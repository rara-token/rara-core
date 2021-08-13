pragma solidity ^0.8.0;

import "./presets/BankableCollectibleConverter.sol";

// RaraToken.
contract RaraAnimalConverter is BankableCollectibleConverter {
    constructor(address _collectibleToken, address _purchaseToken, address _recipient)
    BankableCollectibleConverter(_collectibleToken, _purchaseToken, _recipient) {
        // nothing else to do
    }
}
