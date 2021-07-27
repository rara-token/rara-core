// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ICollectibleTokenSale.sol";
import "../../token/interfaces/IERC721TypeExchangeable.sol";

// An extremely basic ICollectibleTokenSale. Allows scheduled sale periods of
// a particular IERC721 token contract implementing IERC721Collectible.
//
// The sales are extremely basic. Only one SaleInfo can be created for a given
// tokenType; although its settings can be altered at any time, there cannot
// be two different settings for a single type (e.g. there can't be a limited
// low-price run before a higher-price sale begins for the same type, there
// can't be multiple sale periods scheduled in advance for a specific token type,
// etc.). These types of behaviors are possible but only by manually reconfiguring
// the sale settings for that token type after the first sale set is concluded.
pragma solidity ^0.8.0;
contract BasicTimedCollectibleTokenSale is Context, AccessControlEnumerable, ICollectibleTokenSale {
    using SafeERC20 for IERC20;

    // Role that create new sales
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    // Info of each token type sale settings
    struct SaleInfo {
        uint256 price;                  // token price for this sale
        uint256 supply;                 // the number of tokens available for sale
        uint32 startBlock;              // the first block in which this token may be purchased
        uint32 endBlock;                // the last block in which this token may be purchased
        address recipient;              // sale price recipient; if zero, use the default recipient or accumulate in this contract.
    }

    // @notice The collectible token available for purchase
    address public override token;

    // @notice The token used for sales; musts be {approve}d for transfer by this contract.
    address public override purchaseToken;

    // @notice Sale details; mapped by tokenType
    mapping (uint256 => SaleInfo) public saleInfo;
    mapping (uint256 => bool) public saleExists;
    mapping (uint256 => uint256) public override tokenTypePurchased;
    uint256 public override totalPurchased;

    // @notice Sale recipient. Money for a sale goes to the SaleInfo recipient,
    // if zero goes to this address, or if zero resides in this contract.
    address public recipient;

    event SaleCreation(uint256 indexed tokenType);
    event SaleUpdate(uint256 indexed tokenType, uint256 price, uint256 supply, uint32 startBlock, uint32 endBlock, address indexed recipient);
    event Claim(address indexed recipient, uint256 amount);
    event RecipientSet(address indexed oldRecipient, address indexed recipient);

    constructor(
        address _token,
        address _purchaseToken,
        address _recipient
    ) {
        token = _token;
        purchaseToken = _purchaseToken;
        recipient = _recipient;

        // set up roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/remove emission targets
    }

    // @dev Returns whether the sale for `_tokenType` is currently active (even
    // if the supply is exhausted).
    function _active(uint256 _tokenType) internal view returns (bool) {
        // save gas
        SaleInfo storage sale = saleInfo[_tokenType];
        return saleExists[_tokenType]
            && sale.startBlock < block.number
            && (sale.endBlock == 0 || block.number < sale.endBlock);
    }

    // @dev Returns whether the sale for `_tokenType` is currently available
    // (i.e. {_active} and with at least 1 supply)
    function _available(uint256 _tokenType) internal view returns (bool) {
        return saleInfo[_tokenType].supply > 0 && _active(_tokenType);
    }

    // @notice Returns the price at which the indicated tokenType is available,
    // potentially reverting if it is not.
    // @param _tokenType The token type to price.
    function tokenTypePrice(uint256 _tokenType) external view override returns (uint256) {
        require(_active(_tokenType), "BasicCollectibleTokenSale: sale not active");
        return saleInfo[_tokenType].price;
    }

    // @notice Returns the count of the specified token type which is available
    // for purchase. If zero, the call to {price} may fail, but for anything
    // else
    // @param _tokenType The token type to check available supply
    function tokenTypeSupply(uint256 _tokenType) external view override returns (uint256) {
        return _active(_tokenType) ? saleInfo[_tokenType].supply : 0;
    }

    // @notice Purchase the specified token type; it will be minted or transferred
    // to the indicated address if possible. Precondition: the purchase currency
    // must be {approve}d for transfer by this contract.
    // @param _tokenType The token type to purchase.
    // @param _to The address to send the token to
    // @param _maximumPrice The maximum price the user is willing to pay, in case
    // price has changed since the last query.
    // @return The tokenID transferred to `to` as a result of this call.
    function purchase(uint256 _tokenType, address _to, uint256 _maximumPrice) external override returns (uint256 tokenId) {
        require(_available(_tokenType), "BasicCollectibleTokenSale: not available");

        SaleInfo storage sale = saleInfo[_tokenType];
        uint256 price = sale.price;
        require(price <= _maximumPrice, "BasicCollectibleTokenSale: too expensive");

        // determine recipient
        address buyer = _msgSender();
        address purchaseRecipient;
        if (sale.recipient != address(0)) {
          purchaseRecipient = sale.recipient;
        } else if (recipient != address(0)) {
          purchaseRecipient = recipient;
        } else {
          purchaseRecipient = address(this);
        }

        // transfer funds
        IERC20(purchaseToken).safeTransferFrom(buyer, purchaseRecipient, price);

        // mint token; decrement supply
        tokenId = IERC721TypeExchangeable(token).mint(_to, _tokenType);
        sale.supply = sale.supply - 1;

        // events
        emit Purchase(buyer, _tokenType, _to, price, tokenId);
        if (purchaseRecipient != address(this)) {
            emit Claim(purchaseRecipient, price);
        }
    }

    // @notice Creates a sale for the tokenType, which must not have been previously {createSale}d.
    // @param _tokenType The token type sold by this sale.
    // @param _price The amount (in {purchaseToken}) charged to mint a token of `tokenType`
    // @param _supply The quantity initially available
    // @param _startBlock The block at which the sale begins
    // @param _endBlock The block at which the sale ends; if 0, sale does not end.
    // @param _recipient The recipient of sale proceeds; if zero, falls back to
    // global {recipient}.
    function createSale(uint256 _tokenType, uint256 _price, uint256 _supply, uint32 _startBlock, uint32 _endBlock, address _recipient) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleTokenSale: must have MANAGER role to createSale");
        require(!saleExists[_tokenType], "BasicCollectibleTokenSale: already created");

        saleInfo[_tokenType] = SaleInfo({
            price: _price,
            supply: _supply,
            startBlock: _startBlock,
            endBlock: _endBlock,
            recipient: _recipient
        });
        saleExists[_tokenType] = true;

        emit SaleCreation(_tokenType);
        emit SaleUpdate(_tokenType, _price, _supply, _startBlock, _endBlock, _recipient);
    }

    // @notice Update the sale for the tokenType, which must have been previously {createSale}d.
    // @param _tokenType The token type sold by this sale.
    // @param _price The amount (in {purchaseToken}) charged to mint a token of `tokenType`
    // @param _supply The quantity initially available
    // @param _startBlock The block at which the sale begins
    // @param _endBlock The block at which the sale ends; if 0, sale does not end.
    // @param _recipient The recipient of sale proceeds; if zero, falls back to
    // global {recipient}.
    // @param _overwriteRecipient Apply the _recipient value provided; otherwise, ignored.
    function setSale(uint256 _tokenType, uint256 _price, uint256 _supply, uint32 _startBlock, uint32 _endBlock, address _recipient, bool _overwriteRecipient) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleTokenSale: must have MANAGER role to alter sales");
        require(saleExists[_tokenType], "BasicCollectibleTokenSale: not created");

        SaleInfo storage sale = saleInfo[_tokenType];
        sale.price = _price;
        sale.supply = _supply;
        sale.startBlock = _startBlock;
        sale.endBlock = _endBlock;
        if (_overwriteRecipient) {
            sale.recipient = _recipient;
        }

        emit SaleUpdate(_tokenType, _price, _supply, _startBlock, _endBlock, _recipient);
    }

    // @notice Update the sale price for the tokenType, which must have been previously {createSale}d.
    // @param _tokenType The token type sold by this sale.
    // @param _price The amount (in {purchaseToken}) charged to mint a token of `tokenType`
    function setPrice(uint256  _tokenType, uint256 _price) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleTokenSale: must have MANAGER role to alter sales");
        require(saleExists[_tokenType], "BasicCollectibleTokenSale: not created");

        SaleInfo storage sale = saleInfo[_tokenType];
        sale.price = _price;

        emit SaleUpdate(_tokenType, sale.price, sale.supply, sale.startBlock, sale.endBlock, sale.recipient);
    }

    // @notice Update the inventory supply for the given sale, which must have been
    // previously {createSale}d
    // @param _tokenType The token type sold by this sale.
    // @param _supply The quantity available
    function setSupply(uint256  _tokenType, uint256 _supply) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleTokenSale: must have MANAGER role to alter sales");
        require(saleExists[_tokenType], "BasicCollectibleTokenSale: not created");

        SaleInfo storage sale = saleInfo[_tokenType];
        sale.supply = _supply;

        emit SaleUpdate(_tokenType, sale.price, sale.supply, sale.startBlock, sale.endBlock, sale.recipient);
    }

    // @notice Update the inventory supply for the given sale, which must have been
    // previously {createSale}d
    // @param _tokenType The token type sold by this sale.
    // @param _additionalSupply The amount of additional inventory to add to the supply
    function addSupply(uint256  _tokenType, uint256 _additionalSupply) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleTokenSale: must have MANAGER role to alter sales");
        require(saleExists[_tokenType], "BasicCollectibleTokenSale: not created");

        SaleInfo storage sale = saleInfo[_tokenType];
        sale.supply = sale.supply + _additionalSupply;

        emit SaleUpdate(_tokenType, sale.price, sale.supply, sale.startBlock, sale.endBlock, sale.recipient);
    }

    // @notice Update the inventory supply for the given sale, which must have been
    // previously {createSale}d
    // @param _tokenType The token type sold by this sale.
    // @param _supplyToRemove The amount of inventory to remove.
    // @param _zeroSafe Whether to safely set the supply to zero if removing the
    // specified amount would produce a negative number. Otherwise reverts in that
    // context.
    function removeSupply(uint256  _tokenType, uint256 _supplyToRemove, bool _zeroSafe) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleTokenSale: must have MANAGER role to alter sales");
        require(saleExists[_tokenType], "BasicCollectibleTokenSale: not created");

        SaleInfo storage sale = saleInfo[_tokenType];
        if (_zeroSafe && sale.supply < _supplyToRemove) {
            sale.supply = 0;
        } else {
            sale.supply = sale.supply - _supplyToRemove;
        }

        emit SaleUpdate(_tokenType, sale.price, sale.supply, sale.startBlock, sale.endBlock, sale.recipient);
    }

    // @notice Update the blocks during which this sale is active
    // @param _tokenType The token type whose sales will use this recipient.
    // @param _startBlock The block at which the sale begins
    // @param _endBlock The block at which the sale ends; if 0, sale does not end.
    function setSaleBlocks(uint256 _tokenType, uint32 _startBlock, uint32 _endBlock) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleTokenSale: must have MANAGER role to alter sales");
        require(saleExists[_tokenType], "BasicCollectibleTokenSale: not created");

        SaleInfo storage sale = saleInfo[_tokenType];
        sale.startBlock = _startBlock;
        sale.endBlock = _endBlock;

        emit SaleUpdate(_tokenType, sale.price, sale.supply, sale.startBlock, sale.endBlock, sale.recipient);
    }

    // @notice Update the recipient for this sale
    // @param _tokenType The token type whose sales will use this recipient.
    // @param _recipient The address to send proceeds for this sale; if zero, proceeds
    // are kept in this contract until retrieved.
    function setSaleRecipient(uint256 _tokenType, address _recipient) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleTokenSale: must have MANAGER role to alter sales");
        require(saleExists[_tokenType], "BasicCollectibleTokenSale: not created");

        SaleInfo storage sale = saleInfo[_tokenType];
        sale.recipient = _recipient;

        emit SaleUpdate(_tokenType, sale.price, sale.supply, sale.startBlock, sale.endBlock, sale.recipient);
    }

    // @notice Update the recipient, a default target of sale proceeds.
    // @param _recipient The fallback address to send sale proceeds if the
    // given sale has no recipient set; if zero, proceeds are kept in this
    // contract until retrieved.
    function setRecipient(address _recipient) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleTokenSale: must have MANAGER role to set recipient");
        emit RecipientSet(recipient, _recipient);
        recipient = _recipient;
    }

    // @notice Claim all proceeds from sales (in {purchaseToken}). Only available to the
    // current recipient.
    // @param _to The address to transfer the tokens.
    function claimAll(address _to) public {
        require(
            hasRole(MANAGER_ROLE, _msgSender()),
            "BasicCollectibleTokenSale: only recipient or MANAGER may claim"
        );
        uint256 amount = IERC20(purchaseToken).balanceOf(address(this));
        IERC20(purchaseToken).transfer(_to, amount);
        emit Claim(_to, amount);
    }

    // @notice Claim proceeds from sales (in {purchaseToken}). Only available to the
    // current recipient.
    // @param _to The address to transfer the tokens.
    // @param _amount The amount to transfer.
    function claim(address _to, uint256 _amount) public {
        require(
            hasRole(MANAGER_ROLE, _msgSender()),
            "BasicCollectibleTokenSale: only recipient or MANAGER may claim"
        );
        IERC20(purchaseToken).transfer(_to, _amount);
        emit Claim(_to, _amount);
    }
}
