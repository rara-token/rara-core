const { expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');
const RaraToken = artifacts.require('RaraToken');
const RaraEmitter = artifacts.require('RaraEmitter');

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

contract('RaraEmitter', ([alice, bob, carol, dave, edith, manager]) => {
    const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
    const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');

    let startBlock;

    beforeEach(async () => {
        this.rara = await RaraToken.new({ from: alice });
        startBlock = (await web3.eth.getBlockNumber()) + 10;
    });

    it('should set correct state variables', async () => {
        this.emitter = await RaraEmitter.new(this.rara.address, '1000', '550', { from: alice });
        await this.rara.grantRole(MINTER_ROLE, this.emitter.address, { from: alice });
        const rara = await this.emitter.rara();
        assert.equal(rara.valueOf(), this.rara.address);
        assert.equal((await this.rara.hasRole(MINTER_ROLE, this.emitter.address)).toString(), 'true');
        assert.equal((await this.emitter.hasRole(MANAGER_ROLE, alice)).toString(), 'true');

        assert.equal((await this.emitter.raraMintedPerBlock()).valueOf(), '1000');
        assert.equal((await this.emitter.raraEmittedPerBlock()).valueOf(), '0');

        assert.equal((await this.emitter.lastMintBlock()).valueOf().toString(), '550');
        assert.equal((await this.emitter.startBlock()).valueOf().toString(), '550');
    });

    it('mint() should not net Rara if no targets are set', async () => {
      this.emitter = await RaraEmitter.new(this.rara.address, '1000', startBlock, { from: alice });
      await this.rara.grantRole(MINTER_ROLE, this.emitter.address, { from: alice });
      await time.advanceBlockTo(startBlock + 9);
      // 10 blocks
      const balanceBefore = await this.rara.balanceOf(this.emitter.address);
      await this.emitter.mint();
      const balanceAfter = await this.rara.balanceOf(this.emitter.address);

      assert.equal(balanceBefore.valueOf().toString(), '0');
      assert.equal(balanceAfter.valueOf().toString(), '0');
    });

    it('mint() should emit Mint and Burn events', async () => {
      this.emitter = await RaraEmitter.new(this.rara.address, '1000', startBlock, { from: alice });
      await this.rara.grantRole(MINTER_ROLE, this.emitter.address, { from: alice });
      await time.advanceBlockTo(startBlock + 9);
      // 10 blocks
      const res = await this.emitter.mint();

      await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: ADDRESS_ZERO, to: this.emitter.address, value: '10000' });
      await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: this.emitter.address, to: ADDRESS_ZERO, value: '10000' });
    });

    it('mint() should do nothing if startBlock not reached', async () => {
      this.emitter = await RaraEmitter.new(this.rara.address, '1000', startBlock + 20, { from: alice });
      await this.rara.grantRole(MINTER_ROLE, this.emitter.address, { from: alice });
      await time.advanceBlockTo(startBlock + 9);
      // 10 blocks
      const balanceBefore = await this.rara.balanceOf(this.emitter.address);
      const res = await this.emitter.mint();
      const balanceAfter = await this.rara.balanceOf(this.emitter.address);

      assert.equal(balanceBefore.valueOf().toString(), '0');
      assert.equal(balanceAfter.valueOf().toString(), '0');
      await expectEvent.notEmitted.inTransaction(res.tx, this.rara, 'Transfer');
    });

    it('addTarget() should revert for non-manager', async () => {
      startBlock += 10;
      this.emitter = await RaraEmitter.new(this.rara.address, '1000', startBlock, { from: alice });
      await this.rara.grantRole(MINTER_ROLE, this.emitter.address, { from: alice });
      await this.emitter.grantRole(MANAGER_ROLE, manager, { from:alice });

      await expectRevert(this.emitter.addTarget(carol, '100', { from:bob }),
        "RaraEmitter: must have MANAGER role to addTarget");
    });

    it('addTarget() should revert for existing target', async () => {
      startBlock += 10;
      this.emitter = await RaraEmitter.new(this.rara.address, '1000', startBlock, { from: alice });
      await this.rara.grantRole(MINTER_ROLE, this.emitter.address, { from: alice });
      await this.emitter.grantRole(MANAGER_ROLE, manager, { from:alice });

      await this.emitter.addTarget(carol, '50', { from:manager });
      await expectRevert(this.emitter.addTarget(carol, '100', { from:manager }),
        "RaraEmitter: recipient already a target");
    });

    it('updateTarget() should revert for non-manager', async () => {
      startBlock += 10;
      this.emitter = await RaraEmitter.new(this.rara.address, '1000', startBlock, { from: alice });
      await this.rara.grantRole(MINTER_ROLE, this.emitter.address, { from: alice });
      await this.emitter.grantRole(MANAGER_ROLE, manager, { from:alice });

      await this.emitter.addTarget(bob, '50', { from:manager });
      await expectRevert(this.emitter.updateTarget(0, carol, '100', { from:bob }),
        "RaraEmitter: must have MANAGER role to updateTarget");
    });

    it('updateTarget() should revert for invalid tid', async () => {
      startBlock += 10;
      this.emitter = await RaraEmitter.new(this.rara.address, '1000', startBlock, { from: alice });
      await this.rara.grantRole(MINTER_ROLE, this.emitter.address, { from: alice });
      await this.emitter.grantRole(MANAGER_ROLE, manager, { from:alice });

      await this.emitter.addTarget(bob, '50', { from:manager });
      await expectRevert(this.emitter.updateTarget(1, carol, '100', { from:manager }),
        "RaraEmitter: no such tid");
    });

    it('updateTarget() should revert for existing target', async () => {
      startBlock += 10;
      this.emitter = await RaraEmitter.new(this.rara.address, '1000', startBlock, { from: alice });
      await this.rara.grantRole(MINTER_ROLE, this.emitter.address, { from: alice });
      await this.emitter.grantRole(MANAGER_ROLE, manager, { from:alice });

      await this.emitter.addTarget(bob, '50', { from:manager });
      await this.emitter.addTarget(carol, '100', { from:manager });
      await expectRevert(this.emitter.updateTarget(0, carol, '100', { from:manager }),
        "RaraEmitter: recipient already a target");
    });

    context('With Rara emission targets', () => {
      beforeEach(async () => {
        startBlock += 10;
        this.emitter = await RaraEmitter.new(this.rara.address, '1000', startBlock, { from: alice });
        await this.rara.grantRole(MINTER_ROLE, this.emitter.address, { from: alice });
        await this.emitter.grantRole(MANAGER_ROLE, manager, { from:alice });
        await this.emitter.addTarget(bob, '100');
        await this.emitter.addTarget(carol, '250');
      });

      it('mint() should do nothing if startBlock not reached', async () => {
        // 10 blocks
        const balanceBefore = await this.rara.balanceOf(this.emitter.address);
        const res = await this.emitter.mint();
        const balanceAfter = await this.rara.balanceOf(this.emitter.address);

        assert.equal(balanceBefore.valueOf().toString(), '0');
        assert.equal(balanceAfter.valueOf().toString(), '0');
        await expectEvent.notEmitted.inTransaction(res.tx, this.rara, 'Transfer');
      });

      it('owed() should report the amount owed', async () => {
        await time.advanceBlockTo(startBlock + 10);
        // 10 blocks
        assert.equal((await this.emitter.owed(bob)).valueOf().toString(), '1000');
        assert.equal((await this.emitter.owed(carol)).valueOf().toString(), '2500');
        assert.equal((await this.emitter.owed(dave)).valueOf().toString(), '0');
      });

      it('mint() should net Rara', async () => {
        await time.advanceBlockTo(startBlock + 9);
        // 10 blocks
        const balanceBefore = await this.rara.balanceOf(this.emitter.address);
        const res = await this.emitter.mint();
        const balanceAfter = await this.rara.balanceOf(this.emitter.address);

        assert.equal(balanceBefore.valueOf().toString(), '0');
        assert.equal(balanceAfter.valueOf().toString(), '3500');
        await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: ADDRESS_ZERO, to: this.emitter.address, value: '10000' });
        await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: this.emitter.address, to: ADDRESS_ZERO, value: '6500' });

        assert.equal((await this.emitter.owed(bob)).valueOf().toString(), '1000');
        assert.equal((await this.emitter.owed(carol)).valueOf().toString(), '2500');
        assert.equal((await this.emitter.owed(dave)).valueOf().toString(), '0');
      });

      it('claim() should mint and transfer Rara', async () => {
        await time.advanceBlockTo(startBlock + 9);
        // 10 blocks
        const balanceBefore = await this.rara.balanceOf(this.emitter.address);
        const res = await this.emitter.claim(dave, { from:bob });
        const balanceAfter = await this.rara.balanceOf(this.emitter.address);

        assert.equal(balanceBefore.valueOf().toString(), '0');
        assert.equal(balanceAfter.valueOf().toString(), '2500');
        await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: ADDRESS_ZERO, to: this.emitter.address, value: '10000' });
        await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: this.emitter.address, to: ADDRESS_ZERO, value: '6500' });
        await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: this.emitter.address, to: dave, value: '1000' });

        assert.equal((await this.emitter.owed(bob)).valueOf().toString(), '0');
        assert.equal((await this.emitter.owed(carol)).valueOf().toString(), '2500');
        assert.equal((await this.emitter.owed(dave)).valueOf().toString(), '0');
      });

      it('claim() should do nothing for non-target', async () => {
        await time.advanceBlockTo(startBlock + 9);
        // 10 blocks
        const balanceBefore = await this.rara.balanceOf(this.emitter.address);
        const res = await this.emitter.claim(bob, { from:dave });
        const balanceAfter = await this.rara.balanceOf(this.emitter.address);

        assert.equal(balanceBefore.valueOf().toString(), '0');
        assert.equal(balanceAfter.valueOf().toString(), '0');
        await expectEvent.notEmitted.inTransaction(res.tx, this.rara, 'Transfer');

        assert.equal((await this.emitter.owed(bob)).valueOf().toString(), '1000');
        assert.equal((await this.emitter.owed(carol)).valueOf().toString(), '2500');
        assert.equal((await this.emitter.owed(dave)).valueOf().toString(), '0');
      });

      it('emitRara() should revert for non-manager', async () => {
        await time.advanceBlockTo(startBlock + 9);
        // 10 blocks
        await expectRevert(this.emitter.emitRara(0, { from:bob }), 'RaraEmitter: must have MANAGER role to emitRara');
      });

      it('emitRara() should mint and transfer Rara', async () => {
        await time.advanceBlockTo(startBlock + 9);
        // 10 blocks
        const balanceBefore = await this.rara.balanceOf(this.emitter.address);
        const res = await this.emitter.emitRara(0, { from:manager });
        const balanceAfter = await this.rara.balanceOf(this.emitter.address);

        assert.equal(balanceBefore.valueOf().toString(), '0');
        assert.equal(balanceAfter.valueOf().toString(), '2500');
        await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: ADDRESS_ZERO, to: this.emitter.address, value: '10000' });
        await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: this.emitter.address, to: ADDRESS_ZERO, value: '6500' });
        await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: this.emitter.address, to: bob, value: '1000' });

        assert.equal((await this.emitter.owed(bob)).valueOf().toString(), '0');
        assert.equal((await this.emitter.owed(carol)).valueOf().toString(), '2500');
        assert.equal((await this.emitter.owed(dave)).valueOf().toString(), '0');
      });

      it('emitRara() should revert for non-target', async () => {
        await time.advanceBlockTo(startBlock + 9);
        // 10 blocks
        await expectRevert(this.emitter.emitRara(2, { from:manager }), 'RaraEmitter: no such tid');
      });

      it('massEmitRara() should revert for non-manager', async () => {
        await time.advanceBlockTo(startBlock + 9);
        // 10 blocks
        await expectRevert(this.emitter.massEmitRara([0, 1], { from:bob }), 'RaraEmitter: must have MANAGER role to massEmitRara');
      });

      it('massEmitRara() should mint and transfer Rara', async () => {
        await time.advanceBlockTo(startBlock + 9);
        // 10 blocks
        const balanceBefore = await this.rara.balanceOf(this.emitter.address);
        const res = await this.emitter.massEmitRara([0, 1], { from:manager });
        const balanceAfter = await this.rara.balanceOf(this.emitter.address);

        await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: ADDRESS_ZERO, to: this.emitter.address, value: '10000' });
        await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: this.emitter.address, to: ADDRESS_ZERO, value: '6500' });
        await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: this.emitter.address, to: bob, value: '1000' });
        await expectEvent.inTransaction(res.tx, this.rara, 'Transfer', { from: this.emitter.address, to: carol, value: '2500' });
        assert.equal(balanceBefore.valueOf().toString(), '0');
        assert.equal(balanceAfter.valueOf().toString(), '0');

        assert.equal((await this.emitter.owed(bob)).valueOf().toString(), '0');
        assert.equal((await this.emitter.owed(carol)).valueOf().toString(), '0');
        assert.equal((await this.emitter.owed(dave)).valueOf().toString(), '0');
      });

      it('massEmitRara() should revert for non-target', async () => {
        await time.advanceBlockTo(startBlock + 9);
        // 10 blocks
        await expectRevert(this.emitter.emitRara([0, 2], { from:manager }), 'RaraEmitter: no such tid');
      });

      it('should emit the appropriate amount of Rara over time', async () => {
        // block 10
        await time.advanceBlockTo(startBlock + 9);
        // 1000 for Bob, 2500 for Carol
        await this.emitter.claim(bob, { from:bob });
        assert.equal((await this.rara.balanceOf(this.emitter.address)).valueOf().toString(), '2500');
        assert.equal((await this.rara.balanceOf(bob)).valueOf().toString(), '1000');
        assert.equal((await this.rara.balanceOf(carol)).valueOf().toString(), '0');
        assert.equal((await this.rara.balanceOf(dave)).valueOf().toString(), '0');

        assert.equal((await this.emitter.owed(bob)).valueOf().toString(), '0');
        assert.equal((await this.emitter.owed(carol)).valueOf().toString(), '2500');
        assert.equal((await this.emitter.owed(dave)).valueOf().toString(), '0');

        // block 20
        await time.advanceBlockTo(startBlock + 19);
        // 1000 for Bob, 2500 for Carol
        await this.emitter.addTarget(dave, '50', { from:manager });
        assert.equal((await this.rara.balanceOf(this.emitter.address)).valueOf().toString(), '6000');   // 2500 + 3500
        assert.equal((await this.rara.balanceOf(bob)).valueOf().toString(), '1000');
        assert.equal((await this.rara.balanceOf(carol)).valueOf().toString(), '0');
        assert.equal((await this.rara.balanceOf(dave)).valueOf().toString(), '0');

        assert.equal((await this.emitter.owed(bob)).valueOf().toString(), '1000');
        assert.equal((await this.emitter.owed(carol)).valueOf().toString(), '5000');
        assert.equal((await this.emitter.owed(dave)).valueOf().toString(), '0');

        // block 30
        await time.advanceBlockTo(startBlock + 29);
        // 1000 for Bob, 2500 for Carol, 500 for Dave
        await this.emitter.claim(bob, { from:bob });
        assert.equal((await this.rara.balanceOf(this.emitter.address)).valueOf().toString(), '8000');   // 6000 + 4000 - 2000
        assert.equal((await this.rara.balanceOf(bob)).valueOf().toString(), '3000');
        assert.equal((await this.rara.balanceOf(carol)).valueOf().toString(), '0');
        assert.equal((await this.rara.balanceOf(dave)).valueOf().toString(), '0');

        assert.equal((await this.emitter.owed(bob)).valueOf().toString(), '0');
        assert.equal((await this.emitter.owed(carol)).valueOf().toString(), '7500');
        assert.equal((await this.emitter.owed(dave)).valueOf().toString(), '500');

        // block 40
        await time.advanceBlockTo(startBlock + 39);
        // 1000 for Bob, 2500 for Carol, 500 for Dave
        await this.emitter.updateTarget(0, bob, '10', { from:manager });
        assert.equal((await this.rara.balanceOf(this.emitter.address)).valueOf().toString(), '12000');   // 8000 + 4000
        assert.equal((await this.rara.balanceOf(bob)).valueOf().toString(), '3000');
        assert.equal((await this.rara.balanceOf(carol)).valueOf().toString(), '0');
        assert.equal((await this.rara.balanceOf(dave)).valueOf().toString(), '0');

        assert.equal((await this.emitter.owed(bob)).valueOf().toString(), '1000');
        assert.equal((await this.emitter.owed(carol)).valueOf().toString(), '10000');
        assert.equal((await this.emitter.owed(dave)).valueOf().toString(), '1000');

        // block 50
        await time.advanceBlockTo(startBlock + 49);
        // 100 for Bob, 2500 for Carol, 500 for Dave
        await this.emitter.claim(carol, { from:carol });
        assert.equal((await this.rara.balanceOf(this.emitter.address)).valueOf().toString(), '2600');   // 12000 + 3100 - 12500
        assert.equal((await this.rara.balanceOf(bob)).valueOf().toString(), '3000');
        assert.equal((await this.rara.balanceOf(carol)).valueOf().toString(), '12500');
        assert.equal((await this.rara.balanceOf(dave)).valueOf().toString(), '0');

        assert.equal((await this.emitter.owed(bob)).valueOf().toString(), '1100');
        assert.equal((await this.emitter.owed(carol)).valueOf().toString(), '0');
        assert.equal((await this.emitter.owed(dave)).valueOf().toString(), '1500');

        // block 60
        await time.advanceBlockTo(startBlock + 59);
        // 100 for Bob, 2500 for Carol, 500 for edith
        await this.emitter.updateTarget(2, edith, '50', { from:manager });
        assert.equal((await this.rara.balanceOf(this.emitter.address)).valueOf().toString(), '5700');   // 2600 + 3100
        assert.equal((await this.rara.balanceOf(bob)).valueOf().toString(), '3000');
        assert.equal((await this.rara.balanceOf(carol)).valueOf().toString(), '12500');
        assert.equal((await this.rara.balanceOf(dave)).valueOf().toString(), '0');
        assert.equal((await this.rara.balanceOf(edith)).valueOf().toString(), '0');

        assert.equal((await this.emitter.owed(bob)).valueOf().toString(), '1200');
        assert.equal((await this.emitter.owed(carol)).valueOf().toString(), '2500');
        assert.equal((await this.emitter.owed(dave)).valueOf().toString(), '0');
        assert.equal((await this.emitter.owed(edith)).valueOf().toString(), '2000');

        // block 70
        await time.advanceBlockTo(startBlock + 69);
        // 100 for Bob, 2500 for Carol, 500 for edith
        await this.emitter.claim(edith, { from:edith });
        assert.equal((await this.rara.balanceOf(this.emitter.address)).valueOf().toString(), '6300');   // 5700 + 3100 - 2500
        assert.equal((await this.rara.balanceOf(bob)).valueOf().toString(), '3000');
        assert.equal((await this.rara.balanceOf(carol)).valueOf().toString(), '12500');
        assert.equal((await this.rara.balanceOf(dave)).valueOf().toString(), '0');
        assert.equal((await this.rara.balanceOf(edith)).valueOf().toString(), '2500');

        assert.equal((await this.emitter.owed(bob)).valueOf().toString(), '1300');
        assert.equal((await this.emitter.owed(carol)).valueOf().toString(), '5000');
        assert.equal((await this.emitter.owed(dave)).valueOf().toString(), '0');
        assert.equal((await this.emitter.owed(edith)).valueOf().toString(), '0');
      })
    });
  });
