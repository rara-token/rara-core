// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IBlindSaleGachaRack.sol";
import "../interfaces/IBlindCollectibleSale.sol";
import "../interfaces/IBlindSaleRevealable.sol";
import "../../../token/interfaces/IERC721TypeExchangeable.sol";
import "../../../token/interfaces/IERC721Collectible.sol";
import "../../../utils/eip/IEIP210.sol";

// @notice A blind gacha game each prize represents the minting of a particular
// tokenType. Leaves some functionality undefined or abstract.
// Specifically, the method by which the "currentGame" and "availableSupply" is
// left abstract, with these things being determined by a combination of internal
// state, caller address, and (for supply) gameId.
// The method by which new games and prizes are added is omitted, to allow arbitrary
// complexity in their function signatures and input validation; use these
// internal methods as needed:
// {_activateGame}
// {_createGame}
// {_updateGame}
// {_createPrize}
// {_updatePrize}.
pragma solidity ^0.8.0;
abstract contract BaseBlindCollectibleGachaRack is Context, AccessControlEnumerable, IBlindSaleGachaRack, IBlindCollectibleSale, IBlindSaleRevealable {
    using SafeERC20 for IERC20;

    // Role that configures sales
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant SALTER_ROLE = keccak256("SALTER_ROLE");

    struct GameInfo {
        uint256 drawPrice;
        uint256 blocksToReveal;
        uint256 totalWeight;
        bool activated;   // once activated, game prizes cannot be altered.
    }

    // @notice prize info
    struct PrizeInfo {
        uint256 tokenType;
        uint256 weight;
    }

    // @notice draw info
    struct DrawInfo {
        // set at purchase time
        address user;
        uint256 gameId;
        uint256 revealBlock;
        bytes32 revealSeed;
        // set at reveal time, but determined by block hash data
        uint256 prizeId;
        uint256 tokenId;
        bool revealed;
    }

    // games prizes
    GameInfo[] public gameInfo;
    mapping(uint256 => PrizeInfo[]) public prizeInfo;

    // tokens and price
    address public override prizeToken;
    address public override purchaseToken;

    // png
    address public eip210;
    uint256[] internal _revealBlocks;
    uint256 internal _revealBlocksIndex;

    // sale recipient
    address public recipient;

    // draws
    DrawInfo[] public drawInfo;
    mapping(uint256 => uint256[]) public override gameDrawId;
    mapping(uint256 => mapping (uint256 => uint256[])) public override prizeDrawId;
    mapping(address => uint256[]) public override drawIdBy;
    bytes32 internal _salt;

    event GameCreation(uint256 indexed gameId, uint256 drawPrice, uint256 blocksToReveal);
    event GameUpdate(uint256 indexed gameId, uint256 drawPrice, uint256 blocksToReveal, bool activated);
    event PrizeCreation(uint256 indexed gameId, uint256 indexed prizeId, uint256 indexed tokenType, uint256 weight);
    event PrizeUpdate(uint256 indexed gameId, uint256 indexed prizeId, uint256 indexed tokenType, uint256 weight);

    constructor(address _prizeToken, address _purchaseToken, address _eip210, address _recipient) {
        prizeToken = _prizeToken;
        purchaseToken = _purchaseToken;
        eip210 = _eip210;
        recipient = _recipient;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/configure prizes
        _setupRole(SALTER_ROLE, _msgSender());          // salter; can rewrite the RNG salt
    }

    function currentGame() public view override returns (uint256) {
        return _currentGameFor(_msgSender());
    }

    function _currentGameFor(address _user) internal virtual view returns (uint256 _gameId);

    function availableSupply() public view override returns (uint256) {
        address caller = _msgSender();
        uint256 gameId = _currentGameFor(caller);
        return _availableSupplyFor(caller, gameId);
    }

    function _availableSupplyFor(address _user, uint256 _gameId) internal virtual view returns (uint256 _supply);

    // @dev Purchase the indicated number of draws, paying a maximum total price
    // of `_maximumCost`.
    // @param _to The address to award the prize(s).
    // @param _draws The number of draws to purchase.
    // @param _maximumCost The maximum price to pay for the draws (in total),
    // in case prices fluctuate.
    function purchaseDraws(address _to, uint256 _draws, uint256 _maximumCost) external override {
        // verify game is available
        address buyer = _msgSender();
        uint256 gameId = _currentGameFor(buyer);
        _purchaseDraws(buyer, gameId, _to, _draws, _maximumCost);
    }

    function _purchaseDraws(address _buyer, uint256 _gameId, address _to, uint256 _draws, uint256 _maximumCost) internal {
        GameInfo storage game = gameInfo[_gameId];
        require(game.activated, "BlindCollectibleGachaRack: not activated");
        require(game.totalWeight > 0, "BlindCollectibleGachaRack: no prizes available");
        require(_availableSupplyFor(_buyer, _gameId) >= _draws, "BlindCollectibleGachaRack: not enough supply");

        // push reveal block to queue for EIP210 simulation
        uint256 revealBlock = block.number + game.blocksToReveal;
        _revealBlocks.push(revealBlock);

        // determine payment
        uint256 amount = _draws * game.drawPrice;
        require(amount <= _maximumCost, "BlindCollectibleGachaRack: too expensive");

        // charge payment
        address paymentTo = recipient != address(0) ? recipient : address(this);
        IERC20(purchaseToken).safeTransferFrom(_buyer, paymentTo, amount);

        // create (don't reveal) draws
        for (uint256 i = 0; i < _draws; i++) {
            uint256 drawId = drawInfo.length;
            drawInfo.push(DrawInfo({
                user: _to,
                gameId: _gameId,
                revealBlock: revealBlock,
                revealSeed: keccak256(abi.encodePacked(address(this), _salt, _buyer, drawId)),
                prizeId: 0,
                tokenId: 0,
                revealed: false
            }));

            drawIdBy[_to].push(drawId);
            gameDrawId[_gameId].push(drawId);

            emit DrawPurchase(_buyer, _to, drawId, game.drawPrice);
        }

        // advance the png for each purchase; this helps prevent attackers
        // from delaying their reveal until a favorable outcome, since other
        // purchases will lock-in the result they would reveal. Cost is approx.
        // linear with number of draws.
        advancePNG(_draws);
    }

    // @dev Purchase the indicated number of draws, paying a maximum total price
    // of `_maximumCost`.
    // @param _to The address to award the prize(s).
    // @param _drawIds The _drawIds, owned by the sender, to reveal in this transaction.
    function revealDraws(address _to, uint256[] calldata _drawIds) external override {
        uint256 length = _drawIds.length;
        uint256[] memory prizeIds = new uint[](_drawIds.length);
        uint256[] memory tokenTypes = new uint[](_drawIds.length);

        // verify and reveal prizes
        for (uint256 i = 0; i < length; i++) {
            uint256 drawId = _drawIds[i];
            require(drawId < drawInfo.length, "BlindCollectibleGachaRack: nonexistent drawId");

            DrawInfo storage draw = drawInfo[drawId];
            require(draw.user == _msgSender(), "BlindCollectibleGachaRack: drawId not owned by caller");

            uint256 prizeId = prizeIds[i] = _peekReveal(drawId);
            tokenTypes[i] = prizeInfo[draw.gameId][prizeId].tokenType;
        }

        // mint and write
        uint256[] memory tokenIds = IERC721TypeExchangeable(prizeToken).massMint(_to, tokenTypes);
        for (uint256 i = 0; i < length; i++) {
            uint256 drawId  = _drawIds[i];

            DrawInfo storage draw = drawInfo[drawId];
            draw.prizeId = prizeIds[i];
            draw.tokenId = tokenIds[i];
            draw.revealed = true;

            prizeDrawId[draw.gameId][prizeIds[i]].push(drawId);

            emit Draw(_to, drawId, draw.gameId, draw.prizeId);
        }
    }

    function _peekReveal(uint256 _drawId) internal virtual returns (uint256 _prizeId) {
        DrawInfo storage draw = drawInfo[_drawId];
        GameInfo storage game = gameInfo[draw.gameId];
        require(draw.revealBlock < block.number, "BlindCollectibleGachaRack: not revealable");

        bytes32 revealHash = IEIP210(eip210).eip210Blockhash(draw.revealBlock);
        uint256 anchor = uint256(draw.revealSeed ^ revealHash) % game.totalWeight;

        for (; _prizeId < prizeInfo[draw.gameId].length; _prizeId++) {
            uint256 weight = prizeInfo[draw.gameId][_prizeId].weight;
            if (anchor < weight) {
                break;
            }
            anchor = anchor - weight;
        }
    }

    // @notice Pseudorandom number generation is handled by combining a draw-specific
    // seed (generated at purchase time) with the blockhash of a yet-to-occur
    // block. Draw results may be revealed any time after this block. However,
    // the Blockhash-Minus-256 problem prevents secure reveals 256 blocks _after_
    // this block, since the blockhash is no longer available.
    // Calling this function effectively computes and stores the blockhash(es) of
    // any pending reveals, either actually (if w/in 256) or by simulation.
    // The simulation changes every 256 blocks, making attacks time-consuming,
    // while advancing the PNG with this function potentially locks-in the reveal
    // outcome. This call may be used from outside the contract and is also a
    // side-effect of purchases (i.e. other users buying draws will prevent an
    // attacker from exploiting the simulation process).
    function advancePNG(uint256 _limit) public {
        uint256 paramLimit = _revealBlocksIndex + _limit;
        uint256 arrayLimit = _revealBlocks.length;
        uint256 limit = paramLimit < arrayLimit ? paramLimit : arrayLimit;
        uint256 i = _revealBlocksIndex;
        for (; i < limit && _revealBlocks[i] < block.number; i++) {
            // store the (possibly simulated) blockhash permanently
            IEIP210(eip210).eip210Blockhash(_revealBlocks[i]);
        }
        _revealBlocksIndex = i;
    }

    function drawPrice() external view override returns (uint256) {
        uint256 _gameId = _currentGameFor(_msgSender());
        GameInfo storage game = gameInfo[_gameId];
        return game.drawPrice;
    }

    function setDrawPrice(uint256 _gameId, uint256 _price) external {
      require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleGachaRack: must have MANAGER role to setDrawPrice");
      require(_gameId < gameInfo.length, "BlindCollectibleGachaRack: nonexistent gameId");
      gameInfo[_gameId].drawPrice = _price;
    }

    function claimAllProceeds(address _to) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleGachaRack: must have MANAGER role to claimAllProceeds");
        uint256 amount = IERC20(purchaseToken).balanceOf(address(this));
        IERC20(purchaseToken).transfer(_to, amount);
        // TODO emit
    }

    function claimProceeds(address _to, uint256 _amount) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleGachaRack: must have MANAGER role to claimProceeds");
        IERC20(purchaseToken).transfer(_to, _amount);
        // TODO emit
    }

    function setSalt(bytes32 salt) external {
        require(hasRole(SALTER_ROLE, _msgSender()), "BlindCollectibleGachaRack: must have SALTER role to setSalt");
        _salt = salt;
    }

    // @dev Returns the number of draws by `_user` (thus far).
    function drawCountBy(address _user) external view override returns (uint256) {
        return drawIdBy[_user].length;
    }

    // @dev Returns the number of draws conducted thus far. drawIds will index
    // from zero to this number.
    function totalDraws() external view override returns (uint256) {
        return drawInfo.length;
    }

    // @dev Returns the number of games available in this rack.
    function gameCount() public view override returns (uint256) {
        return gameInfo.length;
    }

    // @dev Returns the number of distinct prizes offered by game `_gameId`
    // (each prize may have multiple instances and be drawn multiple times,
    // but they should be identical).
    function prizeCount(uint256 _gameId) external view override returns (uint256) {
        require(_gameId < gameInfo.length, "BlindCollectibleGachaRack: nonexistent gameId");
        return prizeInfo[_gameId].length;
    }

    // @dev Returns the total weight of all prizes in the indicated game.
    function totalPrizeWeight(uint256 _gameId) external view override returns (uint256) {
        require(_gameId < gameInfo.length, "BlindCollectibleGachaRack: nonexistent gameId");
        return gameInfo[_gameId].totalWeight;
    }

    // @dev Returns the probability "weight" for the given `_prizeId` in game
    // `_gameId`.
    function prizeWeight(uint256 _gameId, uint256 _prizeId) external view override returns (uint256) {
        require(_gameId < gameInfo.length, "BlindCollectibleGachaRack: nonexistent gameId");
        PrizeInfo[] storage prizes = prizeInfo[_gameId];
        require(_prizeId < prizes.length, "BlindCollectibleGachaRack: nonexistent prizeId");
        return prizes[_prizeId].weight;
    }

    // @dev The number of times this prize has been drawn (so far).
    function gameDrawCount(uint256 _gameId) external view override returns (uint256) {
        require(_gameId < gameInfo.length, "BlindCollectibleGachaRack: nonexistent gameId");
        return gameDrawId[_gameId].length;
    }

    // @dev The number of times this prize has been drawn (so far).
    function prizeDrawCount(uint256 _gameId, uint256 _prizeId) external view override returns (uint256) {
        require(_gameId < gameInfo.length, "BlindCollectibleGachaRack: nonexistent gameId");
        require(_prizeId < prizeInfo[_gameId].length, "BlindCollectibleGachaRack: nonexistent prizeId");
        return prizeDrawId[_gameId][_prizeId].length;
    }

    // @dev Returns the game played by the indicated draw draw.
    function drawGameId(uint256 _did) external view override returns (uint256 _gameId) {
        require(_did < drawInfo.length, "BlindCollectibleGachaRack: nonexistent drawId");
        _gameId = drawInfo[_did].gameId;
    }

    // @dev Returns the prize won with the indicated draw (gameId and prizeId)
    function drawPrizeId(uint256 _did) external view override returns (uint256 _gameId, uint256 _prizeId) {
        require(_did < drawInfo.length, "BlindCollectibleGachaRack: nonexistent drawId");
        require(drawInfo[_did].revealed, "BlindCollectibleGachaRack: not revealed");
        _gameId = drawInfo[_did].gameId;
        _prizeId = drawInfo[_did].prizeId;
    }


    function drawTokenId(uint256 _did) external view override returns (uint256) {
      require(_did < drawInfo.length, "BlindCollectibleGachaRack: nonexistent did");
      return drawInfo[_did].tokenId;
    }

    function drawTokenType(uint256 _did) external view override returns (uint256) {
      require(_did < drawInfo.length, "BlindCollectibleGachaRack: nonexistent did");
      DrawInfo storage draw = drawInfo[_did];
      return prizeInfo[draw.gameId][draw.prizeId].tokenType;
    }

    function drawRevealed(uint256 _did) external view override returns (bool) {
        require(_did < drawInfo.length, "BlindCollectibleGachaRack: nonexistent did");
        return drawInfo[_did].revealed;
    }

    function drawRevealable(uint256 _did) external view override returns (bool) {
        require(_did < drawInfo.length, "BlindCollectibleGachaRack: nonexistent did");
        return drawInfo[_did].revealBlock <= block.number;
    }

    function drawRevealableBlock(uint256 _did) external view returns (uint256) {
        require(_did < drawInfo.length, "BlindCollectibleGachaRack: nonexistent did");
        return drawInfo[_did].revealBlock;
    }

    function setRecipient(address _recipient) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectibleGachaRack: must have MANAGER role to setRecipient");
        recipient = _recipient;
    }

    function _activateGame(uint256 _gameId) internal returns (bool _activated) {
        GameInfo storage game = gameInfo[_gameId];
        _activated = !game.activated;
        game.activated = true;
        _afterActivateGame(_gameId, _activated);
    }

    function _afterActivateGame(uint256 _gameId, bool _activated) internal virtual {
        if (_activated) {
            GameInfo storage game = gameInfo[_gameId];
            emit GameUpdate(_gameId, game.drawPrice, game.blocksToReveal, game.activated);
        }
    }

    function _createGame(uint256 _drawPrice, uint256 _blocksToReveal) internal returns (uint256 _gameId) {
        _gameId = gameInfo.length;

        gameInfo.push(GameInfo({
            drawPrice: _drawPrice,
            blocksToReveal: _blocksToReveal,
            totalWeight: 0,
            activated: false
        }));

        _afterCreateGame(_gameId, _drawPrice, _blocksToReveal);
    }

    function _afterCreateGame(uint256 _gameId, uint256 _drawPrice, uint256 _blocksToReveal) internal virtual {
        emit GameCreation(_gameId, _drawPrice, _blocksToReveal);
    }

    function _updateGame(uint256 _gameId, uint256 _drawPrice, uint256 _blocksToReveal) internal virtual {
        // note: it is fine to alter price and reveal blocks on an activated
        // game; those changes only affect new purchases from this point, not
        // existing unrevealed draws.
        GameInfo storage game = gameInfo[_gameId];
        game.drawPrice = _drawPrice;
        game.blocksToReveal = _blocksToReveal;

        emit GameUpdate(_gameId, _drawPrice, _blocksToReveal, game.activated);
    }

    function _createPrize(uint256 _gameId, uint256 _tokenType, uint256 _weight) internal returns (uint256 _prizeId) {
        require(_tokenType < IERC721Collectible(prizeToken).totalTypes(), "BlindCollectibleGachaRack: nonexistent tokenType");
        GameInfo storage game = gameInfo[_gameId];
        require(!game.activated, "BlindCollectibleGachaRack: game has been activated");

        game.totalWeight = game.totalWeight + _weight;

        _prizeId = prizeInfo[_gameId].length;
        prizeInfo[_gameId].push(PrizeInfo({
            tokenType: _tokenType,
            weight: _weight
        }));

        // emits
        _afterCreatePrize(_gameId, _prizeId, _tokenType, _weight);
    }

    function _afterCreatePrize(uint256 _gameId, uint256 _prizeId, uint256 _tokenType, uint256 _weight) internal virtual {
        emit PrizeCreation(_gameId, _prizeId, _tokenType, _weight);
    }

    function _updatePrize(uint256 _gameId, uint256 _prizeId, uint256 _tokenType, uint256 _weight) internal virtual {
        GameInfo storage game = gameInfo[_gameId];
        require(!game.activated, "BlindCollectibleGachaRack: game has been activated");

        PrizeInfo storage prize = prizeInfo[_gameId][_prizeId];

        game.totalWeight = game.totalWeight - prize.weight + _weight;
        prize.tokenType = _tokenType;
        prize.weight = _weight;

        emit PrizeUpdate(_gameId, _prizeId, _tokenType, _weight);
    }
}
