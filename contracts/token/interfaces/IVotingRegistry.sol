// A listener for changes to ERC721Collectible balances, for when accumulating
// effects occur based on the collectible(s) owned by a user.
pragma solidity ^0.8.0;
interface IVotingRegistry {
    function totalVotes() external view returns (uint256);
    function getCurrentVotes(address account) external view returns (uint256);
    function getPriorVotes(address account, uint blockNumber) external view returns (uint256);
    function getCurrentLevel(address account) external view returns (uint256);
    function getPriorLevel(address account, uint blockNumber) external view returns (uint256);
}
