import "./BaseBlindCollectibleGachaRack.sol";

pragma solidity ^0.8.0;
abstract contract BaseBlindCollectibleGachaRackRegularResupply is BaseBlindCollectibleGachaRack {

    struct GameSupplyInfo {
        uint256 supply;
        uint256 duration;
        uint256 anchorTime;

        uint256 openTime;
        uint256 closeTime;

        uint256 currentSupply;
        uint256 currentPeriodStartTime;
    }

    GameSupplyInfo[] public gameSupplyInfo;

    function periodStartTime(uint256 timestamp, uint256 _duration, uint256 _anchor) public pure returns (uint256) {
        // using periodAnchorTime and periodDuration, determine the appropriate
        // "start time" for a period that includes that timestamp.
        uint256 anchorOffset = _anchor % _duration;
        return ((timestamp - anchorOffset) / _duration) * _duration + anchorOffset;
    }

    function _updateGameSupplyPeriod(uint256 _gameId, bool _force) internal {
        GameSupplyInfo storage info = gameSupplyInfo[_gameId];
        if (_force || info.currentPeriodStartTime + info.duration <= block.timestamp) {
          info.currentPeriodStartTime = periodStartTime(block.timestamp, info.duration, info.anchorTime);
          info.currentSupply = info.supply;
        }
    }

    function setGameTime(uint256 _gameId, uint256 _openTime, uint256 _closeTime) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);

        GameSupplyInfo storage info = gameSupplyInfo[_gameId];
        info.openTime = _openTime;
        info.closeTime = _closeTime;
    }

    function setGameSupplyPeriod(uint256 _gameId, uint256 _supply, uint256 _duration, uint256 _anchorTime, bool _immediate) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);

        require(_duration > 0, ERR_NONZERO);
        GameSupplyInfo storage info = gameSupplyInfo[_gameId];
        info.supply = _supply;
        info.duration = _duration;
        info.anchorTime = _anchorTime;
        _updateGameSupplyPeriod(_gameId, _immediate);
    }

    function setGameSupply(uint256 _gameId, uint256 _supply) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);

        _updateGameSupplyPeriod(_gameId, false);
        gameSupplyInfo[_gameId].currentSupply = _supply;
    }

    function addGameSupply(uint256 _gameId, uint256 _supply) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);

        _updateGameSupplyPeriod(_gameId, false);
        gameSupplyInfo[_gameId].currentSupply += _supply;
    }

    function _availableSupplyFor(address, uint256 _gameId) internal view override virtual returns (uint256 _supply) {
        if (_gameId >= gameSupplyInfo.length) {
            return 0;
        }

        GameSupplyInfo storage info = gameSupplyInfo[_gameId];
        if (block.timestamp < info.openTime || (info.closeTime > 0 && info.closeTime <= block.timestamp)) {
            return  0;
        }

        if (info.currentPeriodStartTime + info.duration <= block.timestamp) {
            _supply = info.supply;
        } else {
            _supply = info.currentSupply;
        }
    }

    function _afterPurchase(address _buyer, uint256 _gameId, address _to, uint256 _draws, uint256 _cost) internal override virtual {
        _updateGameSupplyPeriod(_gameId, false);
        gameSupplyInfo[_gameId].currentSupply -= _draws;

        super._afterPurchase(_buyer, _gameId, _to, _draws, _cost);
    }

    function _afterCreateGame(uint256 _gameId, uint256 _drawPrice, uint256 _blocksToReveal) internal override virtual {
        gameSupplyInfo.push(GameSupplyInfo({
            supply: 0,
            duration: 86400,
            anchorTime: 0,
            openTime: 0,
            closeTime: 0,
            currentSupply: 0,
            currentPeriodStartTime: 0
        }));

        super._afterCreateGame(_gameId, _drawPrice, _blocksToReveal);
    }
}
