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
    ) public returns (uint256 _gameId) {
        // call checks parameter validity / authorization
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to create game");
        require(_prizeTokenTypes.length == _prizeWeights.length, "BlindCollectibleManagedResupplyGachaRack: prize types and weights must match length");

        // create
        _gameId = _createGame(_drawPrice, _blocksToReveal);

        // set supply period
        _setGameSupplyPeriod(
            _gameId,
            _prizeSupply,
            _prizePeriodDuration,
            _prizePeriodAnchorTime,
            true
        );

        _setGameTime(
            _gameId,
            _openTime,
            _closeTime
        );

        // create prizes
        for (uint256 i = 0; i < _prizeTokenTypes.length; i++) {
            _createPrize(_gameId, _prizeTokenTypes[i], _prizeWeights[i]);
        }

        // activate
        _activateGame(_gameId);
        if (_makeDefault) {
            _setDefaultGame(_gameId);
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
    ) public returns (uint256 _gameId) {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to create game");
        require(_prizeTokenTypes.length == _prizeWeights.length, "BlindCollectibleManagedResupplyGachaRack: prize types and weights must match length");

        // create
        _gameId = _createGame(_drawPrice, _blocksToReveal);

        // set supply period
        _setGameSupplyPeriod(
            _gameId,
            _prizeSupply,
            _prizePeriodDuration,
            _prizePeriodAnchorTime,
            true
        );

        _setGameTime(
            _gameId,
            _openTime,
            _closeTime
        );

        // create prizes
        for (uint256 i = 0; i < _prizeTokenTypes.length; i++) {
            _createPrize(_gameId, _prizeTokenTypes[i], _prizeWeights[i]);
        }
    }

    function activateGame(uint256 _gameId, bool _makeDefault) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to activate game");
        require(_gameId < gameCount(), "BlindCollectibleManagedResupplyGachaRack: invalid gameId");
        _activateGame(_gameId);
        if (_makeDefault) {
            _setDefaultGame(_gameId);
        }
    }

    // Prize creation (if doesn't fit in one transaction)

    function createPrizes(uint256 _gameId, uint256[] calldata _prizeTokenTypes, uint256[] calldata _prizeWeights) public returns (uint256[] memory prizeIds) {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to createPrizes");
        require(_gameId < gameCount(), "BlindCollectibleManagedResupplyGachaRack: invalid gameId");
        require(_prizeTokenTypes.length == _prizeWeights.length, "BlindCollectibleManagedResupplyGachaRack: prize types and weights must match length");
        prizeIds = new uint256[](_prizeTokenTypes.length);
        for (uint256 i = 0; i < _prizeTokenTypes.length; i++) {
            prizeIds[i] = _createPrize(_gameId, _prizeTokenTypes[i], _prizeWeights[i]);
        }
    }

    function updatePrizes(uint256 _gameId, uint256[] calldata _prizeIds, uint256[] calldata _prizeTokenTypes, uint256[] calldata _prizeWeights) public {
      require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to createPrizes");
      require(_gameId < gameCount(), "BlindCollectibleManagedResupplyGachaRack: invalid gameId");
      require(
          _prizeIds.length == _prizeTokenTypes.length && _prizeTokenTypes.length == _prizeWeights.length,
          "BlindCollectibleManagedResupplyGachaRack: prize ids, types, and weights must match length"
      );
      for (uint256 i = 0; i < _prizeIds.length; i++) {
          _updatePrize(_gameId, _prizeIds[i], _prizeTokenTypes[i], _prizeWeights[i]);
      }
    }

    // Managing game assignments

    function currentGameFor(address _user) external view returns (uint256 _gameId) {
        return _currentGameFor(_user);
    }

    function availableSupplyForUser(address _user) external view returns (uint256 _supply) {
        uint256 _gameId = _currentGameFor(_user);
        return _availableSupplyFor(_user, _gameId);
    }

    function availableSupplyForGame(uint256 _gameId) external view returns (uint256 _supply) {
        return _availableSupplyFor(_msgSender(), _gameId);
    }

    function drawPriceFor(address _user) external view returns (uint256) {
        uint256 _gameId = _currentGameFor(_user);
        return gameInfo[_gameId].drawPrice;
    }

    function assignGame(uint256 _gameId, address[] calldata _users) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to assignGame");
        require(_gameId < gameCount(), "BlindCollectibleManagedResupplyGachaRack: invalid gameId");
        for (uint256 i = 0; i < _users.length; i++) {
            _assignGame(_gameId, _users[i]);
        }
    }

    function clearAssignedGame(address[] calldata _users) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to clearAssignedGame");
        for (uint256 i = 0; i < _users.length; i++) {
            _clearAssignedGame(_users[i]);
        }
    }

    function setDefaultGame(uint256 _gameId) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to assignGame");
        require(_gameId < gameCount(), "BlindCollectibleManagedResupplyGachaRack: invalid gameId");
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
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to alter game supply");
        require(_gameId < gameInfo.length, "BlindCollectibleManagedResupplyGachaRack: nonexistent gameId");
        _updateGameSupplyPeriod(_gameId, false);
    }

    function setGameTime(uint256 _gameId, uint256 _openTime, uint256 _closeTime) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to alter game supply");
        require(_gameId < gameInfo.length, "BlindCollectibleManagedResupplyGachaRack: nonexistent gameId");
        _setGameTime(_gameId, _openTime, _closeTime);
    }

    function setGameSupplyPeriod(uint256 _gameId, uint256 _supply, uint256 _duration, uint256 _anchorTime, bool _immediate) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to alter game supply");
        require(_gameId < gameInfo.length, "BlindCollectibleManagedResupplyGachaRack: nonexistent gameId");
        _setGameSupplyPeriod(_gameId, _supply, _duration, _anchorTime, _immediate);
    }

    function setGameSupply(uint256 _gameId, uint256 _supply) public {
          require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to alter game supply");
          require(_gameId < gameInfo.length, "BlindCollectibleManagedResupplyGachaRack: nonexistent gameId");
          _setGameSupply(_gameId, _supply);
    }

    function addGameSupply(uint256 _gameId, uint256 _supply) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to alter game supply");
        require(_gameId < gameInfo.length, "BlindCollectibleManagedResupplyGachaRack: nonexistent gameId");
        _addGameSupply(_gameId, _supply);
    }

    function setGameDrawPrice(uint256 _gameId, uint256 _drawPrice, uint256 _blocksToReveal) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to alter game draw price");
        require(_gameId < gameInfo.length, "BlindCollectibleManagedResupplyGachaRack: nonexistent gameId");
        _updateGame(_gameId, _drawPrice,  _blocksToReveal);
    }
}
