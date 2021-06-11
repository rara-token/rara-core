// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice A contract which holds tokens that can be lent (without internal
/// bookkeeping). Address(es) with LENDER_ROLE can prompt the approval of
/// outgoing token transfers. LENDER_ROLE is administrated by DEFAULT_ADMIN_ROLE.
pragma solidity ^0.8.0;
interface ILendingPool {
    function approveLending(IERC20 _token, address _to, uint256 _amount) external;
    function lend(IERC20 _token, address _to, uint256 _amount) external;
}
