pragma solidity ^0.8.0;

import "../interfaces/IVotingMembershipListener.sol";

contract MockVotingMembershipListener is IVotingMembershipListener {
    event MembershipChanged(address sender, address user, uint32 prevLevel, uint32 level);

    function membershipChanged(address _user, uint32 _prevLevel, uint32 _level) external override {
        emit MembershipChanged(msg.sender, _user, _prevLevel, _level);
    }

    function isVotingMembershipListener() external override pure returns (bool) {
        return true;
    }
}
