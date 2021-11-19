import "./BaseBlindCollectibleGachaRack.sol";

/**
 * Extends {BlindCollectibleGachaRack} by assigning games to individual users
 * (along with a default game for those users not specifically assigned).
 * Managers can assign games to users and set the current default.
 */
pragma solidity ^0.8.0;
abstract contract BaseBlindCollectibleGachaRackAssignedGames is BaseBlindCollectibleGachaRack {

    struct GameAssignment {
        address user;
        uint256 gameId;
    }

    GameAssignment[] public gameAssignment;
    mapping(address => uint256) public gameAssignmentIndex;
    uint256 public defaultGameId;

    function _currentGameFor(address _user) internal override virtual view returns (uint256) {
        uint256 _index = gameAssignmentIndex[_user];
        if (_index < gameAssignment.length && gameAssignment[_index].user == _user) {
            return gameAssignment[_index].gameId;
        }
        return defaultGameId;
    }

    function _setDefaultGame(uint256 _gameId) internal {
        defaultGameId = _gameId;
    }

    function assignGame(uint256 _gameId, address[] calldata _users) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameCount(), ERR_OOB);
        for (uint256 i = 0; i < _users.length; i++) {
            address _user = _users[i];
            uint256 _index = gameAssignmentIndex[_user];
            if (_index >= gameAssignment.length || gameAssignment[_index].user != _user) {
                // not in array; add it
                gameAssignmentIndex[_user] = gameAssignment.length;
                gameAssignment.push(GameAssignment({
                    user: _user,
                    gameId: _gameId
                }));
            } else {
                gameAssignment[_index].gameId = _gameId;
            }
        }
    }

    function clearAssignedGame(address[] calldata _users) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        for (uint256 i = 0; i < _users.length; i++) {
            address _user = _users[i];
            uint256 _index = gameAssignmentIndex[_user];
            if (_index < gameAssignment.length && gameAssignment[_index].user == _user) {
                uint256 lastIndex = gameAssignment.length - 1;
                address lastUser = gameAssignment[lastIndex].user;
                // move last
                gameAssignment[_index] = gameAssignment[gameAssignment.length - 1];
                gameAssignmentIndex[lastUser] = _index;
                // delete
                gameAssignment.pop();
                delete gameAssignmentIndex[_user];
            }
        }
    }
}
