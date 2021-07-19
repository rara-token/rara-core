import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "../interfaces/ITokenListener.sol";
import "../interfaces/IERC721Valuable.sol";

pragma solidity ^0.8.0;
contract MockTokenCollectionListener is ITokenListener, ERC165 {
    event CollectionChanged(address owner, uint256 ownerBalance, uint256 ownerValue);

    function balanceChanged(address _owner) external override {
        emit CollectionChanged(
            _owner,
            IERC721Valuable(msg.sender).balanceOf(_owner),
            IERC721Valuable(msg.sender).ownerValue(_owner)
        );
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(ITokenCollectionListener).interfaceId
            || super.supportsInterface(interfaceId);
    }
}
