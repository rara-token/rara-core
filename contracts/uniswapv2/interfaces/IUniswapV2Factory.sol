pragma solidity ^0.8.0;

import './IUniswapV2SwapValuator.sol';

interface IUniswapV2Factory is IUniswapV2SwapValuator {
    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    function swapValuator() external view returns (address);
    function mintingFeeTo() external view returns (address);
    function feeTo() external view returns (address);
    function feeToSetter() external view returns (address);
    function migrator() external view returns (address);

    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairs(uint) external view returns (address pair);
    function allPairsLength() external view returns (uint);

    function createPair(address tokenA, address tokenB) external returns (address pair);

    function setSwapValuator(address) external;
    function setMintingFeeTo(address) external;
    function setFeeTo(address) external;
    function setFeeToSetter(address) external;
    function setMigrator(address) external;
}
