const { expectRevert, time } = require('@openzeppelin/test-helpers');
const MockERC20 = artifacts.require('MockERC20');
const MockERC721Valuable = artifacts.require('MockERC721Valuable');
const MockTokenEmitter = artifacts.require('MockTokenEmitter');
const MockVotingRegistry = artifacts.require('MockVotingRegistry');
const RaraCollectibleMining = artifacts.require('RaraCollectibleMining');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('RaraCollectibleMining', ([alice, bob, carol, dave, edith, manager, pauser, minter, dev]) => {
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
      await this.pool.add('50', this.token2.address, false, this.registry.address, { from:manager });
      await this.pool.add('0', this.collectible.address, true, ZERO_ADDRESS, { from:manager });
    });

    it('should revert if non-manager adds a pool', async () => {
      await expectRevert.unspecified(this.pool.add('100', this.token.address, false, ZERO_ADDRESS, { from:bob }));
      await expectRevert.unspecified(this.pool.add('50', this.token2.address, false, this.registry.address, { from:pauser }));
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

    it('update() should read token balance and set total shares and user amounts', async () => {
      await this.pool.add('100', this.token.address, false, ZERO_ADDRESS, { from:alice });
      assert.equal((await this.pool.poolShares(0)).valueOf(), '0');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.token.mint(alice, '155');
      await this.token.mint(bob, '45');
      await this.token.mint(carol, '200');

      assert.equal((await this.pool.poolShares(0)).valueOf(), '0');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.update(0, alice);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '155');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '155');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.update(0, bob);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '200');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '155');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '45');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.update(0, carol);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '400');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '155');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '45');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '200');

      await this.pool.update(0, carol);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '400');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '155');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '45');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '200');
    });

    it('update() should read collectible value and set total shares and user amounts', async () => {
      await this.pool.add('100', this.collectible.address, true, ZERO_ADDRESS, { from:alice });

      assert.equal((await this.pool.poolShares(0)).valueOf(), '0');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.collectible.mint(alice, '5');
      await this.collectible.mint(bob, '100');
      await this.collectible.mint(bob, '20');
      await this.collectible.mint(carol, '5');
      await this.collectible.mint(carol, '100');
      await this.collectible.mint(carol, '100');

      assert.equal(await this.collectible.balanceOf(alice), '1');
      assert.equal(await this.collectible.balanceOf(bob), '2');
      assert.equal(await this.collectible.balanceOf(carol), '3');

      assert.equal((await this.pool.poolShares(0)).valueOf(), '0');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.update(0, alice);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '5');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '5');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.update(0, bob);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '125');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '5');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '120');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.update(0, carol);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '330');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '5');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '120');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '205');

      await this.pool.update(0, carol);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '330');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '5');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '120');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '205');

      await this.collectible.mint(alice, 200);
      await this.collectible.mint(bob, 20);
      await this.collectible.mint(carol, 2);
      assert.equal(await this.collectible.balanceOf(alice), '2');
      assert.equal(await this.collectible.balanceOf(bob), '3');
      assert.equal(await this.collectible.balanceOf(carol), '4');
      await this.pool.update(0, alice);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '530');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '205');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '120');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '205');
    });

    it('update() should read token balance, apply level multiplier, and set total shares and user amounts', async () => {
      await this.pool.add('100', this.token.address, false, this.registry.address, { from:alice });
      assert.equal((await this.pool.poolShares(0)).valueOf(), '0');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.token.mint(alice, '155');
      await this.token.mint(bob, '45');
      await this.token.mint(carol, '200');
      await this.registry.set(alice, 1000, 0);  // x1
      await this.registry.set(bob, 1500, 1);    // x2
      await this.registry.set(carol, 10000, 2); // x4

      assert.equal((await this.pool.poolShares(0)).valueOf(), '0');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.update(0, alice);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '155');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '155');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.update(0, bob);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '245');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '155');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '90');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.update(0, carol);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '1045');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '155');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '90');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '800');

      await this.pool.update(0, carol);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '1045');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '155');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '90');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '800');

      await this.registry.set(bob, 15000, 3); // x6
      await this.pool.update(0, bob);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '1225');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '155');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '270');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '800');
    });

    it('updateUsers() should read token balance and set total shares and user amounts', async () => {
      await this.pool.add('100', this.token.address, false, ZERO_ADDRESS, { from:alice });
      assert.equal((await this.pool.poolShares(0)).valueOf(), '0');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.token.mint(alice, '155');
      await this.token.mint(bob, '45');
      await this.token.mint(carol, '200');

      assert.equal((await this.pool.poolShares(0)).valueOf(), '0');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.updateUsers(0, [alice, bob]);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '200');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '155');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '45');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.token.mint(alice, '20');
      await this.token.mint(bob, '10');
      await this.pool.updateUsers(0, [alice, bob, carol]);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '430');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '175');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '55');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '200');
    });

    it('updateUsers() should read collectible value and set total shares and user amounts', async () => {
      await this.pool.add('100', this.collectible.address, true, ZERO_ADDRESS, { from:alice });

      assert.equal((await this.pool.poolShares(0)).valueOf(), '0');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.collectible.mint(alice, '5');
      await this.collectible.mint(bob, '100');
      await this.collectible.mint(bob, '20');
      await this.collectible.mint(carol, '5');
      await this.collectible.mint(carol, '100');
      await this.collectible.mint(carol, '100');

      assert.equal(await this.collectible.balanceOf(alice), '1');
      assert.equal(await this.collectible.balanceOf(bob), '2');
      assert.equal(await this.collectible.balanceOf(carol), '3');

      assert.equal((await this.pool.poolShares(0)).valueOf(), '0');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.updateUsers(0, [alice, bob]);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '125');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '5');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '120');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.updateUsers(0, [carol]);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '330');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '5');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '120');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '205');

      await this.collectible.mint(alice, 200);
      await this.collectible.mint(bob, 20);
      await this.collectible.mint(carol, 2);
      assert.equal(await this.collectible.balanceOf(alice), '2');
      assert.equal(await this.collectible.balanceOf(bob), '3');
      assert.equal(await this.collectible.balanceOf(carol), '4');
      await this.pool.updateUsers(0, [alice]);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '530');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '205');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '120');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '205');
    });

    it('updateUsers() should read token balance, apply level multiplier, and set total shares and user amounts', async () => {
      await this.pool.add('100', this.token.address, false, this.registry.address, { from:alice });
      assert.equal((await this.pool.poolShares(0)).valueOf(), '0');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.token.mint(alice, '155');
      await this.token.mint(bob, '45');
      await this.token.mint(carol, '200');
      await this.registry.set(alice, 1000, 0);  // x1
      await this.registry.set(bob, 1500, 1);    // x2
      await this.registry.set(carol, 10000, 2); // x4

      assert.equal((await this.pool.poolShares(0)).valueOf(), '0');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '0');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.updateUsers(0, [alice, bob]);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '245');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '155');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '90');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '0');

      await this.pool.updateUsers(0, [alice, bob, carol]);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '1045');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '155');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '90');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '800');

      await this.registry.set(bob, 15000, 3); // x6
      await this.pool.updateUsers(0, [bob]);
      assert.equal((await this.pool.poolShares(0)).valueOf(), '1225');
      assert.equal((await this.pool.userInfo(0, alice)).valueOf().amount, '155');
      assert.equal((await this.pool.userInfo(0, bob)).valueOf().amount, '270');
      assert.equal((await this.pool.userInfo(0, carol)).valueOf().amount, '800');
    });

    it('harvest retrieves Rara', async () => {
      await this.pool.add('100', this.token.address, false, ZERO_ADDRESS, { from:alice });
      await this.pool.setBurnRate(0, 1, dev, true, { from:alice });

      await this.token.mint(bob, 10);
      await this.pool.update(0, bob);
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
      await this.pool.add('100', this.token.address, false, ZERO_ADDRESS, { from:alice });
      await this.pool.add('50', this.token2.address, false, this.registry.address, { from:manager });
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
      await this.token.mint(alice, 10);
      await this.pool.update(0, alice);
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2850');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '150');

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
      await this.pool.add('100', this.token.address, false, ZERO_ADDRESS, { from:alice });
      await this.pool.add('50', this.token2.address, false, this.registry.address, { from:manager });
      await this.pool.setBurnRate(10, 100, dev, true, { from:alice });

      await this.token.mint(alice, 5);
      await this.token.mint(bob, 4);
      await this.token.mint(carol, 1);
      await this.pool.updateUsers(0, [alice, bob, carol]);

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
    });

    it('should distribute RARA properly for each staker as stakes change', async () => {
      await this.pool.add('100', this.token.address, false, ZERO_ADDRESS, { from:alice });
      await this.pool.add('50', this.token2.address, false, this.registry.address, { from:manager });
      await this.pool.setBurnRate(1, 10, dev, true, { from:alice });

      await this.token.mint(alice, 5);
      await this.pool.update(0, alice);
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

      await this.token.mint(bob, 4);
      await this.pool.update(0, bob);
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

      await this.token2.mint(bob, 10);
      await this.pool.update(1, bob);
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

      await this.token.burn(5, { from:alice });
      await this.pool.update(0, alice);
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

      await this.token2.burn(10, { from:bob });
      await this.pool.update(1, bob);
      await this.pool.harvest(1, bob, { from:bob });
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
    });

    it('should distribute RARA properly for each staker as registry levels change', async () => {
      await this.pool.add('50', this.token.address, false, ZERO_ADDRESS, { from:alice });
      await this.pool.add('100', this.token2.address, false, this.registry.address, { from:manager });
      await this.pool.setBurnRate(1, 10, dev, true, { from:alice });

      await this.token2.mint(alice, 5);
      await this.pool.update(1, alice);
      await this.emitter.setOwed(this.pool.address, '1500');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.token2.mint(bob, 4);
      await this.pool.update(1, bob);
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '1500');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '1350');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '900');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
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
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '1400'); // 900 + 500
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '400');      // 0 + 400
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '0');

      await this.token.mint(bob, 10);
      await this.pool.update(0, bob);
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '3000');
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '2700');
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '1800');
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '1400'); // 900 + 500
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '400');      // 0 + 400
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      // token2: alice has 5, bob 4. Burn rate is 10%.
      // increase alice's level to 1, bob's to 3: 10 + 24 = 34.
      // increase alice's balance to 8: 16 + 24 = 40.
      // add 6000 to mined amount.
      // add 6666 with 10% burn  ==> 6000.
      // alice gets 0 + (4000 * 16) / 40 = 1600.0
      // bob gets 2000 + (4000 * 24) / 40 = 2400.0
      await this.token2.mint(alice, 3);
      await this.registry.set(alice, 100, 1);
      await this.registry.set(bob, 10000, 3);
      await this.pool.updateUsers(1, [alice, bob]);

      await this.emitter.addOwed(this.pool.address, '6666');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '6666');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '9666');   // 3000 + 6667
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '8700');   // 2700 + 6000
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '7800');      // 1800 + 6000
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '3000'); // 1400  + 1600
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '2800');      // 400 + 2400
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '2000');         // 0 + 2000
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      // token2: alice has 8x2, bob 4x6. Burn rate is 10%.
      // decrease alice's balance to 3: 6 + 24 = 30.
      // add 4500 to mined amount.
      // add 5000 with 10% burn  ==> 4500.
      // alice gets 0 + (3000 * 6) / 30 = 600.0
      // bob gets 1500 + (3000 * 24) / 30 = 2400.0

      await this.token2.burn(5, { from:alice });
      await this.pool.update(1, alice);
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '6666');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '9666');   // 3000 + 6667
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '8700');   // 2700 + 6000
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '7800');      // 1800 + 6000
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '3000'); // 1400  + 1600
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '2800');      // 400 + 2400
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '2000');         // 0 + 2000
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.emitter.addOwed(this.pool.address, '5000');
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '11666');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '14666');   // 9667 + 5000
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '13200');   // 8700 + 4500
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '12300');      // 7800 + 4500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '3600'); // 3000 + 600
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '5200');      // 2800 + 2400
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '3500');         // 2000 + 1500
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '1800');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '300');

      await this.pool.harvest(1, bob, { from:bob });    // triggers a claim
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '14666');   // 9667 + 5000
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '13200');   // 8700 + 4500
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '12300');      // 7800 + 4500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '3600'); // 3000 + 600
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');      // 2800 + 2400
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '3500');         // 2000 + 1500
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '7100'); // + 10500 - 5200
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '5200');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '1466');

      await this.pool.harvest(1, alice, { from:alice });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '14666');   // 9667 + 5000
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '13200');   // 8700 + 4500
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '12300');      // 7800 + 4500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0'); // 3000 + 600
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');      // 2800 + 2400
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '3500');         // 2000 + 1500
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '3500');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '3600');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '5200');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '1466');

      await this.token.burn(10, { from:bob });
      await this.pool.update(0, bob);
      await this.pool.harvest(0, bob, { from:bob });
      assert.equal((await this.emitter.owed(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.pool.totalReceived()).valueOf().toString(), '14666');   // 9667 + 5000
      assert.equal((await this.pool.totalRetained()).valueOf().toString(), '13200');   // 8700 + 4500
      assert.equal((await this.pool.totalMined()).valueOf().toString(), '12300');      // 7800 + 4500
      assert.equal((await this.pool.pendingReward(1, alice)).valueOf().toString(), '0'); // 3000 + 600
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(1, bob)).valueOf().toString(), '0');      // 2800 + 2400
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '0');         // 2000 + 1500
      assert.equal((await this.reward.balanceOf(this.pool.address)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '3600');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '8700');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dev)).valueOf().toString(), '1466');
    });

    it('harvest reverts until unlockBlock', async () => {
      let unlockBlock = (await web3.eth.getBlockNumber()) + 30;

      this.pool = await RaraCollectibleMining.new(this.reward.address, this.emitter.address, unlockBlock, { from: alice });
      await this.pool.grantRole(MANAGER_ROLE, manager, { from:alice });

      await this.pool.add('100', this.token.address, false, ZERO_ADDRESS, { from:alice });
      await this.pool.setBurnRate(0, 1, dev, true, { from:alice });

      await this.token.mint(alice, 5);
      await this.token.mint(bob, 5);
      await this.pool.updateUsers(0, [alice, bob]);

      await this.emitter.setOwed(this.pool.address, '100');
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '0');

      await expectRevert(this.pool.harvest(0, dave, { from:alice }), "RaraCollectibleMining: no harvest before unlockBlock");
      assert.equal((await this.pool.pendingReward(0, alice)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, bob)).valueOf().toString(), '50');
      assert.equal((await this.pool.pendingReward(0, carol)).valueOf().toString(), '0');
      assert.equal((await this.pool.pendingReward(0, dave)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(alice)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(bob)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(carol)).valueOf().toString(), '0');
      assert.equal((await this.reward.balanceOf(dave)).valueOf().toString(), '0');

      await expectRevert(this.pool.harvest(0, dave, { from:alice }), "RaraCollectibleMining: no harvest before unlockBlock");
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

      await this.token.burn(5, { from:bob });
      await this.pool.updateUsers(0, [bob]);
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

    it('should accumulate RARA properly for each staker as stakes change, but only allow harvests after "unlockBlock"', async () => {
      let unlockBlock = (await web3.eth.getBlockNumber()) + 30;

      this.pool = await RaraCollectibleMining.new(this.reward.address, this.emitter.address, unlockBlock, { from: alice });
      await this.pool.grantRole(MANAGER_ROLE, manager, { from:alice });

      await this.pool.add('100', this.token.address, false, ZERO_ADDRESS, { from:alice });
      await this.pool.add('50', this.token2.address, false, this.registry.address, { from:manager });
      await this.pool.setBurnRate(1, 10, dev, true, { from:alice });

      await this.token.mint(alice, 5);
      await this.pool.updateUsers(0, [alice]);
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

      await this.token.mint(bob, 4);
      await this.pool.updateUsers(0, [bob]);
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

      await this.token2.mint(bob, 10);
      await this.pool.updateUsers(1, [bob]);  // first PID update triggers a claim from emitter
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

      await this.token.burn(5, { from:alice });
      await this.pool.update(0, alice);  // no claim triggered
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

      await expectRevert(this.pool.harvest(0, alice, { from:alice }), "RaraCollectibleMining: no harvest before unlockBlock");
      await expectRevert(this.pool.harvest(0, bob, { from:bob }), "RaraCollectibleMining: no harvest before unlockBlock");
      await expectRevert(this.pool.harvest(1, bob, { from:bob }), "RaraCollectibleMining: no harvest before unlockBlock");

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

      await this.token2.burn(10, { from:bob });
      await this.pool.update(1, bob);  // no claim triggered
      await this.pool.harvest(1, bob, { from:bob });
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
    });
  });
});
