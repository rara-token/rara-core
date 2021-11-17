import "../../../utils/eip/IEIP210.sol";

library GachaRackLibrary {
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

    function filterRevealable(
        DrawInfo[] storage _drawInfo,
        uint256 _blocksStale,
        uint256[] memory _drawIds,
        uint256 _start,
        uint256 _limit,
        address _requiredOwner,
        bool _includeRevealed
    ) public view returns (
        uint256[] memory _revealableDrawIds,
        uint256 _revealableLength,
        uint256 _contiguousLength
    ) {
        _revealableDrawIds = new uint[](_drawIds.length);
        bool contiguous = true;
        for (uint256 i = 0; i < _limit; i++) {
            uint256 index = _start + i;
            require(_drawIds[index] < _drawInfo.length, "BlindCollectibleGachaRack: nonexistent drawId");
            DrawInfo storage draw = _drawInfo[_drawIds[index]];

            // requirements: check owner, revealable
            require(draw.revealBlock < block.number, "BlindCollectibleGachaRack: not revealable");
            require(
                _requiredOwner == address(0) || draw.user == _requiredOwner,
                "BlindCollectibleGachaRack: drawId not owned by"
            );

            if (draw.revealBlock < block.number + _blocksStale) {
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

    function getPrize(
        GameInfo[] storage gameInfo,
        mapping(uint256 => PrizeInfo[]) storage prizeInfo,
        DrawInfo storage _draw,
        bytes32 _blockhash
    ) public view returns (uint256 _prizeId, uint256 _tokenType) {
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

    function getPrizes(
        GameInfo[] storage gameInfo,
        mapping(uint256 => PrizeInfo[]) storage prizeInfo,
        DrawInfo[] storage drawInfo,
        address eip210,
        uint256[] memory _drawIds, uint256 _length
    ) public view returns (uint256[] memory _prizeIds, uint256[] memory _tokenTypes) {
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
            (_prizeIds[i], _tokenTypes[i]) = getPrize(gameInfo, prizeInfo, draw, revealHash);
        }
    }
}
