pragma solidity ^0.8.0;

import "./presets/ERC721ValuableCollectibleToken.sol";

// RaraToken.
contract RaraCollectible is ERC721ValuableCollectibleToken {
    constructor(string memory baseTokenURI)
    ERC721ValuableCollectibleToken("Rara Collectible", "cRARA", baseTokenURI) {
        // nothing else to do
    }
}
