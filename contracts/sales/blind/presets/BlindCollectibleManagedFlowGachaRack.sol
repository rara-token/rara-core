import "../base/BaseBlindCollectibleGachaRackLimitedFlow.sol";
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
contract BlindCollectibleManagedFlowGachaRack is
    BaseBlindCollectibleGachaRackAssignedGames,
    BaseBlindCollectibleGachaRackLimitedFlow
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
        uint256 _prizeFlowNumerator,
        uint256 _prizeFlowDenominator,
        uint256 _prizeFlowStartBlock,
        uint256[] calldata _prizeTokenTypes,
        uint256[] calldata _prizeWeights
    ) public returns (uint256 gameId) {
        // call checks parameter validity / authorization
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_prizeTokenTypes.length == _prizeWeights.length, ERR_LENGTH);

        // create
        gameId = _createGame(_drawPrice, _blocksToReveal);

        // set flow and supply
        _setGameDrawFlowAndSupply(
            gameId,
            _prizeSupply,
            _prizeFlowNumerator,
            _prizeFlowDenominator,
            _prizeFlowStartBlock
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
        uint256 _prizeFlowNumerator,
        uint256 _prizeFlowDenominator,
        uint256 _prizeFlowStartBlock,
        uint256[] calldata _prizeTokenTypes,
        uint256[] calldata _prizeWeights
    ) public returns (uint256 gameId) {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_prizeTokenTypes.length == _prizeWeights.length, ERR_LENGTH);

        // create
        gameId = _createGame(_drawPrice, _blocksToReveal);

        // set flow and supply
        _setGameDrawFlowAndSupply(
            gameId,
            _prizeSupply,
            _prizeFlowNumerator,
            _prizeFlowDenominator,
            _prizeFlowStartBlock
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
    function _afterCreateGame(uint256 _gameId, uint256 _drawPrice, uint256 _blocksToReveal) internal virtual override(
        BaseBlindCollectibleGachaRack,
        BaseBlindCollectibleGachaRackLimitedFlow
    ) {
        super._afterCreateGame(_gameId, _drawPrice, _blocksToReveal);
    }

    // Prize Flow
    function setGameDrawFlowAndSupply(uint256 _gameId, uint256 _supply, uint256 _numerator, uint256 _denominator, uint256 _startBlock) external {
      require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
      require(_gameId < gameInfo.length, ERR_OOB);
      _setGameDrawFlowAndSupply(_gameId, _supply, _numerator, _denominator, _startBlock);
    }

    function setGameSupply(uint256 _gameId, uint256 _supply) external {
      require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
      require(_gameId < gameInfo.length, ERR_OOB);
      _setGameSupply(_gameId, _supply);
    }

    function setGameDrawFlow(uint256 _gameId, uint256 _numerator, uint256 _denominator, uint256 _startBlock) external {
      require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
      require(_gameId < gameInfo.length, ERR_OOB);
      _setGameDrawFlow(_gameId, _numerator, _denominator, _startBlock);
    }

    function setGameDrawPrice(uint256 _gameId, uint256 _drawPrice, uint256 _blocksToReveal) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);
        _updateGame(_gameId, _drawPrice,  _blocksToReveal);
    }
}
