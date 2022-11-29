import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

// A listener for changes to ERC721Collectible balances, for when accumulating
// effects occur based on the collectible(s) owned by a user.
pragma solidity ^0.8.0;
interface ITokenListener is IERC165 {
    // @dev Informs the listener that the token collection of the given use has changed.
    // this call is streamlined (does not indicate which tokens have been added
    // or removed) to avoid a large transaction cost for batch transfers.
    function balanceChanged(address _owner) external;
}
