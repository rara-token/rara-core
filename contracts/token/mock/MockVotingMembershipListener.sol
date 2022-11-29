import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "../interfaces/IVotingMembershipListener.sol";

pragma solidity ^0.8.0;
contract MockVotingMembershipListener is IVotingMembershipListener, ERC165 {
    event MembershipChanged(address sender, address user, uint32 prevLevel, uint32 level);

    function membershipChanged(address _user, uint32 _prevLevel, uint32 _level) external override {
        emit MembershipChanged(msg.sender, _user, _prevLevel, _level);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IVotingMembershipListener).interfaceId
            || super.supportsInterface(interfaceId);
    }
}
