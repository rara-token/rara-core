pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "../utils/boring-solidity/IPermitERC20.sol";
import "../utils/boring-solidity/Domain.sol";

// RaraToken.
contract RaraToken is ERC20PresetMinterPauser, IPermitERC20, Domain {
    constructor()
    ERC20PresetMinterPauser("Rara Token", "RARA") {
        // nothing else to do
    }

    function decimals() public view virtual override returns (uint8) {
        return 8;
    }

    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 private constant PERMIT_SIGNATURE_HASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;

    /// @notice A record of states for signing / validating signatures
    mapping (address => uint) public nonces;

    /// @notice Approves `value` from `_owner` to be spend by `spender`.
    /// @param _owner Address of the owner.
    /// @param spender The address of the spender that gets approved to draw from `_owner`.
    /// @param value The maximum collective amount that `spender` can draw.
    /// @param deadline This permit must be redeemed before this deadline (UTC timestamp in seconds).
    function permit(address _owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external override {
        require(block.timestamp < deadline, "ERC20: Expired");
        bytes32 digest = _getDigest(keccak256(abi.encode(PERMIT_SIGNATURE_HASH, _owner, spender, value, nonces[_owner]++, deadline)));
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && recoveredAddress == _owner, 'ERC20: Invalid Signature');
        _approve(_owner, spender, value);
    }
}
