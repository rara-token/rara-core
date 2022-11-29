import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title IERC721Valuable
 * @dev An ERC-721 Non-Fungible Token where each token has with a value.
 * That value may or may not correspond to purchase / sale price;  (that may or may not correspond to
 * purchase / sale price; e.g. it may be "mining power"). The total value owned
 * by an address may be queried.
 */
pragma solidity ^0.8.0;
interface IERC721Valuable is IERC721 {
  /**
   * @dev Returns the total value of tokens stored by this contract.
   */
  function totalValue() external view returns (uint256);

  /**
   * @dev Returns the total value of all tokens owned by the given address.
   */
  function ownerValue(address owner) external view returns (uint256);

  /**
   * @dev Returns the value of the indicated token, by ID.
   */
  function tokenValue(uint256 tokenId) external view returns (uint256);
}
