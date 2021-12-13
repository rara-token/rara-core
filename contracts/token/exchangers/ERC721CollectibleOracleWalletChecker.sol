import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "../interfaces/IERC721CollectibleOracle.sol";

pragma solidity ^0.8.0;
contract ERC721CollectibleOracleWalletChecker {

    address public immutable token;
    address public immutable oracle;

    constructor(address _token, address _oracle) {
        token = _token;
        oracle = _oracle;
    }

    function getCollectibleTokenIds(address _owner, uint256 _start, uint256 _limit) external view returns (uint256[] memory tokenIds, bool more) {
        uint256 supply = IERC721Enumerable(token).balanceOf(_owner);
        uint256 limit = _start + _limit;
        uint256 max = supply > limit ? limit : supply;
        more = max < supply;

        // two passes; count, then set
        uint256 count = 0;
        for (uint256 i = _start; i < max; i++) {
            uint256 tokenId = IERC721Enumerable(token).tokenOfOwnerByIndex(_owner, i);
            if (IERC721CollectibleOracle(oracle).hasTokenType(token, tokenId)) {
                count++;
            }
        }

        tokenIds = new uint256[](count);
        count = 0;
        for (uint256 i = _start; i < max; i++) {
            uint256 tokenId = IERC721Enumerable(token).tokenOfOwnerByIndex(_owner, i);
            if (IERC721CollectibleOracle(oracle).hasTokenType(token, tokenId)) {
                tokenIds[count++] = tokenId;
            }
        }
    }

}
