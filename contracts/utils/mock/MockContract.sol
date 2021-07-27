pragma solidity ^0.8.0;
contract MockContract {
    event Mark(uint256 id, uint256 number, bytes32 hash);

    function mark(uint256 _id) external {
        emit Mark(_id, block.number, blockhash(block.number));
    }
}
