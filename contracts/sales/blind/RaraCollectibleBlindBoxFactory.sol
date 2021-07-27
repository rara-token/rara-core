pragma solidity ^0.8.0;

import "./presets/TokenCollectibleBlindBoxFactory.sol";

// RaraToken.
contract RaraCollectibleBlindBoxFactory is TokenCollectibleBlindBoxFactory {
    constructor(address _prizeToken, address _purchaseToken)
    TokenCollectibleBlindBoxFactory(_prizeToken, _purchaseToken) {
        // nothing else to do
    }
}
