const { expectRevert, time } = require('@openzeppelin/test-helpers');
const EIP210 = artifacts.require('EIP210');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

const ZERO_BYTES = '0x0000000000000000000000000000000000000000000000000000000000000000';

contract('EIP210', ([alice, bob, carol, dave, edith, manager, pauser, minter, dev]) => {
  beforeEach(async () => {
    this.eip210 = await EIP210.new();
  });

  it('storedEip210Blockhash reports 0 for uncalculated hash', async () => {
    const { eip210 } = this;
    const blockNumber = await web3.eth.getBlockNumber();
    const block = await web3.eth.getBlock(blockNumber);

    // check
    assert.equal(await eip210.storedEip210Blockhash(blockNumber), '0x0000000000000000000000000000000000000000000000000000000000000000');
  });

  it('storedEip210Blockhash reports the actual hash after it is stored', async () => {
    const { eip210 } = this;
    const blockNumber = await web3.eth.getBlockNumber();
    const block = await web3.eth.getBlock(blockNumber);

    // calculate
    await eip210.eip210Blockhash(blockNumber);
    // check
    assert.equal(await eip210.storedEip210Blockhash(blockNumber), block.hash);
  });

  it('storedEip210Blockhash reports the actual hash after it is no longer available', async () => {
    const { eip210 } = this;
    const blockNumber = await web3.eth.getBlockNumber() - 200;
    const block = await web3.eth.getBlock(blockNumber);

    // calculate
    await eip210.eip210Blockhash(blockNumber);

    // wait
    await time.advanceBlockTo(blockNumber + 500);

    // check
    assert.equal(await eip210.storedEip210Blockhash(blockNumber), block.hash);
  });

  it('eip210Blockhash does not recalculate hash after storage', async () => {
    const { eip210 } = this;
    const blockNumber = await web3.eth.getBlockNumber() - 200;
    const block = await web3.eth.getBlock(blockNumber);

    // calculate
    await eip210.eip210Blockhash(blockNumber);

    // wait
    await time.advanceBlockTo(blockNumber + 500);

    // recalculate (no effect)
    await eip210.eip210Blockhash(blockNumber);

    // check
    assert.equal(await eip210.storedEip210Blockhash(blockNumber), block.hash);
  });

  it('storedEip210Blockhash reports a simulated hash if actual is not available', async () => {
    const { eip210 } = this;
    const blockNumber = await web3.eth.getBlockNumber() - 400;

    // calculate
    await eip210.eip210Blockhash(blockNumber);

    // check
    const hash = await eip210.storedEip210Blockhash(blockNumber);
    assert.notEqual(hash, ZERO_BYTES);
  });

  it('eip210Blockhash does not recalculate simulated hash', async () => {
    const { eip210 } = this;
    const blockNumber = await web3.eth.getBlockNumber() - 400;

    // calculate
    await eip210.eip210Blockhash(blockNumber);

    // check
    const hash = await eip210.storedEip210Blockhash(blockNumber);

    await time.advanceBlockTo(blockNumber + 500);

    // recalculate
    await eip210.eip210Blockhash(blockNumber);

    assert.equal(await eip210.storedEip210Blockhash(blockNumber), hash);
  });

  it('eip210Blockhash simulated hash matches +256 block offset at time of simulation', async () => {
    const { eip210 } = this;
    const blockNumber = await web3.eth.getBlockNumber() - 200;

    // calculate hashes
    await eip210.eip210Blockhash(blockNumber - 256);
    await eip210.eip210Blockhash(blockNumber - 256 * 2);
    await eip210.eip210Blockhash(blockNumber - 256 * 3);
    await eip210.eip210Blockhash(blockNumber - 256 * 4);

    // check
    const block = await web3.eth.getBlock(blockNumber);
    assert.equal(await eip210.storedEip210Blockhash(blockNumber - 256), block.hash);
    assert.equal(await eip210.storedEip210Blockhash(blockNumber - 256 * 2), block.hash);
    assert.equal(await eip210.storedEip210Blockhash(blockNumber - 256 * 3), block.hash);
    assert.equal(await eip210.storedEip210Blockhash(blockNumber - 256 * 4), block.hash);
  });

  it('eip210Blockhash simulated hash does NOT match +256 block offset from time after simulation', async () => {
    const { eip210 } = this;
    const blockNumber = await web3.eth.getBlockNumber() - 100;

    // calculate hashes
    await eip210.eip210Blockhash(blockNumber - 256);
    await eip210.eip210Blockhash(blockNumber - 256 * 2);
    await eip210.eip210Blockhash(blockNumber - 256 * 3);
    await eip210.eip210Blockhash(blockNumber - 256 * 4);

    // advance
    await time.advanceBlockTo(blockNumber + 356);

    // check
    const block = await web3.eth.getBlock(blockNumber);
    assert.equal(await eip210.storedEip210Blockhash(blockNumber - 256), block.hash);
    assert.equal(await eip210.storedEip210Blockhash(blockNumber - 256 * 2), block.hash);
    assert.equal(await eip210.storedEip210Blockhash(blockNumber - 256 * 3), block.hash);
    assert.equal(await eip210.storedEip210Blockhash(blockNumber - 256 * 4), block.hash);

    const notBlock = await web3.eth.getBlock(blockNumber + 256);
    assert.notEqual(await eip210.storedEip210Blockhash(blockNumber - 256), notBlock.hash);
    assert.notEqual(await eip210.storedEip210Blockhash(blockNumber - 256 * 2), notBlock.hash);
    assert.notEqual(await eip210.storedEip210Blockhash(blockNumber - 256 * 3), notBlock.hash);
    assert.notEqual(await eip210.storedEip210Blockhash(blockNumber - 256 * 4), notBlock.hash);
  });
});
