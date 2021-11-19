// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IBlindSaleGachaRack.sol";
import "../interfaces/IBlindCollectibleSale.sol";
import "../interfaces/IBlindSaleRevealable.sol";
import "../interfaces/IBlindSaleAwardable.sol";
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
abstract contract BaseBlindCollectibleGachaRack is
    Context,
    AccessControlEnumerable,
    IBlindSaleGachaRack,
    IBlindCollectibleSale,
    IBlindSaleRevealable,
    IBlindSaleAwardable
{
    using SafeERC20 for IERC20;

    // Role that configures sales
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant SALTER_ROLE = keccak256("SALTER_ROLE");

    // Error constants
    string internal constant ERR_AUTH = "AUTH";
    string internal constant ERR_OOB = "OOB";
    string internal constant ERR_LENGTH = "LENGTH";
    string internal constant ERR_ACTIVE = "ACTIVE";
    string internal constant ERR_WEIGHT = "WEIGHT";
    string internal constant ERR_SUPPLY = "SUPPLY";
    string internal constant ERR_PRICE = "PRICE";
    string internal constant ERR_DISABLED = "DISABLED";
    string internal constant ERR_NO_TYPE  = "NO_TYPE";
    string internal constant ERR_OWNER = "OWNER";
    string internal constant ERR_BLOCK = "BLOCK";
    string internal constant ERR_REVEALED = "REVEALED";
    string internal constant ERR_NONZERO = "NONZERO";
    string internal constant ERR_PRECISION = "PRECISION";

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

    // Settings
    bool public allowAwarding;
    bool public autoAwarding;

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
    uint256[] internal _drawIdQueuedIndex;
    bool[] internal _drawIdQueued;
    bytes32 internal _salt;

    // draw queue
    uint256[] internal _queuedDrawId;
    uint256 internal _queuedDrawIdNextIndex;

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

    function _currentGameFor(address _user) internal virtual view returns (uint256 gameId);

    function availableSupply() public view override returns (uint256) {
        address caller = _msgSender();
        uint256 gameId = _currentGameFor(caller);
        return _availableSupplyFor(caller, gameId);
    }

    function _availableSupplyFor(address _user, uint256 _gameId) internal virtual view returns (uint256 _supply);

    // Basic Purchase and Reveal

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
        require(game.activated, ERR_ACTIVE);
        require(game.totalWeight > 0, ERR_WEIGHT);
        require(_availableSupplyFor(_buyer, _gameId) >= _draws, ERR_SUPPLY);

        // push reveal block to queue for EIP210 simulation
        uint256 revealBlock = block.number + game.blocksToReveal;
        _revealBlocks.push(revealBlock);

        // determine payment
        uint256 amount = _draws * game.drawPrice;
        require(amount <= _maximumCost, ERR_PRICE);

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

            // manage queue; note that although it starts exactly matching
            // drawId indices, the queue can get reordered over time.
            _drawIdQueuedIndex.push(_queuedDrawId.length);
            _drawIdQueued.push(true);
            _queuedDrawId.push(drawId);

            emit DrawPurchase(_buyer, _to, drawId, game.drawPrice);
        }

        advancePNG(_draws);
        if (autoAwarding) {
            // award queued prizes. Try to catch up a little if there was a big
            // purchase block (not too much).
            _revealQueue(0, _draws > 5 ? _draws : 5);
        }

        // note for subcontracts
        _afterPurchase(_buyer, _gameId, _to, _draws, amount);
    }

    // @dev note the purchase of `_draws` new draws, which have already been pushed
    // to the top of `drawInfo` by the time this call is made.
    function _afterPurchase(address _buyer, uint256 _gameId, address _to, uint256 _draws, uint256 _cost) internal virtual {

    }

    function revealDraws(address _to, uint256[] calldata _drawIds) external override {
        advancePNG(_drawIds.length);
        (uint256[] memory revealingDrawIds, uint256 length,) = _filterRevealable(
            0, _drawIds, 0, _drawIds.length, _msgSender(), true, false
        );
        (uint256[] memory prizeIds, uint256[] memory tokenTypes) = _getPrizes(revealingDrawIds, length);
        _grantPrizes(revealingDrawIds, prizeIds, tokenTypes, length, _to);
    }

    // @notice peeks and returns  the prizeIds to be awarded for the indicated
    // drawIds without minting prize tokens or otherwise changing the chain state.
    // Note that because prizes are based on simulated block hashes, it is possible
    // for a "peeked" prize result to change over time (every 256 blocks) until
    // the blockhash has been written to the EIP210 contract. This can be
    // done by revealing the draws or calling `advancePNG`.
    function peekDrawPrizes(uint256[] calldata _drawIds) external view returns (uint256[] memory prizeIds, uint256[] memory prizeTokenTypes) {
        (uint256[] memory revealingDrawIds, uint256 length,) = _filterRevealable(
            0, _drawIds, 0, _drawIds.length, address(0), true, true
        );
        (prizeIds, prizeTokenTypes) = _getPrizes(revealingDrawIds, length);
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

    // Awardable

    // @dev Award the indicated draws to their purchaser(s), if possible (skips
    // those that are already revealed, but reverts if not revealable yet or
    // invalid).
    // @param _drawIds The _drawIds, which will be awarded to their purchaser(s).
    function awardDraws(uint256[] calldata _drawIds) override external {
        require(allowAwarding, ERR_DISABLED);

        advancePNG(_drawIds.length);
        (uint256[] memory revealingDrawIds, uint256 length,) = _filterRevealable(
            0, _drawIds, 0, _drawIds.length, address(0), true, false
        );
        (uint256[] memory prizeIds, uint256[] memory tokenTypes) = _getPrizes(revealingDrawIds, length);
        _grantPrizes(revealingDrawIds, prizeIds, tokenTypes, length, address(0));
    }

    // @dev Award up to `_limit` queued draws to their purchaser(s).
    // @param _limit The maximum number to award.
    function awardQueuedDraws(uint256 _limit) override external {
        require(allowAwarding, ERR_DISABLED);
        advancePNG(_limit);
        _revealQueue(0, _limit);
    }

    // @dev Award up to `_limit` queued draws to their purchaser(s)
    function awardStaleDraws(uint256 _blocksStale, uint256 _limit) override public {
        require(allowAwarding, ERR_DISABLED);
        advancePNG(_limit);
        _revealQueue(_blocksStale, _limit);
    }

    function _revealQueue(uint256 _blocksStale, uint256 _limit) internal returns (uint256) {
        uint256 remaining = _queuedDrawId.length - _queuedDrawIdNextIndex;
        uint256 limit = remaining > _limit ? _limit : remaining;
        (uint256[] memory drawIds, uint256 length, uint256 contiguous) = _filterRevealable(
            _blocksStale, _queuedDrawId, _queuedDrawIdNextIndex, limit, address(0), false, false
        );

        _queuedDrawIdNextIndex += contiguous;

        (uint256[] memory prizeIds, uint256[] memory tokenTypes) = _getPrizes(drawIds, length);
        _grantPrizes(drawIds, prizeIds, tokenTypes, length, address(0));

        return length;
    }

    // @dev Returns the number of queued draws that are revealable right now,
    // up to `_limit`.
    function queuedDrawsAwardableCount(uint256 _blocksStale, uint256 _limit) override external view returns (uint256 count) {
        uint256 remaining = _queuedDrawId.length - _queuedDrawIdNextIndex;
        uint256 limit = remaining > _limit ? _limit : remaining;
        (, count,) = _filterRevealable(
            _blocksStale, _queuedDrawId, _queuedDrawIdNextIndex, limit, address(0), false, false
        );
    }

    // @dev Returns the number of draws queued right now, revealable or not.
    function queuedDrawsCount() override external view returns (uint256 count) {
        return _queuedDrawId.length - _queuedDrawIdNextIndex;
    }

    // @dev Returns the drawId queued at the indicated index.
    function queuedDrawId(uint256 _index) override external view returns (uint256 drawid) {
        uint256 actualIndex = _index + _queuedDrawIdNextIndex;
        require(actualIndex < _queuedDrawId.length, ERR_OOB);
        return _queuedDrawId[actualIndex];
    }

    // @dev For the draw queued at the indicated index, returns the number of
    // blocks  "stale" (number of blocks it's been revealable).
    function queuedDrawBlocksStale(uint256 _index) override external view returns (uint256 blocks) {
        uint256 actualIndex = _index + _queuedDrawIdNextIndex;
        require(actualIndex < _queuedDrawId.length, ERR_OOB);
        DrawInfo storage draw = drawInfo[_queuedDrawId[actualIndex]];
        return draw.revealBlock < block.number
          ? (block.number - draw.revealBlock - 1)
          : 0;
    }

    // Prize Reveal Helpers

    function _filterRevealable(
        uint256 _blocksStale,
        uint256[] memory _drawIds,
        uint256 _start,
        uint256 _limit,
        address _requiredOwner,
        bool _requireRevealBlock,
        bool _includeRevealed
    ) internal view returns (
        uint256[] memory _revealableDrawIds,
        uint256 _revealableLength,
        uint256 _contiguousLength
    ) {
        _revealableDrawIds = new uint[](_drawIds.length);
        bool contiguous = true;
        for (uint256 i = 0; i < _limit; i++) {
            uint256 index = _start + i;
            require(_drawIds[index] < drawInfo.length, ERR_OOB);
            DrawInfo storage draw = drawInfo[_drawIds[index]];

            // requirements: check owner, revealable
            require(
                !_requireRevealBlock || draw.revealBlock < block.number,
                ERR_BLOCK
            );
            require(
                _requiredOwner == address(0) || draw.user == _requiredOwner,
                ERR_OWNER
            );

            if (draw.revealBlock + _blocksStale < block.number) {
                // revealable... has it been revealed?
                if (_includeRevealed || !draw.revealed) {
                    _revealableDrawIds[_revealableLength++] = _drawIds[index];
                }

                if (contiguous) {
                    _contiguousLength++;
                }
            } else {
                contiguous = false;
            }
        }
    }

    function _getPrize(DrawInfo storage _draw, bytes32 _blockhash) internal view returns (uint256 _prizeId, uint256 _tokenType) {
        // determine prizeId
        PrizeInfo[] storage prizes = prizeInfo[_draw.gameId];
        uint256 anchor = uint256(_draw.revealSeed ^ _blockhash) % gameInfo[_draw.gameId].totalWeight;
        for (; _prizeId < prizes.length; _prizeId++) {
            uint256 weight = prizes[_prizeId].weight;
            if (anchor < weight) {
                break;
            }
            anchor = anchor - weight;
        }
        _tokenType = prizes[_prizeId].tokenType;
    }

    function _getPrizes(uint256[] memory _drawIds, uint256 _length) internal view returns (uint256[] memory _prizeIds, uint256[] memory _tokenTypes) {
        _tokenTypes = new uint[](_length);
        _prizeIds = new uint[](_length);

        uint256 revealBlock;
        bytes32 revealHash;
        for (uint256 i = 0; i < _length; i++) {
            DrawInfo storage draw = drawInfo[_drawIds[i]];

            // determine hash
            if (revealBlock != draw.revealBlock) {
              revealBlock = draw.revealBlock;
              (revealHash,) = IEIP210(eip210).eip210BlockhashEstimate(revealBlock);
            }

            // determine prizeId
            (_prizeIds[i], _tokenTypes[i]) = _getPrize(draw, revealHash);
        }
    }

    function _grantPrizes(uint256[] memory _drawIds, uint256[] memory _prizeIds, uint256[] memory _tokenTypes, uint256 _length, address _to) internal returns (uint256[] memory _tokenIds) {
        // mint or allocate
        _tokenIds = _to != address(0)
            ? IERC721TypeExchangeable(prizeToken).massMint(_to, _tokenTypes)
            : new uint[](_length);

        for (uint256 i = 0; i < _length; i++) {
            uint256 drawId = _drawIds[i];
            DrawInfo storage draw = drawInfo[drawId];

            // mint?
            if (_to == address(0)) {
                _tokenIds[i] = IERC721TypeExchangeable(prizeToken).mint(draw.user, _tokenTypes[i]);
            }

            draw.tokenId = _tokenIds[i];
            draw.prizeId = _prizeIds[i];
            draw.revealed = true;   // prevent duplicate reveals

            prizeDrawId[draw.gameId][_prizeIds[i]].push(drawId);

            // unqueue
            _removeFromQueue(drawId);

            emit Draw(_to, drawId, draw.gameId, draw.prizeId);
        }
    }

    // Queue Management

    function setAllowAwarding(bool _allow) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        allowAwarding = _allow;
    }

    function setAutoAwarding(bool _auto) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        autoAwarding = _auto;
    }

    function addToQueue(uint256 _drawId) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        _addToQueue(_drawId);
    }

    function removeFromQueue(uint256 _drawId) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        _removeFromQueue(_drawId);
    }

    function _addToQueue(uint256 _drawId) internal {
        if (!_drawIdQueued[_drawId] && !drawInfo[_drawId].revealed) {
            _drawIdQueued[_drawId] = true;
            _drawIdQueuedIndex[_drawId] = _queuedDrawId.length;
            _queuedDrawId.push(_drawId);
        }
    }

    function _removeFromQueue(uint256 _drawId) internal {
        uint256 _index = _drawIdQueuedIndex[_drawId];
        if (_drawIdQueued[_drawId]) {
            _drawIdQueued[_drawId] = false;
            if (_index == _queuedDrawIdNextIndex){
                _queuedDrawIdNextIndex++;
            } else if (_index >=  _queuedDrawIdNextIndex) {
                _queuedDrawId[_index] = _queuedDrawId[_queuedDrawId.length - 1];
                _drawIdQueuedIndex[_queuedDrawId[_index]] = _index;
                _queuedDrawId.pop();
            }
        }
    }

    // Other Configuration

    function drawPrice() external view override returns (uint256) {
        uint256 _gameId = _currentGameFor(_msgSender());
        GameInfo storage game = gameInfo[_gameId];
        return game.drawPrice;
    }

    function setDrawPrice(uint256 _gameId, uint256 _price) external {
      require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
      require(_gameId < gameInfo.length, ERR_OOB);
      gameInfo[_gameId].drawPrice = _price;
    }

    function claimAllProceeds(address _to) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        uint256 amount = IERC20(purchaseToken).balanceOf(address(this));
        IERC20(purchaseToken).transfer(_to, amount);
        // TODO emit
    }

    function claimProceeds(address _to, uint256 _amount) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        IERC20(purchaseToken).transfer(_to, _amount);
        // TODO emit
    }

    function setSalt(bytes32 salt) external {
        require(hasRole(SALTER_ROLE, _msgSender()), ERR_AUTH);
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
        require(_gameId < gameInfo.length, ERR_OOB);
        return prizeInfo[_gameId].length;
    }

    // @dev Returns the total weight of all prizes in the indicated game.
    function totalPrizeWeight(uint256 _gameId) external view override returns (uint256) {
        require(_gameId < gameInfo.length, ERR_OOB);
        return gameInfo[_gameId].totalWeight;
    }

    // @dev Returns the probability "weight" for the given `_prizeId` in game
    // `_gameId`.
    function prizeWeight(uint256 _gameId, uint256 _prizeId) external view override returns (uint256) {
        require(_gameId < gameInfo.length, ERR_OOB);
        PrizeInfo[] storage prizes = prizeInfo[_gameId];
        require(_prizeId < prizes.length, ERR_OOB);
        return prizes[_prizeId].weight;
    }

    // @dev The number of times this prize has been drawn (so far).
    function gameDrawCount(uint256 _gameId) external view override returns (uint256) {
        require(_gameId < gameInfo.length, ERR_OOB);
        return gameDrawId[_gameId].length;
    }

    // @dev The number of times this prize has been drawn (so far).
    function prizeDrawCount(uint256 _gameId, uint256 _prizeId) external view override returns (uint256) {
        require(_gameId < gameInfo.length, ERR_OOB);
        require(_prizeId < prizeInfo[_gameId].length, ERR_OOB);
        return prizeDrawId[_gameId][_prizeId].length;
    }

    // @dev Returns the game played by the indicated draw draw.
    function drawGameId(uint256 _did) external view override returns (uint256 gameId) {
        require(_did < drawInfo.length, ERR_OOB);
        gameId = drawInfo[_did].gameId;
    }

    // @dev Returns the prize won with the indicated draw (gameId and prizeId)
    function drawPrizeId(uint256 _did) external view override returns (uint256 gameId, uint256 prizeId) {
        require(_did < drawInfo.length, ERR_OOB);
        require(drawInfo[_did].revealed, ERR_REVEALED);
        gameId = drawInfo[_did].gameId;
        prizeId = drawInfo[_did].prizeId;
    }


    function drawTokenId(uint256 _did) external view override returns (uint256) {
      require(_did < drawInfo.length, ERR_OOB);
      return drawInfo[_did].tokenId;
    }

    function drawTokenType(uint256 _did) external view override returns (uint256) {
      require(_did < drawInfo.length, ERR_OOB);
      DrawInfo storage draw = drawInfo[_did];
      return prizeInfo[draw.gameId][draw.prizeId].tokenType;
    }

    function drawRevealed(uint256 _did) external view override returns (bool) {
        require(_did < drawInfo.length, ERR_OOB);
        return drawInfo[_did].revealed;
    }

    function drawRevealable(uint256 _did) external view override returns (bool) {
        require(_did < drawInfo.length, ERR_OOB);
        return drawInfo[_did].revealBlock < block.number && !drawInfo[_did].revealed;
    }

    function drawRevealableBlock(uint256 _did) external view returns (uint256) {
        require(_did < drawInfo.length, ERR_OOB);
        return drawInfo[_did].revealBlock;
    }

    function setRecipient(address _recipient) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        recipient = _recipient;
    }

    function activateGame(uint256 _gameId) external returns (bool _activated) {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);

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

    function createGame(uint256 _drawPrice, uint256 _blocksToReveal) external returns (uint256 _gameId) {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
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

    function updateGame(uint256 _gameId, uint256 _drawPrice, uint256 _blocksToReveal) external virtual {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);

        // note: it is fine to alter price and reveal blocks on an activated
        // game; those changes only affect new purchases from this point, not
        // existing unrevealed draws.
        GameInfo storage game = gameInfo[_gameId];
        game.drawPrice = _drawPrice;
        game.blocksToReveal = _blocksToReveal;

        emit GameUpdate(_gameId, _drawPrice, _blocksToReveal, game.activated);
    }

    function createPrize(uint256 _gameId, uint256 _tokenType, uint256 _weight) external returns (uint256 _prizeId) {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);
        require(_tokenType < IERC721Collectible(prizeToken).totalTypes(), ERR_NO_TYPE);
        GameInfo storage game = gameInfo[_gameId];
        require(!game.activated, ERR_ACTIVE);

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

    function updatePrize(uint256 _gameId, uint256 _prizeId, uint256 _tokenType, uint256 _weight) external virtual {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);
        require(_prizeId < prizeInfo[_gameId].length, ERR_OOB);

        GameInfo storage game = gameInfo[_gameId];
        require(!game.activated, ERR_ACTIVE);

        PrizeInfo storage prize = prizeInfo[_gameId][_prizeId];

        game.totalWeight = game.totalWeight - prize.weight + _weight;
        prize.tokenType = _tokenType;
        prize.weight = _weight;

        emit PrizeUpdate(_gameId, _prizeId, _tokenType, _weight);
    }
}
