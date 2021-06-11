// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStakeManager.sol";

///@dev An IStakeManager implementation that transfers stakes on behalf of the
/// RaraMiningPool. No extra features; just uses transferFrom and transfer to
/// move and hold LP stake tokens.
pragma solidity 0.8.0;
contract MockStakeManager is IStakeManager {
    using SafeERC20 for IERC20;

    address public immutable pool;

    constructor(address _pool) {
        pool = _pool;
    }

    ///@notice Returns whether this StakeManager performs token transfers on deposit
    /// (i.e. whether the user should {IERC20.approve} this contract's address).
    function transfersStakeDeposit(uint256, IERC20, address, address, uint256, uint256) external override view returns (bool) {
        return true;
    }

    ///@notice Called upon stake deposit by a user. Returns whether the token transfer has been handled by the StakeManager (and no further transfer should be performed).
    function onStakeDeposit(uint256, IERC20 stakeToken, address user, address, uint256 deposit, uint256) external override returns (bool handled) {
        if (msg.sender == pool) {
            stakeToken.safeTransferFrom(user, address(this), deposit);
            handled = true;
        }
    }

    ///@notice Called upon stake withdrawal by a user. Returns whether the token transfer has been handled by the StakeManager (and no further transfer should be performed).
    function onStakeWithdraw(uint256, IERC20 stakeToken, address, address recipient, uint256 withdrawal, uint256) external override returns (bool handled) {
        if (msg.sender == pool) {
            stakeToken.safeTransfer(recipient, withdrawal);
            handled = true;
        }
    }

    ///@notice Called upon Rara reward harvest by a staker. Returns whether the harvest has been handled by the StakeManager (and no further transfer should be performed).
    function onRewardHarvest(uint256, IERC20, address, address, uint256, uint256) external override returns (bool handled) {
        // nothing to do
    }
}
