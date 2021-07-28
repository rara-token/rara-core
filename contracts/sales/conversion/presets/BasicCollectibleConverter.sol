// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ICollectibleConverter.sol";
import "../../../token/interfaces/IERC721TypeExchangeable.sol";
import "../../../token/interfaces/IERC721Collectible.sol";

// A blind box prize pool where each prize represents the minting of a particular
// tokenType.
pragma solidity ^0.8.0;
contract BasicCollectibleConverter is Context, AccessControlEnumerable, ICollectibleConverter {
    using SafeERC20 for IERC20;

    // Role that create new sales
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    // @notice prize info
    struct RecipeInfo {
        uint256[] tokenTypesIn;
        uint256[] tokenTypesOut;
        uint256 price;
        bool available;
    }

    // recipes
    RecipeInfo[] public recipeInfo;
    bool public active;

    // tokens
    address public override token;
    address public override purchaseToken;

    // sale recipient
    address public recipient;

    event RecipeCreation(uint256 indexed recipeId, uint256 price, bool available, uint256[] tokenTypesIn, uint256[] tokenTypesOut);
    event RecipeUpdate(uint256 indexed recipeId, uint256 price, bool available);

    constructor(address _token, address _purchaseToken, address _recipient) {
        token = _token;
        purchaseToken = _purchaseToken;
        recipient = _recipient;

        active = true;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/configure recipes
    }

    // @dev Purchase the indicated number of draws, paying a maximum total price
    // of `_maximumCost`.
    // @param _to The address to award the prize(s).
    // @param _draws The number of draws to purchase.
    // @param _maximumCost The maximum price to pay for the draws (in total),
    // in case prices fluctuate.
    function convert(uint256 _recipeId, uint256 _maximumCost, uint256[] calldata _tokenIdsIn) external override returns (uint256[] memory tokenIdsOut) {
        require(_recipeId < recipeInfo.length, "BasicCollectibleConverter: nonexistent recipe");
        RecipeInfo storage recipe = recipeInfo[_recipeId];
        require(active && recipe.available, "BasicCollectibleConverter: unavailable");
        require(_supportsParameters(recipe, _maximumCost, _tokenIdsIn), "BasicCollectibleConverter: invalid parameters");

        address buyer = _msgSender();

        // charge payment
        if (recipe.price > 0) {
            address paymentTo = recipient != address(0) ? recipient : address(this);
            IERC20(purchaseToken).safeTransferFrom(buyer, paymentTo, recipe.price);
        }

        // note: we haven't checked whether the caller actually owns the tokens
        // indicated; this is verified by the token contract during the exchange call
        tokenIdsOut = IERC721TypeExchangeable(token).exchange(buyer, _tokenIdsIn, recipe.tokenTypesOut);
        emit Conversion(buyer, _recipeId, recipe.price, _tokenIdsIn, tokenIdsOut);
    }

    // @dev a quick check for whether the indicated recipe is supported for
    // the specified `_maximumCost` and `tokenIdsIn`.
    // Does not perform ownership checks or whether the caller has the funds to
    // pay their `_maximumCost`, just whether the input parameters look good.
    function canConvert(uint256 _recipeId, uint256 _maximumCost, uint256[] calldata _tokenIdsIn) external view override returns (bool) {
        require(_recipeId < recipeInfo.length, "BasicCollectibleConverter: nonexistent recipe");
        RecipeInfo storage recipe = recipeInfo[_recipeId];
        return active && recipe.available && _supportsParameters(recipe, _maximumCost, _tokenIdsIn);
    }

    function _supportsParameters(RecipeInfo storage _recipe, uint256 _maximumCost, uint256[] calldata _tokenIdsIn) internal view returns (bool supported) {
        uint256 length = _recipe.tokenTypesIn.length;
        supported = (
            _recipe.price <= _maximumCost
            && _tokenIdsIn.length == length
        );

        // check token types
        if (supported) {
            // collect types
            uint256[] memory inputTypes = new uint[](length);
            for (uint256 i = 0; i < length; i++) {
                inputTypes[i] = IERC721Collectible(token).tokenType(_tokenIdsIn[i]);
            }

            // for each type needed, make sure it's present in the inputs.
            // replace "used" types from the end of the array.
            for (uint256 i = 0; i < length && supported; i++) {
                uint256 tokenType = _recipe.tokenTypesIn[i];
                uint256 limit = length - i;
                for (uint256 j = 0; j < limit; j++) {
                    if (inputTypes[j] == tokenType) {
                        inputTypes[j] = inputTypes[limit - 1];
                        break;
                    } else if (j == limit - 1) {
                        supported = false;
                    }
                }
            }
        }
    }


    function setActive(bool _active) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleConverter: must have MANAGER role to setActive");
        active = _active;
        // TODO emit?
    }

    function claimAllProceeds(address _to) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleConverter: must have MANAGER role to claimAllProceeds");
        uint256 amount = IERC20(purchaseToken).balanceOf(address(this));
        IERC20(purchaseToken).transfer(_to, amount);
        // TODO emit?
    }

    function claimProceeds(address _to, uint256 _amount) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleConverter: must have MANAGER role to claimProceeds");
        IERC20(purchaseToken).transfer(_to, _amount);
        // TODO emit?
    }

    // @dev returns the number of exchange recipes known to this contract
    function recipeCount() external view override returns (uint256) {
        return recipeInfo.length;
    }

    // @dev returns whether recipe `_recipeId` is currently available for those
    // who meet its prerequisites.
    function recipeAvailable(uint256 _recipeId) public view override returns (bool) {
        require(_recipeId < recipeInfo.length, "BasicCollectibleConverter: invalid recipeId");
        return active && recipeInfo[_recipeId].available;
    }

    // @dev returns the current purchase price to process recipe `recipeId` (may be zero)
    function recipePrice(uint256 _recipeId) external view override returns (uint256) {
        require(_recipeId < recipeInfo.length, "BasicCollectibleConverter: invalid recipeId");
        return recipeInfo[_recipeId].price;
    }

    // @dev returns an array of token types required as inputs to recipe `recipeId`.
    // These token types will be consumed (burned) in the recipe.
    function recipeInput(uint256 _recipeId) external view override returns (uint256[] memory tokenTypes) {
        require(_recipeId < recipeInfo.length, "BasicCollectibleConverter: invalid recipeId");
        RecipeInfo storage recipe = recipeInfo[_recipeId];
        uint256 length = recipe.tokenTypesIn.length;
        tokenTypes = new uint[](length);
        for (uint256 i = 0; i < length; i++) {
            tokenTypes[i] = recipe.tokenTypesIn[i];
        }
    }

    // @dev returns an array of token types produced as output of recipe `recipeId`.
    // These token types will minted when the recipe is processed.
    function recipeOutput(uint256 _recipeId) external view override returns (uint256[] memory tokenTypes) {
        require(_recipeId < recipeInfo.length, "BasicCollectibleConverter: invalid recipeId");
        RecipeInfo storage recipe = recipeInfo[_recipeId];
        uint256 length = recipe.tokenTypesOut.length;
        tokenTypes = new uint[](length);
        for (uint256 i = 0; i < length; i++) {
            tokenTypes[i] = recipe.tokenTypesOut[i];
        }
    }

    function setRecipient(address _recipient) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleConverter: must have MANAGER role to setRecipient");
        recipient = _recipient;
    }

    // TODO controls for changing price, start/stop times, prizes and supplies.
    function createRecipe(uint256[] calldata _tokenTypesIn, uint256[] calldata _tokenTypesOut, uint256 _price, bool _available) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleConverter: must have MANAGER role to createRecipe");

        // verify token types exist
        uint256 totalTypes = IERC721Collectible(token).totalTypes();
        for (uint256 i = 0; i < _tokenTypesIn.length; i++) {
            require(_tokenTypesIn[i] < totalTypes, "BasicCollectibleConverter: nonexistent tokenType");
        }
        for (uint256 i = 0; i < _tokenTypesOut.length; i++) {
            require(_tokenTypesOut[i] < totalTypes, "BasicCollectibleConverter: nonexistent tokenType");
        }

        // create
        uint256 _recipeId = recipeInfo.length;
        recipeInfo.push(RecipeInfo({
            price: _price,
            available: _available,
            tokenTypesIn: new uint[](_tokenTypesIn.length),
            tokenTypesOut: new uint[](_tokenTypesOut.length)
        }));
        RecipeInfo storage recipe = recipeInfo[_recipeId];
        for (uint256 i = 0; i < _tokenTypesIn.length; i++) {
            recipe.tokenTypesIn[i] = _tokenTypesIn[i];
        }
        for (uint256 i = 0; i < _tokenTypesOut.length; i++) {
            recipe.tokenTypesOut[i] = _tokenTypesOut[i];
        }

        emit RecipeCreation(_recipeId, _price, _available, _tokenTypesIn, _tokenTypesOut);
    }

    function setRecipe(uint256 _recipeId, uint256 _price, bool _available) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BasicCollectibleConverter: must have MANAGER role to setRecipe");
        require(_recipeId < recipeInfo.length, "BasicCollectibleConverter: nonexistent recipe");
        RecipeInfo storage recipe = recipeInfo[_recipeId];
        recipe.price = _price;
        recipe.available = _available;

        emit RecipeUpdate(_recipeId,  _price, _available);
    }
}
