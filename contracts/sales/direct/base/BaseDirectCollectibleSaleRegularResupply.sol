// SPDX-License-Identifier: MIT
import "./BaseDirectCollectibleSale.sol";

// @notice A direct sale of Collectible tokens with automatic resupplies happening every
// so often. Each resupply tops-up the supply to a given quantity, meaning
// if number of "new items" added is only the difference between this quantity
// and the number remaining.
pragma solidity ^0.8.0;
abstract contract BaseDirectCollectibleSaleRegularResupply is BaseDirectCollectibleSale {

  struct ItemSupplyInfo {
      uint256 supply;
      uint256 duration;
      uint256 anchorTime;

      uint256 openTime;
      uint256 closeTime;

      uint256 totalSupply;
      uint256 currentPeriodStartTime;
  }

  ItemSupplyInfo[] public itemSupplyInfo;

  function availableItemSupply(uint256 _itemId) public view override returns (uint256 _supply) {
      if (_itemId >= itemSupplyInfo.length) {
          return 0;
      }

      ItemSupplyInfo storage info = itemSupplyInfo[_itemId];
      if (block.timestamp < info.openTime || (info.closeTime > 0 && info.closeTime <= block.timestamp)) {
          return  0;
      }

      if (!itemInfo[_itemId].available) {
          return 0;
      }

      if (info.duration > 0 && info.currentPeriodStartTime + info.duration <= block.timestamp) {
          _supply = info.supply;
      } else {
          _supply = info.totalSupply - itemReceiptId[_itemId].length;
      }
  }

  // @dev Any internal updates necessary for bookkeeping before other changes are made to the item
  function updateItem(uint256 _itemId) public override virtual {
      _updateItemSupplyPeriod(_itemId, false);
      super.updateItem(_itemId);
  }

  function periodStartTime(uint256 timestamp, uint256 _duration, uint256 _anchor) public pure returns (uint256 _start) {
      // using periodAnchorTime and periodDuration, determine the appropriate
      // "start time" for a period that includes that timestamp.
      if (_duration > 0) {
        uint256 anchorOffset = _anchor % _duration;
        _start = ((timestamp - anchorOffset) / _duration) * _duration + anchorOffset;
      }
  }

  function _updateItemSupplyPeriod(uint256 _itemId, bool _force) internal {
      ItemSupplyInfo storage info = itemSupplyInfo[_itemId];
      if (_force || (
        info.duration > 0 &&
        info.currentPeriodStartTime + info.duration <= block.timestamp
      )) {
        info.currentPeriodStartTime = periodStartTime(block.timestamp, info.duration, info.anchorTime);
        info.totalSupply = itemReceiptId[_itemId].length + info.supply;
      }
  }

  function _setItemTime(uint256 _itemId, uint256 _openTime, uint256 _closeTime) internal {
      ItemSupplyInfo storage info = itemSupplyInfo[_itemId];
      info.openTime = _openTime;
      info.closeTime = _closeTime;
  }

  function _setItemSupplyPeriod(uint256 _itemId, uint256 _supply, uint256 _duration, uint256 _anchorTime, bool _immediate) internal {
      require(
          _duration > 0 || (_anchorTime == 0 && _immediate),
          "BaseDirectCollectibleSaleRegularResupply: duration 0 (unlimited) requires anchorTime 0 and immediate update"
      );
      ItemSupplyInfo storage info = itemSupplyInfo[_itemId];
      info.supply = _supply;
      info.duration = _duration;
      info.anchorTime = _anchorTime;
      _updateItemSupplyPeriod(_itemId, _immediate);
  }

  function _setItemSupply(uint256 _itemId, uint256 _supply) internal {
      _updateItemSupplyPeriod(_itemId, false);
      itemSupplyInfo[_itemId].totalSupply = itemReceiptId[_itemId].length + _supply;
  }

  function _addItemSupply(uint256 _itemId, uint256 _supply) internal {
      _updateItemSupplyPeriod(_itemId, false);
      itemSupplyInfo[_itemId].totalSupply += _supply;
  }

  function _afterCreateItem(uint256 _itemId, address _token, uint256 _tokenType, bool _available) internal override virtual {
      itemSupplyInfo.push(ItemSupplyInfo({
          supply: 0,
          duration: 0,  // never ending
          anchorTime: 0,
          openTime: 0,
          closeTime: 0,
          totalSupply: 0,
          currentPeriodStartTime: 0
      }));

      super._afterCreateItem(_itemId, _token, _tokenType, _available);
  }
}
