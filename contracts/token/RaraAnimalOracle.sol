pragma solidity ^0.8.0;

import "./presets/ERC721CollectibleReferenceOracle.sol";

// RaraToken.
contract RaraAnimalOracle is ERC721CollectibleReferenceOracle {
    constructor(address referenceToken)
    ERC721CollectibleReferenceOracle(referenceToken) {
        // nothing else to do
    }
}
