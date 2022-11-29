const { expectRevert, time } = require('@openzeppelin/test-helpers');
const MockERC20 = artifacts.require('MockERC20');
const MockLendingPool = artifacts.require('MockLendingPool');
const WithdrawFeeValidatingStakeManager = artifacts.require('WithdrawFeeValidatingStakeManager');

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

contract('WithdrawFeeValidatingStakeManager', ([alice, bob, carol, dave, minter, pool, manager, lender, dev]) => {
  const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');
  const LENDER_ROLE = web3.utils.soliditySha3('LENDER_ROLE');

  context('testing staking transfers and permissions', () => {
    beforeEach(async () => {
      this.lendingPool = await MockLendingPool.new();
      this.manager = await WithdrawFeeValidatingStakeManager.new(pool, this.lendingPool.address, 0, 1, 0, dev, { from:alice });
      this.manager.grantRole(MANAGER_ROLE, manager);
      this.manager.grantRole(LENDER_ROLE, lender);
      this.lendingPool.grantRole(LENDER_ROLE, this.manager.address);

      this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
      await this.lp.transfer(alice, '1000', { from: minter });
      await this.lp.transfer(bob, '1000', { from: minter });
      await this.lp.transfer(carol, '1000', { from: minter });
      await this.lp.approve(this.manager.address, '1000', { from: alice });
      await this.lp.approve(this.manager.address, '1000', { from: bob });
      await this.lp.approve(this.manager.address, '1000', { from: carol });
      this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minter });
      await this.lp2.transfer(alice, '1000', { from: minter });
      await this.lp2.transfer(bob, '1000', { from: minter });
      await this.lp2.transfer(carol, '1000', { from: minter });
      await this.lp2.approve(this.manager.address, '1000', { from: alice });
      await this.lp2.approve(this.manager.address, '1000', { from: bob });
      await this.lp2.approve(this.manager.address, '1000', { from: carol });
    });

    it('constructor sets state appropriately', async () => {
      assert.equal((await this.manager.pool()).valueOf(), pool);
      assert.equal((await this.manager.feeNumerator()).valueOf().toString(), '0');
      assert.equal((await this.manager.feeDenominator()).valueOf().toString(), '1');
      assert.equal((await this.manager.feePeriod()).valueOf().toString(), '0');
      assert.equal((await this.manager.feeRecipient()).valueOf(), dev);
    });

    it('only pool can onStakeDeposit', async () => {
      await expectRevert(this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 0, 0),
        "WithdrawFeeValidatingStakeManager: only mining pool can onStakeDeposit");
      await expectRevert(this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 100, 100, { from:manager }),
        "WithdrawFeeValidatingStakeManager: only mining pool can onStakeDeposit");
      await expectRevert(this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 50, 100, { from:lender }),
        "WithdrawFeeValidatingStakeManager: only mining pool can onStakeDeposit");
      await this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 50, 100, { from:pool });
    });

    it('onStakeDeposit does not allow proxy deposits', async () => {
      await expectRevert(this.manager.onStakeDeposit(0, this.lp.address, alice, bob, 50, 100, { from:pool }),
        "WithdrawFeeValidatingStakeManager: stake funder must be == recipient");
      await expectRevert(this.manager.onStakeDeposit(0, this.lp.address, alice, pool, 50, 100, { from:pool }),
        "WithdrawFeeValidatingStakeManager: stake funder must be == recipient");
      await expectRevert(this.manager.onStakeDeposit(0, this.lp.address, pool, alice, 50, 100, { from:pool }),
        "WithdrawFeeValidatingStakeManager: stake funder must be == recipient");
      await this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 50, 100, { from:pool });
    });

    it('onStakeDeposit reverts if insufficient balance or approval', async () => {
      await this.lp.approve(this.manager.address, '10', { from: alice });
      await expectRevert.unspecified(this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 11, 100, { from:pool }));
      await this.lp.approve(this.manager.address, '10000', { from: alice });
      await expectRevert.unspecified(this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 1001, 1001, { from:pool }));
    });

    it('onStakeDeposit reverts for 0 deposit', async () => {
      await expectRevert(this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 0, 100, { from:pool }),
          "WithdrawFeeValidatingStakeManager: must deposit > 0");

      await expectRevert(this.manager.onStakeDeposit(1, this.lp2.address, bob, bob, 0, 150, { from:pool }),
          "WithdrawFeeValidatingStakeManager: must deposit > 0");
    });

    it('onStakeDeposit transfers funds', async () => {
      await this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 50, 100, { from:pool });
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '950');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '50');

      await this.manager.onStakeDeposit(1, this.lp2.address, bob, bob, 150, 150, { from:pool });
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '850');
      assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '150');
    });

    it('only pool can onStakeWithdraw', async () => {
      await this.lp.transfer(this.manager.address, 100, { from:alice });
      await expectRevert(this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 0, 0),
        "WithdrawFeeValidatingStakeManager: only mining pool can onStakeWithdraw");
      await expectRevert(this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 100, 100, { from:manager }),
        "WithdrawFeeValidatingStakeManager: only mining pool can onStakeWithdraw");
      await expectRevert(this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 50, 100, { from:lender }),
        "WithdrawFeeValidatingStakeManager: only mining pool can onStakeWithdraw");
      await this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 50, 100, { from:pool });
    });

    it('onStakeWithdraw reverts for 0 withdraw', async () => {
      await this.lp.transfer(this.manager.address, 100, { from:alice });
      await this.lp2.transfer(this.manager.address, 150, { from:bob });
      await expectRevert(this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 0, 75, { from:pool }),
          "WithdrawFeeValidatingStakeManager: must withdraw > 0");

      await expectRevert(this.manager.onStakeWithdraw(1, this.lp2.address, bob, bob, 0, 100, { from:pool }),
          "WithdrawFeeValidatingStakeManager: must withdraw > 0");
    });

    it('onStakeWithdraw transfers funds', async () => {
      await this.lp.transfer(this.manager.address, 100, { from:alice });
      await this.lp2.transfer(this.manager.address, 150, { from:bob });
      await this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 25, 75, { from:pool });
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '925');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '75');

      await this.manager.onStakeWithdraw(1, this.lp2.address, bob, bob, 50, 100, { from:pool });
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '900');
      assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '100');
    });

    it('onStakeWithdraw triggers lender drain', async () => {
      await this.lp.transfer(this.lendingPool.address, 100, { from:alice });
      await this.lp2.transfer(this.lendingPool.address, 150, { from:bob });
      await this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 25, 75, { from:pool });
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '925');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '75');

      await this.manager.onStakeWithdraw(1, this.lp2.address, bob, bob, 50, 100, { from:pool });
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '900');
      assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '100');
    });

    it('onStakeWithdraw only triggers lender drain once per PID', async () => {
      await this.lp.transfer(this.lendingPool.address, 100, { from:alice });
      await this.lp2.transfer(this.lendingPool.address, 150, { from:bob });
      await this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 25, 75, { from:pool });
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '925');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '75');

      await this.manager.onStakeWithdraw(1, this.lp2.address, bob, bob, 50, 100, { from:pool });
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '900');
      assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '100');

      await this.lp.transfer(this.lendingPool.address, 100, { from:alice });
      await this.lp2.transfer(this.lendingPool.address, 150, { from:bob });
      await this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 25, 50, { from:pool });
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '850');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '50');
      assert.equal((await this.lp.balanceOf(this.lendingPool.address)).valueOf().toString(), '100');

      await this.manager.onStakeWithdraw(1, this.lp2.address, bob, bob, 50, 50, { from:pool });
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '800');
      assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '50');
      assert.equal((await this.lp2.balanceOf(this.lendingPool.address)).valueOf().toString(), '150');
    });
  })

  context('with fees', async () => {
    beforeEach(async () => {
      this.manager = await WithdrawFeeValidatingStakeManager.new(pool, this.lendingPool.address, 5, 100, 60, dev, { from:alice });
      this.manager.grantRole(MANAGER_ROLE, manager);
      this.manager.grantRole(LENDER_ROLE, lender);
      this.lendingPool.grantRole(LENDER_ROLE, this.manager.address);
      
      this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
      await this.lp.transfer(alice, '1000', { from: minter });
      await this.lp.transfer(bob, '1000', { from: minter });
      await this.lp.transfer(carol, '1000', { from: minter });
      await this.lp.approve(this.manager.address, '1000', { from: alice });
      await this.lp.approve(this.manager.address, '1000', { from: bob });
      await this.lp.approve(this.manager.address, '1000', { from: carol });
      this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minter });
      await this.lp2.transfer(alice, '1000', { from: minter });
      await this.lp2.transfer(bob, '1000', { from: minter });
      await this.lp2.transfer(carol, '1000', { from: minter });
      await this.lp2.approve(this.manager.address, '1000', { from: alice });
      await this.lp2.approve(this.manager.address, '1000', { from: bob });
      await this.lp2.approve(this.manager.address, '1000', { from: carol });
    });

    context('testing fee configuration', () => {
      it('constructor sets state appropriately', async () => {
        assert.equal((await this.manager.pool()).valueOf(), pool);
        assert.equal((await this.manager.feeNumerator()).valueOf().toString(), '5');
        assert.equal((await this.manager.feeDenominator()).valueOf().toString(), '100');
        assert.equal((await this.manager.feePeriod()).valueOf().toString(), '60');
        assert.equal((await this.manager.feeRecipient()).valueOf(), dev);
      });

      it('only manager can setWithdrawFee', async () => {
        await expectRevert(this.manager.setWithdrawFee(1, 5, 30, bob, true, { from:bob }),
          "WithdrawFeeValidatingStakeManager: must have MANAGER role to setWithdrawFee");
        await expectRevert(this.manager.setWithdrawFee(1, 5, 30, carol, true, { from:bob }),
          "WithdrawFeeValidatingStakeManager: must have MANAGER role to setWithdrawFee");
        await expectRevert(this.manager.setWithdrawFee(1, 5, 30, carol, true, { from:lender }),
          "WithdrawFeeValidatingStakeManager: must have MANAGER role to setWithdrawFee");
        await this.manager.setWithdrawFee(1, 5, 30, bob, true, { from:manager });
      });

      it('setWithdrawFee checks arguments for validity', async () => {
        await expectRevert(this.manager.setWithdrawFee(0, 0, 30, bob, true, { from:manager }),
          "WithdrawFeeValidatingStakeManager: feeDenominator must be non-zero");
        await expectRevert(this.manager.setWithdrawFee(11, 10, 30, carol, true, { from:manager }),
          "WithdrawFeeValidatingStakeManager: fee numerator must be <= denominator");
        await expectRevert(this.manager.setWithdrawFee('1000000000000000000000000', '2000000000000000000000000', 30, carol, true, { from:manager }),
          "WithdrawFeeValidatingStakeManager: fee precision too high");
      });

      it('setWithdrawFee updates fee state', async () => {
        await this.manager.setWithdrawFee(1, 5, 30, bob, false, { from:manager });
        assert.equal((await this.manager.feeNumerator()).valueOf().toString(), '1');
        assert.equal((await this.manager.feeDenominator()).valueOf().toString(), '5');
        assert.equal((await this.manager.feePeriod()).valueOf().toString(), '30');
        assert.equal((await this.manager.feeRecipient()).valueOf(), dev);

        await this.manager.setWithdrawFee(3, 7, 90, bob, true, { from:manager });
        assert.equal((await this.manager.feeNumerator()).valueOf().toString(), '3');
        assert.equal((await this.manager.feeDenominator()).valueOf().toString(), '7');
        assert.equal((await this.manager.feePeriod()).valueOf().toString(), '90');
        assert.equal((await this.manager.feeRecipient()).valueOf(), bob);
      });
    });

    context('testing fee application', async () => {
      it('no fee for onStakeDeposit', async () => {
        await this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 50, 100, { from:pool });
        assert.equal((await this.lp.balanceOf(dev)).valueOf().toString(), '0');
        assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '950');
        assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '50');

        await this.manager.onStakeDeposit(1, this.lp2.address, bob, bob, 150, 150, { from:pool });
        assert.equal((await this.lp2.balanceOf(dev)).valueOf().toString(), '0');
        assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '850');
        assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '150');
      });

      it('fee charged on withdrawal', async () => {
        await this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 1000, 1000, { from:pool });
        await this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 1000, 0, { from:pool });
        assert.equal((await this.lp.balanceOf(dev)).valueOf().toString(), '50');
        assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '950');
        assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '0');

        await this.manager.onStakeDeposit(1, this.lp2.address, bob, bob, 150, 150, { from:pool });
        await this.manager.onStakeWithdraw(1, this.lp2.address, bob, bob, 20, 130, { from:pool });
        assert.equal((await this.lp2.balanceOf(dev)).valueOf().toString(), '1');
        assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '869');
        assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '130');
      });

      it('fee charged on withdrawal after setWithdrawFee', async () => {
        await this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 1000, 1000, { from:pool });
        await this.manager.onStakeDeposit(1, this.lp2.address, bob, bob, 150, 150, { from:pool });

        await this.manager.setWithdrawFee(3, 7, 90, carol, true, { from:manager });

        await this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 700, 0, { from:pool });
        assert.equal((await this.lp.balanceOf(dev)).valueOf().toString(), '0');
        assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '1300');
        assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '400');
        assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '300');

        await this.manager.onStakeWithdraw(1, this.lp2.address, bob, bob, 14, 130, { from:pool });
        assert.equal((await this.lp2.balanceOf(dev)).valueOf().toString(), '0');
        assert.equal((await this.lp2.balanceOf(carol)).valueOf().toString(), '1006');
        assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '858');
        assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '136');
      });

      it('fee not charged if enough time has elapsed', async () => {
        await this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 1000, 1000, { from:pool });
        await this.manager.onStakeDeposit(1, this.lp2.address, bob, bob, 150, 150, { from:pool });

        await this.manager.setWithdrawFee(3, 7, 30, carol, true, { from:manager });
        await time.increase(35);

        await this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 700, 0, { from:pool });
        assert.equal((await this.lp.balanceOf(dev)).valueOf().toString(), '0');
        assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '1000');
        assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '700');
        assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '300');

        await this.manager.onStakeWithdraw(1, this.lp2.address, bob, bob, 14, 130, { from:pool });
        assert.equal((await this.lp2.balanceOf(dev)).valueOf().toString(), '0');
        assert.equal((await this.lp2.balanceOf(carol)).valueOf().toString(), '1000');
        assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '864');
        assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '136');
      });

      it('fee timer reset by subsequent deposit', async () => {
        await this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 500, 500, { from:pool });
        await this.manager.onStakeDeposit(1, this.lp2.address, bob, bob, 100, 100, { from:pool });

        await this.manager.setWithdrawFee(3, 7, 30, carol, true, { from:manager });
        await time.increase(35);

        await this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 500, 1000, { from:pool });
        await this.manager.onStakeDeposit(1, this.lp2.address, bob, bob, 50, 150, { from:pool });

        await this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 700, 0, { from:pool });
        assert.equal((await this.lp.balanceOf(dev)).valueOf().toString(), '0');
        assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '1300');
        assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '400');
        assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '300');

        await this.manager.onStakeWithdraw(1, this.lp2.address, bob, bob, 14, 130, { from:pool });
        assert.equal((await this.lp2.balanceOf(dev)).valueOf().toString(), '0');
        assert.equal((await this.lp2.balanceOf(carol)).valueOf().toString(), '1006');
        assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '858');
        assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '136');
      });

      it('fee timer not reset by another user deposit', async () => {
        await this.manager.onStakeDeposit(0, this.lp.address, alice, alice, 1000, 1000, { from:pool });
        await this.manager.onStakeDeposit(1, this.lp2.address, bob, bob, 150, 150, { from:pool });

        await this.manager.setWithdrawFee(3, 7, 30, dave, true, { from:manager });
        await time.increase(35);

        await this.manager.onStakeDeposit(0, this.lp.address, carol, carol, 500, 1000, { from:pool });
        await this.manager.onStakeDeposit(1, this.lp2.address, carol, carol, 50, 150, { from:pool });

        await this.manager.onStakeWithdraw(0, this.lp.address, alice, alice, 700, 0, { from:pool });
        assert.equal((await this.lp.balanceOf(dev)).valueOf().toString(), '0');
        assert.equal((await this.lp.balanceOf(dave)).valueOf().toString(), '0');
        assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '700');
        assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '800');

        await this.manager.onStakeWithdraw(1, this.lp2.address, bob, bob, 14, 130, { from:pool });
        assert.equal((await this.lp2.balanceOf(dev)).valueOf().toString(), '0');
        assert.equal((await this.lp2.balanceOf(dave)).valueOf().toString(), '0');
        assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '864');
        assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '186');
      });
    });
  });
});
