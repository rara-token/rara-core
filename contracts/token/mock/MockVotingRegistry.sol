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

    function set(address _user, uint256 _votes, uint256 _level) public {
        totalVotes = totalVotes + _votes - getCurrentVotes[_user];
        getCurrentVotes[_user] = _votes;
        getCurrentLevel[_user] = _level;

        uint256 blockNumber = block.number;
        uint256 nCheckpoints = numCheckpoints[_user];
        if (nCheckpoints > 0 && checkpoints[_user][nCheckpoints - 1].fromBlock == blockNumber) {
            checkpoints[_user][nCheckpoints - 1].votes = _votes;
            checkpoints[_user][nCheckpoints - 1].level = _level;
        } else {
            checkpoints[_user][nCheckpoints] = Checkpoint(blockNumber, _votes, _level);
            numCheckpoints[_user] = nCheckpoints + 1;
        }
    }

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint blockNumber)
        external
        view
        override
        returns (uint256)
    {
        require(blockNumber < block.number, "MockVotingRegistry::getPriorVotes: not yet determined");

        uint256 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint256 lower = 0;
        uint256 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint256 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }

    /**
     * @notice Determine the prior membershp level for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The membership level the account had as of the given block
     */
    function getPriorLevel(address account, uint blockNumber)
        external
        view
        override
        returns (uint256)
    {
        require(blockNumber < block.number, "MockVotingRegistry::getPriorLevel: not yet determined");

        uint256 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].level;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint256 lower = 0;
        uint256 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint256 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.level;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].level;
    }
}
