import "./ICollectibleConverter.sol";

pragma solidity ^0.8.0;
interface IBankableCollectibleConverter is ICollectibleConverter {
  // @dev Bank the indicated tokens in the converter for later conversion into
  // a different token type by one of its recipes. Banked tokens may not be
  // recoverable; no recovery functions are specified in this interface, though
  // individual implementations are free to provide them if appropriate.
  //
  // The result of banking tokens is that a later {convert} operation must
  // only specify the remaining token required, not those already banked.
  function bank(uint256[] calldata _tokenIds) external;

  // @dev Returns the number of tokens of the given type currently banked by
  // `_user` of the given `_tokenType`. {bank} will increase this number;
  // {convert} will possibly reduce it.
  function bankedBalance(address _user, uint256 _tokenType) external view returns (uint256);

  event Bank(address indexed owner, uint256[] tokenIds, uint256[] tokenTypes);
}
