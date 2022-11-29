// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IMiningPool.sol";
import "./interfaces/IStakeManager.sol";
import "./interfaces/IStakeMigrator.sol";
import "../token/interfaces/IToken.sol";
import "../token/interfaces/ITokenEmitter.sol";
import "../utils/boring-solidity/BoringBatchable.sol";
import "../utils/lending/LendingPool.sol";

/// @notice A staking / mining pool for receiving Rara by staking LP tokens.
/// The supply of Rara is governed by a RaraEmitter; Rara provided by the emitter
/// into this pool is then distributed to staking pools according to their
/// alloction points, and within the pools according to the user's stake size.
pragma solidity ^0.8.0;
contract RaraMiningPool is IMiningPool, BoringBatchable, LendingPool {
    using SafeERC20 for IERC20;

    // Role that manages reward pools and burn rates.
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @notice Info of each RMP user.
    /// `amount` LP token amount the user has provided.
    /// `rewardDebt` The amount of RARA entitled to the user.
    struct UserInfo {
        uint256 amount;
        int256 rewardDebt;
    }

    /// @notice Info of each RMP pool.
    /// `allocPoint` The amount of allocation points assigned to the pool.
    /// Also known as the amount of RARA to distribute per block.
    struct PoolInfo {
        uint256 accRaraPerShare;
        uint256 lastRewardBlockRetainedRara;
        uint256 lastRewardBlock;
        uint256 allocPoint;
    }

    /// @notice Address of RARA token contract.
    IToken public immutable rara;
    uint256 public raraReceived;
    uint256 public raraRetained;
    uint256 public raraMined;
    /// @notice Address of RARA emitter.
    ITokenEmitter public immutable emitter;
    // @notice The migrator contract. It has a lot of power. Can only be set through governance (owner).
    IStakeMigrator public migrator;

    /// @notice Info of each RMP pool.
    PoolInfo[] public poolInfo;
    /// @notice Shares of the pool staked.
    uint256[] public poolShares;
    /// @notice Address of the LP token for each RMP pool.
    IERC20[] public lpToken;
    /// @notice Address of each `IStakeManager` contract in RMP.
    IStakeManager[] public override stakeManager;

    /// @notice Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    /// @dev Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    /// @dev Total staked allocation points. Must be the sum of all allocation points in all pools with nonzero stake.
    uint256 public totalStakedAllocPoint;

    /// @notice Rara accumulates, but cannot be harvested before this block
    uint256 public unlockBlock;

    /// @notice Burn quantity (numerator of a fraction)
    uint256 public burnNumerator;
    /// @notice Burn quantity (denominator of a fraction)
    uint256 public burnDenominator;
    /// @notice Burn address (address to receive burned Rara -- 0x0 default)
    address public burnAddress;

    uint256 private constant PRECISION = 1e20;

    /// @param _rara The RaraToken address
    /// @param _emitter The RaraEmitter address
    constructor(IToken _rara, ITokenEmitter _emitter, uint256 _unlockBlock) {
        rara = _rara;
        emitter = _emitter;
        unlockBlock = _unlockBlock;

        // start with a 5% burn
        burnNumerator = 5;
        burnDenominator = 100;

        // set up roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/remove pools
    }

    /// @notice Returns the number of RMP pools.
    function poolLength() public override view returns (uint256 pools) {
        pools = poolInfo.length;
    }

    /// @notice Add a new LP to the pool.
    /// Performs safety checks and data-integrity operations; this increases
    /// in complexity and will become unusable if the total number of pools
    /// grows. Switch to batch-execution of {updatePool} and {unsafeAdd} at that point.
    /// @param _allocPoint AP of the new pool.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _stakeManager Address of the stake manager.
    function add(uint256 _allocPoint, IERC20 _lpToken, IStakeManager _stakeManager) public override {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to add");

        // note: becomes progressively more expensive, nigh unusable as pools
        // are added. Switch to batch operations with {unsafeAdd}.
        claimFromEmitter();
        uint256 len = poolInfo.length;
        for (uint256 i = 0; i < len; i++) {
            if (poolInfo[i].allocPoint > 0) {
                updatePool(i);
            }
        }
        _add(_allocPoint, _lpToken, _stakeManager);
    }

    /// @notice Update the given pool's Rara allocation point and `IStakeManager`.
    /// Performs safety checks and data-integrity operations; this increases
    /// in complexity and will become unusable if the total number of pools
    /// grows. Switch to batch-execution of {updatePool} and {unsafeSet} at that point.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _allocPoint New AP of the pool.
    /// @param _stakeManager Address of the stake manager.
    /// @param overwrite True if _stakeManager should be `set`. Otherwise `_stakeManager` is ignored.
    function set(uint256 _pid, uint256 _allocPoint, IStakeManager _stakeManager, bool overwrite) public override {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to set");
        require(_pid <= poolInfo.length, "RaraMiningPool: no such pid");

        // note: becomes progressively more expensive, nigh unusable as pools
        // are added. Switch to batch operations with {unsafeSet}.
        claimFromEmitter();
        uint256 len = poolInfo.length;
        for (uint256 i = 0; i < len; i++) {
            if (poolInfo[i].allocPoint > 0 || i == _pid) {
                updatePool(i);
            }
        }
        _set(_pid, _allocPoint, _stakeManager, overwrite);
    }

    /// @notice Safely update the Rara burn rate.
    /// @param _numerator The share of emitted Rara to burn
    /// @param _denominator The share of all Rara out of which {_numerator} is burned.
    /// e.g. _numerator = 5, _denominator = 100 will burn 5%.
    /// @param _burnAddress Address of the burner; the indicated Rara proportion will
    /// be transferred here (e.g. 0x0).
    /// @param overwrite True if the _burnAddress should be set. Otherwise, `_burnAddress` is ignored.
    function setBurnRate(uint256 _numerator, uint256 _denominator, address _burnAddress, bool overwrite) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to setBurnRate");

        // altering burn rates changes Rara calculations; claim first
        claimFromEmitter();
        _setBurnRate(_numerator, _denominator, _burnAddress, overwrite);
    }

    /// @notice Unsafely add a new LP to the pool. Use in a batch after updating
    /// active pools.
    /// DO NOT add without {claimFromEmitter} and updating active pools. Rewards will be messed up if you do.
    /// @param _allocPoint AP of the new pool.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _stakeManager Address of the stack manager.
    function unsafeAdd(uint256 _allocPoint, IERC20 _lpToken, IStakeManager _stakeManager) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to unsafeAdd");
        _add(_allocPoint, _lpToken, _stakeManager);
    }

    /// @notice Unsafely update the given pool's Rara allocation point and `IStakeManager`.
    /// DO NOT call without {claimFromEmitter} and updating active pools. Rewards will be messed up if you do.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _allocPoint New AP of the pool.
    /// @param _stakeManager Address of the stake manager.
    /// @param overwrite True if _stakeManager should be `set`. Otherwise `_stakeManager` is ignored.
    function unsafeSet(uint256 _pid, uint256 _allocPoint, IStakeManager _stakeManager, bool overwrite) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to unsafeSet");
        _set(_pid, _allocPoint, _stakeManager, overwrite);
    }

    /// @notice Unsafely update the Rara burn rate.
    /// DO NOT call this function except as a batch starting with {claimFromEmitter}.
    /// @param _numerator The share of emitted Rara to burn
    /// @param _denominator The share of all Rara out of which {_numerator} is burned.
    /// e.g. _numerator = 5, _denominator = 100 will burn 5%.
    /// @param _burnAddress Address of the burner; the indicated Rara proportion will
    /// be transferred here (e.g. 0x0).
    /// @param overwrite True if the _burnAddress should be set. Otherwise, `_burnAddress` is ignored.
    function unsafeSetBurnRate(uint256 _numerator, uint256 _denominator, address _burnAddress, bool overwrite) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to unsafeSetBurnRate");
        _setBurnRate(_numerator, _denominator, _burnAddress, overwrite);
    }

    /// @notice Add a new LP to the pool.
    /// DO NOT add without updating active pools. Rewards will be messed up if you do.
    /// @param _allocPoint AP of the new pool.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _stakeManager Address of the stake manager.
    function _add(uint256 _allocPoint, IERC20 _lpToken, IStakeManager _stakeManager) internal {
        uint256 lastRewardBlock = block.number;
        uint256 retained = totalRetained();
        totalAllocPoint = totalAllocPoint + _allocPoint;
        lpToken.push(_lpToken);
        stakeManager.push(_stakeManager);

        poolInfo.push(PoolInfo({
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            lastRewardBlockRetainedRara: retained,
            accRaraPerShare: 0
        }));
        poolShares.push(0);
        emit PoolAdd(lpToken.length - 1, _allocPoint, _lpToken, _stakeManager);
    }

    /// @dev Update the given pool's Rara allocation point and `IStakeManager`.
    /// DO NOT call without updating active pools, INCLUDING this one.
    /// Rewards will be messed up if you do.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _allocPoint New AP of the pool.
    /// @param _stakeManager Address of the stake manager.
    /// @param overwrite True if _stakeManager should be `set`. Otherwise `_stakeManager` is ignored.
    function _set(uint256 _pid, uint256 _allocPoint, IStakeManager _stakeManager, bool overwrite) internal {
        totalAllocPoint = totalAllocPoint + _allocPoint - poolInfo[_pid].allocPoint;
        if (poolShares[_pid] > 0) {
          totalStakedAllocPoint = totalStakedAllocPoint + _allocPoint - poolInfo[_pid].allocPoint;
        }
        poolInfo[_pid].allocPoint = _allocPoint;
        if (overwrite) { stakeManager[_pid] = _stakeManager; }
        emit PoolSet(_pid, _allocPoint, overwrite ? _stakeManager : stakeManager[_pid], overwrite);
    }

    /// @dev Update the Rara burn rate.
    /// DO NOT call without claiming any emitted Rara. Rewards will be messed up if you do.
    /// @param _numerator The share of emitted Rara to burn
    /// @param _denominator The share of all Rara out of which {_numerator} is burned.
    /// e.g. _numerator = 5, _denominator = 100 will burn 5%.
    /// @param _burnAddress Address of the burner; the indicated Rara proportion will
    /// be transferred here (e.g. 0x0).
    /// @param overwrite True if the _burnAddress should be set. Otherwise, `_burnAddress` is ignored.
    function _setBurnRate(uint256 _numerator, uint256 _denominator, address _burnAddress, bool overwrite) internal {
        require(_denominator > 0, "RaraMiningPool: burn rate denominator must be non-zero");
        require(_numerator <= _denominator, "RaraMiningPool: burn rate numerator must be <= denominator");
        require(_numerator <= PRECISION &&  _denominator <= PRECISION, "RaraMiningPool: burn rate precision too high");

        burnNumerator = _numerator;
        burnDenominator = _denominator;
        if (overwrite) { burnAddress = _burnAddress; }
    }

    /// @notice Set the `migrator` contract. Can only be called by the manager.
    /// @param _migrator The contract address to set.
    function setMigrator(IStakeMigrator _migrator) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to setMigrator");
        migrator = _migrator;
    }

    /// @notice Migrate LP token to another LP contract through the `migrator` contract.
    /// @param _pid The index of the pool. See `poolInfo`.
    function migrate(uint256 _pid) public {
        require(address(migrator) != address(0), "RareMiningPool: no migrator set");
        IERC20 _lpToken = lpToken[_pid];
        uint256 bal = _lpToken.balanceOf(address(this));
        _lpToken.approve(address(migrator), bal);
        IERC20 newLpToken = migrator.migrate(_lpToken);
        require(bal == newLpToken.balanceOf(address(this)), "RareMiningPool: migrated balance must match");
        lpToken[_pid] = newLpToken;
    }

    /// @notice Set the `unlockBlock`; the block after which mined Rara can be
    /// harvested. Can only be called by the manager, and only before the
    /// current unlockBlock.
    /// @param _block The block at which to unlock harvesting.
    function setUnlockBlock(uint256 _block) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to setUnlockBlock");
        require(block.number < unlockBlock, "RaraMiningPool: no setUnlockBlock after unlocked");
        unlockBlock = _block;
    }

    /// @notice View function to see pending Rara on frontend.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _user Address of user.
    /// @return pending Rara reward for a given user.
    function pendingReward(uint256 _pid, address _user) external override view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRaraPerShare = pool.accRaraPerShare;
        uint256 lpSupply = poolShares[_pid];
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 rewardSince = totalRetained() - pool.lastRewardBlockRetainedRara;
            uint256 poolReward = (rewardSince * pool.allocPoint) / totalAllocPoint;

            accRaraPerShare = accRaraPerShare + (poolReward * PRECISION) / lpSupply;
        }
        pending = uint256(int256((user.amount * accRaraPerShare) / PRECISION) - user.rewardDebt);
    }

    // total received: actual amount emitted
    // total retained: actual amount after ~5% burn
    // total mined: portion of retain coins allocated to populated pools

    /// @notice Calculates and returns the total Rara mined in the lifetime of
    /// this contract (including Rara that this contract burned)
    function totalReceived() public override view returns (uint256 amount) {
        uint256 owed = emitter.owed(address(this));
        amount = raraReceived + owed;
    }

    function totalRetained() public override view returns (uint256 amount) {
        amount = raraRetained;
        uint256 owed = emitter.owed(address(this));
        uint256 burn = (owed * burnNumerator) / burnDenominator;
        amount += owed - burn;
    }

    function totalMined() public override view returns (uint256 amount) {
        amount = raraMined;
        if (totalStakedAllocPoint != 0) {
          uint256 owed = emitter.owed(address(this));
          uint256 burn = (owed * burnNumerator) / burnDenominator;
          amount += ((owed - burn) * totalStakedAllocPoint) / totalAllocPoint;
        }
    }

    /// @notice Claim any Rara owed from the emitter, transferring it into this
    /// contract. Called by this contract as-needed to fulfill Rara harvests,
    /// but can be triggered from outside to square accounts.
    function claimFromEmitter() public {
        if (emitter.owed(address(this)) > 0) {
            uint256 claimed = emitter.claim(address(this));
            raraReceived = raraReceived + claimed;

            uint256 burned = (claimed * burnNumerator) / burnDenominator;
            uint256 retained = claimed - burned;
            raraRetained = raraRetained + retained;

            uint256 mined = 0;
            if (totalStakedAllocPoint != 0) {
              mined = ((claimed - burned) * totalStakedAllocPoint) / totalAllocPoint;
              raraMined = raraMined + mined;
            }

            if (burned != 0) {  // destroy coins explicitly burned, possibly sending to an address
                _burnRara(burnAddress, burned);
            }
            if (retained > mined) { // destroy coins "mined" for unstaked pools (really destroy)
                _burnRara(address(0), retained - mined);
            }
        }
    }

    /// @notice Update reward variables for all pools. Be careful of gas spending!
    /// @param pids Pool IDs of all to be updated. Make sure to update all active pools.
    function massUpdatePools(uint256[] calldata pids) external {
        uint256 len = pids.length;
        for (uint256 i = 0; i < len; ++i) {
            updatePool(pids[i]);
        }
    }

    /// @notice Update reward variables of the given pool.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @return pool Returns the pool that was updated.
    function updatePool(uint256 pid) public returns (PoolInfo memory pool) {
        pool = poolInfo[pid];
        if (block.number > pool.lastRewardBlock) {
            uint256 lpSupply = poolShares[pid];
            uint256 retained = totalRetained();
            if (lpSupply > 0) {
                uint256 retainedSince = retained - pool.lastRewardBlockRetainedRara;
                uint256 poolReward = (retainedSince * pool.allocPoint) / totalAllocPoint;

                pool.accRaraPerShare = pool.accRaraPerShare + ((poolReward * PRECISION) / lpSupply);
            }
            pool.lastRewardBlock = block.number;
            pool.lastRewardBlockRetainedRara = retained;
            poolInfo[pid] = pool;
            emit PoolUpdate(pid, pool.lastRewardBlock, pool.lastRewardBlockRetainedRara, lpSupply, pool.accRaraPerShare);
        }
    }

    /// @notice Deposit LP tokens to RMP for RARA allocation.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param amount LP token amount to deposit.
    /// @param to The receiver of `amount` deposit benefit.
    function deposit(uint256 pid, uint256 amount, address to) public override {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][to];

        // Effects
        if (poolShares[pid] == 0) {
            claimFromEmitter();
            totalStakedAllocPoint = totalStakedAllocPoint + pool.allocPoint;
        }
        user.amount = user.amount + amount;
        user.rewardDebt = user.rewardDebt + int256((amount * pool.accRaraPerShare) / PRECISION);
        poolShares[pid] = poolShares[pid] + amount;

        // Transfer funds: handled either by the manager, or this contract.
        IERC20 token = lpToken[pid];
        IStakeManager _manager = stakeManager[pid];
        if (address(_manager) == address(0) || !_manager.onStakeDeposit(
            pid,
            token,
            msg.sender,
            to,
            amount,
            user.amount
        )) {
            token.safeTransferFrom(msg.sender, address(this), amount);
        }

        emit Deposit(msg.sender, pid, amount, to);
    }

    /// @notice Withdraw LP tokens from RMP.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param amount LP token amount to withdraw.
    /// @param to Receiver of the LP tokens.
    function withdraw(uint256 pid, uint256 amount, address to) public override {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];

        // Effects
        if (poolShares[pid] == amount) {
            claimFromEmitter();
            totalStakedAllocPoint = totalStakedAllocPoint - pool.allocPoint;
        }
        user.rewardDebt = user.rewardDebt - int256((amount * pool.accRaraPerShare) / PRECISION);
        user.amount = user.amount - amount;
        poolShares[pid] = poolShares[pid] - amount;

        // Transfer funds: handled either by the manager, or this contract.
        IERC20 token = lpToken[pid];
        IStakeManager _manager = stakeManager[pid];
        if (address(_manager) == address(0) || !_manager.onStakeWithdraw(
            pid,
            token,
            msg.sender,
            to,
            amount,
            user.amount
        )) {
            token.safeTransfer(to, amount);
        }

        emit Withdraw(msg.sender, pid, amount, to);
    }

    /// @notice Harvest proceeds for transaction sender to `to`.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param to Receiver of RARA rewards.
    function harvest(uint256 pid, address to) public override {
        require(block.number >= unlockBlock, "RaraMiningPool: no harvest before unlockBlock");
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];
        int256 accumulatedRara = int256((user.amount * pool.accRaraPerShare) / PRECISION);
        uint256 _pendingRara = uint256(accumulatedRara - user.rewardDebt);

        // Effects
        user.rewardDebt = accumulatedRara;

        // Transfer rewards: handled either by the manager, or this contract.
        IERC20 token = lpToken[pid];
        IStakeManager _manager = stakeManager[pid];
        if (address(_manager) == address(0) || !_manager.onRewardHarvest(
            pid,
            token,
            msg.sender,
            to,
            _pendingRara,
            user.amount
        )) {
            if (_pendingRara != 0) {
                _transferRara(to, _pendingRara);
            }
        }

        emit Harvest(msg.sender, pid, _pendingRara);
    }

    /// @notice Withdraw LP tokens from RMP and harvest proceeds for transaction sender to `to`.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param amount LP token amount to withdraw.
    /// @param to Receiver of the LP tokens and RARA rewards.
    function withdrawAndHarvest(uint256 pid, uint256 amount, address to) public override {
        require(block.number >= unlockBlock, "RaraMiningPool: no harvest before unlockBlock");
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];
        uint256 _pendingLp = amount;
        int256 accumulatedRara = int256((user.amount * pool.accRaraPerShare) / PRECISION);
        uint256 _pendingRara = uint256(accumulatedRara - user.rewardDebt);
        uint256 _previousLp = user.amount;

        // Effects
        if (poolShares[pid] == amount) {
            claimFromEmitter();
            totalStakedAllocPoint = totalStakedAllocPoint - pool.allocPoint;
        }
        user.rewardDebt = accumulatedRara - int256((amount * pool.accRaraPerShare) / PRECISION);
        user.amount = user.amount - amount;
        poolShares[pid] = poolShares[pid] - amount;

        // Interactions
        IERC20 token = lpToken[pid];
        IStakeManager _manager = stakeManager[pid];
        if (address(_manager) != address(0)) {
            if (_manager.onRewardHarvest(pid, token, msg.sender, to, _pendingRara, _previousLp)) {
                _pendingRara = 0;
            }
            if (_manager.onStakeWithdraw(pid, token, msg.sender, to, _pendingLp, user.amount)) {
                _pendingLp = 0;
            }
        }
        if (_pendingRara != 0) { _transferRara(to, _pendingRara); }
        if (_pendingLp != 0) { token.safeTransfer(to, _pendingLp); }

        emit Harvest(msg.sender, pid, _pendingRara);
        emit Withdraw(msg.sender, pid, amount, to);
    }

    /// @dev Transfer the indicated Rara to the indicated recipient, or as
    /// much of it as possible. Will automatically claim Rara from the
    /// emitter if necessary.
    function _transferRara(address _to, uint256 _amount) internal {
        uint256 raraBal = rara.balanceOf(address(this));
        if (_amount > raraBal) {
            claimFromEmitter();
            raraBal = rara.balanceOf(address(this));
        }

        if (_amount > raraBal) {
            rara.transfer(_to, raraBal);
        } else {
            rara.transfer(_to, _amount);
        }
    }

    function _burnRara(address _to, uint _amount) internal {
        if (_to == address(0)) {
            rara.burn(_amount);
        } else {
            rara.transfer(burnAddress, _amount);
        }
    }
}
