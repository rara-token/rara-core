pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./RaraToken.sol";
import "./interfaces/ITokenEmitter.sol";
import "../utils/boring-solidity/BoringBatchable.sol";

// The RaraEmitter mints 48 Rara for each block, allocating it to designated
// recipients; leftovers are burned.
contract RaraEmitter is Context, AccessControlEnumerable, BoringBatchable, ITokenEmitter {
    // Role that can manage and change emission targets
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    // Info of each emission target.
    struct TargetInfo {
      address recipient;                // Address of the recipient
      uint256 raraPerBlock;             // rara per block
      uint256 raraOwed;                 // rara owed to this target from before lastUpdateBlock
      uint256 lastUpdateBlock;          // last block this target received Rara or updated allocation
    }

    // The RARA token
    RaraToken public rara;

    // Target and minting details
    TargetInfo[] public targetInfo;
    mapping (address => uint256) public recipientTid;
    mapping (address => bool) public hasRecipient;
    // The total allocated rara per block
    uint256 public raraMintedPerBlock;
    uint256 public raraEmittedPerBlock;
    // Mint timing
    uint256 public lastMintBlock;
    uint256 public startBlock;
    // Mint totals
    uint256 public raraEmitted;

    event TargetAdded(uint256 indexed tid, address indexed target, uint256 raraPerBlock);
    event TargetUpdated(uint256 indexed tid, address indexed target, uint256 raraPerBlock);
    event RaraEmitted(uint256 indexed tid, address indexed target, address indexed to, uint256 amount);

    constructor(
        RaraToken _rara,
        uint256 _raraPerBlock,
        uint256 _startBlock
    ) {
        // minting settings
        rara = _rara;
        raraMintedPerBlock = _raraPerBlock;
        startBlock = _startBlock;
        lastMintBlock = _startBlock;

        // set up roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/remove emission targets
    }

    /**
     * @notice Return the token in question.
     */
    function token() external override view returns (IERC20) {
        return rara;
    }

    /**
     * @notice Returns the number of targets; valid tids are < this result.
     */
    function targets() external view returns (uint256) {
        return targetInfo.length;
    }

    /**
     * @notice Mints the appropriate amount of Rara for the current block.
     */
    function mint() external {
        _mint();
    }

    /**
     * @notice Claims Rara owed to the caller, sending it to the designated address.
     * No effect if the caller is not a targetted recipient.
     *
     * No need to call {mint} before making this call.
     *
     * Returns the amount transferred; for recipients, emits a {RaraEmitter} event.
     */
    function claim(address _to) external override returns (uint256 amount) {
        address sender = _msgSender();
        if (hasRecipient[sender]) {
            uint256 tid = recipientTid[sender];
            _mint();      // mint up to the current block
            amount = _emitRara(tid, _to);   // provide any amount owed to the recipient
        }
    }

    /**
     * @notice Returns the amount of Rara currently owed to the _recipient
     * (the amount to transfer on a call to {claim}).
     *
     * For recipients, this value may change every block.
     */
    function owed(address _recipient) public override view returns (uint256 amount) {
        if (hasRecipient[_recipient]) {
            amount = _owed(recipientTid[_recipient], block.number);
        }
    }

    /**
     * @notice Returns the total token amount emitted by the emitter
     * up to this block, whether or not they have been claimed.
     * (e.g. for an emitter that operates by mint-and-burn patterns,
     * reports only the number left after burning.)
     */
    function emitted() external override view returns (uint256 amount) {
        amount = raraEmitted;
        if (block.number > lastMintBlock) {
            uint256 blocks = block.number - lastMintBlock;
            amount = amount + raraEmittedPerBlock * blocks;
        }
    }

    /**
     * @dev Safely add the indicated target as a recipient of Rara from this
     * point forward.
     */
    function addTarget(address _recipient, uint256 _raraPerBlock) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraEmitter: must have MANAGER role to addTarget");
        require(!hasRecipient[_recipient], "RaraEmitter: recipient already a target");

        _mint();    // always mint before altering targetInfo
        _addTarget(_recipient, _raraPerBlock);
    }

    /**
     * @dev Safely update the indicated target, optionally changing the recipient
     * address (i.e. for a contract update) and/or the amount allocated per block.
     */
    function updateTarget(uint256 _tid, address _recipient, uint256 _raraPerBlock) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraEmitter: must have MANAGER role to updateTarget");
        require(_tid < targetInfo.length, "RaraEmitter: no such tid");
        require(!hasRecipient[_recipient] || targetInfo[_tid].recipient == _recipient,
            "RaraEmitter: recipient already a target");

        _mint();      // always mint before altering targetInfo
        _updateTarget(_tid, _recipient, _raraPerBlock);
    }

    /**
     * @dev Emit the Rara owed to the indicated target directly to that target's
     * recipient address; uses {mint} to ensure up-to-date quantities.
     */
    function emitRara(uint256 _tid) external {
      require(hasRole(MANAGER_ROLE, _msgSender()), "RaraEmitter: must have MANAGER role to emitRara");
      require(_tid < targetInfo.length, "RaraEmitter: no such tid");

      _mint();
      _emitRara(_tid, targetInfo[_tid].recipient);
    }

    /**
     * @dev Emit the Rara owed to the indicated targets directly to those targets'
     * recipient address; uses {mint} to ensure up-to-date quantities.
     */
    function massEmitRara(uint256[] calldata _tids) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraEmitter: must have MANAGER role to massEmitRara");

        _mint();
        uint256 len = _tids.length;
        for (uint256 i = 0; i < len; ++i) {
            require(_tids[i] < targetInfo.length, "RaraEmitter: no such tid");
            _emitRara(_tids[i], targetInfo[_tids[i]].recipient);
        }
    }

    /**
     * @dev Unsafely adds a Rara target; i.e., does so without calling {mint} and
     * without checking if the target already exists. Only do this in a batch that
     * begins with {mint} and if you're sure the recipient isn't already set.
     */
    function unsafeAddTarget(address _recipient, uint256 _raraPerBlock) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraEmitter: must have MANAGER role to unsafeAddTarget");
        _addTarget(_recipient, _raraPerBlock);
    }

    /**
     * @dev Unsafely updates a Rara target; i.e., does so without calling {mint}
     * or checking that the _tid and _recipient are valid. Only do this in a batch that
     * begins with {mint} and if you're sure the inputs are good.
     */
    function unsafeUpdateTarget(uint256 _tid, address _recipient, uint256 _raraPerBlock) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraEmitter: must have MANAGER role to unsafeUpdateTarget");
        _updateTarget(_tid, _recipient, _raraPerBlock);
    }

    /**
     * @dev Unsafely emits Rara to the specified recipients; i.e. does so without
     * calling {mint}. Only do this in a batch that starts with {mint}.
     */
    function unsafeMassEmitRara(uint256[] calldata _tids) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraEmitter: must have MANAGER role to massEmitRara");
        uint256 len = _tids.length;
        for (uint256 i = 0; i < len; ++i) {
            _emitRara(_tids[i], targetInfo[_tids[i]].recipient);
        }
    }

    /**
     * @dev Unsafely burns all Rara held by the emitter; i.e. may destroy Rara
     * that was owed to recipients. Only do this in a batch that {emitRara}s to
     * ALL targets.
     */
    function unsafeBurn() external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraEmitter: must have MANAGER role to unsafeBurn");
        _burn();
    }

    /**
     * @dev Mint Rara for every block passed since the last call to this
     * function (after the startBlock), then Burn Rara that was not allocated
     * to targets. This Mint -> Burn flow (rather than just a smaller Mint)
     * is by-request of Binance.
     */
    function _mint() internal {
        if (block.number > lastMintBlock) {
            uint256 blocks = block.number - lastMintBlock;
            uint256 mintAmount = raraMintedPerBlock * blocks;
            uint256 emitAmount = raraEmittedPerBlock * blocks;
            uint256 burnAmount = mintAmount - emitAmount;

            // mint to ourselves, then burn unused quantity.
            // the difference is emitted to targets in a separate step.
            rara.mint(address(this), mintAmount);
            rara.burn(burnAmount);

            raraEmitted = raraEmitted + emitAmount;
            lastMintBlock = block.number;
        }
    }

    /**
     * @dev Burn all Rara held by this Emitter, e.g. Rara mistakenly transferred
     * into this contract from outside. This call is dangerous, as it may
     * burn Rara intended for target recipients. IMPORTANT: emitRara to all
     * recipients first.
     */
    function _burn() internal {
      rara.burn(rara.balanceOf(address(this)));
    }

    /**
     * @dev Emit the Rara owed to the indicated target to the address specified.
     *
     * Returns the amount transferred.
     */
    function _emitRara(uint256 _tid, address _to) internal returns (uint256 amount) {
        amount = _owed(_tid, lastMintBlock);
        if (amount != 0) {
            _transfer(_to, amount);
        }
        TargetInfo storage target = targetInfo[_tid];
        target.lastUpdateBlock = lastMintBlock;
        target.raraOwed = 0;

        emit RaraEmitted(_tid, target.recipient, _to, amount);
    }

    /**
     * @dev Returns the amount of Rara transferred owed to the indicated target
     * as of the indicated block.
     */
    function _owed(uint256 _tid, uint256 _block) internal view returns (uint256 amount) {
        TargetInfo storage target = targetInfo[_tid];
        amount = target.raraOwed;
        if (_block > target.lastUpdateBlock) {
            uint256 blocks = _block - target.lastUpdateBlock;
            amount = amount + (blocks * target.raraPerBlock);
        }
    }

    /**
     * @dev Add a new target to the emitter.
     *
     *  IMPORTANT: call {_mint} before adding a target.
     *  IMPORTANT: do not add a target more than once.
     */
    function _addTarget(address _recipient, uint256 _raraPerBlock) internal {
      uint256 newEmittedRaraPerBlock = raraEmittedPerBlock + _raraPerBlock;
      require(newEmittedRaraPerBlock <= raraMintedPerBlock, "RaraEmitter: emitted Rara cannot exceed minted Rara");

      raraEmittedPerBlock = newEmittedRaraPerBlock;
      recipientTid[_recipient] = targetInfo.length;
      hasRecipient[_recipient] = true;
      targetInfo.push(TargetInfo({
          recipient: _recipient,
          raraPerBlock: _raraPerBlock,
          raraOwed: 0,
          lastUpdateBlock: lastMintBlock
      }));

      emit TargetAdded(targetInfo.length - 1, _recipient, _raraPerBlock);
    }

    /**
     * @dev Update the indicated target.
     *
     *  IMPORTANT: call {_mint} before updating a target.
     *  IMPORTANT: do not add a target more than once.
     */
    function _updateTarget(uint256 _tid, address _recipient, uint256 _raraPerBlock) internal {
      TargetInfo storage target = targetInfo[_tid];
      raraEmittedPerBlock = raraEmittedPerBlock + _raraPerBlock - target.raraPerBlock;
      require(raraEmittedPerBlock <= raraMintedPerBlock, "RaraEmitter: emitted Rara cannot exceed minted Rara");

      // rara may be owed but not yet claimed; note it
      if (block.number > target.lastUpdateBlock) {
        uint256 blocks = block.number - target.lastUpdateBlock;
        target.raraOwed = target.raraOwed + (blocks * target.raraPerBlock);
        target.lastUpdateBlock = block.number;
      }

      if (_recipient != target.recipient) {
        recipientTid[target.recipient] = 0;
        hasRecipient[target.recipient] = false;
        target.recipient = _recipient;
        recipientTid[_recipient] = _tid;
        hasRecipient[_recipient] = true;
      }
      target.raraPerBlock = _raraPerBlock;

      emit TargetUpdated(_tid, _recipient, _raraPerBlock);
    }

    /**
     * @dev Transfer up to the amount of Rara indicated to the address given;
     * if not enough is held by the emitter, transfer the full balance.
     */
    function _transfer(address _to, uint256 _amount) internal {
        uint256 raraBal = rara.balanceOf(address(this));
        if (_amount > raraBal) {
            rara.transfer(_to, raraBal);
        } else {
            rara.transfer(_to, _amount);
        }
    }
}
