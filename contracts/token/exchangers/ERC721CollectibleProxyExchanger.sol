import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../interfaces/IERC721TypeExchangeable.sol";
import "../interfaces/IERC721CollectibleOracle.sol";

pragma solidity ^0.8.0;
contract ERC721CollectibleProxyExchanger {

    event ProxyTokenIssued(address indexed token, uint256 tokenId, uint256 indexed proxyTokenId, address indexed recipient);
    event ProxyTokenRedeemed(address indexed token, uint256 tokenId, uint256 indexed proxyTokenId, address indexed recipient);

    struct TokenInfo {
        address token;
        uint256 tokenId;
        bool issued;
    }

    address public immutable proxyToken;
    address public immutable oracle;
    mapping(uint256 => TokenInfo) public tokenInfo;
    mapping(address => mapping(uint256 => uint256)) internal _proxyForToken;

    constructor(address _proxyToken, address _oracle) {
        proxyToken = _proxyToken;
        oracle = _oracle;
    }

    function issueProxyTokens(address _token, uint256[] calldata _tokenIds, address _to) external returns (uint256[] memory proxyTokenIds) {
        require(_token != proxyToken, "ERC721CollectibleProxyExchanger: can't issue proxy tokens for the proxy token itself");

        // determine tokenTypes
        uint256[] memory tokenTypes = new uint256[](_tokenIds.length);
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            tokenTypes[i] = IERC721CollectibleOracle(oracle).tokenType(_token, _tokenIds[i]);
        }

        // retrieve all tokens provided
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            IERC721(_token).transferFrom(msg.sender, address(this), _tokenIds[i]);
        }

        // mint proxies
        proxyTokenIds = IERC721TypeExchangeable(proxyToken).massMint(_to, tokenTypes);

        // set internal data and events
        for (uint256 i = 0; i < proxyTokenIds.length; i++) {
            tokenInfo[proxyTokenIds[i]] = TokenInfo({
                token: _token,
                tokenId: _tokenIds[i],
                issued: true
            });
            _proxyForToken[_token][_tokenIds[i]] = proxyTokenIds[i];

            emit ProxyTokenIssued(_token, _tokenIds[i], proxyTokenIds[i], _to);
        }
    }

    function redeemProxyTokens(uint256[] calldata _proxyTokenIds, address _to) external returns (address[] memory tokens, uint256[] memory tokenIds) {
        tokens = new address[](_proxyTokenIds.length);
        tokenIds = new uint256[](_proxyTokenIds.length);

        for (uint256 i = 0; i  <  _proxyTokenIds.length; i++) {
            TokenInfo storage info = tokenInfo[_proxyTokenIds[i]];
            require(info.issued, "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

            tokens[i] = info.token;
            tokenIds[i] = info.tokenId;
        }

        // burn tokens. confirms no duplicates and that the sender owns all of them.
        IERC721TypeExchangeable(proxyToken).massBurnFrom(msg.sender, _proxyTokenIds);

        // return originals, mark no-longer-issued, emit event
        for (uint256 i = 0; i < _proxyTokenIds.length; i++) {
            IERC721(tokens[i]).transferFrom(address(this), _to, tokenIds[i]);
            delete tokenInfo[_proxyTokenIds[i]];
            delete _proxyForToken[tokens[i]][tokenIds[i]];

            emit ProxyTokenRedeemed(tokens[i], tokenIds[i], _proxyTokenIds[i], _to);
        }
    }

    function tokenForProxy(uint256 _proxyTokenId) external view returns (address token, uint256 tokenId) {
        TokenInfo storage info = tokenInfo[_proxyTokenId];
        require(info.issued, "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

        token = info.token;
        tokenId = info.tokenId;
    }

    function proxyForToken(address _token, uint256 _tokenId) external view returns (uint256 proxyTokenId) {
        proxyTokenId = _proxyForToken[_token][_tokenId];
        TokenInfo storage info = tokenInfo[proxyTokenId];
        require(
            info.issued && info.token == _token && info.tokenId == _tokenId,
            "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger"
        );
    }

}
