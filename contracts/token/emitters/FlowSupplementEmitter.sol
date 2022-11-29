pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ITokenEmitter.sol";
import "../../utils/boring-solidity/BoringBatchable.sol";

// An ITokenEmitter that retrieves and forwards any tokens emitted by a source
// emitter (never stores those tokens internally) and supplements those tokens
// with additional funds transferred into this contract. The rate of supplement
// is regulated by the rate of tokens emitted from the source emitter; for each
// token from that emitter, one more token (if available) is supplied  from this
// contract's balance.
contract FlowSupplementEmitter is Context, AccessControlEnumerable, ITokenEmitter {
    // Role that can manage and change emission targets
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    // The RARA token, emitter, and recipient
    IERC20 public override token;
    address public emitter;
    address public recipient;

    uint256 public claimed;

    constructor(
        IERC20 _token,
        address _emitter,
        address _recipient
    ) {
        // minting settings
        token = _token;
        emitter = _emitter;
        recipient = _recipient;

        // set up roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/remove emission targets
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
        if (sender == recipient) {
            amount = _emit(_to);
        }
    }

    /**
     * @notice Returns the amount of Rara currently owed to the _recipient
     * (the amount to transfer on a call to {claim}).
     *
     * For recipients, this value may change every block.
     */
    function owed(address _recipient) public override view returns (uint256 amount) {
        if (_recipient == recipient && emitter != address(0)) {
            amount = ITokenEmitter(emitter).owed(address(this));
            amount += _supplementAmount(amount);
        }
    }

    /**
     * @notice Prompts a token emission, sending the balance to the address given.
     * The address need not be set as the recipient. The amount sent is the
     * appropriate emission at this moment.
     *
     * Only managers can make this call.
     */
    function pushClaim(address _to) public returns (uint256 amount) {
        require(hasRole(MANAGER_ROLE, _msgSender()), "FlowSupplementEmitter: must have MANAGER role to pushClaim");
        require(emitter != address(0), "FlowSupplementEmitter: no emitter is set");
        amount = _emit(_to);
    }

    /**
     * @notice Flush all tokens to address given, including current token balance
     * and tokens owed by the emitter.
     *
     * Only managers can make this call.
     */
    function flush() public returns (uint256 amount) {
        require(hasRole(MANAGER_ROLE, _msgSender()), "FlowSupplementEmitter: must have MANAGER role to flush");
        require(recipient != address(0), "FlowSupplementEmitter: must have a recipient");
        if (emitter != address(0)) {
            amount = ITokenEmitter(emitter).claim(recipient);
        }
        uint256 balance = token.balanceOf(address(this));
        amount = amount + balance;
        if (balance > 0) {
            token.transfer(recipient, balance);
        }
        claimed += amount;
    }

    /**
     * @notice Returns the total token amount emitted by the emitter
     * up to this block, whether or not they have been claimed.
     * (e.g. for an emitter that operates by mint-and-burn patterns,
     * reports only the number left after burning.)
     */
    function emitted() external override view returns (uint256 amount) {
        amount = claimed;
        if (emitter != address(0)) {
            uint256 _emission = ITokenEmitter(emitter).owed(address(this));
            amount = amount + _emission + _supplementAmount(_emission);
        }
    }

    /**
     * @dev Calculates the supplementary token amount to include with a source
     * emission, based on the size of that emission and the amount of tokens
     * held by this contract.
     */
    function _supplementAmount(uint256 _emission) internal view returns (uint256 amount) {
        uint256 balance = token.balanceOf(address(this));
        amount = (_emission > balance ? balance : _emission);
    }

    /**
     * @dev Perform a token emission, sending the tokens to the address specified.
     * The amount emitted is determined by the source emitter (all tokens
     * emitted to this contract will be passed to the specified recipient) but
     * an additional supplemental amount, up to the quantity emitted, will be
     * transferred as well.
     */
    function _emit(address _to) internal returns (uint256 amount) {
        uint256 emission = ITokenEmitter(emitter).claim(_to);
        uint256 supplement = _supplementAmount(emission);
        if (supplement > 0) {
            token.transfer(_to, supplement);
        }
        amount = emission + supplement;
        claimed += amount;
    }

    /**
     * @dev Set the token recipient.
     */
    function setRecipient(address _recipient) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "FlowSupplementEmitter: must have MANAGER role to setRecipient");
        recipient = _recipient;
    }

    /**
     * @dev Set the token recipient.
     */
    function setEmitter(address _emitter) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "FlowSupplementEmitter: must have MANAGER role to setEmitter");
        emitter = _emitter;
    }
}
