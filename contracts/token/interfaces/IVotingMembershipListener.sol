import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

// A listener for changes to Voting Membership levels, in case changes in those levels
// carries a significance in accumulating effects (e.g. mining power).
pragma solidity ^0.8.0;
interface IVotingMembershipListener is IERC165 {
    function membershipChanged(address _user, uint32 _prevLevel, uint32 _level) external;
}
