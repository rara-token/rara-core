import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./BlindCollectibleManagedResupplyGachaRack.sol";

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
contract BlindCollectibleManagedResupplyGachaRackHelper is Context, AccessControlEnumerable {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    string internal constant ERR_AUTH = "HELPER_AUTH";
    string internal constant ERR_LENGTH = "LENGTH";

    address public gachaRack;

    constructor(address _gachaRack) {
        gachaRack = _gachaRack;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/configure prizes
    }

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

        BlindCollectibleManagedResupplyGachaRack rack = BlindCollectibleManagedResupplyGachaRack(gachaRack);

        // create
        gameId = rack.createGame(_drawPrice, _blocksToReveal);

        // set supply period
        rack.setGameSupplyPeriod(
            gameId,
            _prizeSupply,
            _prizePeriodDuration,
            _prizePeriodAnchorTime,
            true
        );

        rack.setGameTime(
            gameId,
            _openTime,
            _closeTime
        );

        // create prizes
        for (uint256 i = 0; i < _prizeTokenTypes.length; i++) {
            rack.createPrize(gameId, _prizeTokenTypes[i], _prizeWeights[i]);
        }

        // activate
        rack.activateGame(gameId);
        if (_makeDefault) {
            rack.setDefaultGame(gameId);
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

        BlindCollectibleManagedResupplyGachaRack rack = BlindCollectibleManagedResupplyGachaRack(gachaRack);

        // create
        gameId = rack.createGame(_drawPrice, _blocksToReveal);

        // set supply period
        rack.setGameSupplyPeriod(
            gameId,
            _prizeSupply,
            _prizePeriodDuration,
            _prizePeriodAnchorTime,
            true
        );

        rack.setGameTime(
            gameId,
            _openTime,
            _closeTime
        );

        // create prizes
        for (uint256 i = 0; i < _prizeTokenTypes.length; i++) {
            rack.createPrize(gameId, _prizeTokenTypes[i], _prizeWeights[i]);
        }
    }

    function activateGame(uint256 _gameId, bool _makeDefault) public {
        BlindCollectibleManagedResupplyGachaRack rack = BlindCollectibleManagedResupplyGachaRack(gachaRack);

        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);

        rack.activateGame(_gameId);
        if (_makeDefault) {
            rack.setDefaultGame(_gameId);
        }
    }

    // Prize creation (if doesn't fit in one transaction)

    function createPrizes(uint256 _gameId, uint256[] calldata _prizeTokenTypes, uint256[] calldata _prizeWeights) public returns (uint256[] memory prizeIds) {
        BlindCollectibleManagedResupplyGachaRack rack = BlindCollectibleManagedResupplyGachaRack(gachaRack);

        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_prizeTokenTypes.length == _prizeWeights.length, ERR_LENGTH);

        prizeIds = new uint256[](_prizeTokenTypes.length);
        for (uint256 i = 0; i < _prizeTokenTypes.length; i++) {
            prizeIds[i] = rack.createPrize(_gameId, _prizeTokenTypes[i], _prizeWeights[i]);
        }
    }

    function updatePrizes(uint256 _gameId, uint256[] calldata _prizeIds, uint256[] calldata _prizeTokenTypes, uint256[] calldata _prizeWeights) public {
      BlindCollectibleManagedResupplyGachaRack rack = BlindCollectibleManagedResupplyGachaRack(gachaRack);

      require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
      require(
          _prizeIds.length == _prizeTokenTypes.length && _prizeTokenTypes.length == _prizeWeights.length,
          ERR_LENGTH
      );
      for (uint256 i = 0; i < _prizeIds.length; i++) {
          rack.updatePrize(_gameId, _prizeIds[i], _prizeTokenTypes[i], _prizeWeights[i]);
      }
    }

    function assignGame(uint256 _gameId, address[] calldata _users) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);

        BlindCollectibleManagedResupplyGachaRack rack = BlindCollectibleManagedResupplyGachaRack(gachaRack);
        for (uint256 i = 0; i < _users.length; i++) {
            rack.assignGame(_gameId, _users[i]);
        }
    }

    function clearAssignedGame(address[] calldata _users) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);

        BlindCollectibleManagedResupplyGachaRack rack = BlindCollectibleManagedResupplyGachaRack(gachaRack);
        for (uint256 i = 0; i < _users.length; i++) {
            rack.clearAssignedGame(_users[i]);
        }
    }
}
