pragma solidity ^0.8.0;

import "./presets/BlindCollectibleManagedResupplyGachaRackHelper.sol";

// @notice A GachaRack for RaraAnim
contract RaraAnimalGachaRackHelper is BlindCollectibleManagedResupplyGachaRackHelper {
    constructor(address _gachaRack)
    BlindCollectibleManagedResupplyGachaRackHelper(_gachaRack) {
        // nothing else to do
    }
}
