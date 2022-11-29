pragma solidity ^0.8.0;

import "./presets/BlindCollectibleManagedResupplyGachaRack.sol";

// @notice A GachaRack for RaraAnim
contract RaraAnimalGachaRack is BlindCollectibleManagedResupplyGachaRack {
    constructor(address _prizeToken, address _purchaseToken, address _eip210, address _recipient)
    BlindCollectibleManagedResupplyGachaRack(_prizeToken, _purchaseToken, _eip210, _recipient) {
        // nothing else to do
    }
}
