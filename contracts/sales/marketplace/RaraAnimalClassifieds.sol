pragma solidity ^0.8.0;

import "./presets/ManagedClassifieds.sol";

// RaraToken.
contract RaraAnimalClassifieds is ManagedClassifieds {
    constructor(address _collectibleToken, address _purchaseToken)
    ManagedClassifieds(_collectibleToken, _purchaseToken) {
        // nothing else to do
    }
}
