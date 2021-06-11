// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IStakeManager.sol";

/// @dev A staking / mining pool for receiving a reward by staking LP tokens.
pragma solidity ^0.8.0;
interface IMiningPool {
    function poolLength() external view returns (uint256);

    function add(uint256 _allocPoint, IERC20 _lpToken, IStakeManager _stakeManager) external;
    function set(uint256 _pid, uint256 _allocPoint, IStakeManager _stakeManager, bool overwrite) external;

    function stakeManager(uint256 _pid) external returns (IStakeManager);

    function pendingReward(uint256 _pid, address  _user) external view returns (uint256);
    function totalReceived() external view returns (uint256);
    function totalRetained() external view returns (uint256);
    function totalMined() external view returns (uint256);

    function deposit(uint256 _pid, uint256 _amount, address _to) external;
    function withdraw(uint256 _pid, uint256 _amount, address _to) external;
    function harvest(uint256 _pid, address _to) external;
    function withdrawAndHarvest(uint256 _pid, uint256 _amount, address _to) external;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
    event Harvest(address indexed user, uint256 indexed pid, uint256 amount);

    event PoolAdd(uint256 indexed pid, uint256 allocPoint, IERC20 indexed lpToken, IStakeManager indexed manager);
    event PoolSet(uint256 indexed pid, uint256 allocPoint, IStakeManager indexed manager, bool overwrite);
    event PoolUpdate(uint256 indexed pid, uint256 lastRewardBlock, uint256 lastRewardBlockRetainedRara, uint256 lpSupply, uint256 accRaraPerShare);

    event LendingApproved(uint256 indexed pid, address indexed to, uint256 amount);
}
