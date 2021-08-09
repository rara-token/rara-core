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
contract EIP210 {
    bytes32 internal constant maskLast8Bits = hex'00000000000000000000000000000000000000000000000000000000000000ff';
    bytes32 internal constant maskFirst248Bits = hex'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';

    mapping(uint => bytes32) internal _hash;
    mapping(uint => bool) internal _hashSimulated;

    // @dev returns the block hash at the given block, potentially recording it
    // as well. Returns 0x00..0 if unknown; will provide strictly more valid
    // hashes than the native blockhash function.
    function eip210Blockhash(uint256 _blockNumber) external returns (bytes32 _blockhash) {
        _blockhash = _hash[_blockNumber];
        if (_blockhash == 0) {
            _blockhash = _write(_blockNumber);
        }
    }

    function eip210BlockhashSimulated(uint256 _blockNumber) external returns (bool) {
      bytes32 _blockhash = _hash[_blockNumber];
      if (_blockhash == 0) {
          _write(_blockNumber);
      }
      return _hashSimulated[_blockNumber];
    }

    // @dev returns the stored blockhash for this block, or 0x00.. if not yet
    // stored. Unlike {eip210Blockhash} this call does not calculate or store
    // the appropriate hash for the given block and it is strongly preferred that
    // calls from other chain contracts should use {eip210Blockhash} instead of
    // this.
    function storedEip210Blockhash(uint256 _blockNumber) external view returns (bytes32 _blockhash) {
      _blockhash = _hash[_blockNumber];
    }

    function _write(uint256 _blockNumber) internal returns (bytes32 _blockhash) {
        if (_blockNumber < block.number) {  // block occurred in the past; ok to write
            // source: CryptoKitties GeneLibrary
            // https://contract-library.com/contracts/Ethereum/0xf97e0A5b616dfFC913e72455Fde9eA8bBe946a2B
            _blockhash = blockhash(_blockNumber);
            if (_blockhash == 0) {
                uint256 _correctedBlock =
                    uint256(bytes32(block.number) & maskFirst248Bits) +
                    uint256(bytes32(_blockNumber) & maskLast8Bits);
                if ((_correctedBlock >= block.number)) {
                    _correctedBlock = _correctedBlock - 256;
                }
                _blockhash = blockhash(_correctedBlock);
                _hashSimulated[_blockNumber] = true;
            }
            _hash[_blockNumber] = _blockhash;
        }
    }
}
