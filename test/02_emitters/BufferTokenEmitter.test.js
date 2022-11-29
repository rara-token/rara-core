const { expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');
const MockERC20 = artifacts.require('MockERC20');
const MockTokenEmitter = artifacts.require('MockTokenEmitter');
const BufferTokenEmitter = artifacts.require('BufferTokenEmitter');

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

contract('BufferTokenEmitter', ([alice, bob, carol, dave, edith, manager, recipient, minter]) => {
    const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');

    let startBlock;

    beforeEach(async () => {
      this.token = await MockERC20.new('Token', 'T', '10000000000', { from: minter });
      this.mock = await MockTokenEmitter.new(this.token.address);
      this.emitter = await BufferTokenEmitter.new(this.token.address, this.mock.address, recipient);
      await this.emitter.grantRole(MANAGER_ROLE, manager);
    });

    it('should set correct state variables', async () => {
      const { token, mock, emitter } = this;
      assert.equal((await emitter.token()).valueOf(), token.address);
      assert.equal((await emitter.emitter()).valueOf(), mock.address);
      assert.equal((await emitter.recipient()).valueOf(), recipient);

      assert.equal((await this.emitter.hasRole(MANAGER_ROLE, alice)).toString(), 'true');
      assert.equal((await this.emitter.hasRole(MANAGER_ROLE, manager)).toString(), 'true');
    });

    it('setRecipient()', async () => {
      const { token, mock, emitter } = this;
      await expectRevert(emitter.setRecipient(edith, { from:bob }), "BufferTokenEmitter: must have MANAGER role to setRecipient");
      await emitter.setRecipient(edith, { from:alice });
      assert.equal((await emitter.recipient()).valueOf(), edith);

      await expectRevert(emitter.setRecipient(ADDRESS_ZERO, { from:edith }), "BufferTokenEmitter: must have MANAGER role to setRecipient");
      await emitter.setRecipient(ADDRESS_ZERO, { from:alice });
      assert.equal((await emitter.recipient()).valueOf(), ADDRESS_ZERO);

      await expectRevert(emitter.setRecipient(dave, { from:edith }), "BufferTokenEmitter: must have MANAGER role to setRecipient");
      await emitter.setRecipient(dave, { from:manager });
      assert.equal((await emitter.recipient()).valueOf(), dave);
    });

    it('setEmitter()', async () => {
      const { token, mock, emitter } = this;
      await expectRevert(emitter.setEmitter(edith, { from:bob }), "BufferTokenEmitter: must have MANAGER role to setEmitter");
      await emitter.setEmitter(edith, { from:alice });
      assert.equal((await emitter.emitter()).valueOf(), edith);

      await expectRevert(emitter.setEmitter(ADDRESS_ZERO, { from:edith }), "BufferTokenEmitter: must have MANAGER role to setEmitter");
      await emitter.setEmitter(ADDRESS_ZERO, { from:alice });
      assert.equal((await emitter.emitter()).valueOf(), ADDRESS_ZERO);

      await expectRevert(emitter.setEmitter(dave, { from:edith }), "BufferTokenEmitter: must have MANAGER role to setEmitter");
      await emitter.setEmitter(dave, { from:manager });
      assert.equal((await emitter.emitter()).valueOf(), dave);
    });

    it('owed() reports emitter balance for recipient', async () => {
      const { token, mock, emitter } = this;
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');

      await token.transfer(emitter.address, '1000', { from:minter });
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '1000');

      await emitter.setRecipient(alice, { from:manager });
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '1000');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');

      await emitter.setRecipient(carol, { from:manager });
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');

      await emitter.setRecipient(alice, { from:manager });
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '1000');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');
    });

    it('owed() includes tokens held in up-stream emitter', async () => {
      const { token, mock, emitter } = this;
      await token.transfer(mock.address, '10000', { from:minter });

      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');

      await mock.setOwed(emitter.address, '750');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '750');

      await token.transfer(emitter.address, '250', { from:minter });
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '1000');

      await emitter.setRecipient(alice, { from:manager });
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '1000');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');

      await emitter.setRecipient(carol, { from:manager });
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');

      await emitter.setRecipient(alice, { from:manager });
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '1000');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');

      await mock.addOwed(emitter.address, '250');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '1250');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');
    });

    it('claim() transfers tokens owed to caller from balance', async () => {
      const { token, mock, emitter } = this;
      await emitter.claim(bob, { from:alice });
      await emitter.claim(bob, { from:recipient });
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');

      await token.transfer(emitter.address, '1000', { from:minter });
      await emitter.claim(bob, { from:alice });
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '1000');
      await emitter.claim(bob, { from:recipient });
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '1000');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');

      await emitter.setRecipient(edith, { from:manager });
      await token.transfer(emitter.address, '2000', { from:minter });
      await emitter.claim(bob, { from:alice });
      await emitter.claim(bob, { from:recipient });
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '1000');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '2000');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');
      await emitter.claim(bob, { from:edith });
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '3000');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');
    });

    it('claim() transfers tokens owed to caller from balance and from up-stream emitter', async () => {
      const { token, mock, emitter } = this;
      await token.transfer(mock.address, '10000', { from:minter });

      await mock.setOwed(emitter.address, '750');
      await emitter.claim(bob, { from:alice });
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '750');
      await emitter.claim(bob, { from:recipient });
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '750');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');

      await emitter.setRecipient(edith, { from:manager });

      await mock.setOwed(emitter.address, '750');
      await token.transfer(emitter.address, '250', { from:minter });
      await emitter.claim(bob, { from:alice });
      await emitter.claim(bob, { from:recipient });
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '750');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '1000');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');
      await emitter.claim(bob, { from:edith });
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '1750');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');
    });

    it('emitted() reports total claimed plus amount owed', async () => {
      const { token, mock, emitter } = this;
      await token.transfer(mock.address, '10000', { from:minter });

      await mock.setOwed(emitter.address, '750');
      await emitter.claim(bob, { from:alice });
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '750');
      assert.equal((await emitter.emitted()).valueOf().toString(), '750');
      await emitter.claim(bob, { from:recipient });
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '750');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');
      assert.equal((await emitter.emitted()).valueOf().toString(), '750');

      await emitter.setRecipient(edith, { from:manager });

      await mock.setOwed(emitter.address, '750');
      await token.transfer(emitter.address, '250', { from:minter });
      await emitter.claim(bob, { from:alice });
      await emitter.claim(bob, { from:recipient });
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '750');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '1000');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');
      assert.equal((await emitter.emitted()).valueOf().toString(), '1750');
      await emitter.claim(bob, { from:edith });
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '1750');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');
      assert.equal((await emitter.emitted()).valueOf().toString(), '1750');
    });

    it('pull() retrieves tokens from up-stream emitter', async () => {
      const { token, mock, emitter } = this;
      await token.transfer(mock.address, '10000', { from:minter });

      await mock.setOwed(emitter.address, '750');
      await emitter.pull();
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await token.balanceOf(emitter.address)).valueOf().toString(), '750');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '750');
      assert.equal((await emitter.emitted()).valueOf().toString(), '750');

      await mock.setOwed(emitter.address, '500');
      await emitter.pull();
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await token.balanceOf(emitter.address)).valueOf().toString(), '1250');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '1250');
      assert.equal((await emitter.emitted()).valueOf().toString(), '1250');

      await emitter.claim(bob, { from:recipient });
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '1250');
      assert.equal((await token.balanceOf(emitter.address)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');
      assert.equal((await emitter.emitted()).valueOf().toString(), '1250');

      await mock.setOwed(emitter.address, '1000');
      await emitter.setEmitter(ADDRESS_ZERO, { from:manager });
      await emitter.pull();
      assert.equal((await token.balanceOf(bob)).valueOf().toString(), '1250');
      assert.equal((await token.balanceOf(emitter.address)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');
      assert.equal((await emitter.emitted()).valueOf().toString(), '1250');
    });

    it('flush() reverts for non-manager', async () => {
      const { token, mock, emitter } = this;

      await expectRevert(emitter.flush({ from:bob }), "BufferTokenEmitter: must have MANAGER role to flush");
      await emitter.flush({ from:alice });
      await emitter.flush({ from:manager });
    });

    it('flush() reverts for empty recipient', async () => {
      const { token, mock, emitter } = this;

      await emitter.setRecipient(ADDRESS_ZERO, { from:manager });
      await expectRevert(emitter.flush({ from:alice }), "BufferTokenEmitter: must have a recipient");
      await expectRevert(emitter.flush({ from:manager }), "BufferTokenEmitter: must have a recipient");
    });

    it('flush() sends all owed tokens to recipient', async () => {
      const { token, mock, emitter } = this;
      await token.transfer(mock.address, '10000', { from:minter });
      await token.transfer(emitter.address, '1000', { from:minter });
      await mock.setOwed(emitter.address, '750');
      await emitter.flush({ from:alice });
      assert.equal((await token.balanceOf(recipient)).valueOf().toString(), '1750');
      assert.equal((await token.balanceOf(emitter.address)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(alice)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(bob)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(edith)).valueOf().toString(), '0');
      assert.equal((await emitter.owed(recipient)).valueOf().toString(), '0');
      assert.equal((await emitter.emitted()).valueOf().toString(), '1750');
    });
  });
