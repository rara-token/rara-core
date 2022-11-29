// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IDirectCollectibleSale.sol";
import "../../../token/interfaces/IERC721TypeExchangeable.sol";
import "../../../token/interfaces/IERC721Collectible.sol";

// @notice A direct sale of Collectible tokens with some basic behavior.
pragma solidity ^0.8.0;
abstract contract BaseDirectCollectibleSale is Context, AccessControlEnumerable, IDirectCollectibleSale {
    using SafeERC20 for IERC20;

    // Role that configures sales
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct ItemInfo {
        address token;
        uint256 tokenType;
        bool available;
    }

    // @notice purchase info
    struct ReceiptInfo {
        address buyer;
        address user;
        uint256 price;
        uint256 itemId;
        uint256 tokenId;
        uint256 purchaseBlock;
    }

    // Items
    ItemInfo[] public itemInfo;

    // tokens and price
    address public override purchaseToken;

    // sale recipient
    address public recipient;

    ReceiptInfo[] public receiptInfo;
    mapping(address => uint256[]) public override receiptIdBy;
    mapping(uint256 => uint256[]) public override itemReceiptId;

    event ItemCreation(uint256 indexed itemId, address token, uint256 tokenType, bool available);
    event ItemUpdate(uint256 indexed itemId, address token, uint256 tokenType, bool available);

    constructor(address _purchaseToken, address _recipient) {
        purchaseToken = _purchaseToken;
        recipient = _recipient;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/configure items
    }

    // @dev Returns the number of draws currently available from this sale.
    // The specifics of what this means differ between implementations -- the
    // amount available across all customers, the most one customer can purchase,
    // etc., as well as whether this quantity changes over time or in response
    // to purchases. The only hard and fast rule is that {purchaseDraws} cannot
    // be used to buy more draws than this number.
    function availableItemSupply(uint256 _itemId) public virtual override view returns (uint256);

    // @dev The current price of this many purchases from the sale
    function purchasePrice(uint256 _itemId, uint256 _count) public virtual override view returns (uint256);

    // @dev Any internal updates necessary for bookkeeping before other changes are made to the item
    function updateItem(uint256 _itemId) public virtual {

    }

    function purchaseItems(uint256 _itemId, address _to, uint256 _count, uint256 _maximumCost) external override {
        address buyer = _msgSender();
        require(_itemId < itemInfo.length, "BaseDirectCollectibleSale: invalid itemId");
        updateItem(_itemId);
        ItemInfo storage item = itemInfo[_itemId];
        require(item.available, "BaseDirectCollectibleSale: item not available");
        require(_count <= availableItemSupply(_itemId), "BaseDirectCollectibleSale: not enough supply");
        uint256 amount = purchasePrice(_itemId, _count);
        require(amount <= _maximumCost, "BaseDirectCollectibleSale: too expensive");

        // charge payment
        address paymentTo = recipient != address(0) ? recipient : address(this);
        IERC20(purchaseToken).safeTransferFrom(buyer, paymentTo, amount);

        uint256[] memory tokenTypes = new uint[](_count);
        uint256 receiptsBefore = receiptInfo.length;

        // create (don't reveal) draws
        for (uint256 i = 0; i < _count; i++) {
            uint256 receiptId = receiptInfo.length;
            uint256 price = purchasePrice(_itemId, 1);
            tokenTypes[i] = item.tokenType;

            receiptInfo.push(ReceiptInfo({
                buyer: buyer,
                user: _to,
                price: price,
                itemId: _itemId,
                tokenId: 0,
                purchaseBlock: block.number
            }));

            receiptIdBy[_to].push(receiptId);
            itemReceiptId[_itemId].push(receiptId);

            emit ItemPurchase(buyer, _itemId, _to, receiptId, price);
        }

        // mint
        uint256[] memory tokenIds = IERC721TypeExchangeable(item.token).massMint(_to, tokenTypes);
        for (uint256 i = 0; i < _count; i++) {
            receiptInfo[receiptsBefore + i].tokenId = tokenIds[i];
        }
    }

    function claimAllProceeds(address _to) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BaseDirectCollectibleSale: must have MANAGER role to claimAllProceeds");
        uint256 amount = IERC20(purchaseToken).balanceOf(address(this));
        IERC20(purchaseToken).safeTransfer(_to, amount);
        // TODO emit
    }

    function claimProceeds(address _to, uint256 _amount) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BaseDirectCollectibleSale: must have MANAGER role to claimProceeds");
        IERC20(purchaseToken).safeTransfer(_to, _amount);
        // TODO emit
    }

    function setRecipient(address _recipient) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BaseDirectCollectibleSale: must have MANAGER role to setRecipient");
        recipient = _recipient;
    }

    // @dev Returns the number of draws by `_user` (thus far).
    function receiptCountBy(address _user) external view override returns (uint256) {
        return receiptIdBy[_user].length;
    }

    // @dev The number of times this item has been purchased (so far).
    function itemReceiptCount(uint256 _itemId) external view override returns (uint256) {
        require(_itemId < itemInfo.length, "BaseDirectCollectibleSale: invalid itemId");
        return itemReceiptId[_itemId].length;
    }

    // @dev Returns the number of draws conducted thus far. drawIds will index
    // from zero to this number.
    function totalReceipts() external view override returns (uint256) {
        return receiptInfo.length;
    }

    function itemCount() public view override returns (uint256) {
        return itemInfo.length;
    }

    function itemToken(uint256 _itemId) external view override returns (address) {
        require(_itemId < itemInfo.length, "BaseDirectCollectibleSale: nonexistent itemId");
        return itemInfo[_itemId].token;
    }

    function itemTokenType(uint256 _itemId) external view override returns (uint256) {
        require(_itemId < itemInfo.length, "BaseDirectCollectibleSale: nonexistent itemId");
        return itemInfo[_itemId].tokenType;
    }

    function receiptTokenId(uint256 _rid) external view override returns (uint256) {
        require(_rid < receiptInfo.length, "BaseDirectCollectibleSale: nonexistent receiptId");
        return receiptInfo[_rid].tokenId;
    }

    function receiptTokenType(uint256 _rid) external view override returns (uint256) {
        require(_rid < receiptInfo.length, "BaseDirectCollectibleSale: nonexistent receiptId");
        uint256 itemId = receiptInfo[_rid].itemId;
        return itemInfo[itemId].tokenType;
    }

    function _createItem(address _token, uint256 _tokenType, bool _available) internal returns (uint256 _itemId) {
        require(_tokenType < IERC721Collectible(_token).totalTypes(), "BaseDirectCollectibleSale: nonexistent tokenType");
        _itemId = itemInfo.length;
        itemInfo.push(ItemInfo({
            token: _token,
            tokenType: _tokenType,
            available: _available
        }));

        _afterCreateItem(_itemId, _token, _tokenType, _available);
    }

    function _afterCreateItem(uint256 _itemId, address _token, uint256 _tokenType, bool _available) internal virtual {
        emit ItemCreation(_itemId, _token, _tokenType, _available);
    }

    function _setItemAvailable(uint256 _itemId, bool _available) internal {
        require(_itemId < itemInfo.length, "BaseDirectCollectibleSale: nonexistent itemId");
        updateItem(_itemId);
        ItemInfo storage item = itemInfo[_itemId];
        item.available = _available;

        emit ItemUpdate(_itemId, item.token, item.tokenType, _available);
    }
}
