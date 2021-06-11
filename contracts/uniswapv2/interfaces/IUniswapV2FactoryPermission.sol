pragma solidity ^0.8.0;

import './IUniswapV2Factory.sol';

interface IUniswapV2FactoryPermission is IUniswapV2Factory {
    event CreationPermissionChanged(bool disallowed);
    event TokenPermissionChanged(address indexed token, bool disallowed);
    event PairPermissionChanged(address indexed token0, address indexed token1, bool disallowed);

    // pair creation restrictions
    function creationDisallowed() external view returns (bool);
    function tokenDisallowed(address token) external view returns (bool);
    function pairDisallowed(address tokenA, address tokenB) external view returns (bool);
    function allowed(address tokenA, address tokenB) external view returns (bool);

    // pair restriction configuration
    function setCreationDisallowed(bool disallowed) external;
    function setTokenDisallowed(address token, bool disallowed) external;
    function setPairDisallowed(address tokenA, address tokenB, bool disallowed) external;
}
