pragma solidity ^0.8.0;

/// @dev a SwapValuator; Pairs will allow {swap} output amounts up to a proportion
/// of input amount. This interface determines the proportion, which may differ
/// based on caller (standard behavior is a minimum 0.3% fee).
/// Note that most UniswapV2Pair interaction happens through a UniswapV2Router02;
/// that router should receive full value (10000) swap rates so that any appropriate
/// rate can be applied to clients.
interface IUniswapV2SwapValuator {
    /// @dev The swap rate offered the specified client, out of 10000.
    /// Standard Uniswapv2 behavior is "9970", i.e. a 0.3% fee is charged
    /// on swaps. "10000" is a fee-less swap (full value); "0" means no swap
    /// is possible (full value is confiscated). Numbers outside that range
    /// are invalid.
    function swapRateDimi(address _client) external view returns (uint);

    /// @dev is a SwapValuator (must return TRUE)
    function isSwapValuator() external pure returns (bool);
}
