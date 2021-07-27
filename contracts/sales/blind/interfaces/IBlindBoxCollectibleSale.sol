import "./IBlindBoxSale.sol";

/**
 * @dev A blind box sale in which each prize represents a particular collectible
 * token type to be minted.
 */
pragma solidity ^0.8.0;
interface IBlindBoxCollectibleSale is IBlindBoxSale {
    function prizeToken() external view returns (address);

    function drawTokenId(uint256 _did) external view returns (uint256);

    function drawTokenType(uint256 _did) external view returns (uint256);

    function prizeTokenType(uint256 _pid) external view returns (uint256);
}
