pragma solidity ^0.8.0;

import "./interfaces/IVotingMembershipListener.sol";
import "../utils/boring-solidity/IPermitERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

// RaraVotingToken with Governance.
contract RaraVotingToken is Context, AccessControlEnumerable, ERC20Pausable {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IERC20 public rara;
    address public listener;

    constructor(uint256[] memory _requirements, IERC20 _rara, address _listener)
    ERC20("Rara Voting Token", "vRARA") {
        require(_requirements.length > 0, "vRARA::constructor: _requirements must have length > 0");
        require(_requirements[0] == 0, "vRARA::constructor: _requirements[0] must be 0");
        for (uint i = 1; i < _requirements.length; i++) {
            require(_requirements[i - 1] <= _requirements[i], "vRARA::constructor: _requirements elements must monotonically increase");
        }

        require(address(0) == _listener || IVotingMembershipListener(_listener).isVotingMembershipListener(),
            "vRARA::constructor: address must be zero or implement IVotingMembershipListener");

        membershipRequirement = _requirements;
        rara = _rara;
        listener = _listener;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        _setupRole(MANAGER_ROLE, _msgSender());
        _setupRole(PAUSER_ROLE, _msgSender());
    }

    function decimals() public view virtual override returns (uint8) {
        return 8;
    }

    /// @notice Mint the indicated amount of vRARA to the sender. This requires
    /// an equal amount RARA to be locked in the contract; the sender must have
    /// {approve}d the appropriate amount of RARA by this contract.
    function mint(uint256 _amount) external {
        _stakeAndMint(_msgSender(), _amount);
    }

    /// @notice Mint the indicated amount of vRARA to the permit signer (_owner).
    /// The permit provided should be appropriate for running on RARA, _not_
    /// this contract. It is used to approve the transfer of RARA from the owner
    /// into this contract.
    function mintWithPermit(address _owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        require(spender ==  address(this), "vRARA::mintWithPermit: Spender must be Rara Voting Token");
        IPermitERC20(address(rara)).permit(_owner, spender, value, deadline, v, r, s);
        _stakeAndMint(_owner, value);
    }

    function _stakeAndMint(address _to, uint256 _amount) internal {
        uint256 prevBalance  = balanceOf(_to);
        rara.transferFrom(_to, address(this), _amount);
        _mint(_to, _amount);
        _updateMembership(_to, prevBalance, prevBalance + _amount);
    }

    function burn(uint256 _amount) external {
        _burnAndUnstake(_msgSender(), _amount);
    }

    function _burnAndUnstake(address _from, uint256 _amount) internal {
      uint256 prevBalance = balanceOf(_from);
        _burn(_from, _amount);
        _updateMembership(_from, prevBalance, prevBalance - _amount);
        rara.transfer(_from, _amount);
    }

    /**
     * @dev See {ERC20-_beforeTokenTransfer}.
     *
     * Requirements:
     *
     * - vRARA cannot be transferred between wallets
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        require(from == address(0) || to == address(0), "vRARA: transfer between nonzero addresses");
    }

    /**
     * @dev Pauses all token transfers.
     *
     * See {ERC20Pausable} and {Pausable-_pause}.
     *
     * Requirements:
     *
     * - the caller must have the `PAUSER_ROLE`.
     */
    function pause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "vRARA::pause: must have pauser role to pause");
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
        require(hasRole(PAUSER_ROLE, _msgSender()), "vRARA::unpause: must have pauser role to unpause");
        _unpause();
    }

    /**
     * @dev Alter membership requirements; thresholds for the different membership
     * levels. Manager only.
     *
     * Does _not_ alter the membership levels of existing users. Recommended flow:
     * 1. {pause} to prevent changes to account balances
     * 2. {setMembershipRequirement} to alter thresholds
     * 3. {massUpdateMemberships} for all existing members
     * 4. {unpause} to reenable changes
     */
    function setMembershipRequirement(uint256[] calldata _requirements) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "vRARA::setMembershipRequirement: must have manager role to setMembershipRequirement");
        require(_requirements.length > 0, "vRARA::setMembershipRequirement: _requirements must have length > 0");
        require(_requirements[0] == 0, "vRARA::setMembershipRequirement: _requirements[0] must be 0");
        for (uint i = 1; i < _requirements.length; i++) {
            require(_requirements[i - 1] <= _requirements[i], "vRARA::setMembershipRequirement: _requirements elements must monotonically increase");
        }
        membershipRequirement = _requirements;
    }

    /**
     * @dev Update the membershp levels of all listed user addresses by comparing
     * their current vRARA balance against the current membership tiers. If
     * membership requirements haven't changed, this call should have no effect.
     */
    function massUpdateMemberships(address[] calldata _users) external {
        for (uint i = 0; i < _users.length; i++) {
            address user = _users[i];
            uint256 balance = balanceOf(user);
            _updateMembership(user, balance, balance);
        }
    }

    function setVotingMembershipListener(address _listener) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "vRARA::setVotingMembershipListener: must have manager role to setVotingMembershipListener");
        require(address(0) == _listener || IVotingMembershipListener(_listener).isVotingMembershipListener(),
            "vRARA::setVotingMembershipListener: address must be zero or implement IVotingMembershipListener");
        listener = _listener;
    }

    // Membership levels in "vRARA balance". Convention: the first entry
    // must be zero and entries monotonically increase. e.g. at launch,
    // the entries are
    // [0, 3000e8, 50000e8, 500000e8]. One vRARA = one vote, but only if you
    // qualify for level 1. To allow suffrage to all vRARA holders, use
    // [0, 0, ...] so all holders qualify for membership level 1.
    uint256[] public membershipRequirement;

    // User membership. Can't just store a mapping; large-scale updates are
    // necessary when membership requirements change so we provide an iterable
    // array (note: pause and enumerate array entries before altering memberships,
    // since updates can change length and order).
    address[] public members;
    mapping(address => uint256) public membershipIndex;

    event MembershipChanged(address indexed user, uint32 prevLevel, uint32 level);
    event MemberAdded(address indexed user);
    event MemberRemoved(address indexed user);

    // Copied and modified from YAM code:
    // https://github.com/yam-finance/yam-protocol/blob/master/contracts/token/YAMGovernanceStorage.sol
    // https://github.com/yam-finance/yam-protocol/blob/master/contracts/token/YAMGovernance.sol
    // Which is copied and modified from COMPOUND:
    // https://github.com/compound-finance/compound-protocol/blob/master/contracts/Governance/Comp.sol

    /// @dev A record of each accounts delegate
    mapping (address => address) internal _delegates;

    /// @notice A checkpoint for marking number of votes from a given block
    struct Checkpoint {
        uint32 fromBlock;
        uint256 votes;
    }

    struct MembershipCheckpoint  {
        uint32 fromBlock;
        uint32 level;
    }

    /// @notice Total number of votes held by users (usually equivalent to totalSupply,
    /// but in this case does not include vRARA for users below level 1).
    uint256 public totalVotes;

    /// @notice A record of votes checkpoints for each account, by index
    mapping (address => mapping (uint32 => Checkpoint)) public checkpoints;

    /// @notice The number of checkpoints for each account
    mapping (address => uint32) public numCheckpoints;

    /// @notice A record of level checkpoints for each account, by index
    mapping (address => mapping (uint32 => MembershipCheckpoint)) public membershipCheckpoints;

    /// @notice The number of membership checkpoints for each account
    mapping (address => uint32) public numMembershipCheckpoints;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the delegation struct used by the contract
    bytes32 public constant DELEGATION_TYPEHASH = keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    /// @notice A record of states for signing / validating signatures
    mapping (address => uint) public nonces;

      /// @notice An event thats emitted when an account changes its delegate
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);

    /// @notice An event thats emitted when a delegate account's vote balance changes
    event DelegateVotesChanged(address indexed delegate, uint previousBalance, uint newBalance);

    function memberCount() external view returns (uint) {
        return members.length;
    }

    function membershipLevels() external view returns (uint) {
        return membershipRequirement.length;
    }

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegator The address to get delegatee for
     */
    function delegates(address delegator)
        external
        view
        returns (address)
    {
        return _delegates[delegator];
    }

   /**
    * @notice Delegate votes from `msg.sender` to `delegatee`
    * @param delegatee The address to delegate votes to
    */
    function delegate(address delegatee) external whenNotPaused {
        return _delegate(msg.sender, delegatee);
    }

    /**
     * @notice Delegates votes from signatory to `delegatee`
     * @param delegatee The address to delegate votes to
     * @param nonce The contract state required to match the signature
     * @param expiry The time at which to expire the signature
     * @param v The recovery byte of the signature
     * @param r Half of the ECDSA signature pair
     * @param s Half of the ECDSA signature pair
     */
    function delegateBySig(
        address delegatee,
        uint nonce,
        uint expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        external whenNotPaused
    {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(name())),
                getChainId(),
                address(this)
            )
        );

        bytes32 structHash = keccak256(
            abi.encode(
                DELEGATION_TYPEHASH,
                delegatee,
                nonce,
                expiry
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                structHash
            )
        );

        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "vRARA::delegateBySig: invalid signature");
        require(nonce == nonces[signatory]++, "vRARA::delegateBySig: invalid nonce");
        require(block.timestamp <= expiry, "vRARA::delegateBySig: signature expired");
        return _delegate(signatory, delegatee);
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account)
        external
        view
        returns (uint256)
    {
        uint32 nCheckpoints = numCheckpoints[account];
        return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint blockNumber)
        external
        view
        returns (uint256)
    {
        require(blockNumber < block.number, "vRARA::getPriorVotes: not yet determined");

        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }

    function _delegate(address delegator, address delegatee)
        internal
    {
        address currentDelegate = _delegates[delegator];
        _delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        if (getCurrentLevel(delegator) > 0) {
            uint256 delegatorBalance = balanceOf(delegator); // balance of underlying vRARAs (not scaled);
            _moveDelegates(currentDelegate, delegatee, delegatorBalance);
        }
    }

    function _moveDelegates(address srcRep, address dstRep, uint256 amount) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                // decrease old representative
                uint32 srcRepNum = numCheckpoints[srcRep];
                uint256 srcRepOld = srcRepNum > 0 ? checkpoints[srcRep][srcRepNum - 1].votes : 0;
                uint256 srcRepNew = srcRepOld - amount;
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                // increase new representative
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint256 dstRepOld = dstRepNum > 0 ? checkpoints[dstRep][dstRepNum - 1].votes : 0;
                uint256 dstRepNew = dstRepOld + amount;
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    /**
     * @notice Gets the current membership level for `account`
     * @param account The address to get membership level
     * @return The number of the current membership level,
     */
    function getCurrentLevel(address account)
        public
        view
        returns (uint256)
    {
        uint32 nCheckpoints = numMembershipCheckpoints[account];
        return nCheckpoints > 0 ? membershipCheckpoints[account][nCheckpoints - 1].level : 0;
    }

    /**
     * @notice Determine the prior membershp level for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The membership level the account had as of the given block
     */
    function getPriorLevel(address account, uint blockNumber)
        external
        view
        returns (uint256)
    {
        require(blockNumber < block.number, "vRARA::getPriorLevel: not yet determined");

        uint32 nCheckpoints = numMembershipCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (membershipCheckpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return membershipCheckpoints[account][nCheckpoints - 1].level;
        }

        // Next check implicit zero balance
        if (membershipCheckpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            MembershipCheckpoint memory cp = membershipCheckpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.level;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return membershipCheckpoints[account][lower].level;
    }

    function _updateMembership(address rep, uint256 prevBalance, uint256 balance) internal {
        uint32 nCheckpoints = numMembershipCheckpoints[rep];
        uint32 prevLevel = nCheckpoints > 0 ? membershipCheckpoints[rep][nCheckpoints - 1].level : 0;
        uint32 level = 0;
        while (level + 1 < membershipRequirement.length && balance >= membershipRequirement[level + 1]) {
            level = level + 1;
        }

        // update votes
        if (prevLevel != 0 && level != 0) {
            // adjust nonzero delegate votes
            if (prevBalance > balance) {
                uint256 delta = prevBalance - balance;
                _moveDelegates(_delegates[rep], address(0), delta);
                totalVotes = totalVotes - delta;
            } else {
                uint256 delta = balance - prevBalance;
                _moveDelegates(address(0), _delegates[rep], delta);
                totalVotes = totalVotes + delta;
            }
        } else if (prevLevel != 0) {
            // remove all delegates
            _moveDelegates(_delegates[rep], address(0), prevBalance);
            totalVotes = totalVotes - prevBalance;
        } else if (level != 0) {
            // add all delegates
            _moveDelegates(address(0), _delegates[rep], balance);
            totalVotes = totalVotes + balance;
        }

        // update membership levels
        if (prevLevel != level) {
            uint32 blockNumber = safe32(block.number, "vRARA::_updateMembership: block number exceeds 32 bits");

            if (nCheckpoints > 0 && membershipCheckpoints[rep][nCheckpoints - 1].fromBlock == blockNumber) {
                membershipCheckpoints[rep][nCheckpoints - 1].level = level;
            } else {
                membershipCheckpoints[rep][nCheckpoints] = MembershipCheckpoint(blockNumber, level);
                numMembershipCheckpoints[rep] = nCheckpoints + 1;
            }

            if (prevLevel == 0) {
                // add to membership array
                membershipIndex[rep] = members.length;
                members.push(rep);
                // emit adding
                emit MemberAdded(rep);
            } else if (level == 0) {
                // remove from membership array
                members[membershipIndex[rep]] = members[members.length - 1];
                members.pop();
                membershipIndex[rep] = 0;
                // emit removal
                emit MemberRemoved(rep);
            }

            if (listener != address(0)) {
                IVotingMembershipListener(listener).membershipChanged(rep, prevLevel, level);
            }
            emit MembershipChanged(rep, prevLevel, level);
        }
    }

    function _writeCheckpoint(
        address delegatee,
        uint32 nCheckpoints,
        uint256 oldVotes,
        uint256 newVotes
    )
        internal
    {
        uint32 blockNumber = safe32(block.number, "vRARA::_writeCheckpoint: block number exceeds 32 bits");

        if (nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNumber) {
            checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = Checkpoint(blockNumber, newVotes);
            numCheckpoints[delegatee] = nCheckpoints + 1;
        }

        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    function safe32(uint n, string memory errorMessage) internal pure returns (uint32) {
        require(n < 2**32, errorMessage);
        return uint32(n);
    }

    function getChainId() internal view returns (uint) {
        uint256 chainId;
        assembly { chainId := chainid() }
        return chainId;
    }
}
