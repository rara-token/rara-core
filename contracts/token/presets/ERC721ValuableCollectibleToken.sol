// SPDX-License-Identifier: MIT
import "../interfaces/IERC721TypeExchangeable.sol";
import "../interfaces/IERC721Collectible.sol";
import "../interfaces/IERC721Valuable.sol";
import "../interfaces/ITokenListener.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

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
contract ERC721ValuableCollectibleToken is Context, AccessControlEnumerable, ERC721Enumerable, ERC721Burnable, ERC721Pausable, IERC721Collectible, IERC721Valuable, IERC721TypeExchangeable {
    using ERC165Checker for address;
    using Counters for Counters.Counter;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    Counters.Counter private _tokenIdTracker;

    string private _baseTokenURI;

    // Collectible types and collection enumeration
    struct TypeInfo {
        string name;
        string symbol;
        uint256 value;
    }

    // token types
    TypeInfo[] public typeInfo;
    mapping(uint256 => uint256) private _tokenType;

    // Global totals
    uint256 private _totalValue;

    // Owner total value
    mapping(address => uint256) private _ownedValue;

    // Mapping from owner to list of owned token types
    mapping(address => uint256[]) private _ownedTypes;

    // Mapping from owner, type to index of _ownedTypes;
    mapping(address => mapping(uint256 => uint256)) _ownedTypesIndex;

    // Mapping from owner and type to list of owned token IDs
    mapping(address => mapping(uint256 => uint256[])) private _ownedTypeTokens;

    // Mapping from owner, type, token ID to index of the owned-and-typed tokens list
    mapping(address => mapping(uint256 => mapping(uint256 => uint256))) private _ownedTypeTokensIndex;

    // Array of types, each with all token ids, used for enumeration
    mapping(uint256 => uint256[]) private _allTypeTokens;

    // Mapping from type and token id to position in the _allTypeTokens array
    mapping(uint256 => mapping(uint256 => uint256)) private _allTypeTokensIndex;

    // Listener for changes to token collections; minting, burning, transfers, etc.
    address public tokenCollectionListener;

    event AddTokenType(uint256 indexed tokenType, string name, string symbol, uint256 value);

    /**
     * @dev Grants `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE` and `PAUSER_ROLE` to the
     * account that deploys the contract.
     *
     * Token URIs will be autogenerated based on `baseURI` and their token IDs.
     * See {ERC721-tokenURI}.
     */
    constructor(string memory name, string memory symbol, string memory baseTokenURI) ERC721(name, symbol) {
        _baseTokenURI = baseTokenURI;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        _setupRole(MANAGER_ROLE, _msgSender());
        _setupRole(MINTER_ROLE, _msgSender());
        _setupRole(PAUSER_ROLE, _msgSender());
    }

    function setTokenCollectionListener(address _listener) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "ERC721ValuableCollectibleToken: must have manager role to set token collection listener");
        require(
            _listener == address(0) || _listener.supportsInterface(type(ITokenListener).interfaceId),
            "ERC721ValuableCollectibleToken: address must be zero or implement ITokenListener"
        );
        tokenCollectionListener = _listener;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlEnumerable, ERC721, ERC721Enumerable, IERC165) returns (bool) {
        return interfaceId == type(IERC721TypeExchangeable).interfaceId
            || interfaceId == type(IERC721Collectible).interfaceId
            || interfaceId == type(IERC721Valuable).interfaceId
            || super.supportsInterface(interfaceId);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function totalTypes() public view virtual override returns (uint256 count) {
        return typeInfo.length;
    }

    function typeName(uint256 _type) external view virtual override returns (string memory) {
        require(_type < totalTypes(), "ERC721ValuableCollectibleToken: type out of bounds");
        return typeInfo[_type].name;
    }

    function typeSymbol(uint256 _type) external view virtual override returns (string memory) {
        require(_type < totalTypes(), "ERC721ValuableCollectibleToken: type out of bounds");
        return typeInfo[_type].symbol;
    }

    function typeValue(uint256 _type) external view returns (uint256) {
        require(_type < totalTypes(), "ERC721ValuableCollectibleToken: type out of bounds");
        return typeInfo[_type].value;
    }

    function tokenType(uint256 _tokenId) external view override returns (uint256) {
        require(_exists(_tokenId), "ERC721ValuableCollectibleToken: value query for nonexistent token");
        return _tokenTypeHypothetical(_tokenId);
    }

    function _tokenTypeHypothetical(uint256 _tokenId) internal view virtual returns (uint256) {
        return _tokenType[_tokenId];
    }

    function tokenValue(uint256 _tokenId) external view override returns (uint256) {
        require(_exists(_tokenId), "ERC721ValuableCollectibleToken: value query for nonexistent token");
        return _tokenValueHypothetical(_tokenId);
    }

    function _tokenValueHypothetical(uint256 _tokenId) internal view virtual returns (uint256) {
        return typeInfo[_tokenType[_tokenId]].value;
    }

    function totalSupplyByType(uint256 _type) public view virtual override returns (uint256) {
        require(_type < totalTypes(), "ERC721ValuableCollectibleToken: type out of bounds");
        return _allTypeTokens[_type].length;
    }

    function totalValue() external view virtual override returns (uint256) {
        return _totalValue;
    }

    function ownerTypes(address _owner) public view virtual override returns (uint256) {
        return _ownedTypes[_owner].length;
    }

    function ownerTypeByIndex(address _owner, uint256 _index) external view override returns (uint256) {
        require(_index < ownerTypes(_owner), "ERC721ValuableCollectibleToken: index out of bounds");
        return _ownedTypes[_owner][_index];
    }

    function ownerValue(address _owner) external view virtual override returns (uint256) {
        return _ownedValue[_owner];
    }

    function balanceOfOwnerByType(address _owner, uint256 _type) public view virtual override returns (uint256) {
        require(_type < totalTypes(), "ERC721ValuableCollectibleToken: type out of bounds");
        return _ownedTypeTokens[_owner][_type].length;
    }

    function tokenOfOwnerByTypeAndIndex(address _owner, uint256 _type, uint256 _index) external view virtual override returns (uint256) {
        require(_type < totalTypes(), "ERC721ValuableCollectibleToken: type out of bounds");
        require(_index < balanceOfOwnerByType(_owner, _type), "ERC721ValuableCollectibleToken: index out of bounds");
        return _ownedTypeTokens[_owner][_type][_index];
    }

    function tokenByTypeAndIndex(uint256 _type, uint256 _index) external view virtual override returns (uint256) {
        require(_type < totalTypes(), "ERC721ValuableCollectibleToken: type out of bounds");
        require(_index < totalSupplyByType(_type), "ERC721ValuableCollectibleToken: index out of bounds");
        return _allTypeTokens[_type][_index];
    }

    function addTokenType(string memory _name, string memory _symbol, uint256 _value) public virtual {
        require(hasRole(MANAGER_ROLE, _msgSender()), "ERC721ValuableCollectibleToken: must have manager role to add token type");
        uint256 tType = typeInfo.length;
        typeInfo.push(TypeInfo({
            name: _name,
            symbol: _symbol,
            value: _value
        }));
        emit AddTokenType(tType, _name, _symbol, _value);
    }

    /**
     * @dev See {IERC721-transferFrom}.
     */
    function transferFrom(address from, address to, uint256 tokenId) public virtual override(ERC721, IERC721) {
        super.transferFrom(from, to, tokenId);
        if (tokenCollectionListener != address(0)) {
            ITokenListener(tokenCollectionListener).balanceChanged(from);
            ITokenListener(tokenCollectionListener).balanceChanged(to);
        }
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) public virtual override(ERC721, IERC721) {
        super.safeTransferFrom(from, to, tokenId, _data);
        if (tokenCollectionListener != address(0)) {
            ITokenListener(tokenCollectionListener).balanceChanged(from);
            ITokenListener(tokenCollectionListener).balanceChanged(to);
        }
    }

    /**
     * @dev Creates a new token for `to`. Its token ID will be automatically
     * assigned (and available on the emitted {IERC721-Transfer} event), and the token
     * URI autogenerated based on the base URI passed at construction.
     */
    function mint(address _to, uint256 _type) external override virtual returns (uint256 tokenId) {
        require(hasRole(MINTER_ROLE, _msgSender()), "ERC721ValuableCollectibleToken: must have minter role to mint");
        require(_type < totalTypes(), "ERC721ValuableCollectibleToken: type out of bounds");

        // We cannot just use balanceOf to create the new tokenId because tokens
        // can be burned (destroyed), so we need a separate counter.
        tokenId = _tokenIdTracker.current();
        _tokenIdTracker.increment();

        // minting function requires knowledge  of the token type; write it first.
        // this is sufficient to support _tokenTypeHypothetical and
        //  _tokenValueHypothetical.
        _tokenType[tokenId] = _type;
        _mint(_to, tokenId);

        if (tokenCollectionListener != address(0)) {
            ITokenListener(tokenCollectionListener).balanceChanged(_to);
        }
    }

    /**
     * @dev Creates a new token for `to`. Its token ID will be automatically
     * assigned (and available on the emitted {IERC721-Transfer} event), and the token
     * URI autogenerated based on the base URI passed at construction.
     */
    function massMint(address _to, uint256[] calldata _tokenTypes) external override virtual returns (uint256[] memory tokenIds) {
        require(hasRole(MINTER_ROLE, _msgSender()), "ERC721ValuableCollectibleToken: must have minter role to mint");
        uint256 _totalTypes = totalTypes();
        for (uint i = 0; i < _tokenTypes.length; i++) {
            require(_tokenTypes[i] < _totalTypes, "ERC721ValuableCollectibleToken: type out of bounds");
        }

        tokenIds = new uint256[](_tokenTypes.length);
        for (uint i = 0; i < _tokenTypes.length; i++) {
            uint256 tokenId = tokenIds[i] = _tokenIdTracker.current();
            _tokenIdTracker.increment();

            // minting function requires knowledge  of the token type; write it first.
            // this is sufficient to support _tokenTypeHypothetical and
            //  _tokenValueHypothetical.
            _tokenType[tokenId] = _tokenTypes[i];
            _mint(_to, tokenId);
        }
        if (tokenCollectionListener != address(0)) {
            ITokenListener(tokenCollectionListener).balanceChanged(_to);
        }
    }

    /**
     * @dev Burns the indicated token from `from`'s collection. Only allowed if the
     * caller has approval to access this token its owner's collection (and `from`
     * is the owner of the token).
     */
    function burnFrom(address from, uint256 tokenId) external override virtual {
        require(_exists(tokenId), "ERC721ValuableCollectibleToken: operator query for nonexistent token");
        address owner = ERC721.ownerOf(tokenId);
        address burner = _msgSender();
        require(owner == from, "ERC721ValuableCollectibleToken: token not owned by from address");
        require(
            burner == owner || hasRole(BURNER_ROLE,  burner) || getApproved(tokenId) == burner || isApprovedForAll(owner, burner),
            "ERC721ValuableCollectibleToken: burnFrom caller is not owner, burner, nor approved"
        );

        _burn(tokenId);
        if (tokenCollectionListener != address(0)) {
            ITokenListener(tokenCollectionListener).balanceChanged(from);
        }
    }

    /**
     * @dev Burns the indicated token from `from`'s collection. Only allowed if the
     * caller has approval to access this token its owner's collection (and `from`
     * is the owner of the token).
     */
    function massBurnFrom(address from, uint256[] calldata tokenIds) external override virtual {
        address burner = _msgSender();
        bool allApproved = from == burner || hasRole(BURNER_ROLE,  burner) || isApprovedForAll(from, burner);
        for (uint i = 0; i < tokenIds.length; i++) {
            require(_exists(tokenIds[i]), "ERC721ValuableCollectibleToken: operator query for nonexistent token");
            address owner = ERC721.ownerOf(tokenIds[i]);
            require(owner == from, "ERC721ValuableCollectibleToken: token not owned by from address");
            require(
                allApproved || getApproved(tokenIds[i]) == burner,
                "ERC721ValuableCollectibleToken: massBurnFrom caller is not owner, burner, nor approved"
            );
        }

        for (uint i = 0; i < tokenIds.length; i++) {
            _burn(tokenIds[i]);
        }
        if (tokenCollectionListener != address(0)) {
            ITokenListener(tokenCollectionListener).balanceChanged(from);
        }
    }

    /**
     * @dev Mass transfers tokens (listed as IDs) between the indicated addresses.
     * The caller must have access to the tokens, which must all be owned by the
     * indicated address. This is not a _safe_ transfer; tokens may be trapped
     * in a contract which can't access them. For safe transfers, move them
     * one at a time.
     */
    function massTransferFrom(address from, address to, uint256[] calldata tokenIds) external override virtual {
        address spender = _msgSender();
        bool allApproved = from == spender || isApprovedForAll(from, spender);
        for (uint i = 0; i < tokenIds.length; i++) {
            require(_exists(tokenIds[i]), "ERC721ValuableCollectibleToken: operator query for nonexistent token");
            address owner = ERC721.ownerOf(tokenIds[i]);
            require(owner == from, "ERC721ValuableCollectibleToken: token not owned by from address");
            require(
                allApproved || getApproved(tokenIds[i]) == spender,
                "ERC721ValuableCollectibleToken: massTransferFrom caller is not owner nor approved"
            );
        }

        for (uint i = 0; i < tokenIds.length; i++) {
            _transfer(from, to, tokenIds[i]);
        }
        if (tokenCollectionListener != address(0)) {
            ITokenListener(tokenCollectionListener).balanceChanged(from);
            ITokenListener(tokenCollectionListener).balanceChanged(to);
        }
    }

    /**
     * @dev A batch-operation: burns the indicated tokens from the collection of
     * `owner` (the caller must have approval to do this for all tokens), and
     * mints to them the token type(s) indicated. The caller must have minting
     * privileges and transfer access to all listed tokens (which must be owned
     * by the indicated account).
     */
    function exchange(address owner, uint256[] calldata burnTokenIds, uint256[] calldata tokenTypes) external override virtual returns (uint256[] memory tokenIds) {
        address burner = _msgSender();
        bool allApproved = owner == burner || hasRole(BURNER_ROLE,  burner) || isApprovedForAll(owner, burner);
        for (uint i = 0; i < burnTokenIds.length; i++) {
            require(_exists(burnTokenIds[i]), "ERC721ValuableCollectibleToken: operator query for nonexistent token");
            address tokenOwner = ERC721.ownerOf(burnTokenIds[i]);
            require(tokenOwner == owner, "ERC721ValuableCollectibleToken: token not owned by owner address");
            require(
                allApproved || getApproved(burnTokenIds[i]) == burner,
                "ERC721ValuableCollectibleToken: exchange caller is not owner, burner, nor approved"
            );
        }
        require(hasRole(MINTER_ROLE, burner), "ERC721ValuableCollectibleToken: must have minter role to exchange");
        for (uint i = 0; i < tokenTypes.length; i++) {
            require(tokenTypes[i] < totalTypes(), "ERC721ValuableCollectibleToken: type out of bounds");
        }

        for (uint i = 0; i < burnTokenIds.length; i++) {
            _burn(burnTokenIds[i]);
        }

        tokenIds = new uint256[](tokenTypes.length);
        for (uint i = 0; i < tokenTypes.length; i++) {
            uint256 tokenId = tokenIds[i] = _tokenIdTracker.current();
            _tokenIdTracker.increment();

            // minting function requires knowledge  of the token type; write it first.
            // this is sufficient to support _tokenTypeHypothetical and
            //  _tokenValueHypothetical.
            _tokenType[tokenId] = tokenTypes[i];
            _mint(owner, tokenId);
        }

        if (tokenCollectionListener != address(0)) {
            ITokenListener(tokenCollectionListener).balanceChanged(owner);
        }
    }

    /**
     * @dev Pauses all token transfers.
     *
     * See {ERC721Pausable} and {Pausable-_pause}.
     *
     * Requirements:
     *
     * - the caller must have the `PAUSER_ROLE`.
     */
    function pause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "ERC721ValuableCollectibleToken: must have pauser role to pause");
        _pause();
    }

    /**
     * @dev Unpauses all token transfers.
     *
     * See {ERC721Pausable} and {Pausable-_unpause}.
     *
     * Requirements:
     *
     * - the caller must have the `PAUSER_ROLE`.
     */
    function unpause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "ERC721ValuableCollectibleToken: must have pauser role to unpause");
        _unpause();
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal virtual override(ERC721, ERC721Enumerable, ERC721Pausable) {
        super._beforeTokenTransfer(from, to, tokenId);

        uint256 tType = _tokenTypeHypothetical(tokenId);
        uint256 tValue = _tokenValueHypothetical(tokenId);

        if (from == address(0)) {
            _addTokenToAllTypeTokens(tokenId, tType, tValue);
        } else if (from != to) {
            _removeTokenFromOwnerTypeTokens(from, tokenId, tType, tValue);
        }

        if  (to == address(0)) {
            _removeTokenFromAllTypeTokens(tokenId, tType, tValue);
        } else if (to != from) {
            _addTokenToOwnerTypeTokens(to, tokenId, tType, tValue);
        }
    }

    function _addTokenToAllTypeTokens(uint256 _tokenId, uint256 _type, uint256 _value) private {
        _allTypeTokensIndex[_type][_tokenId] = _allTypeTokens[_type].length;
        _allTypeTokens[_type].push(_tokenId);
        _totalValue =  _totalValue + _value;
    }

    function _removeTokenFromAllTypeTokens(uint256 _tokenId, uint256 _type, uint256 _value) private {
        // To prevent a gap in the tokens array, store the last token in the
        // vacated index (swap and pop).
        uint256 lastTokenIndex = _allTypeTokens[_type].length - 1;
        uint256 tokenIndex = _allTypeTokensIndex[_type][_tokenId];

        uint256 lastTokenId = _allTypeTokens[_type][lastTokenIndex];

        // move the last token into place and update its index
        _allTypeTokens[_type][tokenIndex] = lastTokenId;
        _allTypeTokensIndex[_type][lastTokenId] = tokenIndex;

        // pop the last off
        delete _allTypeTokensIndex[_type][_tokenId];
        _allTypeTokens[_type].pop();

        // update value
        _totalValue = _totalValue - _value;
    }

    function _addTokenToOwnerTypeTokens(address _to, uint256 _tokenId, uint256 _type, uint256 _value) private {
        uint256 length = _ownedTypeTokens[_to][_type].length;
        _ownedTypeTokens[_to][_type].push(_tokenId);
        _ownedTypeTokensIndex[_to][_type][_tokenId] = length;
        _ownedValue[_to] = _ownedValue[_to] + _value;
        if (length == 0) {  // first token of type for user
            _ownedTypesIndex[_to][_type] = _ownedTypes[_to].length;
            _ownedTypes[_to].push(_type);
            emit OwnerTypeAdded(_to, _type, _tokenId);
        }
    }

    function _removeTokenFromOwnerTypeTokens(address _from, uint256 _tokenId, uint256 _type, uint256 _value) private {
        // To prevent a gap in the tokens array, store the last token in the
        // vacated index.
        uint256 lastTokenIndex = _ownedTypeTokens[_from][_type].length - 1;
        uint256 tokenIndex = _ownedTypeTokensIndex[_from][_type][_tokenId];

        uint256 lastTokenId = _ownedTypeTokens[_from][_type][lastTokenIndex];

        // move the last token into place and update its index
        _ownedTypeTokens[_from][_type][tokenIndex] = lastTokenId;
        _ownedTypeTokensIndex[_from][_type][lastTokenId] = tokenIndex;

        // pop the last off
        delete _ownedTypeTokensIndex[_from][_type][_tokenId];
        _ownedTypeTokens[_from][_type].pop();

        // update value
        _ownedValue[_from] = _ownedValue[_from] - _value;
        if (lastTokenIndex == 0) {  // last token of type for user
            uint256 lastOwnedTypeIndex = _ownedTypes[_from].length - 1;
            uint256 typeIndex = _ownedTypesIndex[_from][_type];
            uint256 replacementType = _ownedTypes[_from][lastOwnedTypeIndex];

            // move the last token into place and update its index
            _ownedTypes[_from][typeIndex] = replacementType;
            _ownedTypesIndex[_from][replacementType] = typeIndex;

            // pop the last one off
            delete _ownedTypesIndex[_from][_type];
            _ownedTypes[_from].pop();

            emit OwnerTypeRemoved(_from, _type, _tokenId);
        }
    }
}
