// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ILendingPool.sol";

/// @notice A contract which holds tokens that can be lent (without internal
/// bookkeeping). Address(es) with LENDER_ROLE can prompt the approval of
/// outgoing token transfers. LENDER_ROLE is administrated by DEFAULT_ADMIN_ROLE.
pragma solidity ^0.8.0;
abstract contract LendingPool is Context, AccessControlEnumerable, ILendingPool {
    // Role that can access LP tokens in the mining pool, for automatic lending.
    bytes32 public constant LENDER_ROLE = keccak256("LENDER_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
    }

    function approveLending(IERC20 _token, address _to, uint256 _amount) external override {
        require(hasRole(LENDER_ROLE, _msgSender()), "LendingPool: must have LENDER role to approveLending");
        _token.approve(_to, _amount);
    }

    function lend(IERC20 _token, address _to, uint256 _amount) external override {
        require(hasRole(LENDER_ROLE, _msgSender()), "LendingPool: must have LENDER role to lend");
        _token.transfer(_to, _amount);
    }
}
