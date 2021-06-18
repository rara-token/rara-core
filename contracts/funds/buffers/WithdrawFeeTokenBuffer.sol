import "./UniswapV2TokenBuffer.sol";


// Holds LP tokens and, when asked, converts them to a standard token representation
// using Uniswap pairs before transferring them to a recipient. The goal
// of the buffer is to hold LP tokens until the necessary swap(s) are adequately
// funded, and to optimize for conversion gas costs by converting large sums
// only once. Anyone can run the conversion function; it's therefore advantageous
// for many people to benefit from a conversion (e.g. make the recipient a reward pool)
// to encourage regular invocations.
pragma solidity ^0.8.0;
contract WithdrawFeeTokenBuffer is UniswapV2TokenBuffer {
  constructor(IUniswapV2Factory _factory, address _recipient, address _standard, address _weth)
  UniswapV2TokenBuffer(_factory, _recipient, _standard, _weth) {
    
  }
}
