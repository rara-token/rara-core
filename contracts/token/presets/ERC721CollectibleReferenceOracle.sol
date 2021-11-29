// SPDX-License-Identifier: MIT
import "../interfaces/IERC721Collectible.sol";
import "../interfaces/IERC721CollectibleOracle.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

/**
 * @dev {ERC721} token, including:
 *
 *  - ability for holders to burn (destroy) their tokens
 *  - a minter role that allows for token minting (creation)
 *  - a pauser role that allows to stop all token transfers
 *  - token ID and URI autogeneration
 *  - token types with names, symbols, and values
 *  - "collection" views detailing which types are owned by an account and their quantities
 *  - "value" views showing the total value of all tokens, those owned by an account, etc.
 *
 * This contract uses {AccessControl} to lock permissioned functions using the
 * different roles - head to its documentation for details.
 *
 * The account that deploys the contract will be granted the minter and pauser
 * roles, as well as the default admin role, which will let it grant both minter
 * and pauser roles to other accounts.
 */
pragma solidity ^0.8.0;
contract ERC721CollectibleReferenceOracle is Context, AccessControlEnumerable, IERC721CollectibleOracle {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct TokenInfo {
        uint256 tokenType;
        bool assigned;
    }

    // Reference Token
    address public referenceToken;

    // Other Tokens
    mapping(address => bool) public tokenEnabled;
    mapping(address => mapping(uint256 => TokenInfo)) public tokenInfo;

    /**
     * @dev Grants `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE` and `PAUSER_ROLE` to the
     * account that deploys the contract.
     *
     * Token URIs will be autogenerated based on `baseURI` and their token IDs.
     * See {ERC721-tokenURI}.
     */
    constructor(address _referenceToken) {
        referenceToken = _referenceToken;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        _setupRole(MANAGER_ROLE, _msgSender());
    }

    function totalTypes() public view virtual override returns (uint256 count) {
        return IERC721Collectible(referenceToken).totalTypes();
    }

    function typeName(uint256 _type) external view virtual override returns (string memory) {
        return IERC721Collectible(referenceToken).typeName(_type);
    }

    function typeSymbol(uint256 _type) external view virtual override returns (string memory) {
        return IERC721Collectible(referenceToken).typeSymbol(_type);
    }

    function tokenType(address _token, uint256 _tokenId) external view override returns (uint256) {
        if (_token == referenceToken){
            return IERC721Collectible(referenceToken).tokenType(_tokenId);
        }

        require(tokenEnabled[_token], "ERC721CollectibleReferenceOracle: token not enabled");
        require(tokenInfo[_token][_tokenId].assigned, "ERC721CollectibleReferenceOracle: no token type defined");
        return tokenInfo[_token][_tokenId].tokenType;
    }

    function setTokenEnabled(address _token, bool _enabled) external {
        require(
            hasRole(MANAGER_ROLE, _msgSender()),
            "ERC721CollectibleReferenceOracle: must have manager role to set token enabled"
        );
        require(
            _token != referenceToken,
            "ERC721CollectibleReferenceOracle: cannot alter reference token"
        );

        tokenEnabled[_token] = _enabled;
    }

    function setTokenTypes(address _token, uint256[] calldata _tokenIds, uint256 _tokenType) external {
        require(
            hasRole(MANAGER_ROLE, _msgSender()),
            "ERC721CollectibleReferenceOracle: must have manager role to alter token types"
        );
        require(
            _token != referenceToken,
            "ERC721CollectibleReferenceOracle: cannot alter reference token"
        );
        require(
            _tokenType < IERC721Collectible(referenceToken).totalTypes(),
            "ERC721CollectibleReferenceOracle: tokenType not found in reference token"
        );

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            tokenInfo[_token][_tokenIds[i]] = TokenInfo({
                assigned: true,
                tokenType: _tokenType
            });
        }
    }

    function clearTokenTypes(address _token, uint256[] calldata _tokenIds) external {
        require(
            hasRole(MANAGER_ROLE, _msgSender()),
            "ERC721CollectibleReferenceOracle: must have manager role to alter token types"
        );
        require(
            _token != referenceToken,
            "ERC721CollectibleReferenceOracle: cannot alter reference token"
        );

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            tokenInfo[_token][_tokenIds[i]] = TokenInfo({
                assigned: false,
                tokenType: 0
            });
        }
    }
}
