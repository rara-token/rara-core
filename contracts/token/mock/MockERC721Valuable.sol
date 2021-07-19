import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IERC721Valuable";
import "../interfaces/ITokenListener.sol";

pragma solidity ^0.8.0;
contract MockERC721Valuable is ERC721 {

    uint256 public override totalValue;
    mapping(address => uint256) public override ownerValue;
    uint256[] public tokenValue;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {

    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal virtual override(ERC721, ERC721Enumerable, ERC721Pausable) {
        super._beforeTokenTransfer(from, to, tokenId);
        uint256 value = tokenValue[tokenId];

        if (from == address(0)) {
            totalValue = totalValue + value;
        } else if (from != to) {
            ownerValue[from] = ownerValue[from] - value;
        }

        if (to == address(0)) {
            totalValue = totalValue - value;
        } else if (from != to) {
            ownerValue[to] = ownerValue[to] + value;
        }
    }

    // anyone can mint! it's a mock token. Convenient.
    function mint(address to, uint256 value) {
        uint256 tokenId = tokenValue.length;
        tokenValue.push(value);
        _mint(to, tokenId);
    }

    // Listener functions
    function transferFromAndInform(address from, address to, uint256 tokenId, address listener) public {
        super.transferFrom(from, to, tokenId);
        ITokenListener(listener).balanceChanged(from);
        ITokenListener(listener).balanceChanged(to);
    }

    function burnAndInform(uint256 tokenId, address listener) public {
        address owner = ERC721.ownerOf(tokenId);
        _burn(tokenId);
        ITokenListener(listener).balanceChanged(owner);
    }

    function mintAndInform(address to, uint256 value, address listener) public {
        uint256 tokenId = tokenValue.length;
        tokenValue.push(value);
        _mint(to, tokenId);
        ITokenListener(listener).balanceChanged(to);
    }
}
