import "./IBlindSale.sol";

/**
 * @dev A blind box sale with limited inventories of each prize.
 * Each purchase, for a fixed price, represents a draw from the box until the
 * inventory is exhausted. In some cases the inventory represents a quantity
 * of different types; in others a list of unique outcomes (NFT tokenIds, unique
 * prize packages, etc.).
 */
pragma solidity ^0.8.0;
interface IBlindSalePrizeBag is IBlindSale {
    // @dev Returns the total number of draws available from this box, including
    // those already drawn.
    function totalSupply() external view returns (uint256);

    // @dev Returns the number of distinct prizes offered (each prize may have
    // multiple instances and be drawn multiple times, but they should be identical).
    // Use to iterate {totalPrizeSupply}, etc.
    function prizeCount() external view returns (uint256);

    // @dev The available supply of prize `_pid`. Use {prizeCount} as limit of
    // enumeration.
    function availablePrizeSupply(uint256 _pid) external view returns (uint256);

    // @dev The total supply of prize `_pid`, including already drawn. Use
    // {prizeCount} as limit of enumeration.
    function totalPrizeSupply(uint256 _pid) external view returns (uint256);

    // @dev The number of times this prize has been drawn (so far).
    function prizeDrawCount(uint256 _pid) external view returns (uint256);

    // @dev The
    function prizeDrawId(uint256 _pid, uint256 _index) external view returns (uint256);

    // @dev Returns the prize won with the indicated draw (prizeId)
    function drawPrizeId(uint256 _did) external view returns (uint256);

    event Draw(address indexed user, uint256 indexed drawId, uint256 indexed prizeId);
}
