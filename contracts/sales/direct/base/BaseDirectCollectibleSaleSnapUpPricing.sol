// SPDX-License-Identifier: MIT
import "./BaseDirectCollectibleSale.sol";
import "../../../utils/math/FractionalExponents.sol";

// @notice A direct sale of Collectible tokens with some basic behavior, and
// snap-up price curves. These curves set a minimum price when quantities are
// high, but as they decline, the resulting price will go up along a curve
// defined by y = ((t - s) * (a / b)) ^ (n / d) with `s` the supply and `t` some
// "low supply" threshold for price increases. When `s > x` the minimum price
// is used. In most cases, the threshold supply `x` should be the total supply
// to be sold, with the mininum price setting an initially flat curve;  this
// results in (t - s) being the number sold so far.
pragma solidity ^0.8.0;
abstract contract BaseDirectCollectibleSaleSnapUpPricing is BaseDirectCollectibleSale {

  struct ItemPricing {
      uint256 minimum;
      uint256 scale;
      uint256 thresholdSupply;

      uint256 scalarN;
      uint256 scalarD;
      uint32 expN;
      uint32 expD;
  }

  ItemPricing[] public itemPricing;
  address public fractionalExponents;

  bool public immutable roundPrices;

  constructor(address _purchaseToken, address _fractionalExponents, bool _roundPrices, address _recipient)
  BaseDirectCollectibleSale(_purchaseToken, _recipient) {
      fractionalExponents = _fractionalExponents;
      roundPrices = _roundPrices;
  }

  // @dev Any internal updates necessary for bookkeeping before other changes are made to the item
  function updateItem(uint256 _itemId) public override virtual {
      super.updateItem(_itemId);
  }

  // @notice The current price to purchase `_count` of the indicated item.
  // This function involves moderately complex calculations that are linear
  // in `_count`, since each item is priced independently based on remaining
  // supply.
  function purchasePrice(uint256 _itemId, uint256 _count) public view override returns (uint256 _price) {
      ItemPricing memory pricing = itemPricing[_itemId];
      uint256 supply = availableItemSupply(_itemId);
      require(supply >= _count, "BaseDirectCollectibleSaleSnapUpPricing: insufficient supply");
      for (uint256 i = 0; i < _count; i++) {
          _price += _itemPrice(pricing, supply - i);
      }
  }

  // @dev Calculates the current price to purchase an item when `_supply` of it
  // remains.
  function _itemPrice(ItemPricing memory _pricing, uint256 _supply) internal view returns (uint256 _price) {
      if (_supply >= _pricing.thresholdSupply) {
          // above snap-up pricing threshold; use minimum
          return _pricing.minimum;
      }

      uint256 N = _pricing.scalarN * (_pricing.thresholdSupply - _supply);
      if (N < _pricing.scalarD) {
          // invalid base for power approximation; N/D < 1 produces negative
          // log, a uint underflow
          return _pricing.minimum;
      }

      (uint256 unscaledPrice, uint8 precExp) = FractionalExponents(fractionalExponents)
          .power(N, _pricing.scalarD, _pricing.expN,  _pricing.expD);
      uint256 precision = 2 ** precExp;

      // if rounding prices, discard all precision to get an integer result,
      // then multiply by price scale. (add 1/2 precision to get a _rounded_ number,
      // not floor). Otherwise, multiply by price scale, then divide out the precision.
      uint256 price = roundPrices
          ? ((unscaledPrice + precision / 2) / precision) * _pricing.scale
          : (unscaledPrice * _pricing.scale + precision / 2) / precision;

      // scale
      return price < _pricing.minimum ? _pricing.minimum : price;
  }

  /**
   * Set pricing for item `_itemId`.
   * @param _priceMinimum The minimum price for this item (will be scaled by _priceScaleDecimals)
   * @param _priceScaleDecimals The number of decimals to scale up prices. Might
   * be equal to the "digits" of the currency, but only if you want whole-number
   * pricing. This scale factor will be applied (as appended zeros) to both the
   * minimum price and any calcuated snap-up pricing.
   * @param _thresholdSupply The supply at which low-supply price calculations
   * begin to be used (above this number the minimum price applies). Recommendation:
   * set this value to the _maximum_ supply the store will hold, and use _priceMinimum
   * as a control.

   * @param _scalar In price = (xa / b) ^ (m / n), the values [a, b]
   * @param _exp In price = (xa / b) ^ (m / n), the values [m, n]
   */
  function _setPricing(
      uint256 _itemId,
      uint256 _priceMinimum,
      uint256 _priceScaleDecimals,
      uint256 _thresholdSupply,
      uint256[] calldata _scalar,
      uint32[] calldata _exp
  ) internal {
      require(_scalar.length == 2, "BaseDirectCollectibleSaleSnapUpPricing: scalar and exp must have length 2 (numerator and demoninator)");
      require(_exp.length == 2, "BaseDirectCollectibleSaleSnapUpPricing: scalar and exp must have length 2 (numerator and demoninator)");
      require(_scalar[1] > 0, "BaseDirectCollectibleSaleSnapUpPricing: denominators must be nonzero");
      require(_exp[1] > 0, "BaseDirectCollectibleSaleSnapUpPricing: denominators must be nonzero");

      uint256 scale = 10 ** _priceScaleDecimals;

      ItemPricing storage pricing = itemPricing[_itemId];
      pricing.minimum = _priceMinimum * scale;
      pricing.scale = scale;
      pricing.thresholdSupply = _thresholdSupply;
      pricing.scalarN = _scalar[0];
      pricing.scalarD = _scalar[1];
      pricing.expN = _exp[0];
      pricing.expD = _exp[1];
  }

  function _afterCreateItem(uint256 _itemId, address _token, uint256 _tokenType, bool _available) internal override virtual {
      itemPricing.push(ItemPricing({
          minimum: 0,
          scale: 1,
          thresholdSupply: 0,
          scalarN: 0,
          scalarD: 1,
          expN: 0,
          expD: 1
      }));

      super._afterCreateItem(_itemId, _token, _tokenType, _available);
  }
}
