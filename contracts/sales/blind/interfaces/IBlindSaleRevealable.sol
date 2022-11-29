import "./IBlindSale.sol";

/**
 * @dev A blind sale is one where users may purchase "draws". Each draw is assigned
 * a unique ID at the time of sale and may result in one of multiple "prizes".
 *
 * Some possible implementations:
 * -- Lottery: each drawId is a lottery ticket, of which one will later be selected
 *    as the winner.
 * -- Blind Box / Prize Bag: a limited supply of various prizes is available, and each drawId
 *    results in the selection of an available prize according to the quantities left.
 * -- Gacha Game: purchase draws in a batch, then "reveal" them. Each "reveal"
 *    step produces a new item from a set of probabilities which may change over time.
 */
pragma solidity ^0.8.0;
interface IBlindSaleRevealable is IBlindSale {
    // @dev Reveal the indicated draws, previously purchased by the caller, and
    // send the prizes to `_to`.
    // @param _to The address to award the prize(s).
    // @param _drawIds The _drawIds, owned by the sender, to reveal in this transaction.
    function revealDraws(address _to, uint256[] calldata _drawIds) external;

    function drawRevealed(uint256 _drawId) external view returns (bool);

    function drawRevealable(uint256 _drawId) external view returns (bool);
}
