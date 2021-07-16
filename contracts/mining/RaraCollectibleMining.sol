// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../token/interfaces/IToken.sol";
import "../token/interfaces/ITokenEmitter.sol";
import "../token/interfaces/ITokenCollectionListener.sol";
import "../token/interfaces/IVotingMembershipListener.sol";
import "../utils/boring-solidity/BoringBatchable.sol";

interface RCMToken {
  function balanceOf(address user) external view returns (uint256);
  function valueOf(address user) external view returns (uint256);
}

interface RCMRegistry {
  function getCurrentLevel(address user) external view returns (uint256);
  function getPriorLevel(address user, uint256 blockNumber) external view returns (uint256);
}

pragma solidity ^0.8.0;
contract RaraCollectibleMining is BoringBatchable {
    using SafeERC20 for IERC20;

    uint256 private constant MAX_256 = 2**256 - 1;

    // Role that manages reward rates
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    // Role that can pause/unpause collectible mining (e.g. for an update sweep).
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Info of each RCM user.
    /// `amount` The mining "hashPower" belonging to the user.
    /// `rewardDebt` The amount of RARA entitled to the user.
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    /// @notice Info of each RCM pool.
    /// `allocPoint` The amount of allocation points assigned to the pool.
    /// Also known as the amount of RARA to distribute per block.
    struct PoolInfo {
        uint256 accRaraPerShare;
        uint256 lastRewardBlockRetainedRara;
        uint256 lastRewardBlock;
        uint256 allocPoint;
    }

    struct PoolSources {
        address token;
        bool tokenValued;
        address votingRegistry;
    }

    /// @notice Address of RARA token contract.
    IToken public immutable rara;
    uint256 public raraReceived;
    uint256 public raraRetained;
    uint256 public raraMined;
    uint256 public raraHarvested;
    /// @notice Address of RARA emitter.
    ITokenEmitter public immutable emitter;

    /// @notice Info of each RCM pool.
    PoolInfo[] public poolInfo;
    /// @notice Sources of each RCM pool.
    PoolSources[] public poolSources;
    /// @notice Shares of the pool measured.
    uint256[] public poolShares;
    /// @notice Mapping from tokens to the appropriate Pool PID, for when
    /// updatess come from listener methods (check the msg sender).
    mapping(address => uint256) tokenPid;
    mapping(address => uint256) registryPid;

    /// @notice Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    /// @dev Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    /// @dev Total staked allocation points. Must be the sum of all allocation points in all pools with nonzero stake.
    uint256 public totalStakedAllocPoint;

    /// @notice Rara accumulates, but cannot be harvested before this block
    uint256 public unlockBlock;
    /// @notice The block at which mining was last "paused". When mining is paused,
    /// users cannot accumulate Rara, although their mining hashpower may be
    /// freely updated. Once unpaused, Rara is portioned to them based on
    /// their _current_ hashpower measured from the pauseBlock; i.e. all hashpower
    /// updates during a pause are considered as happening atomically during that
    /// block, regardless of how long the pause actually lasts.
    uint256 public pauseBlock;

    /// @notice Burn quantity (numerator of a fraction)
    uint256 public burnNumerator;
    /// @notice Burn quantity (denominator of a fraction)
    uint256 public burnDenominator;
    /// @notice Burn address (address to receive burned Rara -- 0x0 default)
    address public burnAddress;

    uint256 private constant PRECISION = 1e20;

    event Update(address indexed user, uint256 indexed pid, uint256 amount);
    event Harvest(address indexed user, uint256 indexed pid, address indexed to, uint256 amount);

    event PoolAdd(uint256 indexed pid, uint256 allocPoint, address indexed token, bool tokenValued, address indexed votingRegistry);
    event PoolSet(uint256 indexed pid, uint256 allocPoint);
    event PoolUpdate(uint256 indexed pid, uint256 lastRewardBlock, uint256 lastRewardBlockRetainedRara, uint256 shares, uint256 accRaraPerShare);

    /// @param _rara The RaraToken address
    /// @param _emitter The RaraEmitter address
    constructor(IToken _rara, ITokenEmitter _emitter, uint256 _unlockBlock) {
        rara = _rara;
        emitter = _emitter;
        unlockBlock = _unlockBlock;
        pauseBlock = MAX_256;     // not paused

        // start with a 0% burn
        burnNumerator = 0;
        burnDenominator = 100;

        // set up roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/remove pools
        _setupRole(PAUSER_ROLE, _msgSender());         // pauser; can pause mining
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
    /// @param _token Address of the ERC-20, ERC-721, or ERC-721Valuable token
    /// @param _tokenValued Whether the token should be treated as ERC-721Valuable
    /// with {ownerValue()} used for mining hashpower.
    /// @param _votingRegistry either address 0x00, or an IVotingRegistry used
    /// for hashpower multipliers.
    function add(uint256 _allocPoint, address _token, bool _tokenValued, address _votingRegistry) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to add");
        require(_token != address(0), "RaraCollectibleMining: token must be non-zero address");

        // note: becomes progressively more expensive, nigh unusable as pools
        // are added. Switch to batch operations with {unsafeAdd}.
        claimFromEmitter();
        uint256 len = poolInfo.length;
        for (uint256 i = 0; i < len; i++) {
            if (poolInfo[i].allocPoint > 0) {
                updatePool(i);
            }
        }
        _add(_allocPoint, _token, _tokenValued, _votingRegistry);
    }

    /// @notice Update the given pool's Rara allocation point and `IStakeManager`.
    /// Performs safety checks and data-integrity operations; this increases
    /// in complexity and will become unusable if the total number of pools
    /// grows. Switch to batch-execution of {updatePool} and {unsafeSet} at that point.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _allocPoint New AP of the pool.
    function set(uint256 _pid, uint256 _allocPoint) public override {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to set");
        require(_pid <= poolInfo.length, "RaraCollectibleMining: no such pid");

        // note: becomes progressively more expensive, nigh unusable as pools
        // are added. Switch to batch operations with {unsafeSet}.
        claimFromEmitter();
        uint256 len = poolInfo.length;
        for (uint256 i = 0; i < len; i++) {
            if (poolInfo[i].allocPoint > 0 || i == _pid) {
                updatePool(i);
            }
        }
        _set(_pid, _allocPoint);
    }

    /// @notice Safely update the Rara burn rate.
    /// @param _numerator The share of emitted Rara to burn
    /// @param _denominator The share of all Rara out of which {_numerator} is burned.
    /// e.g. _numerator = 5, _denominator = 100 will burn 5%.
    /// @param _burnAddress Address of the burner; the indicated Rara proportion will
    /// be transferred here (e.g. 0x0).
    /// @param overwrite True if the _burnAddress should be set. Otherwise, `_burnAddress` is ignored.
    function setBurnRate(uint256 _numerator, uint256 _denominator, address _burnAddress, bool overwrite) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to setBurnRate");

        // altering burn rates changes Rara calculations; claim first
        claimFromEmitter();
        _setBurnRate(_numerator, _denominator, _burnAddress, overwrite);
    }

    /// @notice Unsafely add a new LP to the pool. Use in a batch after updating
    /// active pools.
    /// DO NOT add without {claimFromEmitter} and updating active pools. Rewards will be messed up if you do.
    /// @param _allocPoint AP of the new pool.
    /// @param _token Address of the ERC-20, ERC-721, or ERC-721Valuable token
    /// @param _tokenValued Whether the token should be treated as ERC-721Valuable
    /// with {ownerValue()} used for mining hashpower.
    /// @param _votingRegistry either address 0x00, or an IVotingRegistry used
    /// for hashpower multipliers.
    function unsafeAdd(uint256 _allocPoint, address _token, bool _tokenValued, address _votingRegistry) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to unsafeAdd");
        require(_token != address(0), "RaraCollectibleMining: token must be non-zero address");
        _add(_allocPoint, _token, _tokenValued, _votingRegistry);
    }

    /// @notice Unsafely update the given pool's Rara allocation point and `IStakeManager`.
    /// DO NOT call without {claimFromEmitter} and updating active pools. Rewards will be messed up if you do.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _allocPoint New AP of the pool.
    function unsafeSet(uint256 _pid, uint256 _allocPoint) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to unsafeSet");
        _set(_pid, _allocPoint);
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
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to unsafeSetBurnRate");
        _setBurnRate(_numerator, _denominator, _burnAddress, overwrite);
    }

    /// @notice Add a new LP to the pool.
    /// DO NOT add without updating active pools. Rewards will be messed up if you do.
    /// @param _allocPoint AP of the new pool.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _stakeManager Address of the stake manager.
    function _add(uint256 _allocPoint, address _token, bool _tokenValued, address _votingRegistry) internal {
        uint256 lastRewardBlock = _blockNumber();
        uint256 retained = totalRetained();
        totalAllocPoint = totalAllocPoint + _allocPoint;

        uint256 pid = poolInfo.length;

        poolInfo.push(PoolInfo({
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            lastRewardBlockRetainedRara: retained,
            accRaraPerShare: 0
        }));
        poolSources.push(PoolSources({
            token: _token,
            tokenValued: _tokenValued,
            votingRegistry: _votingRegistry
        }));
        poolShares.push(0);

        tokenPid[_token] = pid;
        if (_votingRegistry != address(0)) {
            registryPid[_votingRegistry] = pid;
        }
        emit PoolAdd(pid, _allocPoint, _token, _tokenValued, _votingRegistry);
    }

    /// @dev Update the given pool's Rara allocation point and `IStakeManager`.
    /// DO NOT call without updating active pools, INCLUDING this one.
    /// Rewards will be messed up if you do.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _allocPoint New AP of the pool.
    /// @param _stakeManager Address of the stake manager.
    /// @param overwrite True if _stakeManager should be `set`. Otherwise `_stakeManager` is ignored.
    function _set(uint256 _pid, uint256 _allocPoint) internal {
        totalAllocPoint = totalAllocPoint + _allocPoint - poolInfo[_pid].allocPoint;
        if (poolShares[_pid] > 0) {
          totalStakedAllocPoint = totalStakedAllocPoint + _allocPoint - poolInfo[_pid].allocPoint;
        }
        poolInfo[_pid].allocPoint = _allocPoint;
        emit PoolSet(_pid, _allocPoint);
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

    /// @notice Set the `unlockBlock`; the block after which mined Rara can be
    /// harvested. Can only be called by the manager, and only before the
    /// current unlockBlock.
    /// @param _block The block at which to unlock harvesting.
    function setUnlockBlock(uint256 _block) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to setUnlockBlock");
        require(_blockNumber() < unlockBlock, "RaraMiningPool: no setUnlockBlock after unlocked");
        unlockBlock = _block;
    }

    /**
     * @dev Pauses mining. Mining details may be freely changed (both user hashpower
     * and pool allocation), with no effect on previously earned Rara. When unpaused,
     * proceed as if all changes occurred during {pauseBlock} (i.e. all users receive
     * Rara as if those settings had been in effect for the entire pause duration).
     *
     * See {Pausable-_unpause}.
     *
     * Requirements:
     *
     * - the caller must have the `PAUSER_ROLE`.
     */
    function pause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "RaraCollectibleMining: must have pauser role to pause");
        if (!paused()) {  // pausing twice doesn't step forward; must unpause
            pauseBlock = block.number;  // not _blockNumber() here; use the real block
        }
        _pause();
    }

    /**
     * @dev Unpauses all token transfers.
     *
     * See {ERC20Pausable} and {Pausable-_unpause}.
     *
     * Requirements:
     *
     * - the caller must have the `PAUSER_ROLE`.
     */
    function unpause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "RaraCollectibleMining: must have pauser role to unpause");
        pauseBlock = MAX_256;
        _unpause();
    }

    /// @dev Returns the current block number for mining considerations, which
    /// is <= the actual block number. Use this instead of block.number when
    /// calculating mining output.
    function _blockNumber() internal view returns (uint256) {
        // faster than checking paused(): when not paused pauseBlock is MAX_256.
        return block.number < pauseBlock ? block.number : pauseBlock;
    }

    /// @notice View function to see pending Rara on frontend.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _user Address of user.
    /// @return pending Rara reward for a given user.
    function pendingReward(uint256 _pid, address _user) external override view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRaraPerShare = pool.accRaraPerShare;
        uint256 supply = poolShares[_pid];
        uint256 blockNumber = _blockNumber();
        if (blockNumber > pool.lastRewardBlock && supply != 0) {
            // TODO consider overflow storage bucket?
            uint256 rewardSince = totalRetained() - pool.lastRewardBlockRetainedRara;
            uint256 poolReward = (rewardSince * pool.allocPoint) / totalAllocPoint;

            accRaraPerShare = accRaraPerShare + (poolReward * PRECISION) / supply;
        }
        pending = uint256(int256((user.amount * accRaraPerShare) / PRECISION) - user.rewardDebt);
    }

    function _emissionIncludingSurplus(uint256 _emission) internal view returns (uint256 amount) {
        uint256 surplus = rara.balanceOf(address(this)) + raraHarvested - raraMined;
        return _emission + (surplus > _emission ? _emission : surplus);
    }

    // total received: actual amount emitted
    // total retained: actual amount after ~5% burn
    // total mined: portion of retain coins allocated to populated pools

    /// @notice Calculates and returns the total Rara mined in the lifetime of
    /// this contract (including Rara that this contract burned). Outflow is
    /// determined by the amount received (and owed) from the emitter; if Rara
    /// is transferred into this contract directly, it is distributed 1-to-1
    /// with emitted Rara until exhausted.
    function totalReceived() public override view returns (uint256 amount) {
        uint256 owed = emitter.owed(address(this));
        amount = raraReceived + _emissionIncludingSurplus(owed);
    }

    function totalRetained() public override view returns (uint256 amount) {
        amount = raraRetained;
        uint256 owed = _emissionIncludingSurplus(emitter.owed(address(this)));
        uint256 burn = (owed * burnNumerator) / burnDenominator;
        amount += owed - burn;
    }

    function totalMined() public override view returns (uint256 amount) {
        amount = raraMined;
        if (totalStakedAllocPoint != 0) {
          uint256 owed = _emissionIncludingSurplus(emitter.owed(address(this)));
          uint256 burn = (owed * burnNumerator) / burnDenominator;
          amount += ((owed - burn) * totalStakedAllocPoint) / totalAllocPoint;
        }
    }

    /// @notice Claim any Rara owed from the emitter, transferring it into this
    /// contract. Called by this contract as-needed to fulfill Rara harvests,
    /// but can be triggered from outside to square accounts.
    function claimFromEmitter() public {
        if (emitter.owed(address(this)) > 0) {  // no need to check surplus; output is driven by emitter
            uint256 claimed = _emissionIncludingSurplus(emitter.claim(address(this)));
            raraReceived = raraReceived + claimed;

            uint256 burned = (claimed * burnNumerator) / burnDenominator;
            uint256 retained = claimed - burned;
            raraRetained = raraRetained + retained;

            // TODO include spillover from bucket

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
        uint256 blockNumber = _blockNumber();
        pool = poolInfo[pid];
        if (blockNumber > pool.lastRewardBlock) {
            uint256 s = poolShares[pid];
            uint256 retained = totalRetained();
            if (supply > 0) {
                uint256 retainedSince = retained - pool.lastRewardBlockRetainedRara;
                uint256 poolReward = (retainedSince * pool.allocPoint) / totalAllocPoint;

                pool.accRaraPerShare = pool.accRaraPerShare + ((poolReward * PRECISION) / supply);
            }
            pool.lastRewardBlock = blockNumber;
            pool.lastRewardBlockRetainedRara = retained;
            poolInfo[pid] = pool;
            emit PoolUpdate(pid, pool.lastRewardBlock, pool.lastRewardBlockRetainedRara, supply, pool.accRaraPerShare);
        }
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IVotingMembershipListener).interfaceId
            || interfaceId == type(ITokenCollectionListener).interfaceId
            || super.supportsInterface(interfaceId);
    }

    function tokenCollectionChanged(address _owner) external override {
        // called by a token contract; update the corresponding pool
        address sender = _msgSender();
        uint256 pid = tokenPid[sender];
        PoolSources memory sources = poolSources[pid];
        if (sources.token == sender) {
            PoolInfo memory pool = updatePool(pid);
            _updateUser(pid, pool, sources, _owner);
        }
    }

    function membershipChanged(address _user, uint32 _prevLevel, uint32 _level) external override {
        // called by a voting registry contract; update the corresponding pool
        address sender = _msgSender();
        uint256 pid = registryPid[sender];
        PoolSources memory sources = poolSources[pid];
        if (sources.votingRegistry == sender) {
            PoolInfo memory pool = updatePool(pid);
            _updateUser(pid, pool, sources, _user);
        }
    }

    function update(uint256 pid) external {
        PoolInfo memory pool = updatePool(pid);
        PoolSources memory sources = poolSources[pid];
        _updateUser(pid, pool, sources, msg.sender);
    }

    function updateUsers(uint256 pid, address[] calldata users) external {
        PoolInfo memory pool = updatePool(pid);
        PoolSources memory sources = poolSources[pid];
        for (uint256 i = 0; i < users.length; i++) {
            _updateUser(pid, pool, sources, users[i]);
        }
    }

    function _updateUser(uint256 pid, PoolInfo memory pool, PoolSources memory sources, address owner) internal {
        // determine user share amount
        uint256 value = sources.tokenValued
            ? RCMToken(sources.token).valueOf(user)
            : RCMToken(sources.token).balanceOf(user);
        if (sources.votingRegistry != address(0)) {
            uint256 level = RCMRegistry(sources.votingRegistry).getCurrentLevel();
            if (level > 0) {  // Level 1 => 2x.   Level 2 => 4x.   Level 3 => 6x.
                value = value * level * 2;
            }
        }

        UserInfo storage user = userInfo[owner];

        // Update "staked alloc points"
        uint256 prevPoolShares = poolShares[pid];   // save gas
        if (prevPoolShares == 0 && value > 0) {
            claimFromEmitter();
            totalStakedAllocPoint = totalStakedAllocPoint + poolInfo.allocPoint;
        } else if (prevPoolShares > 0 && prevPoolShares == user.amount && value == 0) {
            claimFromEmitter();
            totalStakedAllocPoint = totalStakedAllocPoint - poolInfo.allocPoint;
        }

        // Update user amount and pool shares
        int256 increase = int256(value) - int256(user.amount);
        poolShares[pid] = poolShares[pid] + value - user.amount;
        user.amount = value;
        user.rewardDebt = user.rewardDebt + (increase * pool.accRaraPerShare) / PRECISION;

        emit Update(owner, pid, value);
    }

    /// @notice Harvest proceeds for transaction sender to `to`.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param to Receiver of RARA rewards.
    function harvest(uint256 pid, address to) public {
        uint256 blockNumber = _blockNumber();
        require(blockNumber >= unlockBlock, "RaraCollectibleMining: no harvest before unlockBlock");
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];
        int256 accumulatedRara = int256((user.amount * pool.accRaraPerShare) / PRECISION);
        uint256 _pendingRara = uint256(accumulatedRara - user.rewardDebt);

        // Effects
        user.rewardDebt = accumulatedRara;

        // Transfer rewards
        if (_pendingRara != 0) {
            _transferRara(to, _pendingRara);
            raraHarvested = raraHarvested + _pendingRara;
        }

        emit Harvest(msg.sender, pid, to, _pendingRara);
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
