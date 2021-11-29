import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title IERC721CollectibleOracle
 * @dev An oracle allowing non-collectible ERC721 tokens to function effectively
 * as collectibles, by reporting their tokenTypes.
 */
pragma solidity ^0.8.0;
interface IERC721CollectibleOracle {
  /**
   * @dev Returns the number of types in existence (including those that have zero
   * instances because all were burned). Use this to enumerate all types.
   */
  function totalTypes() external view returns (uint256);

  /**
   * @dev Returns a name for the indicated type.
   */
  function typeName(uint256 tType) external view returns (string memory);

  /**
   * @dev Returns a symbol for the indicated type.
   */
  function typeSymbol(uint256 tType) external view returns (string memory);

  /**
   * @dev Returns the type of the indicated `tokenId`.
   */
  function tokenType(address token, uint256 tokenId) external view returns (uint256 tType);
}
