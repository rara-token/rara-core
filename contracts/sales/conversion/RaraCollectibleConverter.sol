pragma solidity ^0.8.0;

import "./presets/BasicCollectibleConverter.sol";

// RaraToken.
contract RaraCollectibleConverter is BasicCollectibleConverter {
    constructor(address _collectibleToken, address _purchaseToken, address _recipient)
    BasicCollectibleConverter(_collectibleToken, _purchaseToken, _recipient) {
        // nothing else to do
    }
}
