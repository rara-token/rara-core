import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

// A listener for changes to ERC721Collectible balances, for when accumulating
// effects occur based on the collectible(s) owned by a user.
pragma solidity ^0.8.0;
interface ITokenCollectionListener is IERC165 {
    function tokenAddedToCollection(address _owner, uint256 _tokenId) external;
    function tokenRemovedFromCollection(address _owner, uint256 _tokenId) external;
}
