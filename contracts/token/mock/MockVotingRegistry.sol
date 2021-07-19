pragma solidity ^0.8.0;

import "../interfaces/IVotingRegistry.sol";

contract MockVotingRegistry is IVotingRegistry {
    uint256 public override totalVotes;
    mapping(address => uint256) public override getCurrentVotes;
    mapping(address => uint256) public override getCurrentLevel;

    struct Checkpoint {
        uint256 fromBlock;
        uint256 votes;
        uint256 level;
    }

    mapping (address => mapping (uint256 => Checkpoint)) public checkpoints;
    mapping (address => uint256) numCheckpoints;

    function set(address _user, uint256 _votes, uint256 _level) {
        totalVotes = totalVotes + _votes - getCurrentVotes[_user];
        getCurrentVotes[_user] = _votes;
        getCurrentLevel[_user] = _level;

        uint256 blockNumber = block.number;
        uint256 nCheckpoints = numCheckpoints[_user];
        if (nCheckpoints > 0 && checkpoints[_user][nCheckpoints - 1].fromBlock == blockNumber) {
            checkpoints[_user][nCheckpoints - 1].votes = _votes;
            checkpoints[_user].level = _level;
        } else {
            checkpoints[_user][nCheckpoints] = Checkpoint(blockNumber, _votes, _level);
            numCheckpoints[_user] = nCheckpoints + 1;
        }
    }
}
