pragma solidity ^0.8.0;

import "./presets/ERC721ValuableCollectibleToken.sol";

// RaraToken.
contract RaraAnimal is ERC721ValuableCollectibleToken {
    constructor(string memory baseTokenURI)
    ERC721ValuableCollectibleToken("Rara Animal", "aRARA", baseTokenURI) {
        // nothing else to do
    }
}
