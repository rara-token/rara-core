import "./IBlindSale.sol";

/**
 * @dev A blind box sale in which each prize represents a particular collectible
 * token type to be minted.
 */
pragma solidity ^0.8.0;
interface IBlindCollectibleSale is IBlindSale {
    function prizeToken() external view returns (address);

    function drawTokenId(uint256 _did) external view returns (uint256);

    function drawTokenType(uint256 _did) external view returns (uint256);
}
