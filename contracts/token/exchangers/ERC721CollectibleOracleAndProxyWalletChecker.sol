import "./ERC721CollectibleOracleWalletChecker.sol";
import "../interfaces/IERC721CollectibleProxyExchanger.sol";

pragma solidity ^0.8.0;
contract ERC721CollectibleOracleAndProxyWalletChecker is ERC721CollectibleOracleWalletChecker {

    address public immutable exchanger;

    constructor(address _token, address _oracle, address _exchanger)
    ERC721CollectibleOracleWalletChecker(_token, _oracle) {
        exchanger = _exchanger;
    }

    function getProxyTokenIds(address _owner, uint256 _start, uint256 _limit) external view returns (uint256[] memory tokenIds, bool more) {
        address proxyToken = IERC721CollectibleProxyExchanger(exchanger).proxyToken();
        uint256 supply = IERC721Enumerable(proxyToken).balanceOf(_owner);
        uint256 limit = _start + _limit;
        uint256 max = supply > limit ? limit : supply;
        more = max < supply;

        // two passes; count, then set
        uint256 count = 0;
        for (uint256 i = _start; i < max; i++) {
            uint256 tokenId = IERC721Enumerable(proxyToken).tokenOfOwnerByIndex(_owner, i);
            if (IERC721CollectibleProxyExchanger(exchanger).isProxyIssued(tokenId)) {
                count++;
            }
        }

        tokenIds = new uint256[](count);
        count = 0;
        for (uint256 i = _start; i < max; i++) {
            uint256 tokenId = IERC721Enumerable(proxyToken).tokenOfOwnerByIndex(_owner, i);
            if (IERC721CollectibleProxyExchanger(exchanger).isProxyIssued(tokenId)) {
                tokenIds[count++] = tokenId;
            }
        }
    }

}
