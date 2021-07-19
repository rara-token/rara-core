const { expectRevert, time } = require('@openzeppelin/test-helpers');
const MockERC20 = artifacts.require('MockERC20');
const MockERC721Valuable = artifacts.require('MockERC721Valuable');
const MockTokenEmitter = artifacts.require('MockTokenEmitter');
const MockVotingRegistry = artifacts.require('MockVotingRegistry');
const RaraCollectibleMining = artifacts.require('RaraCollectibleMining');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('RaraCollectibleMining', ([alice, bob, carol, dave, edith, manager, pauser, dev]) => {
  const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');
  const PAUSER_ROLE = web3.utils.soliditySha3('PAUSER_ROLE');

  beforeEach(async () => {
    this.reward = await MockERC20.new("Reward", "R", '1000000000', { from: alice });
    this.emitter = await MockTokenEmitter.new(this.reward.address, { from: alice });
    this.pool = await RaraCollectibleMining.new(this.reward.address, this.emitter.address, 0, { from: alice });
    await this.pool.grantRole(MANAGER_ROLE, manager, { from:alice });
    await this.pool.grantRole(PAUSER_ROLE, pauser, { from:alice });
    await this.reward.transfer(this.emitter.address, '1000000000', { from: alice });
  });

  it('should set correct state variables', async () => {
    const reward = await this.pool.rara();
    const emitter = await this.pool.emitter();
    assert.equal(reward.valueOf(), this.reward.address);
    assert.equal(emitter.valueOf(), this.emitter.address);

    assert.equal((await this.pool.burnNumerator()).valueOf().toString(), '0');
    assert.equal((await this.pool.burnDenominator()).valueOf().toString(), '100');
    assert.equal((await this.pool.burnAddress()).valueOf(), ZERO_ADDRESS);

    assert.equal((await this.pool.hasRole(MANAGER_ROLE, alice)).toString(), 'true');
    assert.equal((await this.pool.hasRole(MANAGER_ROLE, manager)).toString(), 'true');
    assert.equal((await this.pool.hasRole(PAUSER_ROLE, alice)).toString(), 'true');
    assert.equal((await this.pool.hasRole(PAUSER_ROLE, pauser)).toString(), 'true');
  });

  context('With mining tokens added to the field', () => {
    beforeEach(async () => {
      this.token = await MockERC20.new('Token', 'T', '0', { from: minter });
      this.token2 = await MockERC20.new('Token2', 'T2', '0', { from: minter });
      this.collectible = await MockERC721Valuable.new('Collectible', 'C', { from:minter });
      this.registry = await MockVotingRegistry.new();
    });

    it('manager can add token pools', async () => {
      await this.pool.add('100', this.token.address, false, ZERO_ADDRESS, { from:alice });
      await this.pool.add('50', this.token2.address, false, registry.address, { from:manager });
      await this.pool.add('0', this.collectible.address, true, ZERO_ADDRESS, { from:manager });
    });

    it('should revert if non-manager adds a pool', async () => {
      await expectRevert.unspecified(this.pool.add('100', this.token.address, false, ZERO_ADDRESS, { from:bob }));
      await expectRevert.unspecified(this.pool.add('50', this.token2.address, false, registry.address, { from:pauser }));
      await expectRevert.unspecified(this.pool.add('0', this.collectible.address, true, ZERO_ADDRESS, { from:minter }));
    });

    it('setUnlockBlock reverts for non-manager', async () => {
      let unlockBlock = (await web3.eth.getBlockNumber()) + 30;

      const pool = await RaraCollectibleMining.new(this.reward.address, this.emitter.address, unlockBlock, { from: alice });
      await pool.grantRole(MANAGER_ROLE, manager, { from:alice });

      await expectRevert(pool.setUnlockBlock(unlockBlock + 10, { from:bob }), "RaraCollectibleMining: must have MANAGER role to setUnlockBlock");
      await expectRevert(pool.setUnlockBlock(unlockBlock + 10, { from:carol }), "RaraCollectibleMining: must have MANAGER role to setUnlockBlock");
    });

    it('setUnlockBlock reverts if already unlocked', async () => {
      let unlockBlock = (await web3.eth.getBlockNumber()) - 1;

      const pool = await RaraCollectibleMining.new(this.reward.address, this.emitter.address, unlockBlock, { from: alice });
      await pool.grantRole(MANAGER_ROLE, manager, { from:alice });

      await expectRevert(pool.setUnlockBlock(unlockBlock + 10, { from:alice }), "RaraCollectibleMining: no setUnlockBlock after unlocked");
      await expectRevert(pool.setUnlockBlock(unlockBlock + 10, { from:manager }), "RaraCollectibleMining: no setUnlockBlock after unlocked");
    });

    it('setUnlockBlock succeeds when expected', async () => {
      let unlockBlock = (await web3.eth.getBlockNumber()) + 30;

      const pool = await RaraCollectibleMining.new(this.reward.address, this.emitter.address, unlockBlock, { from: alice });
      await pool.grantRole(MANAGER_ROLE, manager, { from:alice });

      await pool.setUnlockBlock(unlockBlock + 10, { from:alice });
      assert.equal((await pool.unlockBlock()).valueOf(), `${unlockBlock + 10}`);

      await pool.setUnlockBlock(unlockBlock + 50, { from:manager });
      assert.equal((await pool.unlockBlock()).valueOf(), `${unlockBlock + 50}`);

      await pool.setUnlockBlock(unlockBlock - 30, { from:alice });
      assert.equal((await pool.unlockBlock()).valueOf(), `${unlockBlock - 30}`);

      await expectRevert(pool.setUnlockBlock(unlockBlock + 100, { from:manager }), "RaraCollectibleMining: no setUnlockBlock after unlocked");
    });

    it('update() should read token quantities and set total shares and user amounts', async () => {
      await this.pool.add('100', this.token.address, false, ZERO_ADDRESS, { from:alice });
      assert.equal((await pool.poolShares[0]).valueOf(), '0');
      assert.equal((await pool.userInfo(0, alice)).valueOf().amount, '0');
      assert.equal((await pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.token.mint(alice, '155');
      await
    })

    it('deposit should move LP token as expected', async () => {
      await this.pool.add('100', this.lp.address, ZERO_ADDRESS, { from:alice });
      await this.pool.deposit(0, 100, alice, { from:alice });
      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '100');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '1000');

      await this.pool.deposit(0, 50, bob, { from:carol });
      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '150');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '950');
    });

    it('deposit should fail if insufficient balance or allowance', async () => {
      await this.pool.add('100', this.lp.address, ZERO_ADDRESS, { from:alice });
      await this.lp.approve(this.pool.address, '10', { from:alice });
      await expectRevert.unspecified(this.pool.deposit(0, 11, alice, { from:alice }));

      await this.lp.approve(this.pool.address, '10000', { from:bob });
      await expectRevert.unspecified(this.pool.deposit(0, '1001', bob, { from:bob }));
    });

    it('withdraw should move LP token as expected', async () => {
      await this.pool.add('100', this.lp.address, ZERO_ADDRESS, { from:alice });
      await this.pool.deposit(0, 150, alice, { from:alice });
      await this.pool.withdraw(0, 50, alice, { from:alice });
      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '100');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '1000');

      await this.pool.deposit(0, 300, bob, { from:carol });
      await this.pool.withdraw(0, 250, carol, { from:bob });
      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '150');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '950');
    });

    it('withdraw should fail if insufficient amount deposited', async () => {
      await this.pool.add('100', this.lp.address, ZERO_ADDRESS, { from:alice });
      await this.pool.deposit(0, 50, alice, { from:alice });
      await expectRevert.unspecified(this.pool.withdraw(0, 51, alice, { from:alice }));

      await this.pool.deposit(0, 150, bob, { from:carol });
      await expectRevert.unspecified(this.pool.withdraw(0, 151, carol, { from:bob }));
    });

    it('harvest retrieves Rara', async () => {
      await this.pool.add('100', this.lp.address, ZERO_ADDRESS, { from:alice });
      await this.pool.setBurnRate(0, 1, dev, true, { from:alice });

      await this.pool.deposit(0, 10, bob, { from:carol });
      await this.emitter.setOwed(this.pool.address, '100');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '100');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '0');

      await this.pool.harvest(0, dave, { from:alice });
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '100');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '0');

      await this.pool.harvest(0, dave, { from:bob });
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '100');
    });

    it('should not mine RARA if no one deposits', async () => {
      await this.pool.add('100', this.lp.address, ZERO_ADDRESS, { from:alice });
      await this.pool.add('50', this.lp2.address, ZERO_ADDRESS, { from:manager });
      await this.pool.setBurnRate(5, 100, dev, true, { from:alice });

      await this.emitter.setOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1425');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.pool.claimFromEmitter();
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1425');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '75');

      await this.emitter.setOwed(this.pool.address, '1500');
      await this.pool.deposit(0, '10', alice, { from:bob });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2850');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '150');
      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '10');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '990');

      await this.emitter.setOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '4500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '4275');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '150');

      await this.pool.harvest(0, alice, { from:alice });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '4500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '4275');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '225');

      await this.emitter.setOwed(this.pool.address, '1500');
      await this.pool.claimFromEmitter();
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1900');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.emitter.setOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '7500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '7125');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '2850');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, bob, { from:alice });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '7500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '7125');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '2850');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '1900');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '375');
    });

    it('should distribute RARA properly for each staker', async () => {
      await this.pool.add('100', this.lp.address, ZERO_ADDRESS, { from:alice });
      await this.pool.add('50', this.lp2.address, ZERO_ADDRESS, { from:manager });
      await this.pool.setBurnRate(10, 100, dev, true, { from:alice });

      await this.pool.deposit(0, '5', alice, { from:alice });
      await this.pool.deposit(0, '4', bob, { from:bob });
      await this.pool.deposit(0, '1', carol, { from:carol });
      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '10');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '995');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '999');

      await this.emitter.setOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.pool.claimFromEmitter();
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '150');

      await this.pool.harvest(0, alice, { from:alice });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '450');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '450');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '150');

      await this.emitter.setOwed(this.pool.address, '1500');
      await this.pool.claimFromEmitter();
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1350');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '450');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, bob, { from:bob });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '630');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '450');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '720');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, alice, { from:alice });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '180');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '720');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, carol, { from:alice });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '180');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '720');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, carol, { from:carol });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '720');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '180');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '10');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '995');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '999');
    });

    it('should distribute RARA properly for each staker as stakes change', async () => {
      await this.pool.add('100', this.lp.address, ZERO_ADDRESS, { from:alice });
      await this.pool.add('50', this.lp2.address, ZERO_ADDRESS, { from:manager });
      await this.pool.setBurnRate(1, 10, dev, true, { from:alice });

      await this.pool.deposit(0, '5', alice, { from:alice });
      await this.emitter.setOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.pool.deposit(0, '4', bob, { from:bob });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.emitter.addOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1400'); // 900 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '400');      // 0 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.pool.deposit(1, '10', bob, { from:bob });  // first PID deposit triggers a claim from emitter
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1400'); // 900 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '400');      // 0 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.emitter.addOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '4500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '4050');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '3150');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // 1400 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '800');      // 400 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '450');        // 0 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '9');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '995');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp2.balanceOf(this.pool.address)).valueOf().toString(), '10');
      assert.equal((await this.lp2.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '990');

      await this.pool.withdraw(0, '5', alice, { from:alice });  // no claim triggered
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '4500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '4050');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '3150');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // 1400 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '800');      // 400 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '450');        // 0 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '4');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp2.balanceOf(this.pool.address)).valueOf().toString(), '10');
      assert.equal((await this.lp2.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '990');

      await this.emitter.addOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // no change
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '1700');     // 800 + 900
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '900');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, bob, { from:bob });    // no claim needed
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // no change
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');        // harvest!
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '900');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '100');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '1700');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, alice, { from:alice });    // triggers a claim; can't cover reward otherwise
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');      // harvest!
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');        // no change!
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '900');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '1900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '1700');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '600');

      await this.pool.withdrawAndHarvest(1, 10, bob, { from:bob });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');      // harvest!
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');        // no change!
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '1900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '2600');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '600');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '4');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp2.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp2.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '1000');
    });

    it('harvest reverts until unlockBlock', async () => {
      let unlockBlock = (await web3.eth.getBlockNumber()) + 30;

      this.pool = await RaraMiningPool.new(this.reward.address, this.emitter.address, unlockBlock, { from: alice });
      await this.pool.grantRole(MANAGER_ROLE, manager, { from:alice });
      await this.pool.grantRole(LENDER_ROLE, lender, { from:alice });

      await this.lp.approve(this.pool.address, '1000', { from: alice });
      await this.lp.approve(this.pool.address, '1000', { from: bob });
      await this.lp.approve(this.pool.address, '1000', { from: carol });
      await this.lp2.approve(this.pool.address, '1000', { from: alice });
      await this.lp2.approve(this.pool.address, '1000', { from: bob });
      await this.lp2.approve(this.pool.address, '1000', { from: carol });

      await this.pool.add('100', this.lp.address, ZERO_ADDRESS, { from:alice });
      await this.pool.setBurnRate(0, 1, dev, true, { from:alice });

      await this.pool.deposit(0, 5, alice, { from:carol });
      await this.pool.deposit(0, 5, bob, { from:carol });
      await this.emitter.setOwed(this.pool.address, '100');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '0');

      await expectRevert(this.pool.harvest(0, dave, { from:alice }), "RaraMiningPool: no harvest before unlockBlock");
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '0');

      await expectRevert(this.pool.withdrawAndHarvest(0, 5, dave, { from:alice }), "RaraMiningPool: no harvest before unlockBlock");
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '0');

      await time.advanceBlockTo(unlockBlock);

      await this.pool.harvest(0, dave, { from:alice });
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '50');

      await this.pool.withdrawAndHarvest(0, 5, dave, { from:bob });
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '100');
    });

    it('should accumulate RARA properly for each staker as stakes change, but only allow harvests after "unlockBlock"', async () => {
      let unlockBlock = (await web3.eth.getBlockNumber()) + 30;

      this.pool = await RaraMiningPool.new(this.reward.address, this.emitter.address, unlockBlock, { from: alice });
      await this.pool.grantRole(MANAGER_ROLE, manager, { from:alice });
      await this.pool.grantRole(LENDER_ROLE, lender, { from:alice });

      await this.lp.approve(this.pool.address, '1000', { from: alice });
      await this.lp.approve(this.pool.address, '1000', { from: bob });
      await this.lp.approve(this.pool.address, '1000', { from: carol });
      await this.lp2.approve(this.pool.address, '1000', { from: alice });
      await this.lp2.approve(this.pool.address, '1000', { from: bob });
      await this.lp2.approve(this.pool.address, '1000', { from: carol });

      await this.pool.add('100', this.lp.address, ZERO_ADDRESS, { from:alice });
      await this.pool.add('50', this.lp2.address, ZERO_ADDRESS, { from:manager });
      await this.pool.setBurnRate(1, 10, dev, true, { from:alice });

      await this.pool.deposit(0, '5', alice, { from:alice });
      await this.emitter.setOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.pool.deposit(0, '4', bob, { from:bob });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.emitter.addOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1400'); // 900 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '400');      // 0 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.pool.deposit(1, '10', bob, { from:bob });  // first PID deposit triggers a claim from emitter
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1400'); // 900 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '400');      // 0 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.emitter.addOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '4500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '4050');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '3150');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // 1400 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '800');      // 400 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '450');        // 0 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '9');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '995');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp2.balanceOf(this.pool.address)).valueOf().toString(), '10');
      assert.equal((await this.lp2.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '990');

      await this.pool.withdraw(0, '5', alice, { from:alice });  // no claim triggered
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '4500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '4050');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '3150');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // 1400 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '800');      // 400 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '450');        // 0 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '4');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp2.balanceOf(this.pool.address)).valueOf().toString(), '10');
      assert.equal((await this.lp2.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '990');

      await this.emitter.addOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // no change
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '1700');     // 800 + 900
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '900');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await expectRevert(this.pool.harvest(0, alice, { from:alice }), "RaraMiningPool: no harvest before unlockBlock");
      await expectRevert(this.pool.harvest(0, bob, { from:bob }), "RaraMiningPool: no harvest before unlockBlock");
      await expectRevert(this.pool.withdrawAndHarvest(1, 10, bob, { from:bob }), "RaraMiningPool: no harvest before unlockBlock");

      await time.advanceBlockTo(unlockBlock + 10);

      await this.pool.harvest(0, bob, { from:bob });    // no claim needed
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // no change
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');        // harvest!
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '900');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '100');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '1700');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, alice, { from:alice });    // triggers a claim; can't cover reward otherwise
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');      // harvest!
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');        // no change!
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '900');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '1900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '1700');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '600');

      await this.pool.withdrawAndHarvest(1, 10, bob, { from:bob });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');      // harvest!
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');        // no change!
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '1900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '2600');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '600');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '4');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp2.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp2.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '1000');
    });
  });

  context('With LP token and a dedicated StakeManager', () => {
    beforeEach(async () => {
      this.manager = await MockStakeManager.new(this.pool.address);
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

    it('manager can add token pools', async () => {
      await this.pool.add('100', this.lp.address, this.manager.address, { from:alice });
      await this.pool.add('50', this.lp2.address, this.manager.address, { from:manager });
    });

    it('should revert if non-manager adds a pool', async () => {
      await expectRevert.unspecified(this.pool.add('100', this.lp.address, this.manager.address, { from:bob }));
      await expectRevert.unspecified(this.pool.add('50', this.lp2.address, this.manager.address, { from:lender }));
    });

    it('deposit should move LP token as expected', async () => {
      await this.pool.add('100', this.lp.address, this.manager.address, { from:alice });
      await this.pool.deposit(0, 100, alice, { from:alice });
      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '100');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '1000');

      await this.pool.deposit(0, 50, bob, { from:carol });
      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '150');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '950');
    });

    it('deposit should fail if insufficient balance or allowance', async () => {
      await this.pool.add('100', this.lp.address, this.manager.address, { from:alice });
      await this.lp.approve(this.manager.address, '10', { from:alice });
      await expectRevert.unspecified(this.pool.deposit(0, 11, alice, { from:alice }));

      await this.lp.approve(this.manager.address, '10000', { from:bob });
      await expectRevert.unspecified(this.pool.deposit(0, '1001', bob, { from:bob }));
    });

    it('withdraw should move LP token as expected', async () => {
      await this.pool.add('100', this.lp.address, this.manager.address, { from:alice });
      await this.pool.deposit(0, 150, alice, { from:alice });
      await this.pool.withdraw(0, 50, alice, { from:alice });
      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '100');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '1000');

      await this.pool.deposit(0, 300, bob, { from:carol });
      await this.pool.withdraw(0, 250, carol, { from:bob });
      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '150');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '950');
    });

    it('withdraw should fail if insufficient amount deposited', async () => {
      await this.pool.add('100', this.lp.address, this.manager.address, { from:alice });
      await this.pool.deposit(0, 50, alice, { from:alice });
      await expectRevert.unspecified(this.pool.withdraw(0, 51, alice, { from:alice }));

      await this.pool.deposit(0, 150, bob, { from:carol });
      await expectRevert.unspecified(this.pool.withdraw(0, 151, carol, { from:bob }));
    });

    it('harvest retrieves Rara', async () => {
      await this.pool.add('100', this.lp.address, this.manager.address, { from:alice });
      await this.pool.setBurnRate(0, 1, dev, true, { from:alice });

      await this.pool.deposit(0, 10, bob, { from:carol });
      await this.emitter.setOwed(this.pool.address, '100');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '100');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '0');

      await this.pool.harvest(0, dave, { from:alice });
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '100');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '0');

      await this.pool.harvest(0, dave, { from:bob });
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '100');
    });

    it('should not mine RARA if no one deposits', async () => {
      await this.pool.add('100', this.lp.address, this.manager.address, { from:alice });
      await this.pool.add('50', this.lp2.address, this.manager.address, { from:manager });
      await this.pool.setBurnRate(5, 100, dev, true, { from:alice });

      await this.emitter.setOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1425');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.pool.claimFromEmitter();
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1425');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '75');

      await this.emitter.setOwed(this.pool.address, '1500');
      await this.pool.deposit(0, '10', alice, { from:bob });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2850');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '150');
      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '10');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '990');

      await this.emitter.setOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '4500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '4275');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '150');

      await this.pool.harvest(0, alice, { from:alice });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '4500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '4275');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '225');

      await this.emitter.setOwed(this.pool.address, '1500');
      await this.pool.claimFromEmitter();
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1900');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.emitter.setOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '7500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '7125');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '2850');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, bob, { from:alice });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '7500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '7125');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '2850');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '950');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '1900');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '375');
    });

    it('should distribute RARA properly for each staker', async () => {
      await this.pool.add('100', this.lp.address, this.manager.address, { from:alice });
      await this.pool.add('50', this.lp2.address, this.manager.address, { from:manager });
      await this.pool.setBurnRate(10, 100, dev, true, { from:alice });

      await this.pool.deposit(0, '5', alice, { from:alice });
      await this.pool.deposit(0, '4', bob, { from:bob });
      await this.pool.deposit(0, '1', carol, { from:carol });
      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '10');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '995');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '999');

      await this.emitter.setOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.pool.claimFromEmitter();
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '150');

      await this.pool.harvest(0, alice, { from:alice });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '450');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '450');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '150');

      await this.emitter.setOwed(this.pool.address, '1500');
      await this.pool.claimFromEmitter();
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1350');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '450');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, bob, { from:bob });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '630');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '450');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '720');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, alice, { from:alice });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '180');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '720');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, carol, { from:alice });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '180');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '720');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, carol, { from:carol });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '720');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '180');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '10');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '995');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp.balanceOf(carol)).valueOf().toString(), '999');
    });

    it('should distribute RARA properly for each staker as stakes change', async () => {
      await this.pool.add('100', this.lp.address, this.manager.address, { from:alice });
      await this.pool.add('50', this.lp2.address, this.manager.address, { from:manager });
      await this.pool.setBurnRate(1, 10, dev, true, { from:alice });

      await this.pool.deposit(0, '5', alice, { from:alice });
      await this.emitter.setOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.pool.deposit(0, '4', bob, { from:bob });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.emitter.addOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1400'); // 900 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '400');      // 0 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.pool.deposit(1, '10', bob, { from:bob });  // first PID deposit triggers a claim from emitter
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1400'); // 900 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '400');      // 0 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.emitter.addOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '4500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '4050');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '3150');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // 1400 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '800');      // 400 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '450');        // 0 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '9');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '995');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp2.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '10');
      assert.equal((await this.lp2.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '990');

      await this.pool.withdraw(0, '5', alice, { from:alice });  // no claim triggered
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '4500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '4050');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '3150');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // 1400 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '800');      // 400 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '450');        // 0 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '4');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp2.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '10');
      assert.equal((await this.lp2.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '990');

      await this.emitter.addOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // no change
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '1700');     // 800 + 900
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '900');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, bob, { from:bob });    // no claim needed
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // no change
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');        // harvest!
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '900');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '100');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '1700');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, alice, { from:alice });    // triggers a claim; can't cover reward otherwise
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');      // harvest!
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');        // no change!
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '900');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '1900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '1700');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '600');

      await this.pool.withdrawAndHarvest(1, 10, bob, { from:bob });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');      // harvest!
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');        // no change!
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '1900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '2600');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '600');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '4');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp2.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '0');
      assert.equal((await this.lp2.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '1000');
    });

    it('harvest reverts until unlockBlock', async () => {
      let unlockBlock = (await web3.eth.getBlockNumber()) + 30;

      this.pool = await RaraMiningPool.new(this.reward.address, this.emitter.address, unlockBlock, { from: alice });
      this.manager = await MockStakeManager.new(this.pool.address);
      await this.pool.grantRole(MANAGER_ROLE, manager, { from:alice });
      await this.pool.grantRole(LENDER_ROLE, lender, { from:alice });

      await this.lp.approve(this.manager.address, '1000', { from: alice });
      await this.lp.approve(this.manager.address, '1000', { from: bob });
      await this.lp.approve(this.manager.address, '1000', { from: carol });
      await this.lp2.approve(this.manager.address, '1000', { from: alice });
      await this.lp2.approve(this.manager.address, '1000', { from: bob });
      await this.lp2.approve(this.manager.address, '1000', { from: carol });

      await this.pool.add('100', this.lp.address, this.manager.address, { from:alice });
      await this.pool.setBurnRate(0, 1, dev, true, { from:alice });

      await this.pool.deposit(0, 5, alice, { from:carol });
      await this.pool.deposit(0, 5, bob, { from:carol });
      await this.emitter.setOwed(this.pool.address, '100');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '0');

      await expectRevert(this.pool.harvest(0, dave, { from:alice }), "RaraMiningPool: no harvest before unlockBlock");
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '0');

      await expectRevert(this.pool.withdrawAndHarvest(0, 5, dave, { from:alice }), "RaraMiningPool: no harvest before unlockBlock");
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '0');

      await time.advanceBlockTo(unlockBlock);

      await this.pool.harvest(0, dave, { from:alice });
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '50');

      await this.pool.withdrawAndHarvest(0, 5, dave, { from:bob });
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '100');
    });

    it('should accumulate RARA properly for each staker as stakes change, but only allow harvests after "unlockBlock"', async () => {
      let unlockBlock = (await web3.eth.getBlockNumber()) + 30;

      this.pool = await RaraMiningPool.new(this.reward.address, this.emitter.address, unlockBlock, { from: alice });
      this.manager = await MockStakeManager.new(this.pool.address);

      await this.pool.grantRole(MANAGER_ROLE, manager, { from:alice });
      await this.pool.grantRole(LENDER_ROLE, lender, { from:alice });

      await this.lp.approve(this.manager.address, '1000', { from: alice });
      await this.lp.approve(this.manager.address, '1000', { from: bob });
      await this.lp.approve(this.manager.address, '1000', { from: carol });
      await this.lp2.approve(this.manager.address, '1000', { from: alice });
      await this.lp2.approve(this.manager.address, '1000', { from: bob });
      await this.lp2.approve(this.manager.address, '1000', { from: carol });

      await this.pool.add('100', this.lp.address, this.manager.address, { from:alice });
      await this.pool.add('50', this.lp2.address, this.manager.address, { from:manager });
      await this.pool.setBurnRate(1, 10, dev, true, { from:alice });

      await this.pool.deposit(0, '5', alice, { from:alice });
      await this.emitter.setOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.pool.deposit(0, '4', bob, { from:bob });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.emitter.addOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1400'); // 900 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '400');      // 0 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.pool.deposit(1, '10', bob, { from:bob });  // first PID deposit triggers a claim from emitter
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1400'); // 900 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '400');      // 0 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.emitter.addOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '4500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '4050');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '3150');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // 1400 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '800');      // 400 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '450');        // 0 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '9');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '995');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp2.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '10');
      assert.equal((await this.lp2.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '990');

      await this.pool.withdraw(0, '5', alice, { from:alice });  // no claim triggered
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '4500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '4050');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '3150');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // 1400 + 500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '800');      // 400 + 400
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '450');        // 0 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '4');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp2.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '10');
      assert.equal((await this.lp2.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '990');

      await this.emitter.addOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // no change
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '1700');     // 800 + 900
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '900');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await expectRevert(this.pool.harvest(0, alice, { from:alice }), "RaraMiningPool: no harvest before unlockBlock");
      await expectRevert(this.pool.harvest(0, bob, { from:bob }), "RaraMiningPool: no harvest before unlockBlock");
      await expectRevert(this.pool.withdrawAndHarvest(1, 10, bob, { from:bob }), "RaraMiningPool: no harvest before unlockBlock");

      await time.advanceBlockTo(unlockBlock + 10);

      await this.pool.harvest(0, bob, { from:bob });    // no claim needed
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '1900');   // no change
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');        // harvest!
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '900');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '100');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '1700');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(0, alice, { from:alice });    // triggers a claim; can't cover reward otherwise
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');      // harvest!
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');        // no change!
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '900');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '900');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '1900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '1700');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '600');

      await this.pool.withdrawAndHarvest(1, 10, bob, { from:bob });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '6000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '5400');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '4500');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');      // harvest!
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0');      // no change
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');        // no change!
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');      // 450 + 450
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '1900');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '2600');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '600');

      assert.equal((await this.lp.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp.balanceOf(this.manager.address)).valueOf().toString(), '4');
      assert.equal((await this.lp.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp.balanceOf(bob)).valueOf().toString(), '996');
      assert.equal((await this.lp2.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.lp2.balanceOf(this.manager.address)).valueOf().toString(), '0');
      assert.equal((await this.lp2.balanceOf(alice)).valueOf().toString(), '1000');
      assert.equal((await this.lp2.balanceOf(bob)).valueOf().toString(), '1000');
    });
  });
});
