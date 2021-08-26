// SPDX-License-Identifier: MIT
import "./BaseDirectCollectibleSale.sol";
import "../../../utils/libraries/FractionalExponentsLibrary.sol";

// @notice A direct sale of Collectible tokens with some basic behavior, and
// snap-up price curves. These curves set a minimum price when quantities are
// high, but as they decline, the resulting price will go up along a curve
// defined by y = ((t - s) * (a / b)) ^ (n / d) with `s` the supply and `t` some
// "low supply" threshold for price increases. When `s > x` the minimum price
// is used. In most cases, the threshold supply `x` should be the total supply
// to be sold, with the mininum price setting an initially flat curve.
pragma solidity ^0.8.0;
abstract contract BaseDirectCollectibleSaleSnapUpPricing is BaseDirectCollectibleSale {

  struct ItemPricing {
      uint256 minimumPrice;
      uint256 thresholdSupply;
      uint256 rounding;

      uint256 scalarN;
      uint256 scalarD;
      uint256 expN;
      uint256 expD;
  }

  ItemPricing[] public itemPricing;

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
      for (uint256 i = 0; i < _count; i++) {
          _price += _itemPrice(pricing, supply - i);
      }
  }

  // @dev Calculates the current price to purchase an item when `_supply` of it
  // remains.
  function _itemPrice(ItemPricing memory _pricing, uint256 _supply) internal pure returns (uint256 _price) {
      if (_supply > _pricing.thresholdSupply) {
          return _pricing.minimumPrice;
      }

      (uint256 realPrice,) = FractionalExponentsLibrary.power(
          _pricing.scalarN * (_pricing.thresholdSupply - _supply),
          _pricing.scalarD,
          _pricing.expN,
          _pricing.expD
      );

      // round
      uint256 roundedPrice = (realPrice / _pricing.rounding) * _pricing.rounding;
      return (roundedPrice < _pricing.minimumPrice) ? _pricing.minimumPrice : roundedPrice;
  }

  /**
   * Set pricing for item `_itemId`.
   * @param _roundDecimals The number of decimals to round (down to zero).
   * e.g. for an 18-decimal payment token, using "18" will ensure whole-number
   * prices.  Using "16" will result in "dollars and cents" pricing. etc.
   * This rounding factor is not applied to the input `_minimumPrice`.
   * @param _thresholdSupply The supply at which low-supply price calculations
   * begin to be used (above this number the minimum price applies). Recommendation:
   * set this value to the _maximum_ supply the store will hold, and use _minimumPrice
   * as a control.
   * @param _minimumPrice The minimum price for this item.
   * @param _scalar In price = (xa / b) ^ (m / n), the values [a, b]
   * @param _exp In price = (xa / b) ^ (m / n), the values [m, n]
   */
  function _setPricing(
      uint256 _itemId,
      uint256 _minimumPrice,
      uint256 _thresholdSupply,
      uint256 _roundDecimals,
      uint256[] calldata _scalar,
      uint256[] calldata _exp
  ) internal {
      require(_scalar.length == 2, "BaseDirectCollectibleSaleSnapUpPricing: scalar and exp must have length 2 (numerator and demoninator)");
      require(_exp.length == 2, "BaseDirectCollectibleSaleSnapUpPricing: scalar and exp must have length 2 (numerator and demoninator)");
      require(_scalar[1] > 0, "BaseDirectCollectibleSaleSnapUpPricing: denominators must be nonzero");
      require(_exp[1] > 0, "BaseDirectCollectibleSaleSnapUpPricing: denominators must be nonzero");

      ItemPricing storage pricing = itemPricing[_itemId];
      pricing.minimumPrice = _minimumPrice;
      pricing.thresholdSupply = _thresholdSupply;
      pricing.rounding = 10 ** _roundDecimals;
      pricing.scalarN = _scalar[0];
      pricing.scalarD = _scalar[1];
      pricing.expN = _exp[0];
      pricing.expD = _exp[1];
  }

  function _afterCreateItem(uint256 _itemId, address _token, uint256 _tokenType, bool _available) internal override virtual {
      itemPricing.push(ItemPricing({
          minimumPrice: 0,
          thresholdSupply: 0,
          rounding: 1,
          scalarN: 0,
          scalarD: 1,
          expN: 0,
          expD: 1
      }));

      super._afterCreateItem(_itemId, _token, _tokenType, _available);
  }
}
