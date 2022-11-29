import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../interfaces/IERC721TypeExchangeable.sol";
import "../interfaces/IERC721CollectibleOracle.sol";

pragma solidity ^0.8.0;
interface IERC721CollectibleProxyExchanger {

    event ProxyTokenIssued(address indexed token, uint256 tokenId, uint256 indexed proxyTokenId, address indexed recipient);
    event ProxyTokenRedeemed(address indexed token, uint256 tokenId, uint256 indexed proxyTokenId, address indexed recipient);

    /**
     * @dev Returns the address of the ERC721 token issued as proxies
     */
    function proxyToken() external view returns (address);

    /**
     * @dev Returns the address of the token type oracle used to determine exchange value.
     */
    function oracle() external view returns (address);

    /**
     * @dev Given the tokenId of a proxy token issued by this exchanger, returns
     * the token it represnts (or reverts).
     */
    function tokenForProxy(uint256 _proxyTokenId) external view returns (address token, uint256 tokenId);

    /**
     * @dev Given an address and tokenId, returns the proxy tokenId issued for it
     * (or reverts).
     */
    function proxyForToken(address _token, uint256 _tokenId) external view returns (uint256 proxyTokenId);

    /**
     * @dev Returns whether the tokenId provided represents a proxy token issued by
     * this exchanger.
     */
    function isProxyIssued(uint256 _proxyTokenId) external view returns (bool);

    /**
     * @dev Returns whether the provided address and tokenId is held by this exchanger
     * (i.e. whether a proxy has been issued for it).
     */
    function isProxyIssuedForToken(address _token, uint256 _tokenId) external view returns (bool);

    /**
     * @dev Issue proxy tokens for the provided non-proxy tokens, which must Have
     * a token type set on the Oracle. Mints proxies to {_to}.
     */
    function issueProxyTokens(address _token, uint256[] calldata _tokenIds, address _to) external returns (uint256[] memory proxyTokenIds);

    /**
     * @dev Redeem the specified proxy tokens from the user's wallet, transferring
     * the underlying tokens to {_to}.
     */
    function redeemProxyTokens(uint256[] calldata _proxyTokenIds, address _to) external returns (address[] memory tokens, uint256[] memory tokenIds);

}
