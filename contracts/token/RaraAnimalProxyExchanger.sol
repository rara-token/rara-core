pragma solidity ^0.8.0;

import "./exchangers/ERC721CollectibleProxyExchanger.sol";

// RaraToken.
contract RaraAnimalProxyExchanger is ERC721CollectibleProxyExchanger {
    constructor(address proxyToken, address oracle)
    ERC721CollectibleProxyExchanger(proxyToken, oracle) {
        // nothing else to do
    }
}
