// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStakeManager.sol";
import "../../utils/lending/LendingPool.sol";

///@dev An IStakeManager implementation that transfers stakes on behalf of the
/// RaraMiningPool and charges a fee on withdrawal (if the most recent deposit
/// was too recent). Managers can set the fee and fee recipient (do NOT use 0x00
/// as recipient, since you can't be sure the token supports transfers to zero).
/// Fee is applied as a % of the withdraw amount, only if the most recent deposit
/// by the user into that pool was within a specified amount of time.

/**
 * @dev An IStakeManager implementation that transfers stakes on behalf of the
 * RaraMiningPool and charges a fee on withdrawal (if the most recent deposit
 * was too recent). Managers can set the fee and fee recipient (do NOT use 0x00
 * as recipient, since you can't be sure the token supports transfers to zero).
 * Fee is applied as a % of the withdraw amount, only if the most recent deposit
 * by the user into that pool was within a specified amount of time.
 *
 * Note that this StakeManager specifically disallows deposits on behalf of
 * others; allowing such a deposit would let users either evade withdraw fees
 * or attack others by imposing fees, depending on whether proxy deposits
 * reset the fee timer.
 */
pragma solidity 0.8.0;
contract WithdrawFeeStakeManager is IStakeManager, LendingPool {
    using SafeERC20 for IERC20;

    // Role that manages fees
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @notice the RaraMiningPool managed
    address public immutable pool;

    /// @notice the fee applied upon withdrawal (fraction numerator)
    uint256 public feeNumerator;
    /// @notice the fee applied upon withdrawal (fraction denominator)
    uint256 public feeDenominator;
    /// @notice the fee period, in seconds since the most recent deposit.
    uint256 public feePeriod;
    /// @notice the fee recipient; tokens will be transfered here.
    address public feeRecipient;

    /// @notice time of the last deposit made by into this pool by the user
    mapping (uint256 => mapping (address => uint256)) public lastDepositTime;

    uint256 private constant PRECISION = 1e20;

    constructor(address _pool, uint256 _feeNumerator, uint256 _feeDenominator, uint256 _feePeriod, address _feeRecipient) {
        require(_feeDenominator > 0, "WithdrawFeeStakeManager: feeDenominator must be non-zero");
        require(_feeNumerator <= _feeDenominator, "WithdrawFeeStakeManager: fee numerator must be <= denominator");
        require(_feeNumerator < PRECISION && _feeDenominator < PRECISION, "WithdrawFeeStakeManager: fee precision too high");

        pool = _pool;
        feeNumerator = _feeNumerator;
        feeDenominator = _feeDenominator;
        feePeriod = _feePeriod;
        feeRecipient = _feeRecipient;

        // set up roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/remove pools
    }

    /**
     * @notice Set the fee amount and fee period for this Manager.
     * @param _feeNumerator Numerator of the fee fraction; <= denominator
     * @param _feeDenominator Denominator of the fee fraction; >= 1.
     * @param _feePeriod Number of seconds after a deposit
     * @param _feeRecipient Address to which the fee is sent.
     * @param overwrite True if _feeRecipient should be `set`. Otherwise `_feeRecipient` is ignored.
     */
    function setWithdrawFee(uint256 _feeNumerator, uint256 _feeDenominator, uint256 _feePeriod, address _feeRecipient, bool overwrite) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "WithdrawFeeStakeManager: must have MANAGER role to setWithdrawFee");
        require(_feeDenominator > 0, "WithdrawFeeStakeManager: feeDenominator must be non-zero");
        require(_feeNumerator <= _feeDenominator, "WithdrawFeeStakeManager: fee numerator must be <= denominator");
        require(_feeNumerator < PRECISION && _feeDenominator < PRECISION, "WithdrawFeeStakeManager: fee precision too high");

        feeNumerator = _feeNumerator;
        feeDenominator = _feeDenominator;
        feePeriod = _feePeriod;

        if (overwrite) {
            feeRecipient = _feeRecipient;
        }
    }

    ///@notice Returns whether this StakeManager performs token transfers on deposit
    /// (i.e. whether the user should {IERC20.approve} this contract's address).
    function transfersStakeDeposit(uint256, IERC20, address, address, uint256, uint256) external override view returns (bool) {
        return true;
    }

    ///@notice Returns the timestamp (in seconds since the epoch) at which the user
    /// will no longer be charged a fee for withdrawals. This resets upon deposit
    /// into that pool.
    function withdrawFeeUntil(uint256 pid, address user) public view returns (uint256 timestamp) {
        return lastDepositTime[pid][user] + feePeriod;
    }

    ///@notice Returns the fee that will be assessed on the indicated withdrawal.
    function withdrawFee(uint256 pid, address user, uint256 withdrawal) public view returns (uint256 amount) {
        if (withdrawFeeUntil(pid, user) > block.timestamp) {
            amount = (withdrawal * feeNumerator) / feeDenominator;
        }
    }

    ///@notice Called by the mining pool upon stake deposit by a user. Performs
    /// the token transfer on behalf of the pool and notes the time for fee
    /// scheduling. Returns true.
    function onStakeDeposit(uint256 pid, IERC20 stakeToken, address user, address recipient, uint256 deposit, uint256) external override returns (bool) {
        require(_msgSender() == pool, "WithdrawFeeStakeManager: only mining pool can onStakeDeposit");
        require(user == recipient, "WithdrawFeeStakeManager: stake funder must be == recipient");
        stakeToken.safeTransferFrom(user, address(this), deposit);
        lastDepositTime[pid][recipient] = block.timestamp;
        return true;
    }

    ///@notice Called by the mining pool upon stake withdrawal by a user. Performs
    /// the token transfer on behalf of the pool, charging a fee if appropriate,
    ///
    function onStakeWithdraw(uint256 pid, IERC20 stakeToken, address user, address recipient, uint256 withdrawal, uint256) external override returns (bool) {
        require(_msgSender() == pool, "WithdrawFeeStakeManager: only mining pool can onStakeWithdraw");
        uint256 fee = withdrawFee(pid, user, withdrawal);
        stakeToken.safeTransfer(recipient, withdrawal - fee);
        if (fee > 0) {
            stakeToken.safeTransfer(feeRecipient, fee);
        }
        return true;
    }

    ///@notice Called upon Rara reward harvest by a staker. Returns whether the harvest has been handled by the StakeManager (and no further transfer should be performed).
    function onRewardHarvest(uint256, IERC20, address, address, uint256, uint256) external override returns (bool handled) {
        // nothing to do
    }
}
