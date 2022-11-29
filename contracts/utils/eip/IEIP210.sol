// @dev A contract which records blockhashes for later retrieval. Solidity
// supports blockhash(blockNumber), but only for the most recent 256 blocks.
// In some cases hashes for older blocks are useful or necessary; for instance,
// 2-step "purchase-then-reveal" PNG draws might use block hash information
// that occurs between the two steps to determine the result, but if the "reveal"
// transaction occurs more than 256 blocks later the only two options are
// 1. Invalidate the purchase, or 2. Allow the revealed data to be determined
// by when the reveal happens.
//
// This contract attempts to mitigate this risk by simulating the effects of
// EIP-210 (https://eips.ethereum.org/EIPS/eip-210), a proposed rule change that
// makes blockhashes available for all blocks going forward (eliminating the
// Blockhash-Minus-256 problem).
//
// This contract combines in-contract blockhash storage with blockhash "simulation"
// as used by CryptoKitties. This allows genuine hashes to be retrieved for
// blocks recorded earlier, and immutable "simulated" hashes to be used for
// others (once read, the simulated hash is recorded).
//
// The simulation output changes only once every 256 blocks, meaning attackers
// that revert unfavorable simulations can only make one attempt every 12.8 minutes
// (on BSC; longer on Ethereum). Further, as this record is shared among all users,
// proper use may cause a disadvantageous simulation to be written by a non-attacker
// as a side-effect of their actions. For example, as a side-effect of purchasing
// a random draw to be fulfilled later, a contract might record a different user's
// pending blockhash into this contract. This prevents the attacker from later
// attempting try-and-revert since the results become fixed.
pragma solidity ^0.8.0;
interface IEIP210 {
    // @dev Returns the blockhash (real or simulated) for the given block,
    // storing the result if not previously calculated. This method is strongly
    // preferred over {eip210BlockhashReadOnly} as the result of this function
    // will always be consistent after the first committed transaction.
    function eip210Blockhash(uint256 _blockNumber) external returns (bytes32);

    // @dev Returns the blockhash (real or simulated) for the given block,
    // without storing the result. Useful in `view` functions but otherwise
    // {eip210Blockhash} is preferred, as the results are immutable over time.
    // If `_immutable`, the output of this function will be  consistent over time;
    // otherwise it may change at an indeterminate point (every 256 blocks).
    function eip210BlockhashEstimate(uint256 _blockNumber) external view returns (bytes32 _blockhash, bool _immutable);
}
