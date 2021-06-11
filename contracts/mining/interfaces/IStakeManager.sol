// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

pragma solidity 0.8.0;
interface IStakeManager {
    ///@dev Returns whether this StakeManager performs token transfers on deposit
    /// (i.e. whether the user should {IERC20.approve} this contract's address).
    function transfersStakeDeposit(uint256 pid, IERC20 stakeToken, address user, address recipient, uint256 deposit, uint256 totalStake) external view returns (bool);

    ///@dev Called upon stake deposit by a user. Returns whether the token transfer has been handled by the StakeManager (and no further transfer should be performed).
    function onStakeDeposit(uint256 pid, IERC20 stakeToken, address user, address recipient, uint256 deposit, uint256 totalStake) external returns (bool);

    ///@dev Called upon stake withdrawal by a user. Returns whether the token transfer has been handled by the StakeManager (and no further transfer should be performed).
    function onStakeWithdraw(uint256 pid, IERC20 stakeToken, address user, address recipient, uint256 withdrawal, uint256 totalStake) external returns (bool);

    ///@dev Called upon Rara reward harvest by a staker. Returns whether the harvest has been handled by the StakeManager (and no further transfer should be performed).
    function onRewardHarvest(uint256 pid, IERC20 stakeToken, address user, address recipient, uint256 rewardAmount, uint256 totalStake) external returns (bool);
}
