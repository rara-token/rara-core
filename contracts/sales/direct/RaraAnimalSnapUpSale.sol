pragma solidity ^0.8.0;

import "./presets/DirectCollectibleSaleSnapUpResupply.sol";

// @notice A GachaRack for RaraAnim
contract RaraAnimalSnapUpSale is DirectCollectibleSaleSnapUpResupply {
    constructor(address _purchaseToken, address _fractionalExponents, address _recipient)
    DirectCollectibleSaleSnapUpResupply(_purchaseToken, _fractionalExponents, _recipient) {
        // nothing else to do
    }
}
