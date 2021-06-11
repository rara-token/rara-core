import '../interfaces/IUniswapV2SwapValuator.sol';

pragma solidity 0.8.0;
contract MockUniswapV2SwapValuator is IUniswapV2SwapValuator {
    mapping (address => uint) public rates;

    function unsetSwapRateDimi(address _client) external returns (uint) {
        rates[_client] = 0;
    }

    function setSwapRateDimi(address _client, uint _rate) external returns (uint) {
        require(_rate > 0, "MockUniswapV2SwapValuator::setSwapRateDimi: rate must be nonzero");
        require(_rate <= 10000, "MockUniswapV2SwapValuator::setSwapRateDimi: rate must be <= 10000");
        rates[_client] = _rate;
    }

    function swapRateDimi(address _client) external override view returns (uint) {
        uint rate = rates[_client];
        if (rate > 0) {
            return rate;
        }
        return 9970;
    }

    function isSwapValuator() external override pure returns (bool) {
        return true;
    }
}
