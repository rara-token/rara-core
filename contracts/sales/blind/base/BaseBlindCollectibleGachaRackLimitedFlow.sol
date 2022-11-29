import "./BaseBlindCollectibleGachaRack.sol";

pragma solidity ^0.8.0;
abstract contract BaseBlindCollectibleGachaRackLimitedFlow is BaseBlindCollectibleGachaRack {

    uint256 private constant PRECISION = 1e20;

    struct GameDrawFlow {
        uint256 numerator;
        uint256 denominator;
        uint256 updateBlock;
        uint256 updateDraws;
    }

    GameDrawFlow[] public gameDrawFlow;

    function setGameDrawFlowAndSupply(uint256 _gameId, uint256 _supply, uint256 _numerator, uint256 _denominator, uint256 _startBlock) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);

        require(_denominator > 0, ERR_NONZERO);
        require(_numerator < PRECISION && _denominator < PRECISION, ERR_PRECISION);

        GameDrawFlow storage flow = gameDrawFlow[_gameId];
        flow.numerator = _numerator;
        flow.denominator = _denominator;
        flow.updateBlock = _startBlock > block.number ? _startBlock : block.number;
        flow.updateDraws = _supply + gameDrawId[_gameId].length;
    }

    function setGameSupply(uint256 _gameId, uint256 _supply) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);

        GameDrawFlow storage flow = gameDrawFlow[_gameId];
        flow.updateBlock = block.number < flow.updateBlock ? flow.updateBlock : block.number; // keep future start; re-anchor active flow
        flow.updateDraws = _supply + gameDrawId[_gameId].length;
    }

    function setGameDrawFlow(uint256 _gameId, uint256 _numerator, uint256 _denominator, uint256 _startBlock) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), ERR_AUTH);
        require(_gameId < gameInfo.length, ERR_OOB);

        require(_denominator > 0, ERR_NONZERO);
        require(_numerator < PRECISION && _denominator < PRECISION, ERR_PRECISION);

        GameDrawFlow storage flow = gameDrawFlow[_gameId];
        flow.numerator = _numerator;
        flow.denominator = _denominator;
        flow.updateBlock = _startBlock > block.number ? _startBlock : block.number;
        // don't alter flow.updateDraws; that is current supply, unchanged by this call
    }

    function _availableSupplyFor(address, uint256 _gameId) internal view override virtual returns (uint256) {
        if (_gameId >= gameDrawFlow.length) {
          return 0;
        }

        GameDrawFlow storage flow = gameDrawFlow[_gameId];
        uint256 drawn = gameDrawId[_gameId].length;
        if (block.number > flow.updateBlock) {
            uint256 blocks = block.number - flow.updateBlock;
            uint256 flowed = (blocks * flow.numerator) / flow.denominator;
            uint256 totalFlowed = flow.updateDraws + flowed;
            return totalFlowed > drawn ? totalFlowed - drawn : 0;
        } else {
            return flow.updateDraws > drawn ? flow.updateDraws - drawn : 0;
        }
    }

    function _afterCreateGame(uint256 _gameId, uint256 _drawPrice, uint256 _blocksToReveal) internal override virtual {
        gameDrawFlow.push(GameDrawFlow({
            numerator: 0,
            denominator: 1,
            updateBlock: 0,
            updateDraws: 0
        }));

        super._afterCreateGame(_gameId, _drawPrice, _blocksToReveal);
    }
}
