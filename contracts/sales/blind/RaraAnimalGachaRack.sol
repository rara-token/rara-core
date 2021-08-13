pragma solidity ^0.8.0;

import "./presets/BlindCollectibleManagedGachaRack.sol";

// @notice A GachaRack for RaraAnim
contract RaraAnimalGachaRack is BlindCollectibleManagedGachaRack {
    constructor(address _prizeToken, address _purchaseToken, address _eip210, address _recipient)
    BlindCollectibleManagedGachaRack(_prizeToken, _purchaseToken, _eip210, _recipient) {
        // nothing else to do
    }
}
