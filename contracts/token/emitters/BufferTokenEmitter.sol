pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ITokenEmitter.sol";
import "../../utils/boring-solidity/BoringBatchable.sol";

// An ITokenEmitter that holds Rara as a buffer, making its full balance available
// to a recipient (when not 0x00). Optionally it can pull tokens from another emitter,
// behaving as if they are held by this contract.
contract BufferTokenEmitter is Context, AccessControlEnumerable, ITokenEmitter {
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
            amount = _flush(_to);
        }
    }

    /**
     * @notice Returns the amount of Rara currently owed to the _recipient
     * (the amount to transfer on a call to {claim}).
     *
     * For recipients, this value may change every block.
     */
    function owed(address _recipient) public override view returns (uint256 amount) {
        if (_recipient == recipient) {
            amount = token.balanceOf(address(this));
            if (emitter != address(0)) {
                amount = amount + ITokenEmitter(emitter).owed(address(this));
            }
        }
    }

    /**
     * @notice Returns the total token amount emitted by the emitter
     * up to this block, whether or not they have been claimed.
     * (e.g. for an emitter that operates by mint-and-burn patterns,
     * reports only the number left after burning.)
     */
    function emitted() external override view returns (uint256 amount) {
        amount = claimed + token.balanceOf(address(this));
        if (emitter != address(0)) {
            amount = amount + ITokenEmitter(emitter).owed(address(this));
        }
    }

    /**
     * @notice Pull any tokens owed by the originating emitter into this contract
     * (e.g. in case that emitter may be changing its settings).
     */
    function pull() external returns (uint256 amount) {
        if (emitter != address(0)) {
            amount = ITokenEmitter(emitter).claim(address(this));
        }
    }

    /**
     * @notice Flush all tokens held by this contract, and any owed by
     * the associated emitter, sending them to the recipient.
     */
    function flush() external returns (uint256 amount) {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BufferTokenEmitter: must have MANAGER role to flush");
        require(recipient != address(0), "BufferTokenEmitter: must have a recipient");
        amount = _flush(recipient);
    }

    /**
     * @dev Send all tokens held here, and any owed by associated
     * emitter, to the indicated address.
     */
    function _flush(address _to) internal returns (uint256 amount) {
        amount = token.balanceOf(address(this));
        if (amount > 0) {
            token.transfer(_to, amount);
        }
        if (emitter != address(0)) {
            amount = amount + ITokenEmitter(emitter).claim(_to);
        }
        claimed = claimed + amount;
    }

    /**
     * @dev Set the token recipient.
     */
    function setRecipient(address _recipient) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BufferTokenEmitter: must have MANAGER role to setRecipient");
        recipient = _recipient;
    }

    /**
     * @dev Set the token recipient.
     */
    function setEmitter(address _emitter) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BufferTokenEmitter: must have MANAGER role to setEmitter");
        emitter = _emitter;
    }
}
