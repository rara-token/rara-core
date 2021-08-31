import "../base/BaseDirectCollectibleSaleSnapUpPricing.sol";
import "../base/BaseDirectCollectibleSaleRegularResupply.sol";

/**
 * @notice A direct sale of collectible tokens where each sale item represents
 * a tokenType sold in regularly resupplied quantities with "snap-up" pricing,
 * where the sale price of the item increases available supply drops.
 */
pragma solidity ^0.8.0;
contract DirectCollectibleSaleSnapUpPricing is
    BaseDirectCollectibleSaleSnapUpPricing,
    BaseDirectCollectibleSaleRegularResupply
{
    constructor(address _purchaseToken, address _fractionalExponents, address _recipient)
    BaseDirectCollectibleSaleSnapUpPricing(_purchaseToken, _fractionalExponents, true, _recipient)
    { }

    // Item creation

    // @notice Create a new item for sale with snap-up pricing. It will be
    // created with no supply; set resupply settings separately.
    // @param _token The token address to sell
    // @param _tokenType The token type to mint
    // @param _available Whether the item should be set available.
    // @param _priceMinimum The minimum sale price
    // @param _priceScaleDecimals The number of decimals to scale up the price (both minimum and snap-up)
    // @param _priceThresholdSupply The threshold item supply to apply price calculations
    // @param _priceScalar [numerator, denominator] Multiplied against #sold
    // @param _priceExp [numerator, denominator] Exponent for pricing
    function createItem(
        address _token,
        uint256 _tokenType,
        bool _available,
        uint256 _priceMinimum,
        uint256 _priceScaleDecimals,
        uint256 _priceThresholdSupply,
        uint256[] calldata _priceScalar,
        uint32[] calldata _priceExp
    ) external returns (uint256 _itemId) {
        // call checks parameter validity / authorization
        require(hasRole(MANAGER_ROLE, _msgSender()), "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to create item");

        // create
        _itemId = _createItem(_token, _tokenType, _available);

        // set pricing
        _setPricing(
            _itemId,
            _priceMinimum,
            _priceScaleDecimals,
            _priceThresholdSupply,
            _priceScalar,
            _priceExp
        );
    }

    // @notice Create a new item for sale with snap-up pricing and active
    // resupply. To simplify the parameter list, the resupply quantity
    // (`_resupplyParams[0]`) is used for the snap-up pricing supply threshold,
    // and the item is created with `available = true` (since `_openAndCloseTime`)
    // handles actual availability via block times).
    // @param _token The token address to sell
    // @param _tokenType The token type to mint
    // @param _resupplyParams [supply, duration, anchorTime] for resupply
    // @param _openAndCloseTime [openTime, closeTime] for sale
    // @param _priceMinimum The minimum sale price
    // @param _priceScaleDecimals The number of decimals to scale up the price (both minimum and snap-up)
    // @param _priceScalar [numerator, denominator] Multiplied against #sold
    // @param _priceExp [numerator, denominator] Exponent for pricing
    function createItemWithResupplyPricing(
        address _token,
        uint256 _tokenType,
        uint256[] calldata _resupplyParams,
        uint256[] calldata _openAndCloseTime,
        uint256 _priceMinimum,
        uint256 _priceScaleDecimals,
        uint256[] calldata _priceScalar,
        uint32[] calldata _priceExp
    ) external returns (uint256 _itemId) {
        // call checks parameter validity / authorization
        require(hasRole(MANAGER_ROLE, _msgSender()), "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to create item");
        require(_resupplyParams.length == 3, "DirectCollectibleSaleSnapUpPricing: _resupplyParams must have length 3");
        require(_openAndCloseTime.length == 2, "DirectCollectibleSaleSnapUpPricing: _openAndCloseTime must have length 2");

        // create
        _itemId = _createItem(_token, _tokenType, true);

        _setItemSupplyPeriod(
            _itemId,
            _resupplyParams[0],
            _resupplyParams[1],
            _resupplyParams[2],
            true
        );

        _setItemTime(
            _itemId,
            _openAndCloseTime[0],
            _openAndCloseTime[1]
        );

        // set pricing
        _setPricing(
            _itemId,
            _priceMinimum,
            _priceScaleDecimals,
            _resupplyParams[0],
            _priceScalar,
            _priceExp
        );
    }

    // batch operations

    function setItemsAvailable(uint256[] calldata _itemIds, bool _available) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item availability");
        for (uint256 i = 0; i < _itemIds.length; i++) {
            uint256 itemId = _itemIds[i];
            require(itemId < itemCount(), "DirectCollectibleSaleSnapUpPricing: invalid itemId");
            _setItemAvailable(itemId, _available);
        }
    }

    function setItemsTimes(uint256[] calldata _itemIds, uint256 _openTime, uint256 _closeTime) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item time");
        for (uint256 i = 0; i < _itemIds.length; i++) {
            uint256 itemId = _itemIds[i];
            require(itemId < itemCount(), "DirectCollectibleSaleSnapUpPricing: invalid itemId");
            _setItemTime(itemId, _openTime, _closeTime);
        }
    }

    // supply and pricing

    function setItemResupplyPricing(
        uint256 _itemId,
        uint256[] calldata _resupplyParams,
        uint256[] calldata _openAndCloseTime,
        bool _immediateResupply,
        uint256 _priceMinimum,
        uint256 _priceScaleDecimals,
        uint256[] calldata _priceScalar,
        uint32[] calldata _priceExp
    ) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item supply or pricing");
        require(_itemId < itemCount(), "DirectCollectibleSaleSnapUpPricing: invalid itemId");

        _setItemSupplyPeriod(
            _itemId,
            _resupplyParams[0],
            _resupplyParams[1],
            _resupplyParams[2],
            _immediateResupply
        );

        _setItemTime(_itemId, _openAndCloseTime[0], _openAndCloseTime[1]);

        // set pricing
        _setPricing(
            _itemId,
            _priceMinimum,
            _priceScaleDecimals,
            _resupplyParams[0],
            _priceScalar,
            _priceExp
        );
    }

    function setItemPricing(
        uint256 _itemId,
        uint256 _priceMinimum,
        uint256 _priceScaleDecimals,
        uint256 _priceThresholdSupply,
        uint256[] calldata _priceScalar,
        uint32[] calldata _priceExp
    ) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item supply or pricing");
        require(_itemId < itemCount(), "DirectCollectibleSaleSnapUpPricing: invalid itemId");

        // set pricing
        _setPricing(
            _itemId,
            _priceMinimum,
            _priceScaleDecimals,
            _priceThresholdSupply,
            _priceScalar,
            _priceExp
        );
    }

    function setItemResupply(
        uint256 _itemId,
        uint256[] calldata _resupplyParams,
        uint256[] calldata _openAndCloseTime,
        bool _immediate
    ) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item supply or pricing");
        require(_itemId < itemCount(), "DirectCollectibleSaleSnapUpPricing: invalid itemId");

        _setItemSupplyPeriod(
            _itemId,
            _resupplyParams[0],
            _resupplyParams[1],
            _resupplyParams[2],
            _immediate
        );

        _setItemTime(_itemId, _openAndCloseTime[0], _openAndCloseTime[1]);
    }

    function setItemSupply(
        uint256 _itemId,
        uint256 _supply
    ) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item supply or pricing");
        require(_itemId < itemCount(), "DirectCollectibleSaleSnapUpPricing: invalid itemId");

        _setItemSupply(_itemId, _supply);
    }

    function addItemSupply(
        uint256 _itemId,
        uint256 _supply
    ) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item supply or pricing");
        require(_itemId < itemCount(), "DirectCollectibleSaleSnapUpPricing: invalid itemId");

        _addItemSupply(_itemId, _supply);
    }

    // Internal overrides
    function _afterCreateItem(uint256 _itemId, address _token, uint256 _tokenType, bool _available) internal virtual override(
        BaseDirectCollectibleSaleRegularResupply,
        BaseDirectCollectibleSaleSnapUpPricing
    ) {
        super._afterCreateItem(_itemId, _token, _tokenType, _available);
    }

    function updateItem(uint256 _itemId) public virtual override(
        BaseDirectCollectibleSaleRegularResupply,
        BaseDirectCollectibleSaleSnapUpPricing
    ) {
        super.updateItem(_itemId);
    }
}
