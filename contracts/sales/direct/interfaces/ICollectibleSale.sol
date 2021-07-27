pragma solidity ^0.8.0;
interface ICollectibleSale {
    // @notice Returns the address of the token contract being sold
    // @return The collectible token address
    function token() external view returns (address);

    // @notice Returns the price at which the indicated tokenType is available,
    // potentially reverting if it is not.
    // @param _tokenType The token type to price.
    function tokenTypePrice(uint256 _tokenType) external view returns (uint256);

    // @notice Returns the count of the specified token type which is available
    // for purchase. If zero, the call to {price} may fail, but for anything
    // else
    // @param _tokenType The token type to check available supply
    function tokenTypeSupply(uint256 _tokenType) external view returns (uint256);

    // @notice Returns the count of specified token type which have been purchased so far.
    // @param _tokenType The token type to check purchased count.
    // @return The number of `_tokenType` tokens sold by this sale contract.
    function tokenTypePurchased(uint256 _tokenType) external view returns (uint256);

    // @notice Returns the total tokens purchased from this contract, of all types.
    // @return The total number of tokens sold by this sale contract.
    function totalPurchased() external view returns (uint256);

    event Purchase(address indexed buyer, uint256 indexed tokenType, address indexed to, uint256 price, uint256 tokenId);
}
