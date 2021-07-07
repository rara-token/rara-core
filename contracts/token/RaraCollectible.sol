pragma solidity ^0.8.0;

import "./presets/ERC721ValuableCollectibleToken.sol";
import "./interfaces/ITokenCollectionListener.sol";

// RaraToken.
contract RaraCollectibleToken is ERC721ValuableCollectibleToken {
    address public tokenCollectionListener;

    constructor(string memory baseTokenURI)
    ERC721ValuableCollectibleToken("Rara Collectible", "cRARA", baseTokenURI) {
        // nothing else to do
    }

    /**
     * @dev Transfers `tokenId` between addresses, notifying the listener if
     * it exists.
     */
    function _transfer(address from, address to, uint256 tokenId) internal virtual override {
        super._transfer(from, to, tokenId);
        if (tokenCollectionListener != address(0)) {
            ITokenCollectionListener(tokenCollectionListener).tokenRemovedFromCollection(from, tokenId);
            ITokenCollectionListener(tokenCollectionListener).tokenAddedToCollection(to, tokenId);
        }
    }

    /**
     * @dev Mints `tokenId` and transfers it to `to`, notifying the listener if
     * it exists.
     */
    function _mint(address to, uint256 tokenId) internal virtual override {
        super._mint(to, tokenId);
        if (tokenCollectionListener != address(0)) {
            ITokenCollectionListener(tokenCollectionListener).tokenAddedToCollection(to, tokenId);
        }
    }

    /**
     * @dev Burns `tokenId` from `from`, notifying the listener if
     * it exists.
     */
    function _burn(address from, uint256 tokenId) internal virtual override {
        super._burn(from, tokenId);
        if (tokenCollectionListener != address(0)) {
            ITokenCollectionListener(tokenCollectionListener).tokenRemovedFromCollection(from, tokenId);
        }
    }


}
