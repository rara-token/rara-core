import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

pragma solidity ^0.8.0;
interface IToken is IERC20 {
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}
