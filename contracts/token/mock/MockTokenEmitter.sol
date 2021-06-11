pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ITokenEmitter.sol";

contract MockTokenEmitter is ITokenEmitter {
    IERC20 public override token;
    uint256 public override emitted;
    mapping (address => uint256) public override owed;

    constructor(IERC20 _token) {
      token = _token;
    }

    function setOwed(address _addr, uint256 _amount) public {
        emitted = emitted + _amount - owed[_addr];
        owed[_addr] = _amount;
    }

    function addOwed(address _addr, uint256 _amount) public {
        emitted = emitted + _amount;
        owed[_addr] = owed[_addr] + _amount;
    }

    function claim(address _to) external override returns (uint256 amount) {
        amount = owed[msg.sender];
        token.transfer(_to, amount);
        owed[msg.sender] = 0;
    }
}
