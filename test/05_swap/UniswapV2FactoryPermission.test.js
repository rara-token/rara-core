const MockERC20 = artifacts.require('MockERC20');
const UniswapV2Pair = artifacts.require('UniswapV2Pair');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');

const { expectEvent, time } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');

const { bn, s, getCreate2Address, getAddress, MINIMUM_LIQUIDITY } = require('../shared/utilities');

chai.use(solidity)

const TEST_ADDRESSES = [
  [
    '0x1000000000000000000000000000000000000000',
    '0x2000000000000000000000000000000000000000'
  ],
  [
    '0x3000000000000000000000000000000000000000',
    '0x4000000000000000000000000000000000000000'
  ],
  [
    '0x5000000000000000000000000000000000000000',
    '0x6000000000000000000000000000000000000000'
  ]
]

contract('UniswapV2Factory (UniswapV2FactoryPermission interface)', ([alice, bob, carol, minter, scrooge]) => {
  beforeEach(async () => {
    // deploy factory
    this.factory = await UniswapV2Factory.new(minter);

    // create a wallet account
    this.wallet = await web3.eth.accounts.create();
  });

  it('feeTo, feeToSetter, allPairsLength', async () => {
    const { factory } = this;
    expect(await factory.feeTo()).to.eq(ZERO_ADDRESS);
    expect(await factory.feeToSetter()).to.eq(minter);
    expect(await factory.mintingFeeTo()).to.eq(ZERO_ADDRESS);
    expect(await factory.migrator()).to.eq(ZERO_ADDRESS);
    expect(bn(await factory.allPairsLength())).to.eq(0)
  })

  const createPair = async (tokens, opts = { from:alice }) => {
    const { factory } = this;
    const bytecode = UniswapV2Pair._json.bytecode;
    const create2Address = getCreate2Address(factory.address, tokens, bytecode)
    const count = bn(await factory.allPairsLength());
    const { tx } = await factory.createPair(tokens[0], tokens[1], opts);
    const [token0, token1] = bn(tokens[0]).lt(tokens[1]) ? [tokens[0], tokens[1]].map(getAddress) : [tokens[1], tokens[0]].map(getAddress);
    await expectEvent.inTransaction(tx, factory, 'PairCreated', { token0, token1, pair:create2Address });

    await expect(factory.createPair(...tokens)).to.be.reverted // UniswapV2: PAIR_EXISTS
    await expect(factory.createPair(...tokens.slice().reverse())).to.be.reverted // UniswapV2: PAIR_EXISTS
    expect(await factory.getPair(...tokens)).to.eq(create2Address)
    expect(await factory.getPair(...tokens.slice().reverse())).to.eq(create2Address)
    expect(await factory.allPairs(count)).to.eq(create2Address)
    expect(bn(await factory.allPairsLength())).to.eq(count.add(bn(1)))

    const pair = await UniswapV2Pair.at(create2Address);
    expect(await pair.factory()).to.eq(factory.address)
    expect(await pair.token0()).to.eq(token0)
    expect(await pair.token1()).to.eq(token1)
  };

  const createPairRevert = async (tokens, message, opts = { from:alice }) => {
    const { factory } = this;
    await expect(factory.createPair(tokens[0], tokens[1], opts)).to.be.revertedWith(message);
  };

  it('createPair', async () => {
    await createPair(TEST_ADDRESSES[0])
  })

  it('createPair:reverse', async () => {
    await createPair(TEST_ADDRESSES[0].slice().reverse())
  })

  it('createPair:problem inputs',  async() => {
    await createPair(['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2']);
  });

  it('setCreationDisallowed', async () => {
    const { factory, wallet } = this;
    expect(await factory.creationDisallowed()).to.eq(false);
    await expect(factory.setCreationDisallowed(true)).to.be.revertedWith('UniswapV2: FORBIDDEN')
    await factory.setCreationDisallowed(true, { from:minter });
    expect(await factory.creationDisallowed()).to.eq(true);

    expect(await factory.allowed(TEST_ADDRESSES[0][0], TEST_ADDRESSES[0][1])).to.eq(false);
    expect(await factory.allowed(TEST_ADDRESSES[1][0], TEST_ADDRESSES[1][1])).to.eq(false);

    await createPairRevert(TEST_ADDRESSES[0], 'UniswapV2: CREATION_DISALLOWED');
    await createPair(TEST_ADDRESSES[0], { from:minter });

    expect(await factory.allowed(TEST_ADDRESSES[0][0], TEST_ADDRESSES[0][1])).to.eq(true);
    expect(await factory.allowed(TEST_ADDRESSES[1][0], TEST_ADDRESSES[1][1])).to.eq(false);

    await expect(factory.setCreationDisallowed(false)).to.be.revertedWith('UniswapV2: FORBIDDEN')
    await factory.setCreationDisallowed(false, { from:minter });
    expect(await factory.creationDisallowed()).to.eq(false);

    expect(await factory.allowed(TEST_ADDRESSES[0][0], TEST_ADDRESSES[0][1])).to.eq(true);
    expect(await factory.allowed(TEST_ADDRESSES[1][0], TEST_ADDRESSES[1][1])).to.eq(true);

    await createPair(TEST_ADDRESSES[1]);

    expect(await factory.allowed(TEST_ADDRESSES[0][0], TEST_ADDRESSES[0][1])).to.eq(true);
    expect(await factory.allowed(TEST_ADDRESSES[1][0], TEST_ADDRESSES[1][1])).to.eq(true);
  });

  it('setTokenDisallowed', async () => {
    const { factory, wallet } = this;
    const [token, alt] = TEST_ADDRESSES[0];
    const [tokenC, tokenD] = TEST_ADDRESSES[1];
    expect(await factory.tokenDisallowed(token)).to.eq(false);
    expect(await factory.tokenDisallowed(alt)).to.eq(false);
    await expect(factory.setTokenDisallowed(token, true)).to.be.revertedWith('UniswapV2: FORBIDDEN')
    await factory.setTokenDisallowed(token, true, { from:minter });
    await factory.setTokenDisallowed(alt, true, { from:minter });
    expect(await factory.tokenDisallowed(token)).to.eq(true);
    expect(await factory.tokenDisallowed(alt)).to.eq(true);
    expect(await factory.tokenDisallowed(tokenC)).to.eq(false);

    expect(await factory.allowed(token, alt)).to.eq(false);
    expect(await factory.allowed(token, tokenC)).to.eq(false);
    expect(await factory.allowed(tokenC, tokenD)).to.eq(true);

    await createPairRevert(TEST_ADDRESSES[0], 'UniswapV2: TOKEN_DISALLOWED');
    await createPairRevert([token, tokenC], 'UniswapV2: TOKEN_DISALLOWED');
    await createPair([token, tokenC], { from:minter });
    await createPair(TEST_ADDRESSES[1]);

    expect(await factory.allowed(token, alt)).to.eq(false);
    expect(await factory.allowed(token, tokenC)).to.eq(true);
    expect(await factory.allowed(tokenC, tokenD)).to.eq(true);

    await expect(factory.setTokenDisallowed(token, false)).to.be.revertedWith('UniswapV2: FORBIDDEN')
    await factory.setTokenDisallowed(token, false, { from:minter });
    await factory.setTokenDisallowed(alt, false, { from:minter });
    expect(await factory.tokenDisallowed(token)).to.eq(false);
    expect(await factory.tokenDisallowed(alt)).to.eq(false);
    expect(await factory.tokenDisallowed(tokenC)).to.eq(false);

    expect(await factory.allowed(token, alt)).to.eq(true);
    expect(await factory.allowed(token, tokenC)).to.eq(true);
    expect(await factory.allowed(tokenC, tokenD)).to.eq(true);

    await createPair(TEST_ADDRESSES[0]);
    await createPair([alt, tokenC]);
    await createPair(TEST_ADDRESSES[2]);

    expect(await factory.allowed(token, alt)).to.eq(true);
    expect(await factory.allowed(token, tokenC)).to.eq(true);
    expect(await factory.allowed(tokenC, tokenD)).to.eq(true);
  });

  it('setPairDisallowed', async () => {
    const { factory, wallet } = this;
    const [tokenA, tokenB] = TEST_ADDRESSES[0];
    const [tokenC, tokenD] = TEST_ADDRESSES[1];
    expect(await factory.pairDisallowed(tokenA, tokenB)).to.eq(false);
    expect(await factory.pairDisallowed(tokenB, tokenA)).to.eq(false);
    expect(await factory.pairDisallowed(tokenA, tokenC)).to.eq(false);
    await expect(factory.setPairDisallowed(tokenA, tokenB, true)).to.be.revertedWith('UniswapV2: FORBIDDEN')
    await factory.setPairDisallowed(tokenA, tokenB, true, { from:minter });
    await factory.setPairDisallowed(tokenC, tokenD, true, { from:minter });
    expect(await factory.pairDisallowed(tokenA, tokenB)).to.eq(true);
    expect(await factory.pairDisallowed(tokenB, tokenA)).to.eq(true);
    expect(await factory.pairDisallowed(tokenA, tokenC)).to.eq(false);
    expect(await factory.pairDisallowed(tokenC, tokenD)).to.eq(true);

    expect(await factory.allowed(tokenA, tokenB)).to.eq(false);
    expect(await factory.allowed(tokenC, tokenD)).to.eq(false);
    expect(await factory.allowed(tokenA, tokenC)).to.eq(true);

    await createPairRevert(TEST_ADDRESSES[0], 'UniswapV2: PAIR_DISALLOWED');
    await createPairRevert(TEST_ADDRESSES[1], 'UniswapV2: PAIR_DISALLOWED');
    await createPair([tokenA, tokenC]);
    await createPair(TEST_ADDRESSES[0], { from:minter });

    expect(await factory.allowed(tokenA, tokenB)).to.eq(true);
    expect(await factory.allowed(tokenC, tokenD)).to.eq(false);
    expect(await factory.allowed(tokenA, tokenC)).to.eq(true);

    await expect(factory.setPairDisallowed(tokenB, tokenA, false)).to.be.revertedWith('UniswapV2: FORBIDDEN')
    await factory.setPairDisallowed(tokenB, tokenA, false, { from:minter });
    await factory.setPairDisallowed(tokenD, tokenC, false, { from:minter });
    expect(await factory.pairDisallowed(tokenA, tokenB)).to.eq(false);
    expect(await factory.pairDisallowed(tokenB, tokenA)).to.eq(false);
    expect(await factory.pairDisallowed(tokenA, tokenC)).to.eq(false);
    expect(await factory.pairDisallowed(tokenC, tokenD)).to.eq(false);

    expect(await factory.allowed(tokenA, tokenB)).to.eq(true);
    expect(await factory.allowed(tokenC, tokenD)).to.eq(true);
    expect(await factory.allowed(tokenA, tokenC)).to.eq(true);

    await createPair(TEST_ADDRESSES[1]);
    await createPair([tokenA, tokenD]);

    expect(await factory.allowed(tokenA, tokenB)).to.eq(true);
    expect(await factory.allowed(tokenC, tokenD)).to.eq(true);
    expect(await factory.allowed(tokenA, tokenC)).to.eq(true);
  });
});
