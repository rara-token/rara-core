pragma solidity ^0.8.0;

import "./exchangers/ERC721CollectibleOracleAndProxyWalletChecker.sol";

// RaraToken.
contract RaraAnimalBinanceWalletChecker is ERC721CollectibleOracleAndProxyWalletChecker {
    constructor(address binanceToken, address oracle, address exchanger)
    ERC721CollectibleOracleAndProxyWalletChecker(binanceToken, oracle, exchanger) {
        // nothing else to do
    }
}
