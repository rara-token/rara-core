import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../uniswapv2/interfaces/IUniswapV2ERC20.sol";
import "../uniswapv2/interfaces/IUniswapV2Pair.sol";
import "../uniswapv2/interfaces/IUniswapV2Factory.sol";


// Holds LP tokens and, when asked, converts them to a standard token representation
// using Uniswap pairs before transferring them to a recipient. The goal
// of the buffer is to hold LP tokens until the necessary swap(s) are adequately
// funded, and to optimize for conversion gas costs by converting large sums
// only once. Anyone can run the conversion function; it's therefore advantageous
// for many people to benefit from a conversion (e.g. make the recipient a reward pool)
// to encourage regular invocations.
pragma solidity ^0.8.0;
contract UniswapV2TokenBuffer {
    using SafeERC20 for IERC20;

    IUniswapV2Factory public factory;
    address public recipient;
    address public standard;
    address public weth;

    address public recipientSetter;

    constructor(IUniswapV2Factory _factory, address _recipient, address _standard, address _weth) {
        factory = _factory;
        recipient = _recipient;
        standard = _standard;
        weth = _weth;

        recipientSetter = msg.sender;
    }

    function convert(address token0, address token1) public {
        // At least we try to make front-running harder to do.
        require(msg.sender == tx.origin, "do not convert from contract");
        require(recipient != address(0), "recipient not set");
        IUniswapV2Pair pair = IUniswapV2Pair(factory.getPair(token0, token1));
        pair.transfer(address(pair), pair.balanceOf(address(this)));
        pair.burn(address(this));
        uint256 wethAmount = _toWETH(token0) + _toWETH(token1);
        _toStandard(wethAmount);
    }

    function _toWETH(address token) internal returns (uint256) {
        if (token == standard) {
            uint amount = IERC20(token).balanceOf(address(this));
            _safeTransfer(token, recipient, amount);
            return 0;
        }
        if (token == weth) {
            uint amount = IERC20(token).balanceOf(address(this));
            _safeTransfer(token, factory.getPair(weth, standard), amount);
            return amount;
        }
        IUniswapV2Pair pair = IUniswapV2Pair(factory.getPair(token, weth));
        if (address(pair) == address(0)) {
            return 0;
        }
        (uint reserve0, uint reserve1,) = pair.getReserves();
        address token0 = pair.token0();
        (uint reserveIn, uint reserveOut) = token0 == token ? (reserve0, reserve1) : (reserve1, reserve0);
        uint amountIn = IERC20(token).balanceOf(address(this));
        uint amountInWithFee = amountIn * 997;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = (reserveIn * 1000) + amountInWithFee;
        uint amountOut = numerator / denominator;
        (uint amount0Out, uint amount1Out) = token0 == token ? (uint(0), amountOut) : (amountOut, uint(0));
        _safeTransfer(token, address(pair), amountIn);
        pair.swap(amount0Out, amount1Out, factory.getPair(weth, standard), new bytes(0));
        return amountOut;
    }

    function _toStandard(uint256 amountIn) internal {
        IUniswapV2Pair pair = IUniswapV2Pair(factory.getPair(weth, standard));
        (uint reserve0, uint reserve1,) = pair.getReserves();
        address token0 = pair.token0();
        (uint reserveIn, uint reserveOut) = token0 == weth ? (reserve0, reserve1) : (reserve1, reserve0);
        uint amountInWithFee = amountIn * 997;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = (reserveIn * 1000) + amountInWithFee;
        uint amountOut = numerator / denominator;
        (uint amount0Out, uint amount1Out) = token0 == weth ? (uint(0), amountOut) : (amountOut, uint(0));
        pair.swap(amount0Out, amount1Out, recipient, new bytes(0));
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        IERC20(token).safeTransfer(to, amount);
    }

    function setRecipient(address _recipient) public {
      require(msg.sender == recipientSetter, "not recipientSetter");
      recipient = _recipient;
    }

    function setRecipientSetter(address _recipientSetter) public {
      require(msg.sender == recipientSetter, "not recipientSetter");
      recipientSetter = _recipientSetter;
    }
}
