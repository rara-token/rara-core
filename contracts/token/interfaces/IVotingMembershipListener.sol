// An ITokenEmitter accumulates tokens on its own internal schedule,
// allocating it to specific recipients.
pragma solidity ^0.8.0;
interface IVotingMembershipListener {
    function membershipChanged(address _user, uint32 _prevLevel, uint32 _level) external;
    function isVotingMembershipListener() external pure returns (bool);
}
