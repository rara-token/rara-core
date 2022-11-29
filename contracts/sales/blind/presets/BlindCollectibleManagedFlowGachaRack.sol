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

    // Internal overrides
    function _afterCreateGame(uint256 _gameId, uint256 _drawPrice, uint256 _blocksToReveal) internal virtual override(
        BaseBlindCollectibleGachaRack,
        BaseBlindCollectibleGachaRackLimitedFlow
    ) {
        super._afterCreateGame(_gameId, _drawPrice, _blocksToReveal);
    }
}
