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
interface IBlindSaleAwardable is IBlindSale {
    // @dev Award the indicated draws to their purchaser(s), if possible (skips
    // those that are already revealed, but reverts if not revealable yet or
    // invalid).
    // @param _drawIds The _drawIds, which will be awarded to their purchaser(s).
    function awardDraws(uint256[] calldata _drawIds) external;

    // @dev Award up to `_limit` queued draws to their purchaser(s).
    // @param _limit The maximum number to award.
    function awardQueuedDraws(uint256 _limit) external;

    // @dev Award up to `_limit` queued draws to their purchaser(s)
    function awardStaleDraws(uint256 _blocksStale, uint256 _limit) external;

    // @dev Returns the number of queued draws that are revealable right now,
    // up to `_limit`.
    function queuedDrawsAwardableCount(uint256 _blocksStale, uint256 _limit) external view returns (uint256 count);

    // @dev Returns the number of draws queued right now, revealable or not.
    function queuedDrawsCount() external view returns (uint256 _count);

    // @dev Returns the drawId queued at the indicated index.
    function queuedDrawId(uint256 _index) external view returns (uint256 drawid);

    // @dev For the draw queued at the indicated index, returns the number of
    // blocks  "stale" (number of blocks it's been revealable).
    function queuedDrawBlocksStale(uint256 _index) external view returns (uint256 blocks);
}
