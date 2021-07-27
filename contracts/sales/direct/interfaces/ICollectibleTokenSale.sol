import "./ICollectibleSale.sol";

pragma solidity ^0.8.0;
interface ICollectibleTokenSale is ICollectibleSale {
    // @notice Returns the address of the token contract used for sales
    function purchaseToken() external view returns (address);

    // @notice Purchase the specified token type; it will be minted or transferred
    // to the indicated address if possible. Precondition: the purchase currency
    // must be {approve}d for transfer by this contract.
    // @param _tokenType The token type to purchase.
    // @param _to The address to send the token to
    // @param _maximumPrice The maximum price the user is willing to pay, in case
    // price has changed since the last query.
    // @return The tokenID transferred to `to` as a result of this call.
    function purchase(uint256 _tokenType, address _to, uint256 _maximumPrice) external returns (uint256);
}
