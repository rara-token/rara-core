pragma solidity ^0.8.0;

import "./exchangers/ERC721CollectibleOracleWalletChecker.sol";

// RaraToken.
contract RaraAnimalBinanceWalletChecker is ERC721CollectibleOracleWalletChecker {
    constructor(address binanceToken, address oracle)
    ERC721CollectibleOracleWalletChecker(binanceToken, oracle) {
        // nothing else to do
    }
}
