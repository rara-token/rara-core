pragma solidity ^0.8.0;

import "./presets/Classifieds.sol";

// RaraToken.
contract RaraCollectibleClassifieds is Classifieds {
    constructor(address _collectibleToken, address _purchaseToken)
    Classifieds(_collectibleToken, _purchaseToken) {
        // nothing else to do
    }
}
