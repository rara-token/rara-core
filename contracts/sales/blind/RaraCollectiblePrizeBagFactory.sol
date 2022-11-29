pragma solidity ^0.8.0;

import "./presets/BlindCollectiblePrizeBagFactory.sol";

// RaraToken.
contract RaraCollectiblePrizeBagFactory is BlindCollectiblePrizeBagFactory {
    constructor(address _prizeToken, address _purchaseToken)
    BlindCollectiblePrizeBagFactory(_prizeToken, _purchaseToken) {
        // nothing else to do
    }
}
