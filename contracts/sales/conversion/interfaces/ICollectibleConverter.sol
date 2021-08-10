pragma solidity ^0.8.0;
interface ICollectibleConverter {
  // @notice Returns the address of the token contract being sold
  // @return The collectible token address
  function token() external view returns (address);

  // @dev Returns the token address
  function purchaseToken() external view returns (address);

  // @dev execute the recipe `_recipeId`; convert the tokens whose ids are given
  // by `_tokenIds`, paying up to `_maximumCost` to run the process.
  // Returns the created tokenIds.
  // The caller must own all of the `_tokenIdsIn` listed.
  function convert(uint256 _recipeId, uint256 _maximumCost, uint256[] calldata _tokenIdsIn) external returns (uint256[] memory tokenIdsOut);

  // @dev a quick check for whether the indicated recipe is supported for
  // the specified `_maximumCost` and `tokenIdsIn`.
  // Does not perform ownership checks or whether the caller has the funds to
  // pay their `_maximumCost`, just whether the input parameters look good
  // and the recipe is currently active
  function canConvert(uint256 _recipeId, uint256 _maximumCost, uint256[] calldata _tokenIdsIn) external view returns (bool);

  // @dev returns the number of exchange recipes known to this contract
  function recipeCount() external view returns (uint256);

  // @dev returns whether recipe `_recipeId` is currently available for those
  // who meet its prerequisites.
  function recipeAvailable(uint256 _recipeId) external view returns (bool);

  // @dev returns the current purchase price to process recipe `recipeId` (may be zero)
  function recipePrice(uint256 _recipeId) external view returns (uint256);

  // @dev returns an array of token types required as inputs to recipe `recipeId`.
  // These token types will be consumed (burned) in the recipe.
  function recipeInput(uint256 _recipeId) external view returns (uint256[] memory tokenTypes);

  // @dev returns an array of token types produced as output of recipe `recipeId`.
  // These token types will minted when the recipe is processed.
  function recipeOutput(uint256 _recipeId) external view returns (uint256[] memory tokenTypes);

  event Conversion(address indexed owner, uint256 indexed recipeId, uint256 price, uint256[] tokenIdsIn, uint256[] tokenTypesIn, uint256[] tokenIdsOut);
}
