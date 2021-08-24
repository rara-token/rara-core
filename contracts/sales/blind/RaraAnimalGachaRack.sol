pragma solidity ^0.8.0;

import "./presets/BlindCollectibleManagedFlowGachaRack.sol";

// @notice A GachaRack for RaraAnim
contract RaraAnimalGachaRack is BlindCollectibleManagedFlowGachaRack {
    constructor(address _prizeToken, address _purchaseToken, address _eip210, address _recipient)
    BlindCollectibleManagedFlowGachaRack(_prizeToken, _purchaseToken, _eip210, _recipient) {
        // nothing else to do
    }
}
