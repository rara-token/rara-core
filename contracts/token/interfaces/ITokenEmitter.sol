import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// An ITokenEmitter accumulates tokens on its own internal schedule,
// allocating it to specific recipients.
pragma solidity ^0.8.0;
interface ITokenEmitter {
    /**
     * @dev Returns token address
     */
    function token() external view returns (IERC20);

    /**
     * @dev Claims tokens owed to the caller, sending it to the designated address.
     * No effect if the caller is not a targetted recipient.
     *
     * No need to call {mint} before making this call.
     *
     * Returns the amount transferred; for recipients, emits a {RaraEmitted} event.
     */
    function claim(address _to) external returns (uint256);

    /**
     * @dev Returns the amount of tokens currently owed to the _recipient
     * (the amount to transfer on a call to {claim}).
     *
     * For recipients, this value changes each block.
     */
    function owed(address _recipient) external view returns (uint256);

    /**
     * @dev Returns the total token amount emitted by the emitter
     * up to this block, whether or not they have been claimed.
     * (e.g. for an emitter that operates by mint-and-burn patterns,
     * reports only the number left after burning.)
     */
    function emitted() external view returns (uint256);
}
