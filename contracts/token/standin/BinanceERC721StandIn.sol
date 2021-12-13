pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/presets/ERC721PresetMinterPauserAutoId.sol";

// RaraToken.
contract BinanceERC721StandIn is ERC721PresetMinterPauserAutoId {
    constructor()
    ERC721PresetMinterPauserAutoId("Binance NFT", "BN", "http://binance.nft.standin/") {
        // nothing else to do
    }
}
