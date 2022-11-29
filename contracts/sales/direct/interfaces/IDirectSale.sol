/**
 * @dev A direct sale is one where users may purchase items. There may or may
 * not be a purchase-and-claim flow, a bidding system, refunds, etc.
 *
 * Some possible implementations:
 * -- TokenSale: buy ERC721 tokens.
 */
pragma solidity ^0.8.0;
interface IDirectSale {
    // @dev Returns the token address used for purchasing
    function purchaseToken() external view returns (address);

    // @dev Return the number of items available for sale
    function itemCount() external view returns (uint256);

    // @dev Returns the number of draws currently available from this sale.
    // The specifics of what this means differ between implementations -- the
    // amount available across all customers, the most one customer can purchase,
    // etc., as well as whether this quantity changes over time or in response
    // to purchases. The only hard and fast rule is that {purchaseDraws} cannot
    // be used to buy more draws than this number.
    function availableItemSupply(uint256 _itemId) external view returns (uint256);

    // @dev The current price of this many purchases from the sale
    function purchasePrice(uint256 _itemId, uint256 _count) external view returns (uint256);

    // @dev Purchase the indicated number of draws, paying a maximum total price
    // of `_maximumCost`.
    // @param _to The address to award the prize(s).
    // @param _draws The number of draws to purchase.
    // @param _maximumCost The maximum price to pay for the draws (in total),
    // in case prices fluctuate.
    function purchaseItems(uint256 _itemId, address _to, uint256 _count, uint256 _maximumCost) external;

    // @dev Returns the number of draws by `_user` (thus far).
    function receiptCountBy(address _user) external view returns (uint256);

    // @dev Returns the drawId of the specified draw based on user and index
    // (from zero to {drawCountBy}).
    function receiptIdBy(address _user, uint256 _index) external view returns (uint256);

    // @dev The number of times this item has been purchased (so far).
    function itemReceiptCount(uint256 _itemId) external view returns (uint256);

    // @dev The `receiptId` of the `indexed` time the indicated item was
    // purchased
    function itemReceiptId(uint256 _itemId, uint256 _index) external view returns (uint256);

    // @dev Returns the number of draws conducted thus far. drawIds will index
    // from zero to this number.
    function totalReceipts() external view returns (uint256);

    event ItemPurchase(address indexed buyer, uint256 indexed itemId, address indexed to, uint256 receiptId, uint256 price);
}
