import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IToken.sol";

pragma solidity ^0.8.0;
contract MockERC20 is ERC20, IToken {
    constructor(
        string memory name,
        string memory symbol,
        uint256 supply
    ) ERC20(name, symbol) {
        _mint(msg.sender, supply);
    }

    function burn(uint256 amount) public override virtual {
        _burn(_msgSender(), amount);
    }

    function burnFrom(address account, uint256 amount) public override virtual {
        uint256 currentAllowance = allowance(account, _msgSender());
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        _approve(account, _msgSender(), currentAllowance - amount);
        _burn(account, amount);
    }
}
