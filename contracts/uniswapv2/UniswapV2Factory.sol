pragma solidity ^0.8.0;

import './interfaces/IUniswapV2FactoryPermission.sol';
import './interfaces/IUniswapV2SwapValuator.sol';
import './UniswapV2Pair.sol';

contract UniswapV2Factory is IUniswapV2FactoryPermission {
    address public override swapValuator;
    address public override mintingFeeTo;
    address public override feeTo;
    address public override feeToSetter;
    address public override migrator;

    mapping(address => mapping(address => address)) public override getPair;
    address[] public override allPairs;

    bool public override creationDisallowed;
    mapping(address => bool) public override tokenDisallowed;
    mapping(address => mapping(address => bool)) public override pairDisallowed;

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }

    function swapRateDimi(address _client) external override view returns (uint) {
        if (swapValuator != address(0)) {
            return IUniswapV2SwapValuator(swapValuator).swapRateDimi(_client);
        }
        return 9970;
    }

    function isSwapValuator() external override pure returns (bool) {
        return true;
    }

    function allPairsLength() external override view returns (uint) {
        return allPairs.length;
    }

    function pairCodeHash() external pure returns (bytes32) {
        return keccak256(type(UniswapV2Pair).creationCode);
    }

    function createPair(address tokenA, address tokenB) external override returns (address pair) {
        require(tokenA != tokenB, 'UniswapV2: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'UniswapV2: PAIR_EXISTS'); // single check is sufficient
        require(!creationDisallowed || msg.sender == feeToSetter, 'UniswapV2: CREATION_DISALLOWED');
        require((!tokenDisallowed[tokenA] && !tokenDisallowed[tokenB]) || msg.sender == feeToSetter, 'UniswapV2: TOKEN_DISALLOWED');
        require(!pairDisallowed[tokenA][tokenB] || msg.sender == feeToSetter, 'UniswapV2: PAIR_DISALLOWED');
        bytes memory bytecode = type(UniswapV2Pair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        UniswapV2Pair(pair).initialize(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function allowed(address tokenA, address tokenB) external override view returns (bool) {
        return getPair[tokenA][tokenB] != address(0) || (
            !creationDisallowed &&
            !tokenDisallowed[tokenA] &&
            !tokenDisallowed[tokenB] &&
            !pairDisallowed[tokenA][tokenB]
        );
    }

    function setSwapValuator(address _swapValuator) external override {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        require(_swapValuator == address(0) || IUniswapV2SwapValuator(_swapValuator).isSwapValuator(),
            'UnswapV2: INVALID_ADDRESS');
        swapValuator = _swapValuator;
    }

    function setMintingFeeTo(address _mintingFeeTo) external override {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        mintingFeeTo = _mintingFeeTo;
    }

    function setFeeTo(address _feeTo) external override {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        feeTo = _feeTo;
    }

    function setMigrator(address _migrator) external override {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        migrator = _migrator;
    }

    function setFeeToSetter(address _feeToSetter) external override {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        feeToSetter = _feeToSetter;
    }

    function setCreationDisallowed(bool _disallowed) external override {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        creationDisallowed = _disallowed;

        emit CreationPermissionChanged(_disallowed);
    }

    function setTokenDisallowed(address _token, bool _disallowed) external override {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        tokenDisallowed[_token] = _disallowed;

        emit TokenPermissionChanged(_token, _disallowed);
    }

    function setPairDisallowed(address _tokenA, address _tokenB, bool _disallowed) external override {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        pairDisallowed[_tokenA][_tokenB] = pairDisallowed[_tokenB][_tokenA] = _disallowed;

        (address token0, address token1) = _tokenA < _tokenB ? (_tokenA, _tokenB) : (_tokenB, _tokenA);
        emit PairPermissionChanged(token0, token1, _disallowed);
    }

}
