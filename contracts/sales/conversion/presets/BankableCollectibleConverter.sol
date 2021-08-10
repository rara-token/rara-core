// SPDX-License-Identifier: MIT
import "./BasicCollectibleConverter.sol";
import "../interfaces/IBankableCollectibleConverter.sol";

// A blind box prize pool where each prize represents the minting of a particular
// tokenType.
pragma solidity ^0.8.0;
contract BankableCollectibleConverter is BasicCollectibleConverter, IBankableCollectibleConverter {
    using SafeERC20 for IERC20;

    mapping(uint256 => bool) internal _tokenTypeBankable;
    mapping(uint256 => mapping(uint256 => bool)) internal _recipeIncludesTokenType;
    mapping(uint256 => uint256[]) internal _recipeTokenTypesInList;
    mapping(uint256 => uint256[]) internal _recipeTokenTypesInCount;

    mapping(address => mapping(uint256 => uint256)) public override bankedBalance;

    constructor(address _token, address _purchaseToken, address _recipient)
    BasicCollectibleConverter(_token, _purchaseToken, _recipient)
    { }

    function bank(uint256[] calldata _tokenIds) external override virtual {
        // tokens can only be banked if they are used as input to
        // conversion recipes. Ownership of those tokens is confirmed
        // when they are burned (not transfered), so the main purpose
        // here is to update our banked records and leave ownership
        // confirmation to the token itself.
        address _sender = _msgSender();
        uint256[] memory tokenTypes = new uint256[](_tokenIds.length);
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenType = IERC721Collectible(token).tokenType(_tokenIds[i]);
            require(_tokenTypeBankable[tokenType], "BankableCollectibleConverter: invalid tokenType");
            bankedBalance[_sender][tokenType]++;
            tokenTypes[i] = tokenType;
        }

        IERC721TypeExchangeable(token).massBurnFrom(_sender, _tokenIds);
        emit Bank(_sender, _tokenIds, tokenTypes);
    }

    // @dev Purchase the indicated number of draws, paying a maximum total price
    // of `_maximumCost`.
    // @param _to The address to award the prize(s).
    // @param _draws The number of draws to purchase.
    // @param _maximumCost The maximum price to pay for the draws (in total),
    // in case prices fluctuate.
    function convert(uint256 _recipeId, uint256 _maximumCost, uint256[] calldata _tokenIdsIn) external
    override(BasicCollectibleConverter, ICollectibleConverter)
    returns (uint256[] memory tokenIdsOut) {
        require(_recipeId < recipeInfo.length, "BankableCollectibleConverter: nonexistent recipe");
        RecipeInfo storage recipe = recipeInfo[_recipeId];
        require(active && recipe.available, "BankableCollectibleConverter: unavailable");

        address buyer = _msgSender();

        // Verify that enough tokens have been provided, spending from bank if necessary.
        (
            uint256 _lengthIn,
            uint256[] memory _tokenTypesIn,
            uint256[] memory _tokenCountsIn
        ) = _countTypes(true, _tokenIdsIn);
        // verify that each provided token type in is represented in recipe
        for (uint256 i = 0; i < _lengthIn; i++) {
            require(
                _recipeIncludesTokenType[_recipeId][_tokenTypesIn[i]],
                "BankableCollectibleConverter: invalid tokens"
            );
        }
        // verify that recipe requirements are met by specified and banked
        for (uint256 i = 0; i < _recipeTokenTypesInList[_recipeId].length; i++) {
            uint256 _tokenType = _recipeTokenTypesInList[_recipeId][i];
            uint256 _countNeeded = _recipeTokenTypesInCount[_recipeId][i];
            uint256 _countIn;
            for (uint256 j = 0; j < _lengthIn; j++) {
                if (_tokenTypesIn[j] == _tokenType) {
                    _countIn = _tokenCountsIn[j];
                    break;
                }
            }

            require(_countIn <= _countNeeded, "BankableCollectibleConverter: invalid tokens");
            if (_countIn < _countNeeded) {
                uint256 _remainder = _countNeeded - _countIn;
                require(
                    bankedBalance[buyer][_tokenType] >= _remainder,
                    "BankableCollectibleConverter: invalid tokens"
                );
                bankedBalance[buyer][_tokenType] -= _remainder;
            }
        }

        // charge payment
        if (recipe.price > 0) {
            require(_maximumCost >= recipe.price, "BankableCollectibleConverter: insufficient funds");
            address paymentTo = recipient != address(0) ? recipient : address(this);
            IERC20(purchaseToken).safeTransferFrom(buyer, paymentTo, recipe.price);
        }

        uint256[] memory tokenTypesIn = new uint256[](_tokenIdsIn.length);
        for (uint256 i = 0; i < _tokenIdsIn.length; i++) {
          tokenTypesIn[i] = IERC721Collectible(token).tokenType(_tokenIdsIn[i]);
        }

        // note: we haven't checked whether the caller actually owns the tokens
        // indicated; this is verified by the token contract during the exchange call
        tokenIdsOut = IERC721TypeExchangeable(token).exchange(buyer, _tokenIdsIn, recipe.tokenTypesOut);
        emit Conversion(buyer, _recipeId, recipe.price, _tokenIdsIn, tokenTypesIn, tokenIdsOut);
    }

    // @dev a quick check for whether the indicated recipe is supported for
    // the specified `_maximumCost` and `tokenIdsIn`.
    // Does not perform ownership checks or whether the caller has the funds to
    // pay their `_maximumCost`, just whether the input parameters look good.
    function canConvert(uint256 _recipeId, uint256 _maximumCost, uint256[] calldata _tokenIdsIn) external view
    override(BasicCollectibleConverter, ICollectibleConverter)
    returns (bool) {
        require(_recipeId < recipeInfo.length, "BasicCollectibleConverter: nonexistent recipe");
        address _sender = _msgSender();
        RecipeInfo storage recipe = recipeInfo[_recipeId];
        if (!active || !recipe.available || recipe.price > _maximumCost) {
            return false;
        }

        (uint256 _lengthIn, uint256[] memory _tokenTypesIn, uint256[] memory _tokenCountsIn) = _countTypes(true, _tokenIdsIn);
        // for each type provided, check that it is required
        for (uint256 i = 0; i < _lengthIn; i++) {
            if (!_recipeIncludesTokenType[_recipeId][_tokenTypesIn[i]]) {
                return false;
            }
        }
        // for each type needed, check that the caller has enough specified or banked.
        for (uint256 i = 0; i < _recipeTokenTypesInList[_recipeId].length; i++) {
            uint256 _tokenType = _recipeTokenTypesInList[_recipeId][i];
            uint256 _countNeeded = _recipeTokenTypesInCount[_recipeId][i];
            bool ok = false;
            for (uint256 j = 0; j < _lengthIn; j++) {
                if (_tokenTypesIn[j] == _tokenType) {
                    if (
                        _tokenCountsIn[j] > _countNeeded
                        || _tokenCountsIn[j] + bankedBalance[_sender][_tokenType] < _countNeeded
                    ) {
                        return false;
                    }
                    ok = true;
                    break;
                }
            }
            if (!ok) {
                return false;
            }
        }

        return true;
    }

    function _countTypes(bool idsGiven, uint256[] calldata _tokenIdsOrTypes) public view returns (uint256 _length, uint256[] memory _tokenTypes, uint256[] memory _count) {
        _tokenTypes = new uint256[](_tokenIdsOrTypes.length);
        _count = new uint256[](_tokenIdsOrTypes.length);

        for (uint256 i = 0; i < _tokenIdsOrTypes.length; i++) {
            uint256 tokenType = idsGiven ? IERC721Collectible(token).tokenType(_tokenIdsOrTypes[i]) : _tokenIdsOrTypes[i];
            uint256 index = 0;
            bool found = false;
            for (; index < _length; index++) {
                if (_tokenTypes[index] == tokenType) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                _tokenTypes[index] = tokenType;
                _length++;
            }

            _count[index]++;
        }
    }

    function createRecipe(
        uint256[] calldata _tokenTypesIn,
        uint256[] calldata _tokenTypesOut,
        uint256 _price,
        bool _available
    )
    public
    virtual
    override
    returns (uint256 _recipeId) {
        _recipeId = super.createRecipe(_tokenTypesIn, _tokenTypesOut, _price, _available);

        // note bankable
        for (uint256 i = 0; i < _tokenTypesIn.length; i++) {
            _tokenTypeBankable[_tokenTypesIn[i]] = true;
        }

        // note input types in a more efficient format
        (uint256 length, uint256[] memory types, uint256[] memory counts) = _countTypes(false, _tokenTypesIn);
        for (uint256 i = 0; i < length; i++) {
            _recipeIncludesTokenType[_recipeId][types[i]] = true;
            _recipeTokenTypesInList[_recipeId].push(types[i]);
            _recipeTokenTypesInCount[_recipeId].push(counts[i]);
        }
    }
}
