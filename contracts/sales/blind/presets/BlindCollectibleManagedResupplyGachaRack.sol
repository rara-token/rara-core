import "../base/BaseBlindCollectibleGachaRackRegularResupply.sol";
import "../base/BaseBlindCollectibleGachaRackAssignedGames.sol";

/**
 * @notice A GachaRack distributing Rara collectibles in a managed way.
 * Allows updates of prizes and their distribution through the creation of
 * new games (games cannot be altered once activated, meaning probabilities
 * and prizes become fixed).
 *
 * In addition, specific users can be assigned to specific games, e.g. to
 * reward high-profile users with better distributions or a reliable flow
 * of draw opportunities.
 *
 * Each game produces a flow of available draws, and / or uses a fixed supply;
 * these are game-specific.
 */
pragma solidity ^0.8.0;
contract BlindCollectibleManagedResupplyGachaRack is
    BaseBlindCollectibleGachaRackAssignedGames,
    BaseBlindCollectibleGachaRackRegularResupply
{
    constructor(address _prizeToken, address _purchaseToken, address _eip210, address _recipient)
    BaseBlindCollectibleGachaRack(_prizeToken, _purchaseToken, _eip210, _recipient)
    { }

    // Game creation / activation

    function createActivatedGame(
        bool _makeDefault,
        uint256 _drawPrice,
        uint256 _blocksToReveal,
        uint256 _prizeSupply,
        uint256 _prizePeriodDuration,
        uint256 _prizePeriodAnchorTime,
        uint256 _openTime,
        uint256 _closeTime,
        uint256[] calldata _prizeTokenTypes,
        uint256[] calldata _prizeWeights
    ) public returns (uint256 gameId) {
        // call checks parameter validity / authorization
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_prizeTokenTypes.length == _prizeWeights.length, ERR_LENGTH);

        // create
        gameId = _createGame(_drawPrice, _blocksToReveal);

        // set supply period
        _setGameSupplyPeriod(
            gameId,
            _prizeSupply,
            _prizePeriodDuration,
            _prizePeriodAnchorTime,
            true
        );

        _setGameTime(
            gameId,
            _openTime,
            _closeTime
        );

        // create prizes
        for (uint256 i = 0; i < _prizeTokenTypes.length; i++) {
            _createPrize(gameId, _prizeTokenTypes[i], _prizeWeights[i]);
        }

        // activate
        _activateGame(gameId);
        if (_makeDefault) {
            _setDefaultGame(gameId);
        }
    }

    // @notice Create a new game and populate it with prizes and a supply rate.
    // Does NOT activate the game; prize changes can still be made.
    function createUnactivatedGame(
        uint256 _drawPrice,
        uint256 _blocksToReveal,
        uint256 _prizeSupply,
        uint256 _prizePeriodDuration,
        uint256 _prizePeriodAnchorTime,
        uint256 _openTime,
        uint256 _closeTime,
        uint256[] calldata _prizeTokenTypes,
        uint256[] calldata _prizeWeights
    ) public returns (uint256 gameId) {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_prizeTokenTypes.length == _prizeWeights.length, ERR_LENGTH);

        // create
        gameId = _createGame(_drawPrice, _blocksToReveal);

        // set supply period
        _setGameSupplyPeriod(
            gameId,
            _prizeSupply,
            _prizePeriodDuration,
            _prizePeriodAnchorTime,
            true
        );

        _setGameTime(
            gameId,
            _openTime,
            _closeTime
        );

        // create prizes
        for (uint256 i = 0; i < _prizeTokenTypes.length; i++) {
            _createPrize(gameId, _prizeTokenTypes[i], _prizeWeights[i]);
        }
    }

    function activateGame(uint256 _gameId, bool _makeDefault) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameCount(), ERR_OOB);
        _activateGame(_gameId);
        if (_makeDefault) {
            _setDefaultGame(_gameId);
        }
    }

    // Prize creation (if doesn't fit in one transaction)

    function createPrizes(uint256 _gameId, uint256[] calldata _prizeTokenTypes, uint256[] calldata _prizeWeights) public returns (uint256[] memory prizeIds) {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameCount(), ERR_OOB);
        require(_prizeTokenTypes.length == _prizeWeights.length, ERR_LENGTH);
        prizeIds = new uint256[](_prizeTokenTypes.length);
        for (uint256 i = 0; i < _prizeTokenTypes.length; i++) {
            prizeIds[i] = _createPrize(_gameId, _prizeTokenTypes[i], _prizeWeights[i]);
        }
    }

    function updatePrizes(uint256 _gameId, uint256[] calldata _prizeIds, uint256[] calldata _prizeTokenTypes, uint256[] calldata _prizeWeights) public {
      require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
      require(_gameId < gameCount(), ERR_OOB);
      require(
          _prizeIds.length == _prizeTokenTypes.length && _prizeTokenTypes.length == _prizeWeights.length,
          ERR_LENGTH
      );
      for (uint256 i = 0; i < _prizeIds.length; i++) {
          _updatePrize(_gameId, _prizeIds[i], _prizeTokenTypes[i], _prizeWeights[i]);
      }
    }

    // Managing game assignments

    function currentGameFor(address _user) external view returns (uint256 gameId) {
        return _currentGameFor(_user);
    }

    function availableSupplyForUser(address _user) external view returns (uint256 supply) {
        uint256 _gameId = _currentGameFor(_user);
        return _availableSupplyFor(_user, _gameId);
    }

    function availableSupplyForGame(uint256 _gameId) external view returns (uint256 supply) {
        return _availableSupplyFor(_msgSender(), _gameId);
    }

    function drawPriceFor(address _user) external view returns (uint256) {
        uint256 _gameId = _currentGameFor(_user);
        return gameInfo[_gameId].drawPrice;
    }

    function setDefaultGame(uint256 _gameId) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameCount(), ERR_OOB);
        _setDefaultGame(_gameId);
    }

    // Internal overrides
    function _afterPurchase(address _buyer, uint256 _gameId, address _to, uint256 _draws, uint256 _cost) internal virtual override(
        BaseBlindCollectibleGachaRack,
        BaseBlindCollectibleGachaRackRegularResupply
    ) {
        super._afterPurchase(_buyer, _gameId, _to, _draws, _cost);
    }

    function _afterCreateGame(uint256 _gameId, uint256 _drawPrice, uint256 _blocksToReveal) internal virtual override(
        BaseBlindCollectibleGachaRack,
        BaseBlindCollectibleGachaRackRegularResupply
    ) {
        super._afterCreateGame(_gameId, _drawPrice, _blocksToReveal);
    }

    function updateGameSupplyPeriod(uint256 _gameId) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);
        _updateGameSupplyPeriod(_gameId, false);
    }

    function setGameTime(uint256 _gameId, uint256 _openTime, uint256 _closeTime) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);
        _setGameTime(_gameId, _openTime, _closeTime);
    }

    function setGameSupplyPeriod(uint256 _gameId, uint256 _supply, uint256 _duration, uint256 _anchorTime, bool _immediate) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);
        _setGameSupplyPeriod(_gameId, _supply, _duration, _anchorTime, _immediate);
    }

    function setGameSupply(uint256 _gameId, uint256 _supply) public {
          require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
          require(_gameId < gameInfo.length, ERR_OOB);
          _setGameSupply(_gameId, _supply);
    }

    function addGameSupply(uint256 _gameId, uint256 _supply) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);
        _addGameSupply(_gameId, _supply);
    }

    function setGameDrawPrice(uint256 _gameId, uint256 _drawPrice, uint256 _blocksToReveal) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);
        _updateGame(_gameId, _drawPrice,  _blocksToReveal);
    }
}
