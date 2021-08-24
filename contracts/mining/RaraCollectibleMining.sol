// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "../token/interfaces/IToken.sol";
import "../token/interfaces/ITokenEmitter.sol";
import "../utils/boring-solidity/BoringBatchable.sol";

interface RCMToken {
  function ownerOf(uint256 tokenId) external view returns (address);
  function tokenType(uint256 tokenId) external view returns (uint256);
  function massTransferFrom(address from, address to, uint256[] calldata tokenId) external;
  function massBurnFrom(address from, uint256[] calldata tokenId) external;
}

interface RCMRegistry {
  function getCurrentLevel(address user) external view returns (uint256);
  function getPriorLevel(address user, uint256 blockNumber) external view returns (uint256);
}

pragma solidity ^0.8.0;
contract RaraCollectibleMining is AccessControlEnumerable, BoringBatchable {
    uint256 private constant MAX_256 = 2**256 - 1;

    // Role that manages reward rates
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @notice Info of each RCM user.
    /// Each staking period requires users to reactivate their staked
    /// tokens; if they do not, their mining power for that period is
    /// zero. Because of this, we can't use a rolling reward accumulation
    /// with "rewardDebt". Instead, each period's mined reward and total stake
    /// is stored by the first transaction after the end of period; this lets
    /// us calculate the reward owed to a user for the most recent activation
    /// period they participated in, regardless of how much later their next
    /// transaction occurs.
    struct UserInfo {
        uint256 activatedPower;
        uint256 activationPeriod;
        uint256 accumulatedRewardPrec;
        uint256 harvestedReward;
    }

    struct PoolInfo {
        address token;        // the token address
        uint256 tokenPower;   // per-token, mining power

        bool stakeIsTyped;        // whether to consider token type (or just "any token")
        uint256 stakeTokenType;   // the "type" of token to be staked

        address activationToken;  // token paid to "activate"
        uint256 activationAmount; // amount of activation token paid to "activate" one staked token
        bool activationIsTyped;   // activation token is typed
        uint256 activationTokenType;
    }

    struct TokenInfo {
        uint256 poolId;
        address owner;
        uint256 ownerTokenIndex;
        bool staked;    // has it ever been staked? (to see if _currently_ staked, check owner)
        uint256 activatedPower;
        uint256 activationPeriod;
    }

    struct PeriodInfo {
        uint256 power;
        uint256 reward;
        uint256 startBlock;
        uint256 endBlock;
        uint256 initTime;
        uint256 startTime;
        uint256 endTime;
    }

    /// @notice Address of RARA token contract.
    IToken public immutable rara;
    uint256 public totalReceived;
    uint256 public totalRetained;
    uint256 public totalMined;
    uint256 public totalHarvested;

    /// @notice Address of RARA emitter.
    ITokenEmitter public immutable emitter;
    /// @notice Address of voting level registry (provides power multipliers)
    address public registry;

    /// @notice Info of each RCM pool.
    PoolInfo[] public poolInfo;

    /// @notice Info of each user (not divided between pools)
    mapping (address => UserInfo) public userInfo;

    /// @notice Info of each token by address and ID
    mapping (address => mapping (uint256 => TokenInfo)) public tokenInfo;

    /// @notice Info on mining periods. We attempt mining over a timeframe, but
    /// because we can only actually change periods during a transaction, we mark
    /// these events by blocks.
    PeriodInfo[] public periodInfo;
    uint256 public currentPeriod;
    uint256 public currentPeriodStartTime;
    uint256 public periodDuration;
    uint256 public periodAnchorTime;  // @notice period transitions occur in fixed time-increments from this moment

    /// @notice Enemurability for tokens staked by user into pools.
    /// For pool p, user u, poolUserTokenIndex[p][u].length gives the number of
    /// tokens invested, and poolUserTokenIndex[p][u][i] the tokenId of the 'i'th
    /// such token. This `tokenId` can be used in tokenInfo[tAddress][tokenId].
    mapping (uint256 => mapping (address => uint256[])) public poolUserTokenIndex;

    /// @notice Rara accumulates, but cannot be harvested before this block
    uint256 public unlockBlock;

    /// @notice Burn quantity (numerator of a fraction)
    uint256 public burnNumerator;
    /// @notice Burn quantity (denominator of a fraction)
    uint256 public burnDenominator;
    /// @notice Burn address (address to receive burned Rara -- 0x0 default)
    address public burnAddress;

    uint256 private constant PRECISION = 1e20;

    event Deposit(uint256 indexed pid, address user, address indexed to, uint256 indexed tokenId, uint256 periodId);
    event Activation(uint256 indexed pid, address user, address indexed to, uint256 indexed tokenId, uint256 periodId, uint256 power);
    event Withdraw(uint256 indexed pid, address user, address indexed to, uint256 indexed tokenId, uint256 periodId);

    event Harvest(address indexed user, address indexed to, uint256 periodId, uint256 amount);

    event PeriodStart(uint256 indexed periodId, uint256 reward, uint256 startTime, uint256 initTime);
    event PeriodEnd(uint256 indexed periodId, uint256 power, uint256 reward, uint256 startBlock, uint256 endBlock, uint256 startTime, uint256 initTime, uint256 endTime);
    event PeriodDurationUpdate(uint256 duration, uint256 anchor);

    event PoolAdd(uint256 indexed pid, address indexed token, bool typed, uint256 tokenType);
    event PoolUpdate(uint256 indexed pid, uint256 power);
    event PoolActivationUpdate(uint256 indexed pid, address indexed token, uint256 amount, bool typed, uint256 tokenType);

    /// @param _rara The RaraToken address
    /// @param _emitter The RaraEmitter address
    constructor(IToken _rara, ITokenEmitter _emitter, uint256 _unlockBlock) {
        rara = _rara;
        emitter = _emitter;
        unlockBlock = _unlockBlock;

        // start with a 0% burn
        burnNumerator = 0;
        burnDenominator = 100;

        // start with daily periods
        periodDuration = 60 * 60 * 24;


        // set up roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/remove pools
    }

    /// @notice Returns the number of RMP pools.
    function poolLength() external view returns (uint256 pools) {
        pools = poolInfo.length;
    }

    function periodLength() external view returns (uint256 periods) {
        periods = periodInfo.length;
    }

    function poolUserTokenCount(uint256 _pid, address _owner) external view returns (uint256 count) {
        count =  poolUserTokenIndex[_pid][_owner].length;
    }

    function setRegistry(address _registry) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to setRegistry");
        registry = _registry;
    }

    function setPeriod(uint256 _duration, uint256 _anchor) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to setPeriod");
        require(_duration > 0, "RaraCollectibleMining: duration must be nonzero");
        periodDuration = _duration;
        periodAnchorTime = _anchor;
        emit PeriodDurationUpdate(_duration, _anchor);

        // might have updated period / transitioned to a new one.
        if (periodInfo.length > 0) {
            updatePeriod();
        }
    }

    /// @notice Add a new collectible token to the pool.
    /// @param _token Address of the ERC-721 token
    /// @param _tokenPower The amount of mining hashpower granted for instance of this token
    /// @param _typed Whether this token is typed (IERC721Collectible) *AND* a particular type is of interest,
    /// i.e. if a particular {tokenType} must be deposited to earn any Rara.
    /// @param _tokenType If `_typed`, this is the {tokenType} which must be deposited.
    function addPool(address _token, uint256 _tokenPower, bool _typed, uint256 _tokenType) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to addPool");
        require(_token != address(0), "RaraCollectibleMining: token must be non-zero address");

        // hash power is additive, not proportional between pools, so adding a
        // new pool does not affect the payouts of other "pools" (pool is just a
        // shorthand to refer to staked and activation token parameters).
        // there's no need to update anything as a result.
        uint256 pid = poolInfo.length;
        poolInfo.push(PoolInfo({
            token: _token,
            tokenPower: _tokenPower,

            stakeIsTyped: _typed,
            stakeTokenType:  _tokenType,

            activationToken: address(0),
            activationAmount: 0,
            activationIsTyped: false,
            activationTokenType: 0
        }));

        emit PoolAdd(pid, _token, _typed, _tokenType);
        emit PoolUpdate(pid, _tokenPower);
    }

    /// @notice Update the given pool's tokenPower: the amount of mining hashpower
    /// generated by a single activated token.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _tokenPower Mining hashpower of a single activated token instance.
    function setPoolPower(uint256 _pid, uint256 _tokenPower) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to setPoolPower");
        require(_pid < poolInfo.length, "RaraCollectibleMining: no such pid");

        // affects all _future_ activations of tokens in this pool, but is not
        // retroactive to already-active ones. They can be withdrawn, re-deposited,
        // and activated to get this new power, or the user can just wait until the
        // period ends and then activatate them again.
        poolInfo[_pid].tokenPower = _tokenPower;
        emit PoolUpdate(_pid, _tokenPower);
    }

    /// @notice Update the given pool's activation requirements: the type of token,
    /// and quantity, which must be provided to "activate" one instance of the
    /// staked token. Also sets the resulting mining hashpower generated by a
    /// single activated token.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _power Mining hashpower of a single activated token instance.
    /// @param _token Token address of the "activation" token which must be burned
    /// to activate a staked token.
    /// @param _amount The number of the "activation" token which must be burned.
    /// @param _typed Whether the activation token implements IERC721Collectible
    /// *AND* a particular {tokenType} must be burned.
    /// @param _tokenType if `_typed`, the {tokenType} which must be burned.
    function setPoolActivation(
        uint256 _pid,
        uint256 _power,
        address _token,
        uint256 _amount,
        bool _typed,
        uint256 _tokenType
    ) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to setPoolActivation");
        require(_pid < poolInfo.length, "RaraCollectibleMining: no such pid");
        require(_amount == 0 || _token != address(0), "RaraCollectibleMining: non-zero token amount of zero-address token");

        PoolInfo storage pool = poolInfo[_pid];
        pool.activationToken = _token;
        pool.activationAmount = _amount;
        pool.activationIsTyped = _typed;
        pool.activationTokenType = _tokenType;

        if (_power != pool.tokenPower) {
            pool.tokenPower = _power;
            emit PoolUpdate(_pid, _power);
        }
        emit PoolActivationUpdate(_pid, _token, _amount, _typed, _tokenType);
    }

    /// @notice Safely update the Rara burn rate.
    /// @param _numerator The share of emitted Rara to burn
    /// @param _denominator The share of all Rara out of which {_numerator} is burned.
    /// e.g. _numerator = 5, _denominator = 100 will burn 5%.
    /// @param _burnAddress Address of the burner; the indicated Rara proportion will
    /// be transferred here (e.g. 0x0).
    /// @param overwrite True if the _burnAddress should be set. Otherwise, `_burnAddress` is ignored.
    function setBurnRate(uint256 _numerator, uint256 _denominator, address _burnAddress, bool overwrite) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to setBurnRate");
        require(_denominator > 0, "RaraCollectibleMining: burn rate denominator must be non-zero");
        require(_numerator <= _denominator, "RaraCollectibleMining: burn rate numerator must be <= denominator");
        require(_numerator <= PRECISION && _denominator <= PRECISION, "RaraCollectibleMining: burn rate precision too high");

        // altering burn rates changes Rara calculations; advance period first
        if (periodInfo.length > 0) {
            updatePeriod();
        }

        burnNumerator = _numerator;
        burnDenominator = _denominator;
        if (overwrite) { burnAddress = _burnAddress; }
    }

    /// @notice Set the `unlockBlock`; the block after which mined Rara can be
    /// harvested. Can only be called by the manager, and only before the
    /// current unlockBlock.
    /// @param _block The block at which to unlock harvesting.
    function setUnlockBlock(uint256 _block) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to setUnlockBlock");
        require(block.number < unlockBlock, "RaraCollectibleMining: no setUnlockBlock after unlocked");
        unlockBlock = _block;
    }

    /// @notice View function to see pending Rara on frontend.
    /// @param _user Address of user.
    /// @return pending Rara reward for a given user.
    function pendingReward(address _user) external view returns (uint256 pending) {
        UserInfo storage user = userInfo[_user];
        uint256 pendingPrec = user.accumulatedRewardPrec;

        if (user.activatedPower > 0) {
            uint256 totalReward = 0;
            uint256 totalPower = periodInfo[user.activationPeriod].power;
            if (user.activationPeriod < currentPeriod) {
                // full reward known and recorded
                totalReward = periodInfo[user.activationPeriod].reward;
            } else if (currentPeriodStartTime + periodDuration < block.timestamp) {
                // estimate reward proportionally based on how much would go to this
                // period vs the next and the interim (if any). Use the same
                // calculation as in {updatePeriod}, with one exception: if
                // no time passed do NOT award all to this period (it's a weird
                // edge case that may not ever occur but we never want to
                // _overestimate_ pending reward, especially in a way that may
                // change in the next few blocks).
                PeriodInfo storage period = periodInfo[user.activationPeriod];
                totalReward = period.reward;
                uint256 totalTime = block.timestamp - period.initTime;
                uint256 periodEndTime = currentPeriodStartTime + periodDuration;
                if (totalTime > 0) {  // proportional allocation between periods
                    uint256 totalClaim = _estimateClaim();
                    uint256 endingPeriodTime = periodEndTime - period.initTime;
                    uint256 endAmount = (totalClaim * endingPeriodTime) / totalTime;
                    totalReward += endAmount;
                }
            }

            if (totalPower > 0) {
                pendingPrec += (user.activatedPower * totalReward * PRECISION) / totalPower;
            }
        }

        pending = pendingPrec / PRECISION - user.harvestedReward;
    }

    function _estimateClaim() internal view returns (uint256 amount) {
        amount = emitter.owed(address(this));
        amount -= (amount * burnNumerator) / burnDenominator;
    }

    function _claimFromEmitter() internal returns (uint256 amount) {
        amount = emitter.claim(address(this));
        totalReceived += amount;

        uint256 burned = (amount * burnNumerator) / burnDenominator;
        amount -= burned;
        totalRetained += amount;

        if (burned > 0) {
            _burnRara(burnAddress, burned);
        }
    }

    function periodStartTime(uint256 timestamp, uint256 _duration, uint256 _anchor) public pure returns (uint256) {
        // using periodAnchorTime and periodDuration, determine the appropriate
        // "start time" for a period that includes that timestamp.
        uint256 anchorOffset = _anchor % _duration;
        return ((timestamp - anchorOffset) / _duration) * _duration + anchorOffset;
    }

    /// @notice Initialize the mining process, starting the first Period based
    /// on current settings. Once called, will attempt to record mining periods
    /// continuously (long waits between transactions and/or changes to period
    /// durations may introduce gaps); until this function is called, however, no
    /// deposits are possible.
    function initialize() external returns (PeriodInfo memory period) {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraCollectibleMining: must have MANAGER role to initialize");
        require(periodInfo.length == 0, "RaraCollectibleMining: already initialized");
        currentPeriod = 1;
        currentPeriodStartTime = periodStartTime(block.timestamp, periodDuration, periodAnchorTime);
        uint256 pastPeriodStartTime = currentPeriodStartTime - periodDuration;

        // push 0, to get 0 out of the way
        periodInfo.push(PeriodInfo({
            power: 0,
            reward: 0,
            startBlock: block.number,
            endBlock: block.number,
            initTime: block.timestamp,
            startTime: pastPeriodStartTime,
            endTime: currentPeriodStartTime
        }));

        // push 1, the current starting period
        periodInfo.push(PeriodInfo({
            power: 0,
            reward: 0,
            startBlock: block.number,
            endBlock: 0,
            initTime: block.timestamp,
            startTime: currentPeriodStartTime,
            endTime: 0
        }));

        period = periodInfo[1];
        emit PeriodStart(0, 0, pastPeriodStartTime, block.timestamp);
        emit PeriodEnd(0, 0, 0, block.number, block.number, pastPeriodStartTime, block.timestamp, currentPeriodStartTime);
        emit PeriodStart(0, 0, currentPeriodStartTime, block.timestamp);
    }

    function updatePeriod() public returns (PeriodInfo memory period) {
        require(periodInfo.length > 0, "RaraCollectibleMining: not initialized");
        if (currentPeriodStartTime + periodDuration <= block.timestamp) {
            // time to transition. Finalize existing period, push a new one
            PeriodInfo storage endingPeriod = periodInfo[currentPeriod];
            endingPeriod.endBlock = block.number;
            endingPeriod.endTime = currentPeriodStartTime + periodDuration;

            // note: because period duration and anchor can change, the ending
            // period and the new one may partially overlap or may have a gap
            // in between. In most cases the transition is exact, with
            // endTime matching startTime.
            currentPeriod = periodInfo.length;
            currentPeriodStartTime = periodStartTime(block.timestamp, periodDuration, periodAnchorTime);
            periodInfo.push(PeriodInfo({
                power: 0,
                reward: 0,
                startBlock: block.number,
                endBlock: 0,
                initTime: block.timestamp,
                startTime: currentPeriodStartTime,
                endTime: 0
            }));
            PeriodInfo storage newPeriod = periodInfo[currentPeriod];

            // allocate Rara rewards. Whatever amount is available from the
            // emitter should be divided between the ending period, the new
            // period, and if relevant the unmined interim (that quantity is burned).
            uint256 claimed = _claimFromEmitter();
            uint256 burnAmount = 0;
            // this quantity should be split between the previous period and the
            // next period (or periods, if time is skipped). initTime is the
            // last time an emitter claim was made.

            uint256 totalTime = block.timestamp - endingPeriod.initTime;

            if (totalTime > 0) {  // proportional allocation between periods
                uint256 endingPeriodTime = endingPeriod.endTime - endingPeriod.initTime;
                uint256 currentPeriodTime = block.timestamp - currentPeriodStartTime;
                uint256 interimTime = (endingPeriodTime + currentPeriodTime < totalTime)
                    ? totalTime - (endingPeriodTime + currentPeriodTime)
                    : 0;

                uint256 endAmount = (claimed * endingPeriodTime) / totalTime;
                uint256 interimAmount = (claimed * interimTime) / totalTime;

                // add to rewards / burns
                endingPeriod.reward += endAmount;
                newPeriod.reward += (claimed - (endAmount + interimAmount));
                burnAmount += interimAmount;
            } else {  // weird, but just give it all to the one that ended
                endingPeriod.reward += claimed;
            }

            // if no one staked, nothing is kept
            if (endingPeriod.power == 0) {
                burnAmount += endingPeriod.reward;
                endingPeriod.reward = 0;
            }

            totalMined += endingPeriod.reward;

            // burn any unused
            if (burnAmount > 0) {
                _burnRara(address(0), burnAmount);
            }

            emit PeriodEnd(
                currentPeriod - 1,
                endingPeriod.power,
                endingPeriod.reward,
                endingPeriod.startBlock,
                endingPeriod.endBlock,
                endingPeriod.startTime,
                endingPeriod.initTime,
                endingPeriod.endTime
            );
            emit PeriodStart(
                currentPeriod,
                newPeriod.reward,
                newPeriod.startTime,
                newPeriod.initTime
            );
        }

        period = periodInfo[currentPeriod];
    }

    function _updateUser(address _user) internal returns (UserInfo storage user) {
        user = userInfo[_user];
        if (user.activationPeriod < currentPeriod) {
            // grant share of reward
            uint256 totalReward = periodInfo[user.activationPeriod].reward;
            uint256 totalPower = periodInfo[user.activationPeriod].power;
            if (totalPower > 0) {
                uint256 gainedPrec = (user.activatedPower * totalReward * PRECISION) / totalPower;
                user.accumulatedRewardPrec += gainedPrec;
            }

            user.activatedPower = 0;
            user.activationPeriod = currentPeriod;
        }
    }

    function _powerMultiplier(address _user) internal view returns (uint256 _multiplier) {
        _multiplier = 1;
        if (registry != address(0)) {
            uint256 level = RCMRegistry(registry).getCurrentLevel(_user);
            if (level > 0) {  // Level 1 => 2x.   Level 2 => 4x.   Level 3 => 6x.
                _multiplier = level * 2;
            }
        }
    }

    function deposit(uint256 _pid, address _to, uint256[] calldata tokenIds) external {
        require(_pid < poolInfo.length, "RaraCollectibleMining: invalid pid");

        // always update period and user before making changes
        PoolInfo memory pool = poolInfo[_pid];
        updatePeriod();
        UserInfo storage user = _updateUser(_to);
        uint256 power = pool.tokenPower * _powerMultiplier(_to);

        // check token types
        if (pool.stakeIsTyped) {
            for (uint256 i = 0; i < tokenIds.length; i++) {
                require(
                    RCMToken(pool.token).tokenType(tokenIds[i]) == pool.stakeTokenType,
                    "RaraCollectibleMining: invalid tokenType"
                );
            }
        }

        // transfer ALL tokens (checks for duplicates)
        RCMToken(pool.token).massTransferFrom(msg.sender, address(this), tokenIds);

        // update data
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            TokenInfo storage token = tokenInfo[pool.token][tokenId];

            // store
            token.poolId = _pid;
            token.owner = _to;
            token.ownerTokenIndex =  poolUserTokenIndex[_pid][_to].length;
            poolUserTokenIndex[_pid][_to].push(tokenId);

            // emit
            emit Deposit(_pid, msg.sender, _to, tokenId, currentPeriod);

            // activate
            if (!token.staked) {
                // new tokens are always initially active
                token.staked = true;
                token.activatedPower = power;
                token.activationPeriod = currentPeriod;
                user.activatedPower += power;
                periodInfo[currentPeriod].power += power;

                emit Activation(_pid, msg.sender, _to, tokenId, currentPeriod, power);
            }
        }
    }

    function withdraw(uint256 _pid, address _to, uint256[] calldata tokenIds) external {
        require(_pid < poolInfo.length, "RaraCollectibleMining: invalid pid");

        // always update period and user before making changes
        PoolInfo memory pool = poolInfo[_pid];
        updatePeriod();
        UserInfo storage user = _updateUser(msg.sender);

        // check token pools and owners
        for (uint256 i = 0; i < tokenIds.length; i++) {
            TokenInfo storage token = tokenInfo[pool.token][tokenIds[i]];
            uint256 tokenId = tokenIds[i];
            require(RCMToken(pool.token).ownerOf(tokenId) == address(this), "RaraCollectibleMining: token not staked");
            require(token.poolId == _pid, "RaraCollectibleMining: token not in pool");
            require(token.owner == msg.sender, "RaraCollectibleMining: token not staked by caller");
        }

        // transfer ALL tokens (checks for duplicates)
        RCMToken(pool.token).massTransferFrom(address(this), _to, tokenIds);

        // update inner data
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            TokenInfo storage token = tokenInfo[pool.token][tokenId];

            // deactivate
            if (token.activationPeriod == currentPeriod) {
                // deactivate
                user.activatedPower -= token.activatedPower;
                periodInfo[currentPeriod].power -= token.activatedPower;
                token.activationPeriod = 0;
                token.activatedPower = 0;
            }

            // clear owner
            token.owner = address(0);

            // remove from index
            uint256 rIndex = poolUserTokenIndex[_pid][msg.sender].length - 1;
            uint256 rTokenId = poolUserTokenIndex[_pid][msg.sender][rIndex];

            tokenInfo[pool.token][rTokenId].ownerTokenIndex = token.ownerTokenIndex;
            poolUserTokenIndex[_pid][msg.sender][token.ownerTokenIndex] = rTokenId;
            poolUserTokenIndex[_pid][msg.sender].pop();

            emit Withdraw(_pid, msg.sender, _to, tokenId, currentPeriod);
        }
    }

    function activate(uint256 _pid, uint256[] calldata stakedTokenIds, uint256[] calldata activationTokenIds) external {
        require(_pid < poolInfo.length, "RaraCollectibleMining: invalid pid");

        // always update period before making changes
        PoolInfo memory pool = poolInfo[_pid];
        updatePeriod();

        // check staked token pools and whether held by this contract
        for (uint256 i = 0; i < stakedTokenIds.length; i++) {
            uint256 tokenId = stakedTokenIds[i];
            TokenInfo storage token = tokenInfo[pool.token][tokenId];
            require(RCMToken(pool.token).ownerOf(tokenId) == address(this), "RaraCollectibleMining: token not staked");
            require(token.poolId == _pid, "RaraCollectibleMining: token not in pool");
            require(token.activationPeriod < currentPeriod, "RaraCollectibleMining: token already activated");
        }

        // check activation tokens
        require(
            stakedTokenIds.length * pool.activationAmount == activationTokenIds.length,
            "RaraCollectibleMining: invalid activation token quantity"
        );
        if (pool.activationIsTyped) {
            for (uint256 i = 0; i < activationTokenIds.length; i++) {
                require(
                    RCMToken(pool.activationToken).tokenType(activationTokenIds[i]) == pool.activationTokenType,
                    "RaraCollectibleMining: invalid tokenType"
                );
            }
        }

        // destroy
        if (activationTokenIds.length > 0) {
            RCMToken(pool.activationToken).massBurnFrom(msg.sender, activationTokenIds);
        }

        // update records and grant activation power
        for (uint256 i = 0; i < stakedTokenIds.length; i++) {
            uint256 tokenId = stakedTokenIds[i];
            TokenInfo storage token = tokenInfo[pool.token][tokenId];
            UserInfo storage user = _updateUser(token.owner);

            uint256 power = pool.tokenPower * _powerMultiplier(token.owner);

            token.activatedPower = power;
            token.activationPeriod = currentPeriod;
            user.activatedPower += power;
            periodInfo[currentPeriod].power += power;

            emit Activation(_pid, msg.sender, token.owner, tokenId, currentPeriod, power);
        }
    }

    /// @notice Harvest proceeds for transaction sender to `to`.
    /// @param to Receiver of RARA rewards.
    function harvest(address to) external {
        require(block.number >= unlockBlock, "RaraCollectibleMining: no harvest before unlockBlock");

        updatePeriod();
        UserInfo storage user = _updateUser(msg.sender);

        uint256 accumulatedRara = user.accumulatedRewardPrec / PRECISION;
        uint256 pendingRara = accumulatedRara - user.harvestedReward;

        // Transfer rewards
        if (pendingRara != 0) {
            user.harvestedReward += pendingRara;
            totalHarvested += pendingRara;
            _transferRara(to, pendingRara);
        }

        emit Harvest(msg.sender, to, currentPeriod, pendingRara);
    }

    /// @dev Transfer the indicated Rara to the indicated recipient, or as
    /// much of it as possible. Will automatically claim Rara from the
    /// emitter if necessary.
    function _transferRara(address _to, uint256 _amount) internal {
        uint256 raraBal = rara.balanceOf(address(this));
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
