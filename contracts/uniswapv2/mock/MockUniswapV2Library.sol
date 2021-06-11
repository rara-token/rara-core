import '../libraries/UniswapV2Library.sol';

pragma solidity ^0.8.0;
contract MockUniswapV2Library {
  function pairFor(address factory, address tokenA, address tokenB) public pure returns (address) {
    return UniswapV2Library.pairFor(factory, tokenA, tokenB);
  }
}
