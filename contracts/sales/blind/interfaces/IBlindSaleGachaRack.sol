import "./IBlindSale.sol";

/**
 * @dev A blind box sale that acts like a rack of Gacha games, each with its
 * own prize set and probabilities. Uses a two-index system, gameId and prizeId,
 * to identify prizes.
 *
 * To support {purchaseDraws} and {drawPrice}, GachaRacks should have a current or "default"
 * gameId. It is unspecified whether other gameIds are accessible for draws
 * or if the purchaser is forced to use the current game.
 *
 * Distinguished from
 */
pragma solidity ^0.8.0;
interface IBlindSaleGachaRack is IBlindSale {
    // @dev Returns the number of games available in this rack.
    function gameCount() external view returns (uint256);

    // @dev Returns the current active game used for {purchaseDraws}. In some
    // cases, players may choose the game they want, with {currentGame} acting
    // only as a default value; in others the contract forces all purchases
    // to use the current game.
    function currentGame() external view returns (uint256);

    // @dev Returns the number of distinct prizes offered by game `_gameId`
    // (each prize may have multiple instances and be drawn multiple times,
    // but they should be identical).
    function prizeCount(uint256 _gameId) external view returns (uint256);

    // @dev Returns the total weight of all prizes in the indicated game.
    function totalPrizeWeight(uint256 _gameId) external view returns (uint256);

    // @dev Returns the probability "weight" for the given `_prizeId` in game
    // `_gameId`.
    function prizeWeight(uint256 _gameId, uint256 _prizeId) external view returns (uint256);

    // @dev The number of times this game has been drawn (so far).
    function gameDrawCount(uint256 _gameId) external view returns (uint256);

    // @dev The `drawId` of the `indexed` time a draw was purchased from
    // the indicated game.
    function gameDrawId(uint256 _gameId, uint256 _index) external view returns (uint256);

    // @dev The number of times this prize has been drawn (so far).
    function prizeDrawCount(uint256 _gameId, uint256 _prizeId) external view returns (uint256);

    // @dev The `drawId` of the `indexed` time the indicated prize was
    // awarded for the indicated game.
    function prizeDrawId(uint256 _gameId, uint256 _prizeId, uint256 _index) external view returns (uint256);

    // @dev Returns the game played by the indicated draw draw.
    function drawGameId(uint256 _did) external view returns (uint256 _gameId);

    // @dev Returns the prize won with the indicated draw (gameId and prizeId)
    function drawPrizeId(uint256 _did) external view returns (uint256 _gameId, uint256 _prizeId);

    event Draw(address indexed user, uint256 drawId, uint256 indexed gameId, uint256 indexed prizeId);
}
