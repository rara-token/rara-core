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
interface IBlindSale {
    // @dev Returns the token address
    function purchaseToken() external view returns (address);

    // @dev The current price of a draw from the box (assuming any remain).
    function drawPrice() external view returns (uint256);

    // @dev Purchase the indicated number of draws, paying a maximum total price
    // of `_maximumCost`.
    // @param _to The address to award the prize(s).
    // @param _draws The number of draws to purchase.
    // @param _maximumCost The maximum price to pay for the draws (in total),
    // in case prices fluctuate.
    function purchaseDraws(address _to, uint256 _draws, uint256 _maximumCost) external;

    // @dev Returns the number of draws by `_user` (thus far).
    function drawCountBy(address _user) external view returns (uint256);

    // @dev Returns the drawId of the specified draw based on user and index
    // (from zero to {drawCountBy}).
    function drawIdBy(address _user, uint256 _index) external view returns (uint256);

    // @dev Returns the number of draws conducted thus far. drawIds will index
    // from zero to this number.
    function totalDraws() external view returns (uint256);

    event DrawPurchase(address indexed buyer, address indexed to, uint256 indexed drawId, uint256 price);
}
