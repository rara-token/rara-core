import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title IERC721Collectible
 * @dev An ERC-721 Non-Fungible Token where each token is one of an enumerable
 * set of "types." Each token type has with a value (that may or may not correspond to
 * purchase / sale price; e.g. it may be "mining power"). The total value owned
 * by an address may be queried, as well as the number of types owned and list of
 * tokens by type. Types are enumerated 0...n-1.
 */
pragma solidity ^0.8.0;
interface IERC721Collectible is IERC721 {

  /**
   * @dev Emitted when `owner` acquires a token of type `tokenType` when previously
   * they had none (i.e. when {balanceOfOwnerByType} goes from 0 to 1 for `tokenType`).
   * Can be emitted multiple times for an owner if they lose and receive tokens
   * of this type repeatedly.
   */
  event OwnerTypeAdded(address indexed owner, uint256 indexed tokenType, uint256 indexed tokenId);

  /**
   * @dev Emitted when `owner` loses their last a token of type `tokenType`
   * (i.e. when {balanceOfOwnerByType} goes from 1 to 0 for `tokenType`).
   * Can be emitted multiple times for an owner if they lose and receive tokens
   * of this type repeatedly.
   */
  event OwnerTypeRemoved(address indexed owner, uint256 indexed tokenType, uint256 indexed tokenId);

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
   * @dev Returns the total amount of `type` tokens stored by the contract.
   */
  function totalSupplyByType(uint256 tType) external view returns (uint256);

  /**
   * @dev Returns the number of token types of which the indicated owner has at least one.
   */
  function ownerTypes(address owner) external view returns (uint256);

  /**
   * @dev Returns the `index`tn tokenType owned by the user, for indexes
   * ranging from 0 to {ownerTypes}.
   */
  function ownerTypeByIndex(address owner, uint256 index) external view returns  (uint256);

  /**
   * @dev Returns the number of tokens of type ``type`` in ``owner``'s account.
   */
  function balanceOfOwnerByType(address owner, uint256 tType) external view returns (uint256);

  /**
   * @dev Returns a token ID owned by `owner` at the given `index` of all tokens
   * of the indicated `type`. Use along with {balanceOfOwnerByType} to enumerate
   * all of the ``owner``'s tokens of that type.
   */
  function tokenOfOwnerByTypeAndIndex(address owner, uint256 tType, uint256 index) external view returns (uint256);

  /**
   * @dev Returns a token ID at the given `index` of all tokens
   * of the indicated `type`. Use along with {totalSupplyByType} to enumerate
   * all of the tokens of that type.
   */
  function tokenByTypeAndIndex(uint256 tType, uint256 index) external view returns (uint256);

  /**
   * @dev Returns the type of the indicated `tokenId`.
   */
  function tokenType(uint256 tokenId) external view returns (uint256 tType);
}
