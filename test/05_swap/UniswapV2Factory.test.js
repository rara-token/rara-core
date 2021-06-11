const MockERC20 = artifacts.require('MockERC20');
const UniswapV2Pair = artifacts.require('UniswapV2Pair');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const MockUniswapV2SwapValuator = artifacts.require('MockUniswapV2SwapValuator');

const { expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');

const { bn, s, getCreate2Address, getAddress, MINIMUM_LIQUIDITY } = require('../shared/utilities');

chai.use(solidity)

const TEST_ADDRESSES = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000'
]

contract('UniswapV2Factory (UniswapV2Factory interface)', ([alice, bob, carol, minter, scrooge]) => {
  beforeEach(async () => {
    // deploy factory
    this.factory = await UniswapV2Factory.new(minter);

    // create a wallet account
    this.wallet = await web3.eth.accounts.create();

    // create a valuator
    this.valuator  =  await MockUniswapV2SwapValuator.new();
  });

  it('feeTo, feeToSetter, allPairsLength, isSwapValuator, swapRateDimi', async () => {
    const { factory, wallet } = this;
    expect(await factory.feeTo()).to.eq(ZERO_ADDRESS);
    expect(await factory.feeToSetter()).to.eq(minter);
    expect(await factory.mintingFeeTo()).to.eq(ZERO_ADDRESS);
    expect(await factory.migrator()).to.eq(ZERO_ADDRESS);
    expect(bn(await factory.allPairsLength())).to.eq(0)
    expect(await factory.isSwapValuator()).to.eq(true);
    expect(bn(await factory.swapRateDimi(wallet.address))).to.eq(9970);
    expect(bn(await factory.swapRateDimi(TEST_ADDRESSES[0]))).to.eq(9970);
    expect(bn(await factory.swapRateDimi(TEST_ADDRESSES[1]))).to.eq(9970);
  })

  const createPair = async (tokens) => {
    const { factory } = this;
    const bytecode = UniswapV2Pair._json.bytecode;
    const create2Address = getCreate2Address(factory.address, tokens, bytecode)
    const { tx } = await factory.createPair(...tokens);
    const [token0, token1] = bn(tokens[0]).lt(tokens[1]) ? [tokens[0], tokens[1]].map(getAddress) : [tokens[1], tokens[0]].map(getAddress);
    await expectEvent.inTransaction(tx, factory, 'PairCreated', { token0, token1, pair:create2Address });

    await expect(factory.createPair(...tokens)).to.be.reverted // UniswapV2: PAIR_EXISTS
    await expect(factory.createPair(...tokens.slice().reverse())).to.be.reverted // UniswapV2: PAIR_EXISTS
    expect(await factory.getPair(...tokens)).to.eq(create2Address)
    expect(await factory.getPair(...tokens.slice().reverse())).to.eq(create2Address)
    expect(await factory.allPairs(0)).to.eq(create2Address)
    expect(bn(await factory.allPairsLength())).to.eq(bn(1))

    const pair = await UniswapV2Pair.at(create2Address);
    expect(await pair.factory()).to.eq(factory.address)
    expect(await pair.token0()).to.eq(token0)
    expect(await pair.token1()).to.eq(token1)
  }

  it('createPair', async () => {
    await createPair(TEST_ADDRESSES)
  })

  it('createPair:reverse', async () => {
    await createPair(TEST_ADDRESSES.slice().reverse())
  })

  it('createPair:problem inputs',  async() => {
    await createPair(['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2']);
  })

  /* TODO: restore gas-based testing
  it('createPair:gas', async () => {
    const { factory } = this;
    const { receipt } = await factory.createPair(...TEST_ADDRESSES)
    expect(receipt.gasUsed).to.eq(2512920)
  })

  */

  it('setSwapValuator', async () => {
    const { factory, wallet, valuator } = this;
    await expect(factory.setSwapValuator(valuator.address)).to.be.revertedWith('UniswapV2: FORBIDDEN')
    await expect(factory.setSwapValuator(wallet.address, { from:minter })).to.be.reverted;
    await factory.setSwapValuator(valuator.address, { from:minter });
    expect(await factory.swapValuator()).to.eq(valuator.address);
  })

  it('setFeeTo', async () => {
    const { factory, wallet } = this;
    await expect(factory.setFeeTo(wallet.address)).to.be.revertedWith('UniswapV2: FORBIDDEN')
    await factory.setFeeTo(wallet.address, { from:minter });
    expect(await factory.feeTo()).to.eq(wallet.address)
  })

  it('setFeeToSetter', async () => {
    const { factory, wallet } = this;
    await expect(factory.setFeeToSetter(bob)).to.be.revertedWith('UniswapV2: FORBIDDEN')
    await factory.setFeeToSetter(bob, { from:minter })
    expect(await factory.feeToSetter()).to.eq(bob)
    await expect(factory.setFeeToSetter(wallet.address, { from:minter })).to.be.revertedWith('UniswapV2: FORBIDDEN')
  })

  it('setMintingFeeTo', async () => {
    const { factory, wallet } = this;
    await expect(factory.setMintingFeeTo(wallet.address)).to.be.revertedWith('UniswapV2: FORBIDDEN')
    await factory.setMintingFeeTo(wallet.address, { from:minter });
    expect(await factory.mintingFeeTo()).to.eq(wallet.address)
  })

  it('setMigrator', async () => {
    const { factory, wallet } = this;
    await expect(factory.setMigrator(wallet.address)).to.be.revertedWith('UniswapV2: FORBIDDEN')
    await factory.setMigrator(wallet.address, { from:minter });
    expect(await factory.migrator()).to.eq(wallet.address)
  })

  it('swapRateDimi', async () => {
    const { factory, wallet, valuator } = this;
    expect(bn(await factory.swapRateDimi(wallet.address))).to.eq(9970);
    expect(bn(await factory.swapRateDimi(TEST_ADDRESSES[0]))).to.eq(9970);
    expect(bn(await factory.swapRateDimi(TEST_ADDRESSES[1]))).to.eq(9970);

    await factory.setSwapValuator(valuator.address, { from:minter });
    expect(bn(await factory.swapRateDimi(wallet.address))).to.eq(9970);
    expect(bn(await factory.swapRateDimi(TEST_ADDRESSES[0]))).to.eq(9970);
    expect(bn(await factory.swapRateDimi(TEST_ADDRESSES[1]))).to.eq(9970);

    await valuator.setSwapRateDimi(wallet.address, 9975);
    await valuator.setSwapRateDimi(TEST_ADDRESSES[0], 10000);
    await valuator.setSwapRateDimi(TEST_ADDRESSES[1], 5);

    expect(bn(await factory.swapRateDimi(wallet.address))).to.eq(9975);
    expect(bn(await factory.swapRateDimi(TEST_ADDRESSES[0]))).to.eq(10000);
    expect(bn(await factory.swapRateDimi(TEST_ADDRESSES[1]))).to.eq(5);
  });
});
