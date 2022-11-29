import "./IDirectSale.sol";

/**
 * @dev A blind box sale in which each prize represents a particular collectible
 * token type to be minted.
 */
pragma solidity ^0.8.0;
interface IDirectCollectibleSale is IDirectSale {
    function itemToken(uint256 _itemId) external view returns (address);

    function itemTokenType(uint256 _itemId) external view returns (uint256);

    function receiptTokenId(uint256 _rid) external view returns (uint256);

    function receiptTokenType(uint256 _rid) external view returns (uint256);
}
