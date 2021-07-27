import "./ICollectibleSale.sol";

pragma solidity ^0.8.0;
interface ICollectibleETHSale is ICollectibleSale {
    // @notice Purchase the specified token type; it will be minted or transferred
    // to the indicated address if possible. Send with ETH (BNB, etc.) representing
    // the maximum amount the caller is willing to pay; if greater than the sale
    // price, the remainder will be returned.
    // @param _tokenType The token type to purchase.
    // @param _to The address to send the token to
    // @return The tokenID transferred to `to` as a result of this call.
    function purchase(uint256 _tokenType, address _to) external payable returns (uint256);
}
