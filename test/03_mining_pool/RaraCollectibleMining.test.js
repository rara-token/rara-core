const { expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');
const MockERC20 = artifacts.require('MockERC20');
const ERC721ValuableCollectibleToken = artifacts.require('ERC721ValuableCollectibleToken');
const MockTokenEmitter = artifacts.require('MockTokenEmitter');
const MockVotingRegistry = artifacts.require('MockVotingRegistry');
const RaraCollectibleMining = artifacts.require('RaraCollectibleMining');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('RaraCollectibleMining', ([alice, bob, carol, dave, edith, manager, minter, dev]) => {
  const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');
  const PAUSER_ROLE = web3.utils.soliditySha3('PAUSER_ROLE');

  beforeEach(async () => {
    this.reward = await MockERC20.new("Reward", "R", '1000000000', { from: alice });
    this.emitter = await MockTokenEmitter.new(this.reward.address, { from: alice });
    this.pool = await RaraCollectibleMining.new(this.reward.address, this.emitter.address, 0, { from: alice });
    await this.pool.grantRole(MANAGER_ROLE, manager, { from:alice });
    await this.reward.transfer(this.emitter.address, '1000000000', { from: alice });
  });

  async function nextPeriod(pool, overshoot = 0) {
    const periods = Number((await pool.periodLength()).toString());
    const start = Number((await pool.currentPeriodStartTime()).toString());
    const nextStart = start + Number((await pool.periodDuration()).toString());

    await time.increaseTo(nextStart + (overshoot ? overshoot : - 1));
    let res = await pool.updatePeriod();
    while (time.latest() < nextStart || Number((await pool.periodLength()).toString()) == periods) {
      res = await pool.updatePeriod();
    }
    return res;
  }

  it('should set correct state variables', async () => {
    const reward = await this.pool.rara();
    const emitter = await this.pool.emitter();
    assert.equal(reward.valueOf(), this.reward.address);
    assert.equal(emitter.valueOf(), this.emitter.address);

    assert.equal((await this.pool.burnNumerator()).valueOf().toString(), '0');
    assert.equal((await this.pool.burnDenominator()).valueOf().toString(), '100');
    assert.equal((await this.pool.burnAddress()).valueOf(), ZERO_ADDRESS);

    assert.equal((await this.pool.periodDuration()).valueOf().toString(), '86400');

    assert.equal((await this.pool.hasRole(MANAGER_ROLE, alice)).toString(), 'true');
    assert.equal((await this.pool.hasRole(MANAGER_ROLE, manager)).toString(), 'true');
  });

  it('periodStartTime should calculate period boundaries as expected', async () => {
    const { pool } = this;
    const tests = [];
    tests.push({ duration:86400, anchor:0, time:0, result:0 });
    tests.push({ duration:86400, anchor:0, time:10000, result:0 });
    tests.push({ duration:86400, anchor:0, time:86399, result:0 });
    tests.push({ duration:86400, anchor:0, time:86400, result:86400 });
    tests.push({ duration:86400, anchor:0, time:100000, result:86400 });
    tests.push({ duration:86400, anchor:100, time:100000, result:86500 });
    tests.push({ duration:86400, anchor:1000, time:100000, result:87400 });
    tests.push({ duration:86400, anchor:10000, time:100000, result:96400 });
    tests.push({ duration:86400, anchor:100000, time:100000, result:100000 });
    tests.push({ duration:86400, anchor:110000, time:100000, result:23600 });
    tests.push({ duration:86400, anchor:100000, time:110000, result:100000 });

    tests.push({ duration:1001, anchor:0, time:500, result:0 });
    tests.push({ duration:1001, anchor:50, time:500, result:50 });
    tests.push({ duration:1001, anchor:50, time:1000, result:50 });
    tests.push({ duration:1001, anchor:50, time:1500, result:1051 });
    tests.push({ duration:1001, anchor:50, time:2000, result:1051 });
    tests.push({ duration:1001, anchor:50, time:2500, result:2052 });
    tests.push({ duration:1001, anchor:50, time:5532000, result:5531576 });

    for (const t of tests) {
      assert.equal(
        (await this.pool.periodStartTime(t.time, t.duration, t.anchor)).valueOf().toString(),
        `${t.result}`
      );
    }
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

  it('setRegistry reverts for non-manager', async () => {
    const { pool } = this;
    const registry = await MockVotingRegistry.new();
    await expectRevert(pool.setRegistry(registry.address, { from:bob }), "RaraCollectibleMining: must have MANAGER role to setRegistry");
    await expectRevert(pool.setRegistry(registry.address, { from:carol }), "RaraCollectibleMining: must have MANAGER role to setRegistry");
  });

  it('setRegistry updates internal state', async () => {
    const { pool } = this;
    const registry = await MockVotingRegistry.new();
    await pool.setRegistry(registry.address, { from:alice });
    assert.equal(await pool.registry(), registry.address);

    await pool.setRegistry(ZERO_ADDRESS, { from:manager });
    assert.equal(await pool.registry(), ZERO_ADDRESS);
  });

  it('setPeriod reverts for non-manager', async () => {
    const { pool } = this;
    await expectRevert(pool.setPeriod(3600, 100, { from:bob }), "RaraCollectibleMining: must have MANAGER role to setPeriod");
    await expectRevert(pool.setPeriod(3600, 0, { from:carol }), "RaraCollectibleMining: must have MANAGER role to setPeriod");
  });

  it('setPeriod reverts duration 0', async () => {
    const { pool } = this;
    await expectRevert(pool.setPeriod(0, 100, { from:alice }), "RaraCollectibleMining: duration must be nonzero");
    await expectRevert(pool.setPeriod(0, 0, { from:manager }), "RaraCollectibleMining: duration must be nonzero");
  });

  it('setPeriod succeeds when expected', async () => {
    const { pool } = this;
    await pool.setPeriod(1000, 50, { from:alice });
    assert.equal(await pool.periodDuration(), '1000');
    assert.equal(await pool.periodAnchorTime(), '50');

    await pool.setPeriod(14400, 1001, { from:manager });
    assert.equal(await pool.periodDuration(), '14400');
    assert.equal(await pool.periodAnchorTime(), '1001');
  });

  context('With mining tokens added to the field', () => {
    beforeEach(async () => {
      this.collectible = await ERC721ValuableCollectibleToken.new('Collectible', 'C', 'http://c/', { from:minter });
      this.collectible2 = await ERC721ValuableCollectibleToken.new('Collectible2', 'C2', 'http://c2/',{ from:minter });
      this.food = await ERC721ValuableCollectibleToken.new('Food', 'F', 'http://f/',{ from:minter });
      this.registry = await MockVotingRegistry.new();
    });

    it('should revert if non-manager adds a pool', async () => {
      await expectRevert(
        this.pool.addPool(this.collectible.address, '100', false, 0, { from:bob }),
        "RaraCollectibleMining: must have MANAGER role to addPool"
      );
      await expectRevert(
        this.pool.addPool(this.collectible.address, '1000', true, 10, { from:carol }),
        "RaraCollectibleMining: must have MANAGER role to addPool"
      );
      await expectRevert(
        this.pool.addPool(this.collectible2.address, '1', false, 0, { from:minter }),
        "RaraCollectibleMining: must have MANAGER role to addPool"
      );
    });

    it('manager can add token pools', async () => {
      await this.pool.addPool(this.collectible.address, '100', false, 0, { from:alice });
      await this.pool.addPool(this.collectible.address, '1000', true, 10, { from:manager });
      await this.pool.addPool(this.collectible2.address, '1', false, 0, { from:manager });
    });

    it('(internal) addPool updates internal state', async () => {
      const { pool, collectible, collectible2 } = this;
      assert.equal(await pool.poolLength(), '0');

      await pool.addPool(collectible.address, '100', false, 0, { from:alice });
      assert.equal(await pool.poolLength(), '1');
      let info = await pool.poolInfo(0);
      assert.equal(info.token, collectible.address);
      assert.equal(info.tokenPower, '100');
      assert.equal(info.stakeIsTyped, false);
      assert.equal(info.stakeTokenType, 0);
      // check activation info at the end

      await pool.addPool(this.collectible.address, '1000', true, 10, { from:manager });
      assert.equal(await pool.poolLength(), '2');
      info = await pool.poolInfo(1);
      assert.equal(info.token, collectible.address);
      assert.equal(info.tokenPower, '1000');
      assert.equal(info.stakeIsTyped, true);
      assert.equal(info.stakeTokenType, 10);
      // check activation info at the end

      await pool.addPool(this.collectible2.address, '1', false, 0, { from:manager });
      assert.equal(await pool.poolLength(), '3');
      info = await pool.poolInfo(2);
      assert.equal(info.token, collectible2.address);
      assert.equal(info.tokenPower, '1');
      assert.equal(info.stakeIsTyped, false);
      assert.equal(info.stakeTokenType, 0);
      // check activation info at the end

      for (let i = 0; i < 3; i++) {
        info = await pool.poolInfo(i);
        assert.equal(info.activationToken, ZERO_ADDRESS);
        assert.equal(info.activationAmount, '0');
        assert.equal(info.activationIsTyped, false);
        assert.equal(info.activationTokenType, 0);
      }
    });

    it('setPoolPower reverts if called by non-manager', async () => {
      const { pool, collectible, collectible2 } = this;
      await this.pool.addPool(this.collectible.address, '100', false, 0, { from:alice });
      await this.pool.addPool(this.collectible.address, '1000', true, 10, { from:manager });
      await this.pool.addPool(this.collectible2.address, '1', false, 0, { from:manager });

      await expectRevert(
        this.pool.setPoolPower(0, '1', { from:bob }),
        "RaraCollectibleMining: must have MANAGER role to setPoolPower"
      );
      await expectRevert(
        this.pool.setPoolPower(1, '0', { from:carol }),
        "RaraCollectibleMining: must have MANAGER role to setPoolPower"
      );
      await expectRevert(
        this.pool.setPoolPower(2, '100', { from:minter }),
        "RaraCollectibleMining: must have MANAGER role to setPoolPower"
      );
    });

    it('(internal) setPoolPower updates internal state', async () => {
      const { pool, collectible, collectible2 } = this;
      await this.pool.addPool(this.collectible.address, '100', false, 0, { from:alice });
      await this.pool.addPool(this.collectible.address, '1000', true, 10, { from:manager });
      await this.pool.addPool(this.collectible2.address, '1', false, 0, { from:manager });

      await pool.setPoolPower(0, '1', { from:alice });
      let info = await pool.poolInfo(0);
      assert.equal(info.token, collectible.address);
      assert.equal(info.tokenPower, '1');

      await pool.setPoolPower(1, '0', { from:manager });
      info = await pool.poolInfo(1);
      assert.equal(info.token, collectible.address);
      assert.equal(info.tokenPower, '0');

      await pool.setPoolPower(2, '100', { from:manager });
      info = await pool.poolInfo(2);
      assert.equal(info.token, collectible2.address);
      assert.equal(info.tokenPower, '100');
    });

    it('setPoolActivation reverts if called by non-manager', async () => {
      await this.pool.addPool(this.collectible.address, '100', false, 0, { from:alice });
      await this.pool.addPool(this.collectible.address, '1000', true, 10, { from:manager });
      await this.pool.addPool(this.collectible2.address, '1', false, 0, { from:manager });

      await expectRevert(
        this.pool.setPoolActivation(0, '1', this.collectible.address, '1', false, 0, { from:bob }),
        "RaraCollectibleMining: must have MANAGER role to setPoolActivation"
      );
      await expectRevert(
        this.pool.setPoolActivation(1, '0', this.collectible2.address, '10', true, 10, { from:carol }),
        "RaraCollectibleMining: must have MANAGER role to setPoolActivation"
      );
      await expectRevert(
        this.pool.setPoolActivation(2, '10', this.collectible.address, '2', true, 2, { from:minter }),
        "RaraCollectibleMining: must have MANAGER role to setPoolActivation"
      );
    });

    it('(internal) setPoolActivation updates internal state', async () => {
      const { pool, collectible, collectible2 } = this;
      await this.pool.addPool(this.collectible.address, '100', false, 0, { from:alice });
      await this.pool.addPool(this.collectible.address, '1000', true, 10, { from:manager });
      await this.pool.addPool(this.collectible2.address, '1', false, 0, { from:manager });

      await pool.setPoolActivation(0, '1', this.collectible.address, '1', false, 0, { from:alice });
      let info = await pool.poolInfo(0);
      assert.equal(info.token, collectible.address);
      assert.equal(info.tokenPower, '1');
      assert.equal(info.stakeIsTyped, false);
      assert.equal(info.stakeTokenType, 0);
      assert.equal(info.activationToken, collectible.address);
      assert.equal(info.activationAmount, '1');
      assert.equal(info.activationIsTyped, false);
      assert.equal(info.activationTokenType, 0);

      await pool.setPoolActivation(1, '0', this.collectible2.address, '10', true, 10, { from:manager });
      info = await pool.poolInfo(1);
      assert.equal(info.token, collectible.address);
      assert.equal(info.tokenPower, '0');
      assert.equal(info.stakeIsTyped, true);
      assert.equal(info.stakeTokenType, 10);
      assert.equal(info.activationToken, collectible2.address);
      assert.equal(info.activationAmount, '10');
      assert.equal(info.activationIsTyped, true);
      assert.equal(info.activationTokenType, 10);

      await pool.setPoolActivation(2, '10', this.collectible.address, '2', true, 2, { from:manager });
      info = await pool.poolInfo(2);
      assert.equal(info.token, collectible2.address);
      assert.equal(info.tokenPower, '10');
      assert.equal(info.stakeIsTyped, false);
      assert.equal(info.stakeTokenType, 0);
      assert.equal(info.activationToken, collectible.address);
      assert.equal(info.activationAmount, '2');
      assert.equal(info.activationIsTyped, true);
      assert.equal(info.activationTokenType, 2);
    });

    it('updatePeriod reverts if not initialized', async () => {
      await expectRevert(
        this.pool.updatePeriod(),
        "RaraCollectibleMining: not initialized"
      );
    });

    it('(internal) initalize starts a new period when called by manager', async () => {
      const { pool, collectible, collectible2 } = this;
      await expectRevert(pool.initialize({ from:bob }), "RaraCollectibleMining: must have MANAGER role to initialize");
      await expectRevert(pool.initialize({ from:minter }), "RaraCollectibleMining: must have MANAGER role to initialize");

      await pool.setPeriod('10070', '555', { from:alice });
      await pool.initialize({ from:alice });
      const initBlockNumber = await web3.eth.getBlockNumber();
      const initBlock = await web3.eth.getBlock(initBlockNumber);
      const initTimestamp = Number(initBlock.timestamp.toString());
      const stepMargin = initTimestamp % 10070;
      const startTimestamp = stepMargin >= 555
        ? initTimestamp - (stepMargin - 555)
        : initTimestamp - (stepMargin + 10070) + 555;

      assert.equal(await pool.periodLength(), '2');
      assert.equal(await pool.currentPeriod(), '1');
      assert.equal(await pool.currentPeriodStartTime(), `${startTimestamp}`);
      let info = await pool.periodInfo(0);
      assert.equal(info.power, '0');
      assert.equal(info.reward, '0');
      assert.equal(info.startBlock, `${initBlockNumber}`);
      assert.equal(info.endBlock, `${initBlockNumber}`);
      assert.equal(info.initTime, `${initTimestamp}`);
      assert.equal(info.startTime, `${startTimestamp - 10070}`);
      assert.equal(info.endTime, `${startTimestamp}`);

      info = await pool.periodInfo(1);
      assert.equal(info.power, '0');
      assert.equal(info.reward, '0');
      assert.equal(info.startBlock, `${initBlockNumber}`);
      assert.equal(info.endBlock, '0');
      assert.equal(info.initTime, `${initTimestamp}`);
      assert.equal(info.startTime, `${startTimestamp}`);
      assert.equal(info.endTime, '0');

      await expectRevert(pool.initialize({ from:bob }), "RaraCollectibleMining: must have MANAGER role to initialize");
      await expectRevert(pool.initialize({ from:manager }), "RaraCollectibleMining: already initialized");
    });

    it('(internal) updatePeriod starts a new period when appropriate', async () => {
      const { pool, collectible, collectible2 } = this;

      const stats = [];
      async function pushStats() {
        const initBlockNumber = await web3.eth.getBlockNumber();
        const initBlock = await web3.eth.getBlock(initBlockNumber);
        const initTimestamp = Number(initBlock.timestamp.toString());
        const stepMargin = initTimestamp % 10070;
        const startTimestamp = stepMargin >= 555
          ? initTimestamp - (stepMargin - 555)
          : initTimestamp - (stepMargin + 10070) + 555;

        stats.push({
          initBlock: initBlockNumber,
          initTime: initTimestamp,
          startTime: startTimestamp,
          endTime: startTimestamp + 10070
        });
      }

      async function checkStats(i) {
        const s = stats[i];
        const n = i + 1 < stats.length ? stats[i+1] : null;
        const info = await pool.periodInfo(i);
        assert.equal(info.power, '0');
        assert.equal(info.reward, '0');
        assert.equal(info.startBlock, `${s.initBlock}`);
        assert.equal(info.endBlock, `${n ? n.initBlock : 0}`);
        assert.equal(info.initTime, `${s.initTime}`);
        assert.equal(info.startTime, `${s.startTime}`);
        assert.equal(info.endTime, `${n ? s.endTime : 0}`);
      }

      await pool.setPeriod('10070', '555', { from:alice });
      await pool.initialize({ from:alice });
      await pushStats();
      await pushStats();
      stats[0].startTime -= 10070;
      stats[0].endTime -= 10070;

      // advance to next period
      await time.increaseTo(stats[1].startTime + 12000);
      await pool.updatePeriod();
      await pushStats();

      // check periods 0, 1 and 2
      assert.equal(await pool.periodLength(), '3');
      assert.equal(await pool.currentPeriod(), '2');
      assert.equal(await pool.currentPeriodStartTime(), `${stats[1].startTime + 10070}`);
      await checkStats(0);
      await checkStats(1);
      await checkStats(2);

      // advance between periods; should not alter anything
      await time.increaseTo(stats[1].startTime + 18000);
      await pool.updatePeriod();
      assert.equal(await pool.periodLength(), '3');
      assert.equal(await pool.currentPeriod(), '2');
      assert.equal(await pool.currentPeriodStartTime(), `${stats[1].startTime + 10070}`);
      await checkStats(0);
      await checkStats(1);
      await checkStats(2);

      // advance to _exactly_ the start of the next period (as best we can...)
      await time.increaseTo(stats[1].startTime + 20140);
      await pool.updatePeriod();
      await pushStats();
      assert.equal(await pool.periodLength(), '4');
      assert.equal(await pool.currentPeriod(), '3');
      assert.equal(await pool.currentPeriodStartTime(), `${stats[1].startTime + 20140}`);
      await checkStats(0);
      await checkStats(1);
      await checkStats(2);
      await checkStats(3);
    });

    context('testing deposit', () => {
      beforeEach(async () => {
        const { pool, collectible, collectible2 } = this;

        await collectible.addTokenType(`Type 0`, `T0`, 0, { from:minter });
        await collectible.addTokenType(`Type 1`, `T1`, 0, { from:minter });
        await collectible.addTokenType(`Type 2`, `T2`, 0, { from:minter });

        await collectible2.addTokenType(`Domino 0`, `D0`, 0, { from:minter });
        await collectible2.addTokenType(`Domino 1`, `D1`, 0, { from:minter });
        await collectible2.addTokenType(`Domino 2`, `D2`, 0, { from:minter });
      });

      it('reverts for invalid pid', async () => {
        await expectRevert(this.pool.deposit(0, alice, [], { from:alice }), "RaraCollectibleMining: invalid pid");

        await this.pool.addPool(this.collectible.address, '100', false, 0, { from:alice });
        await this.pool.addPool(this.collectible.address, '1000', true, 2, { from:manager });
        await this.pool.addPool(this.collectible2.address, '1', false, 0, { from:manager });

        await expectRevert(this.pool.deposit(3, alice, [], { from:alice }), "RaraCollectibleMining: invalid pid");
      });

      it('reverts for uninitialized contract', async () => {
        await this.pool.addPool(this.collectible.address, '100', false, 0, { from:alice });
        await expectRevert(
          this.pool.deposit(0, alice, [], { from:alice }),
          "RaraCollectibleMining: not initialized"
        );
      });

      it('reverts for invalid token type', async () => {
        const { pool, collectible } = this;
        await pool.addPool(collectible.address, '100', false, 0, { from:alice });
        await pool.addPool(collectible.address, '1000', true, 2, { from:manager });

        await pool.initialize({ from:manager });

        await collectible.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await collectible.setApprovalForAll(this.pool.address, true, { from:bob });

        await expectRevert(
          this.pool.deposit(1, bob, [0], { from:bob }),
          "RaraCollectibleMining: invalid tokenType"
        );

        await expectRevert(
          this.pool.deposit(1, bob, [1], { from:bob }),
          "RaraCollectibleMining: invalid tokenType"
        );

        await expectRevert(
          this.pool.deposit(1, bob, [3], { from:bob }),
          "RaraCollectibleMining: invalid tokenType"
        );

        await expectRevert(
          this.pool.deposit(1, bob, [4, 0, 5], { from:bob }),
          "RaraCollectibleMining: invalid tokenType"
        );
      });

      context('with functioning setup', () => {
        beforeEach(async () => {
          const { pool, collectible, collectible2 } = this;
          await pool.addPool(collectible.address, '100', false, 0, { from:alice });
          await pool.addPool(collectible.address, '1000', true, 2, { from:manager });
          await pool.addPool(collectible2.address, '1', false, 0, { from:manager });

          await pool.setPeriod('10070', '555', { from:alice });
          await pool.initialize({ from:manager });

          const initBlockNumber = await web3.eth.getBlockNumber();
          const initBlock = await web3.eth.getBlock(initBlockNumber);
          const initTimestamp = Number(initBlock.timestamp.toString());
          const stepMargin = initTimestamp % 10070;
          const startTimestamp = stepMargin >= 555
            ? initTimestamp - (stepMargin - 555)
            : initTimestamp - (stepMargin + 10070) + 555;

          await time.increaseTo(startTimestamp + 12000);

          await collectible.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
          await collectible.setApprovalForAll(this.pool.address, true, { from:bob });

          await collectible2.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
          await collectible2.setApprovalForAll(this.pool.address, true, { from:bob });
        });

        it('deposited tokens are transferred', async () => {
          const { pool, collectible, collectible2 } = this;

          await pool.updatePeriod();

          await pool.deposit(0, carol, [0, 2, 4], { from:bob });
          assert.equal(await collectible.ownerOf(0), pool.address);
          assert.equal(await collectible.ownerOf(1), bob);
          assert.equal(await collectible.ownerOf(2), pool.address);
          assert.equal(await collectible.ownerOf(3), bob);
          assert.equal(await collectible.ownerOf(4), pool.address);
          assert.equal(await collectible.ownerOf(5), bob);

          await pool.deposit(1, edith, [5], { from:bob });
          assert.equal(await collectible.ownerOf(0), pool.address);
          assert.equal(await collectible.ownerOf(1), bob);
          assert.equal(await collectible.ownerOf(2), pool.address);
          assert.equal(await collectible.ownerOf(3), bob);
          assert.equal(await collectible.ownerOf(4), pool.address);
          assert.equal(await collectible.ownerOf(5), pool.address);

          await pool.deposit(2, dave, [1, 2, 3], { from:bob });
          assert.equal(await collectible2.ownerOf(0), bob);
          assert.equal(await collectible2.ownerOf(1), pool.address);
          assert.equal(await collectible2.ownerOf(2), pool.address);
          assert.equal(await collectible2.ownerOf(3), pool.address);
          assert.equal(await collectible2.ownerOf(4), bob);
          assert.equal(await collectible2.ownerOf(5), bob);
        });

        it('deposited tokens must be owned by caller', async () => {
          const { pool, collectible, collectible2 } = this;

          await pool.updatePeriod();

          await expectRevert.unspecified(pool.deposit(0, bob, [0, 2, 4], { from:carol }));
          await expectRevert.unspecified(pool.deposit(1, bob, [5], { from:edith }));
          await expectRevert.unspecified(pool.deposit(2, bob, [1, 2, 3], { from:dave }));
        });

        it('deposited tokens must match pool type (if any)', async () => {
          const { pool, collectible, collectible2 } = this;

          await pool.updatePeriod();
          await expectRevert(pool.deposit(1, edith, [3], { from:bob }), "RaraCollectibleMining: invalid tokenType");
        });

        it('deposited tokens update poolUserTokenIndex', async () => {
          const { pool, collectible, collectible2 } = this;

          await pool.updatePeriod();

          await pool.deposit(0, carol, [0, 2, 4], { from:bob });
          await pool.deposit(1, edith, [5], { from:bob });
          await pool.deposit(2, dave, [1, 2, 3], { from:bob });

          assert.equal(await pool.poolUserTokenCount(0, bob), '0');
          assert.equal(await pool.poolUserTokenCount(0, carol), '3');
          assert.equal(await pool.poolUserTokenCount(0, dave), '0');
          assert.equal(await pool.poolUserTokenCount(0, edith), '0');

          assert.equal(await pool.poolUserTokenCount(1, bob), '0');
          assert.equal(await pool.poolUserTokenCount(1, carol), '0');
          assert.equal(await pool.poolUserTokenCount(1, dave), '0');
          assert.equal(await pool.poolUserTokenCount(1, edith), '1');

          assert.equal(await pool.poolUserTokenCount(2, bob), '0');
          assert.equal(await pool.poolUserTokenCount(2, carol), '0');
          assert.equal(await pool.poolUserTokenCount(2, dave), '3');
          assert.equal(await pool.poolUserTokenCount(2, edith), '0');

          assert.equal(await pool.poolUserTokenIndex(0, carol, 0), '0');
          assert.equal(await pool.poolUserTokenIndex(0, carol, 1), '2');
          assert.equal(await pool.poolUserTokenIndex(0, carol, 2), '4');

          assert.equal(await pool.poolUserTokenIndex(1, edith, 0), '5');

          assert.equal(await pool.poolUserTokenIndex(2, dave, 0), '1');
          assert.equal(await pool.poolUserTokenIndex(2, dave, 1), '2');
          assert.equal(await pool.poolUserTokenIndex(2, dave, 2), '3');
        });

        it('(internal) deposited tokens update tokenInfo', async () => {
          const { pool, collectible, collectible2 } = this;

          const registry = await MockVotingRegistry.new();
          await pool.setRegistry(registry.address, { from:manager });

          await registry.set(carol, 100, 1);  // x2
          await registry.set(edith, 200, 3);  // x6
          await registry.set(dave, 300, 10);  // x20

          await pool.updatePeriod();

          await pool.deposit(0, carol, [0, 2, 4], { from:bob });
          await pool.deposit(1, edith, [5], { from:bob });
          await pool.deposit(2, dave, [1, 2, 3], { from:bob });

          async function checkTokenInfo(opts) {
            const { address, tokenId, poolId, owner, ownerTokenIndex, staked, activatedPower, activationPeriod } = opts;
            const info = await pool.tokenInfo(address, tokenId);
            assert.equal(info.poolId, `${poolId}`);
            assert.equal(info.owner, owner);
            assert.equal(info.ownerTokenIndex, `${ownerTokenIndex}`);
            assert.equal(info.staked, staked);
            assert.equal(info.activatedPower, `${activatedPower}`);
            assert.equal(info.activationPeriod, `${activationPeriod}`);
          }

          const poolInfo = [
            { poolId: 0, owner: carol, staked:true, activatedPower: 200, activationPeriod: 2 },
            { poolId: 1, owner: edith, staked:true, activatedPower: 6000, activationPeriod: 2 },
            { poolId: 2, owner: dave, staked:true, activatedPower: 20, activationPeriod: 2 }
          ]

          await checkTokenInfo({ address:collectible.address, tokenId:0, ownerTokenIndex:0, ...poolInfo[0] });
          await checkTokenInfo({ address:collectible.address, tokenId:2, ownerTokenIndex:1, ...poolInfo[0] });
          await checkTokenInfo({ address:collectible.address, tokenId:4, ownerTokenIndex:2, ...poolInfo[0] });
          await checkTokenInfo({ address:collectible.address, tokenId:5, ownerTokenIndex:0, ...poolInfo[1] });
          await checkTokenInfo({ address:collectible2.address, tokenId:1, ownerTokenIndex:0, ...poolInfo[2] });
          await checkTokenInfo({ address:collectible2.address, tokenId:2, ownerTokenIndex:1, ...poolInfo[2] });
          await checkTokenInfo({ address:collectible2.address, tokenId:3, ownerTokenIndex:2, ...poolInfo[2] });
        });

        it('(internal) deposited tokens update userInfo', async () => {
          const { pool, collectible, collectible2 } = this;

          const registry = await MockVotingRegistry.new();
          await pool.setRegistry(registry.address, { from:manager });

          await registry.set(carol, 100, 1);  // x2
          await registry.set(edith, 200, 3);  // x6
          await registry.set(dave, 300, 10);  // x20

          await pool.updatePeriod();

          await pool.deposit(0, carol, [0, 2, 4], { from:bob });
          await pool.deposit(1, edith, [5], { from:bob });
          await pool.deposit(2, dave, [1, 2, 3], { from:bob });

          async function checkUserInfo(address, power) {
            const info = await pool.userInfo(address);
            assert.equal(info.activatedPower, `${power}`);
            assert.equal(info.activationPeriod, '2');
            assert.equal(info.accumulatedRewardPrec, '0');
            assert.equal(info.harvestedReward, '0');
          }

          await checkUserInfo(carol, 600);
          await checkUserInfo(edith, 6000);
          await checkUserInfo(dave, 60);
        });
      });
    });

    context('testing withdraw', () => {
      beforeEach(async () => {
        const { pool, collectible, collectible2 } = this;

        await collectible.addTokenType(`Type 0`, `T0`, 0, { from:minter });
        await collectible.addTokenType(`Type 1`, `T1`, 0, { from:minter });
        await collectible.addTokenType(`Type 2`, `T2`, 0, { from:minter });

        await collectible2.addTokenType(`Domino 0`, `D0`, 0, { from:minter });
        await collectible2.addTokenType(`Domino 1`, `D1`, 0, { from:minter });
        await collectible2.addTokenType(`Domino 2`, `D2`, 0, { from:minter });

        await pool.addPool(collectible.address, '100', false, 0, { from:alice });
        await pool.addPool(collectible.address, '1000', true, 2, { from:manager });
        await pool.addPool(collectible2.address, '1', false, 0, { from:manager });
        await pool.addPool(collectible2.address, '2', false, 0, { from:manager });

        await pool.setPeriod('10070', '555', { from:alice });
        await pool.initialize({ from:manager });

        const initBlockNumber = await web3.eth.getBlockNumber();
        const initBlock = await web3.eth.getBlock(initBlockNumber);
        const initTimestamp = Number(initBlock.timestamp.toString());
        const stepMargin = initTimestamp % 10070;
        const startTimestamp = stepMargin >= 555
          ? initTimestamp - (stepMargin - 555)
          : initTimestamp - (stepMargin + 10070) + 555;

        await time.increaseTo(startTimestamp + 12000);

        await collectible.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await collectible.setApprovalForAll(this.pool.address, true, { from:bob });

        await collectible2.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await collectible2.setApprovalForAll(this.pool.address, true, { from:bob });

        await pool.updatePeriod();

        await pool.deposit(0, carol, [0, 2, 4], { from:bob });
        await pool.deposit(1, edith, [5], { from:bob });
        await pool.deposit(2, dave, [1, 2, 3], { from:bob });
      });

      it('withdraw tokens are transferred out', async () => {
        const { pool, collectible, collectible2 } = this;

        await pool.withdraw(0, alice, [0, 4], { from:carol })
        assert.equal(await collectible.ownerOf(0), alice);
        assert.equal(await collectible.ownerOf(1), bob);
        assert.equal(await collectible.ownerOf(2), pool.address);
        assert.equal(await collectible.ownerOf(3), bob);
        assert.equal(await collectible.ownerOf(4), alice);
        assert.equal(await collectible.ownerOf(5), pool.address);

        await pool.withdraw(1, alice, [5], { from:edith });
        assert.equal(await collectible.ownerOf(0), alice);
        assert.equal(await collectible.ownerOf(1), bob);
        assert.equal(await collectible.ownerOf(2), pool.address);
        assert.equal(await collectible.ownerOf(3), bob);
        assert.equal(await collectible.ownerOf(4), alice);
        assert.equal(await collectible.ownerOf(5), alice);

        await pool.withdraw(2, alice, [1, 2, 3], { from:dave });
        assert.equal(await collectible2.ownerOf(0), bob);
        assert.equal(await collectible2.ownerOf(1), alice);
        assert.equal(await collectible2.ownerOf(2), alice);
        assert.equal(await collectible2.ownerOf(3), alice);
        assert.equal(await collectible2.ownerOf(4), bob);
        assert.equal(await collectible2.ownerOf(5), bob);
      });

      it('withdraw reverts unstaked token', async () => {
        const { pool, collectible, collectible2 } = this;

        await expectRevert(
          pool.withdraw(0, alice, [0, 3], { from:carol }),
          "RaraCollectibleMining: token not staked"
        );

        await expectRevert(
          pool.withdraw(1, alice, [1], { from:edith }),
          "RaraCollectibleMining: token not staked"
        );

        await expectRevert(
          pool.withdraw(2, alice, [0, 1, 2, 3], { from:dave }),
          "RaraCollectibleMining: token not staked"
        );
      });

      it('withdraw reverts for wrong pid', async () => {
        const { pool, collectible, collectible2 } = this;

        await expectRevert(
          pool.withdraw(1, alice, [0, 4], { from:carol }),
          "RaraCollectibleMining: token not in pool"
        );

        await expectRevert(
          pool.withdraw(0, alice, [5], { from:edith }),
          "RaraCollectibleMining: token not in pool"
        );

        await expectRevert(
          pool.withdraw(3, alice, [1, 2, 3], { from:dave }),
          "RaraCollectibleMining: token not in pool"
        );
      });

      it('withdraw reverts token owned by another', async () => {
        const { pool, collectible, collectible2 } = this;

        await expectRevert(
          pool.withdraw(0, alice, [0, 4], { from:edith }),
          "RaraCollectibleMining: token not staked by caller"
        );

        await expectRevert(
          pool.withdraw(1, alice, [5], { from:dave }),
          "RaraCollectibleMining: token not staked by caller"
        );

        await expectRevert(
          pool.withdraw(2, alice, [1, 2, 3], { from:bob }),
          "RaraCollectibleMining: token not staked by caller"
        );
      });

      it('withdrawn tokens update poolUserTokenIndex', async () => {
        const { pool, collectible, collectible2 } = this;

        await pool.withdraw(0, alice, [0, 4], { from:carol });
        await pool.withdraw(1, alice, [5], { from:edith });

        assert.equal(await pool.poolUserTokenCount(0, alice), '0');
        assert.equal(await pool.poolUserTokenCount(0, bob), '0');
        assert.equal(await pool.poolUserTokenCount(0, carol), '1');
        assert.equal(await pool.poolUserTokenCount(0, dave), '0');
        assert.equal(await pool.poolUserTokenCount(0, edith), '0');

        assert.equal(await pool.poolUserTokenCount(1, alice), '0');
        assert.equal(await pool.poolUserTokenCount(1, bob), '0');
        assert.equal(await pool.poolUserTokenCount(1, carol), '0');
        assert.equal(await pool.poolUserTokenCount(1, dave), '0');
        assert.equal(await pool.poolUserTokenCount(1, edith), '0');

        assert.equal(await pool.poolUserTokenCount(2, alice), '0');
        assert.equal(await pool.poolUserTokenCount(2, bob), '0');
        assert.equal(await pool.poolUserTokenCount(2, carol), '0');
        assert.equal(await pool.poolUserTokenCount(2, dave), '3');
        assert.equal(await pool.poolUserTokenCount(2, edith), '0');

        assert.equal(await pool.poolUserTokenIndex(0, carol, 0), '2');

        await pool.withdraw(2, alice, [1], { from:dave });
        assert.equal(await pool.poolUserTokenCount(2, dave), '2');
        assert.equal(await pool.poolUserTokenIndex(2, dave, 0), '3');
        assert.equal(await pool.poolUserTokenIndex(2, dave, 1), '2');

        await pool.withdraw(2, alice, [2], { from:dave });
        assert.equal(await pool.poolUserTokenCount(2, dave), '1');
        assert.equal(await pool.poolUserTokenIndex(2, dave, 0), '3');

        await pool.withdraw(2, alice, [3], { from:dave });
        assert.equal(await pool.poolUserTokenCount(2, dave), '0');
      });

      it('(internal) withdrawn tokens update tokenInfo', async () => {
        const { pool, collectible, collectible2 } = this;

        const registry = await MockVotingRegistry.new();
        await pool.setRegistry(registry.address, { from:manager });

        // should have no effect; values already assessed
        await registry.set(carol, 100, 1);  // x2
        await registry.set(edith, 200, 3);  // x6
        await registry.set(dave, 300, 10);  // x20

        await pool.withdraw(0, alice, [0, 4], { from:carol });
        await pool.withdraw(1, alice, [5], { from:edith });
        await pool.withdraw(2, alice, [1], { from:dave });

        async function checkTokenInfo(opts) {
          const { address, tokenId, poolId, owner, ownerTokenIndex, staked, activatedPower, activationPeriod } = opts;
          const info = await pool.tokenInfo(address, tokenId);
          assert.equal(info.poolId, `${poolId}`);
          assert.equal(info.owner, owner);
          assert.equal(info.ownerTokenIndex, `${ownerTokenIndex}`);
          assert.equal(info.staked, staked);
          assert.equal(info.activatedPower, `${activatedPower}`);
          assert.equal(info.activationPeriod, `${activationPeriod}`);
        }

        const poolInfo = [
          { poolId: 0, owner: carol, staked:true, activatedPower: 100, activationPeriod: 2 },
          { poolId: 1, owner: edith, staked:true, activatedPower: 1000, activationPeriod: 2 },
          { poolId: 2, owner: dave, staked:true, activatedPower: 1, activationPeriod: 2 }
        ]

        const unpoolInfo = [
          { poolId: 0, owner: ZERO_ADDRESS, staked:true, activatedPower: 0, activationPeriod: 0 },
          { poolId: 1, owner: ZERO_ADDRESS, staked:true, activatedPower: 0, activationPeriod: 0 },
          { poolId: 2, owner: ZERO_ADDRESS, staked:true, activatedPower: 0, activationPeriod: 0 }
        ]

        await checkTokenInfo({ address:collectible.address, tokenId:2, ownerTokenIndex:0, ...poolInfo[0] });
        await checkTokenInfo({ address:collectible.address, tokenId:0, ownerTokenIndex:0, ...unpoolInfo[0] });
        await checkTokenInfo({ address:collectible.address, tokenId:4, ownerTokenIndex:0, ...unpoolInfo[0] });
        await checkTokenInfo({ address:collectible.address, tokenId:5, ownerTokenIndex:0, ...unpoolInfo[1] });
        await checkTokenInfo({ address:collectible2.address, tokenId:1, ownerTokenIndex:0, ...unpoolInfo[2] });
        await checkTokenInfo({ address:collectible2.address, tokenId:2, ownerTokenIndex:1, ...poolInfo[2] });
        await checkTokenInfo({ address:collectible2.address, tokenId:3, ownerTokenIndex:0, ...poolInfo[2] });
      });

      it('(internal) withdrawn tokens update userInfo', async () => {
        const { pool, collectible, collectible2 } = this;

        const registry = await MockVotingRegistry.new();
        await pool.setRegistry(registry.address, { from:manager });

        // should have no effect; values already assessed
        await registry.set(carol, 100, 1);  // x2
        await registry.set(edith, 200, 3);  // x6
        await registry.set(dave, 300, 10);  // x20

        async function checkUserInfo(address, power) {
          const info = await pool.userInfo(address);
          assert.equal(info.activatedPower, `${power}`);
          assert.equal(info.activationPeriod, '2');
          assert.equal(info.accumulatedRewardPrec, '0');
          assert.equal(info.harvestedReward, '0');
        }

        await checkUserInfo(carol, 300);
        await checkUserInfo(edith, 1000);
        await checkUserInfo(dave, 3);
      });

      it('deposited after withdrawal tokens update poolUserTokenIndex', async () => {
        const { pool, collectible, collectible2 } = this;

        await collectible.setApprovalForAll(this.pool.address, true, { from:carol });
        await collectible.setApprovalForAll(this.pool.address, true, { from:edith });
        await collectible2.setApprovalForAll(this.pool.address, true, { from:dave });

        await pool.withdraw(0, carol, [0, 4], { from:carol });
        await pool.withdraw(1, edith, [5], { from:edith });
        await pool.withdraw(2, dave, [1, 2], { from:dave });

        await pool.deposit(0, carol, [0, 4], { from:carol });
        await pool.deposit(1, edith, [5], { from:edith });
        await pool.deposit(2, dave, [1, 2], { from:dave });

        assert.equal(await pool.poolUserTokenCount(0, bob), '0');
        assert.equal(await pool.poolUserTokenCount(0, carol), '3');
        assert.equal(await pool.poolUserTokenCount(0, dave), '0');
        assert.equal(await pool.poolUserTokenCount(0, edith), '0');

        assert.equal(await pool.poolUserTokenCount(1, bob), '0');
        assert.equal(await pool.poolUserTokenCount(1, carol), '0');
        assert.equal(await pool.poolUserTokenCount(1, dave), '0');
        assert.equal(await pool.poolUserTokenCount(1, edith), '1');

        assert.equal(await pool.poolUserTokenCount(2, bob), '0');
        assert.equal(await pool.poolUserTokenCount(2, carol), '0');
        assert.equal(await pool.poolUserTokenCount(2, dave), '3');
        assert.equal(await pool.poolUserTokenCount(2, edith), '0');

        assert.equal(await pool.poolUserTokenIndex(0, carol, 0), '2');
        assert.equal(await pool.poolUserTokenIndex(0, carol, 1), '0');
        assert.equal(await pool.poolUserTokenIndex(0, carol, 2), '4');

        assert.equal(await pool.poolUserTokenIndex(1, edith, 0), '5');

        assert.equal(await pool.poolUserTokenIndex(2, dave, 0), '3');
        assert.equal(await pool.poolUserTokenIndex(2, dave, 1), '1');
        assert.equal(await pool.poolUserTokenIndex(2, dave, 2), '2');
      });

      it('(internal) deposited after withdrawal tokens update tokenInfo', async () => {
        const { pool, collectible, collectible2 } = this;

        await collectible.setApprovalForAll(this.pool.address, true, { from:carol });
        await collectible.setApprovalForAll(this.pool.address, true, { from:edith });
        await collectible2.setApprovalForAll(this.pool.address, true, { from:dave });

        await pool.withdraw(0, carol, [0, 4], { from:carol });
        await pool.withdraw(1, edith, [5], { from:edith });
        await pool.withdraw(2, dave, [1, 2], { from:dave });

        await pool.deposit(0, carol, [0, 4], { from:carol });
        await pool.deposit(1, edith, [5], { from:edith });
        await pool.deposit(2, dave, [1, 2], { from:dave });

        async function checkTokenInfo(opts) {
          const { address, tokenId, poolId, owner, ownerTokenIndex, staked, activatedPower, activationPeriod } = opts;
          const info = await pool.tokenInfo(address, tokenId);
          assert.equal(info.poolId, `${poolId}`);
          assert.equal(info.owner, owner);
          assert.equal(info.ownerTokenIndex, `${ownerTokenIndex}`);
          assert.equal(info.staked, staked);
          assert.equal(info.activatedPower, `${activatedPower}`);
          assert.equal(info.activationPeriod, `${activationPeriod}`);
        }

        const poolInfo = [
          { poolId: 0, owner: carol, staked:true, activatedPower: 100, activationPeriod: 2 },
          { poolId: 1, owner: edith, staked:true, activatedPower: 1000, activationPeriod: 2 },
          { poolId: 2, owner: dave, staked:true, activatedPower: 1, activationPeriod: 2 }
        ]

        const repoolInfo = [
          { poolId: 0, owner: carol, staked:true, activatedPower: 0, activationPeriod: 0 },
          { poolId: 1, owner: edith, staked:true, activatedPower: 0, activationPeriod: 0 },
          { poolId: 2, owner: dave, staked:true, activatedPower: 0, activationPeriod: 0 }
        ]

        await checkTokenInfo({ address:collectible.address, tokenId:2, ownerTokenIndex:0, ...poolInfo[0] });
        await checkTokenInfo({ address:collectible.address, tokenId:0, ownerTokenIndex:1, ...repoolInfo[0] });
        await checkTokenInfo({ address:collectible.address, tokenId:4, ownerTokenIndex:2, ...repoolInfo[0] });
        await checkTokenInfo({ address:collectible.address, tokenId:5, ownerTokenIndex:0, ...repoolInfo[1] });
        await checkTokenInfo({ address:collectible2.address, tokenId:3, ownerTokenIndex:0, ...poolInfo[2] });
        await checkTokenInfo({ address:collectible2.address, tokenId:1, ownerTokenIndex:1, ...repoolInfo[2] });
        await checkTokenInfo({ address:collectible2.address, tokenId:2, ownerTokenIndex:2, ...repoolInfo[2] });
      });

      it('(internal) deposited after withdrawal tokens update userInfo', async () => {
        const { pool, collectible, collectible2 } = this;

        await collectible.setApprovalForAll(this.pool.address, true, { from:carol });
        await collectible.setApprovalForAll(this.pool.address, true, { from:edith });
        await collectible2.setApprovalForAll(this.pool.address, true, { from:dave });

        await pool.withdraw(0, carol, [0, 4], { from:carol });
        await pool.withdraw(1, edith, [5], { from:edith });
        await pool.withdraw(2, dave, [1, 2], { from:dave });

        await pool.deposit(0, carol, [0, 4], { from:carol });
        await pool.deposit(1, edith, [5], { from:edith });
        await pool.deposit(2, dave, [1, 2], { from:dave });

        async function checkUserInfo(address, power) {
          const info = await pool.userInfo(address);
          assert.equal(info.activatedPower, `${power}`);
          assert.equal(info.activationPeriod, '2');
          assert.equal(info.accumulatedRewardPrec, '0');
          assert.equal(info.harvestedReward, '0');
        }

        await checkUserInfo(carol, 100);
        await checkUserInfo(edith, 0);
        await checkUserInfo(dave, 1);
      });
    });

    context('testing withdraw with registry levels', () => {
      beforeEach(async () => {
        const { pool, collectible, collectible2 } = this;
        const registry = await MockVotingRegistry.new();
        await pool.setRegistry(registry.address, { from:manager });

        await registry.set(carol, 100, 1);  // x2
        await registry.set(edith, 200, 2);  // x4
        await registry.set(dave, 100, 5);  // x10

        await collectible.addTokenType(`Type 0`, `T0`, 0, { from:minter });
        await collectible.addTokenType(`Type 1`, `T1`, 0, { from:minter });
        await collectible.addTokenType(`Type 2`, `T2`, 0, { from:minter });

        await collectible2.addTokenType(`Domino 0`, `D0`, 0, { from:minter });
        await collectible2.addTokenType(`Domino 1`, `D1`, 0, { from:minter });
        await collectible2.addTokenType(`Domino 2`, `D2`, 0, { from:minter });

        await pool.addPool(collectible.address, '100', false, 0, { from:alice });
        await pool.addPool(collectible.address, '1000', true, 2, { from:manager });
        await pool.addPool(collectible2.address, '1', false, 0, { from:manager });
        await pool.addPool(collectible2.address, '2', false, 0, { from:manager });

        await pool.setPeriod('10070', '555', { from:alice });
        await pool.initialize({ from:manager });

        const initBlockNumber = await web3.eth.getBlockNumber();
        const initBlock = await web3.eth.getBlock(initBlockNumber);
        const initTimestamp = Number(initBlock.timestamp.toString());
        const stepMargin = initTimestamp % 10070;
        const startTimestamp = stepMargin >= 555
          ? initTimestamp - (stepMargin - 555)
          : initTimestamp - (stepMargin + 10070) + 555;

        await time.increaseTo(startTimestamp + 12000);

        await collectible.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await collectible.setApprovalForAll(this.pool.address, true, { from:bob });

        await collectible2.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await collectible2.setApprovalForAll(this.pool.address, true, { from:bob });

        await pool.updatePeriod();

        await pool.deposit(0, carol, [0, 2, 4], { from:bob });
        await pool.deposit(1, edith, [5], { from:bob });
        await pool.deposit(2, dave, [1, 2, 3], { from:bob });
      });

      it('withdraw tokens are transferred out', async () => {
        const { pool, collectible, collectible2 } = this;

        await pool.withdraw(0, alice, [0, 4], { from:carol })
        assert.equal(await collectible.ownerOf(0), alice);
        assert.equal(await collectible.ownerOf(1), bob);
        assert.equal(await collectible.ownerOf(2), pool.address);
        assert.equal(await collectible.ownerOf(3), bob);
        assert.equal(await collectible.ownerOf(4), alice);
        assert.equal(await collectible.ownerOf(5), pool.address);

        await pool.withdraw(1, alice, [5], { from:edith });
        assert.equal(await collectible.ownerOf(0), alice);
        assert.equal(await collectible.ownerOf(1), bob);
        assert.equal(await collectible.ownerOf(2), pool.address);
        assert.equal(await collectible.ownerOf(3), bob);
        assert.equal(await collectible.ownerOf(4), alice);
        assert.equal(await collectible.ownerOf(5), alice);

        await pool.withdraw(2, alice, [1, 2, 3], { from:dave });
        assert.equal(await collectible2.ownerOf(0), bob);
        assert.equal(await collectible2.ownerOf(1), alice);
        assert.equal(await collectible2.ownerOf(2), alice);
        assert.equal(await collectible2.ownerOf(3), alice);
        assert.equal(await collectible2.ownerOf(4), bob);
        assert.equal(await collectible2.ownerOf(5), bob);
      });

      it('withdraw reverts unstaked token', async () => {
        const { pool, collectible, collectible2 } = this;

        await expectRevert(
          pool.withdraw(0, alice, [0, 3], { from:carol }),
          "RaraCollectibleMining: token not staked"
        );

        await expectRevert(
          pool.withdraw(1, alice, [1], { from:edith }),
          "RaraCollectibleMining: token not staked"
        );

        await expectRevert(
          pool.withdraw(2, alice, [0, 1, 2, 3], { from:dave }),
          "RaraCollectibleMining: token not staked"
        );
      });

      it('withdraw reverts for wrong pid', async () => {
        const { pool, collectible, collectible2 } = this;

        await expectRevert(
          pool.withdraw(1, alice, [0, 4], { from:carol }),
          "RaraCollectibleMining: token not in pool"
        );

        await expectRevert(
          pool.withdraw(0, alice, [5], { from:edith }),
          "RaraCollectibleMining: token not in pool"
        );

        await expectRevert(
          pool.withdraw(3, alice, [1, 2, 3], { from:dave }),
          "RaraCollectibleMining: token not in pool"
        );
      });

      it('withdraw reverts token owned by another', async () => {
        const { pool, collectible, collectible2 } = this;

        await expectRevert(
          pool.withdraw(0, alice, [0, 4], { from:edith }),
          "RaraCollectibleMining: token not staked by caller"
        );

        await expectRevert(
          pool.withdraw(1, alice, [5], { from:dave }),
          "RaraCollectibleMining: token not staked by caller"
        );

        await expectRevert(
          pool.withdraw(2, alice, [1, 2, 3], { from:bob }),
          "RaraCollectibleMining: token not staked by caller"
        );
      });

      it('withdrawn tokens update poolUserTokenIndex', async () => {
        const { pool, collectible, collectible2 } = this;

        await pool.withdraw(0, alice, [0, 4], { from:carol });
        await pool.withdraw(1, alice, [5], { from:edith });

        assert.equal(await pool.poolUserTokenCount(0, alice), '0');
        assert.equal(await pool.poolUserTokenCount(0, bob), '0');
        assert.equal(await pool.poolUserTokenCount(0, carol), '1');
        assert.equal(await pool.poolUserTokenCount(0, dave), '0');
        assert.equal(await pool.poolUserTokenCount(0, edith), '0');

        assert.equal(await pool.poolUserTokenCount(1, alice), '0');
        assert.equal(await pool.poolUserTokenCount(1, bob), '0');
        assert.equal(await pool.poolUserTokenCount(1, carol), '0');
        assert.equal(await pool.poolUserTokenCount(1, dave), '0');
        assert.equal(await pool.poolUserTokenCount(1, edith), '0');

        assert.equal(await pool.poolUserTokenCount(2, alice), '0');
        assert.equal(await pool.poolUserTokenCount(2, bob), '0');
        assert.equal(await pool.poolUserTokenCount(2, carol), '0');
        assert.equal(await pool.poolUserTokenCount(2, dave), '3');
        assert.equal(await pool.poolUserTokenCount(2, edith), '0');

        assert.equal(await pool.poolUserTokenIndex(0, carol, 0), '2');

        await pool.withdraw(2, alice, [1], { from:dave });
        assert.equal(await pool.poolUserTokenCount(2, dave), '2');
        assert.equal(await pool.poolUserTokenIndex(2, dave, 0), '3');
        assert.equal(await pool.poolUserTokenIndex(2, dave, 1), '2');

        await pool.withdraw(2, alice, [2], { from:dave });
        assert.equal(await pool.poolUserTokenCount(2, dave), '1');
        assert.equal(await pool.poolUserTokenIndex(2, dave, 0), '3');

        await pool.withdraw(2, alice, [3], { from:dave });
        assert.equal(await pool.poolUserTokenCount(2, dave), '0');
      });

      it('(internal) withdrawn tokens update tokenInfo', async () => {
        const { pool, collectible, collectible2 } = this;

        const registry = await MockVotingRegistry.at(await pool.registry());

        // should have no effect; values already assessed
        await registry.set(carol, 0, 0);
        await registry.set(edith, 100, 30);
        await registry.set(dave, 700, 9999);

        await pool.withdraw(0, alice, [0, 4], { from:carol });
        await pool.withdraw(1, alice, [5], { from:edith });
        await pool.withdraw(2, alice, [1], { from:dave });

        async function checkTokenInfo(opts) {
          const { address, tokenId, poolId, owner, ownerTokenIndex, staked, activatedPower, activationPeriod } = opts;
          const info = await pool.tokenInfo(address, tokenId);
          assert.equal(info.poolId, `${poolId}`);
          assert.equal(info.owner, owner);
          assert.equal(info.ownerTokenIndex, `${ownerTokenIndex}`);
          assert.equal(info.staked, staked);
          assert.equal(info.activatedPower, `${activatedPower}`);
          assert.equal(info.activationPeriod, `${activationPeriod}`);
        }

        const poolInfo = [
          { poolId: 0, owner: carol, staked:true, activatedPower: 200, activationPeriod: 2 },
          { poolId: 1, owner: edith, staked:true, activatedPower: 4000, activationPeriod: 2 },
          { poolId: 2, owner: dave, staked:true, activatedPower: 10, activationPeriod: 2 }
        ]

        const unpoolInfo = [
          { poolId: 0, owner: ZERO_ADDRESS, staked:true, activatedPower: 0, activationPeriod: 0 },
          { poolId: 1, owner: ZERO_ADDRESS, staked:true, activatedPower: 0, activationPeriod: 0 },
          { poolId: 2, owner: ZERO_ADDRESS, staked:true, activatedPower: 0, activationPeriod: 0 }
        ]

        await checkTokenInfo({ address:collectible.address, tokenId:2, ownerTokenIndex:0, ...poolInfo[0] });
        await checkTokenInfo({ address:collectible.address, tokenId:0, ownerTokenIndex:0, ...unpoolInfo[0] });
        await checkTokenInfo({ address:collectible.address, tokenId:4, ownerTokenIndex:0, ...unpoolInfo[0] });
        await checkTokenInfo({ address:collectible.address, tokenId:5, ownerTokenIndex:0, ...unpoolInfo[1] });
        await checkTokenInfo({ address:collectible2.address, tokenId:1, ownerTokenIndex:0, ...unpoolInfo[2] });
        await checkTokenInfo({ address:collectible2.address, tokenId:2, ownerTokenIndex:1, ...poolInfo[2] });
        await checkTokenInfo({ address:collectible2.address, tokenId:3, ownerTokenIndex:0, ...poolInfo[2] });
      });

      it('(internal) withdrawn tokens update userInfo', async () => {
        const { pool, collectible, collectible2 } = this;

        const registry = await MockVotingRegistry.at(await pool.registry());

        // should have no effect; values already assessed
        await registry.set(carol, 0, 0);
        await registry.set(edith, 100, 30);
        await registry.set(dave, 700, 9999);

        async function checkUserInfo(address, power) {
          const info = await pool.userInfo(address);
          assert.equal(info.activatedPower, `${power}`);
          assert.equal(info.activationPeriod, '2');
          assert.equal(info.accumulatedRewardPrec, '0');
          assert.equal(info.harvestedReward, '0');
        }

        await checkUserInfo(carol, 600);
        await checkUserInfo(edith, 4000);
        await checkUserInfo(dave, 30);

        await pool.withdraw(0, alice, [0, 4], { from:carol });
        await pool.withdraw(1, alice, [5], { from:edith });
        await pool.withdraw(2, alice, [1], { from:dave });

        await checkUserInfo(carol, 200);
        await checkUserInfo(edith, 0);
        await checkUserInfo(dave, 20);
      });

      it('deposited after withdrawal tokens update poolUserTokenIndex', async () => {
        const { pool, collectible, collectible2 } = this;

        await collectible.setApprovalForAll(this.pool.address, true, { from:carol });
        await collectible.setApprovalForAll(this.pool.address, true, { from:edith });
        await collectible2.setApprovalForAll(this.pool.address, true, { from:dave });

        await pool.withdraw(0, carol, [0, 4], { from:carol });
        await pool.withdraw(1, edith, [5], { from:edith });
        await pool.withdraw(2, dave, [1, 2], { from:dave });

        await pool.deposit(0, carol, [0, 4], { from:carol });
        await pool.deposit(1, edith, [5], { from:edith });
        await pool.deposit(2, dave, [1, 2], { from:dave });

        assert.equal(await pool.poolUserTokenCount(0, bob), '0');
        assert.equal(await pool.poolUserTokenCount(0, carol), '3');
        assert.equal(await pool.poolUserTokenCount(0, dave), '0');
        assert.equal(await pool.poolUserTokenCount(0, edith), '0');

        assert.equal(await pool.poolUserTokenCount(1, bob), '0');
        assert.equal(await pool.poolUserTokenCount(1, carol), '0');
        assert.equal(await pool.poolUserTokenCount(1, dave), '0');
        assert.equal(await pool.poolUserTokenCount(1, edith), '1');

        assert.equal(await pool.poolUserTokenCount(2, bob), '0');
        assert.equal(await pool.poolUserTokenCount(2, carol), '0');
        assert.equal(await pool.poolUserTokenCount(2, dave), '3');
        assert.equal(await pool.poolUserTokenCount(2, edith), '0');

        assert.equal(await pool.poolUserTokenIndex(0, carol, 0), '2');
        assert.equal(await pool.poolUserTokenIndex(0, carol, 1), '0');
        assert.equal(await pool.poolUserTokenIndex(0, carol, 2), '4');

        assert.equal(await pool.poolUserTokenIndex(1, edith, 0), '5');

        assert.equal(await pool.poolUserTokenIndex(2, dave, 0), '3');
        assert.equal(await pool.poolUserTokenIndex(2, dave, 1), '1');
        assert.equal(await pool.poolUserTokenIndex(2, dave, 2), '2');
      });

      it('(internal) deposited after withdrawal tokens update tokenInfo', async () => {
        const { pool, collectible, collectible2 } = this;

        await collectible.setApprovalForAll(this.pool.address, true, { from:carol });
        await collectible.setApprovalForAll(this.pool.address, true, { from:edith });
        await collectible2.setApprovalForAll(this.pool.address, true, { from:dave });

        await pool.withdraw(0, carol, [0, 4], { from:carol });
        await pool.withdraw(1, edith, [5], { from:edith });
        await pool.withdraw(2, dave, [1, 2], { from:dave });

        await pool.deposit(0, carol, [0, 4], { from:carol });
        await pool.deposit(1, edith, [5], { from:edith });
        await pool.deposit(2, dave, [1, 2], { from:dave });

        async function checkTokenInfo(opts) {
          const { address, tokenId, poolId, owner, ownerTokenIndex, staked, activatedPower, activationPeriod } = opts;
          const info = await pool.tokenInfo(address, tokenId);
          assert.equal(info.poolId, `${poolId}`);
          assert.equal(info.owner, owner);
          assert.equal(info.ownerTokenIndex, `${ownerTokenIndex}`);
          assert.equal(info.staked, staked);
          assert.equal(info.activatedPower, `${activatedPower}`);
          assert.equal(info.activationPeriod, `${activationPeriod}`);
        }

        const poolInfo = [
          { poolId: 0, owner: carol, staked:true, activatedPower: 200, activationPeriod: 2 },
          { poolId: 1, owner: edith, staked:true, activatedPower: 4000, activationPeriod: 2 },
          { poolId: 2, owner: dave, staked:true, activatedPower: 10, activationPeriod: 2 }
        ]

        const repoolInfo = [
          { poolId: 0, owner: carol, staked:true, activatedPower: 0, activationPeriod: 0 },
          { poolId: 1, owner: edith, staked:true, activatedPower: 0, activationPeriod: 0 },
          { poolId: 2, owner: dave, staked:true, activatedPower: 0, activationPeriod: 0 }
        ]

        await checkTokenInfo({ address:collectible.address, tokenId:2, ownerTokenIndex:0, ...poolInfo[0] });
        await checkTokenInfo({ address:collectible.address, tokenId:0, ownerTokenIndex:1, ...repoolInfo[0] });
        await checkTokenInfo({ address:collectible.address, tokenId:4, ownerTokenIndex:2, ...repoolInfo[0] });
        await checkTokenInfo({ address:collectible.address, tokenId:5, ownerTokenIndex:0, ...repoolInfo[1] });
        await checkTokenInfo({ address:collectible2.address, tokenId:3, ownerTokenIndex:0, ...poolInfo[2] });
        await checkTokenInfo({ address:collectible2.address, tokenId:1, ownerTokenIndex:1, ...repoolInfo[2] });
        await checkTokenInfo({ address:collectible2.address, tokenId:2, ownerTokenIndex:2, ...repoolInfo[2] });
      });

      it('(internal) deposited after withdrawal tokens update userInfo', async () => {
        const { pool, collectible, collectible2 } = this;

        await collectible.setApprovalForAll(this.pool.address, true, { from:carol });
        await collectible.setApprovalForAll(this.pool.address, true, { from:edith });
        await collectible2.setApprovalForAll(this.pool.address, true, { from:dave });

        await pool.withdraw(0, carol, [0, 4], { from:carol });
        await pool.withdraw(1, edith, [5], { from:edith });
        await pool.withdraw(2, dave, [1, 2], { from:dave });

        await pool.deposit(0, carol, [0, 4], { from:carol });
        await pool.deposit(1, edith, [5], { from:edith });
        await pool.deposit(2, dave, [1, 2], { from:dave });

        async function checkUserInfo(address, power) {
          const info = await pool.userInfo(address);
          assert.equal(info.activatedPower, `${power}`);
          assert.equal(info.activationPeriod, '2');
          assert.equal(info.accumulatedRewardPrec, '0');
          assert.equal(info.harvestedReward, '0');
        }

        await checkUserInfo(carol, 200);
        await checkUserInfo(edith, 0);
        await checkUserInfo(dave, 10);
      });
    });

    context('testing activate', () => {
      beforeEach(async () => {
        const { pool, collectible, collectible2, food } = this;

        await collectible.addTokenType(`Type 0`, `T0`, 0, { from:minter });
        await collectible.addTokenType(`Type 1`, `T1`, 0, { from:minter });
        await collectible.addTokenType(`Type 2`, `T2`, 0, { from:minter });

        await collectible2.addTokenType(`Domino 0`, `D0`, 0, { from:minter });
        await collectible2.addTokenType(`Domino 1`, `D1`, 0, { from:minter });
        await collectible2.addTokenType(`Domino 2`, `D2`, 0, { from:minter });

        await food.addTokenType(`Food 0`, `F0`, 0, { from:minter });
        await food.addTokenType(`Food 1`, `F1`, 0, { from:minter });
        await food.addTokenType(`Food 2`, `F2`, 0, { from:minter });

        await pool.addPool(collectible.address, '100', false, 0, { from:alice });
        await pool.addPool(collectible.address, '1000', true, 2, { from:manager });
        await pool.addPool(collectible2.address, '1', false, 0, { from:manager });
        await pool.addPool(collectible2.address, '2', false, 0, { from:manager });

        await pool.setPoolActivation(0, '100', ZERO_ADDRESS, 0, false, 0, { from:alice });
        await pool.setPoolActivation(1, '1000', food.address, 2, true, 0, { from:alice });
        await pool.setPoolActivation(2, '1', food.address, 3, false, 0, { from:alice });
        await pool.setPoolActivation(3, '1', food.address, 3, false, 0, { from:alice });

        await pool.setPeriod('10070', '555', { from:alice });
        await pool.initialize({ from:manager });

        const initBlockNumber = await web3.eth.getBlockNumber();
        const initBlock = await web3.eth.getBlock(initBlockNumber);
        const initTimestamp = Number(initBlock.timestamp.toString());
        const stepMargin = initTimestamp % 10070;
        const startTimestamp = stepMargin >= 555
          ? initTimestamp - (stepMargin - 555)
          : initTimestamp - (stepMargin + 10070) + 555;

        await time.increaseTo(startTimestamp + 12000);

        await collectible.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await collectible.setApprovalForAll(this.pool.address, true, { from:bob });

        await collectible2.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await collectible2.setApprovalForAll(this.pool.address, true, { from:bob });

        await food.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await food.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await food.setApprovalForAll(this.pool.address, true, { from:bob });

        await pool.updatePeriod();

        await pool.deposit(0, carol, [0, 1, 2], { from:bob });
        await pool.deposit(1, edith, [4], { from:bob });
        await pool.deposit(2, dave, [0, 1, 2], { from:bob });
      });

      it('activate reverts for unstaked token', async () => {
        const { pool, collectible, collectible2, food } = this;

        await expectRevert(
          pool.activate(0, [3], [], { from:bob }),
          "RaraCollectibleMining: token not staked"
        );

        await expectRevert(
          pool.activate(1, [5], [4, 5], { from:bob }),
          "RaraCollectibleMining: token not staked"
        );

        await expectRevert(
          pool.activate(2, [3, 4], [0, 1, 2, 3, 4, 5], { from:bob }),
          "RaraCollectibleMining: token not staked"
        );
      });

      it('activate reverts for already activated token', async () => {
        const { pool, collectible, collectible2, food } = this;

        await expectRevert(
          pool.activate(0, [0], [], { from:bob }),
          "RaraCollectibleMining: token already activated"
        );

        await expectRevert(
          pool.activate(1, [4], [4, 5], { from:bob }),
          "RaraCollectibleMining: token already activated"
        );

        await expectRevert(
          pool.activate(2, [0], [0, 1, 2], { from:bob }),
          "RaraCollectibleMining: token already activated"
        );
      });

      it('activate reverts for token not in pool', async () => {
        const { pool, collectible, collectible2, food } = this;

        await expectRevert(
          pool.activate(1, [0], [4, 5], { from:bob }),
          "RaraCollectibleMining: token not in pool"
        );

        await expectRevert(
          pool.activate(0, [4], [], { from:bob }),
          "RaraCollectibleMining: token not in pool"
        );

        await expectRevert(
          pool.activate(3, [1, 2], [0, 1, 2, 3, 4, 5], { from:bob }),
          "RaraCollectibleMining: token not in pool"
        );
      });

      context('with tokens unactivated via withdrawal and redeposit', () => {
        beforeEach(async () => {
          const { pool } = this;

          await pool.withdraw(0, bob, [0, 1, 2], { from:carol });
          await pool.withdraw(1, bob, [4], { from:edith });
          await pool.withdraw(2, bob, [0, 1, 2], { from:dave });

          await pool.deposit(0, carol, [0, 1, 2], { from:bob });
          await pool.deposit(1, edith, [4], { from:bob });
          await pool.deposit(2, dave, [0, 1, 2], { from:bob });
        });

        it('activate reverts for any unstaked token', async () => {
          const { pool, collectible, collectible2, food } = this;

          await expectRevert(
            pool.activate(0, [0, 1, 2, 3], [], { from:bob }),
            "RaraCollectibleMining: token not staked"
          );

          await expectRevert(
            pool.activate(1, [5, 4], [4, 5, 10, 11], { from:bob }),
            "RaraCollectibleMining: token not staked"
          );

          await expectRevert(
            pool.activate(2, [0, 3, 1], [0, 1, 2, 3, 4, 5, 6, 7, 8], { from:bob }),
            "RaraCollectibleMining: token not staked"
          );
        });

        it('activate reverts for any token not in pool', async () => {
          const { pool, collectible, collectible2, food } = this;

          await expectRevert(
            pool.activate(1, [0, 4], [4, 5, 6, 7], { from:bob }),
            "RaraCollectibleMining: token not in pool"
          );

          await expectRevert(
            pool.activate(0, [1, 4, 2], [], { from:bob }),
            "RaraCollectibleMining: token not in pool"
          );

          await expectRevert(
            pool.activate(3, [1, 2], [0, 1, 2, 3, 4, 5], { from:bob }),
            "RaraCollectibleMining: token not in pool"
          );
        });

        it('activate reverts for already manually activated token', async () => {
          const { pool, collectible, collectible2, food } = this;

          await pool.activate(0, [0], [], { from:bob });
          await pool.activate(1, [4], [0, 1], { from:bob });
          await pool.activate(2, [2], [3, 4, 5], { from:bob });

          await expectRevert(
            pool.activate(0, [0, 1, 2], [], { from:bob }),
            "RaraCollectibleMining: token already activated"
          );

          await expectRevert(
            pool.activate(1, [4], [10, 11], { from:bob }),
            "RaraCollectibleMining: token already activated"
          );

          await expectRevert(
            pool.activate(2, [0, 1, 2], [4, 5, 6, 7, 8, 9, 10, 11, 12], { from:bob }),
            "RaraCollectibleMining: token already activated"
          );
        });

        it('activate reverts for incorrect activation token quantity', async () => {
          const { pool, collectible, collectible2, food } = this;

          await expectRevert(
            pool.activate(0, [0], [0], { from:bob }),
            "RaraCollectibleMining: invalid activation token quantity"
          );

          await expectRevert(
            pool.activate(0, [0], [0, 1, 2], { from:bob }),
            "RaraCollectibleMining: invalid activation token quantity"
          );

          await expectRevert(
            pool.activate(1, [4], [4, 5, 10, 11], { from:bob }),
            "RaraCollectibleMining: invalid activation token quantity"
          );

          await expectRevert(
            pool.activate(2, [0], [], { from:bob }),
            "RaraCollectibleMining: invalid activation token quantity"
          );

          await expectRevert(
            pool.activate(2, [0], [0], { from:bob }),
            "RaraCollectibleMining: invalid activation token quantity"
          );

          await expectRevert(
            pool.activate(2, [0], [0, 1], { from:bob }),
            "RaraCollectibleMining: invalid activation token quantity"
          );
        });

        it('activate reverts for invalid activation tokenType', async () => {
          const { pool, collectible, collectible2, food } = this;

          await expectRevert(
            pool.activate(1, [4], [1, 2], { from:bob }),
            "RaraCollectibleMining: invalid tokenType"
          );

          await expectRevert(
            pool.activate(1, [4], [2, 1], { from:bob }),
            "RaraCollectibleMining: invalid tokenType"
          );
        });

        it('activate destroys activation tokens', async () => {
          const { pool, collectible, collectible2, food } = this;

          assert.equal(await collectible.totalSupply(), '6');
          assert.equal(await collectible2.totalSupply(), '6');
          assert.equal(await food.totalSupply(), '12');

          await pool.activate(0, [0, 2], [], { from:bob });
          assert.equal(await collectible.totalSupply(), '6');
          assert.equal(await collectible2.totalSupply(), '6');
          assert.equal(await food.totalSupply(), '12');

          await pool.activate(1, [4], [0, 1], { from:bob });
          assert.equal(await collectible.totalSupply(), '6');
          assert.equal(await collectible2.totalSupply(), '6');
          assert.equal(await food.totalSupply(), '10');
          await expectRevert.unspecified(food.ownerOf(0));
          await expectRevert.unspecified(food.ownerOf(1));
          assert.equal(await food.ownerOf(2), bob);
          assert.equal(await food.ownerOf(3), bob);

          await pool.activate(2, [1, 2], [2, 3, 4, 5, 6, 7], { from:bob });
          assert.equal(await collectible.totalSupply(), '6');
          assert.equal(await collectible2.totalSupply(), '6');
          assert.equal(await food.totalSupply(), '4');
          await expectRevert.unspecified(food.ownerOf(0));
          await expectRevert.unspecified(food.ownerOf(1));
          await expectRevert.unspecified(food.ownerOf(2));
          await expectRevert.unspecified(food.ownerOf(3));
          await expectRevert.unspecified(food.ownerOf(4));
          await expectRevert.unspecified(food.ownerOf(5));
          await expectRevert.unspecified(food.ownerOf(6));
          await expectRevert.unspecified(food.ownerOf(7));
          assert.equal(await food.ownerOf(8), bob);
          assert.equal(await food.ownerOf(9), bob);
        });

        it('(internal) activate updates tokenInfo', async () => {
          const { pool, collectible, collectible2, food } = this;

          await pool.activate(0, [0, 2], [], { from:bob });
          await pool.activate(1, [4], [0, 1], { from:bob });
          await pool.activate(2, [1, 2], [2, 3, 4, 5, 6, 7], { from:bob });

          async function checkTokenInfo(opts) {
            const { address, tokenId, poolId, owner, ownerTokenIndex, staked, activatedPower, activationPeriod } = opts;
            const info = await pool.tokenInfo(address, tokenId);
            assert.equal(info.poolId, `${poolId}`);
            assert.equal(info.owner, owner);
            assert.equal(info.ownerTokenIndex, `${ownerTokenIndex}`);
            assert.equal(info.staked, staked);
            assert.equal(info.activatedPower, `${activatedPower}`);
            assert.equal(info.activationPeriod, `${activationPeriod}`);
          }

          const act = [
            { poolId: 0, owner: carol, staked:true, activatedPower: 100, activationPeriod: 2 },
            { poolId: 1, owner: edith, staked:true, activatedPower: 1000, activationPeriod: 2 },
            { poolId: 2, owner: dave, staked:true, activatedPower: 1, activationPeriod: 2 }
          ];

          const unact = [
            { poolId: 0, owner: carol, staked:true, activatedPower: 0, activationPeriod: 0 },
            { poolId: 1, owner: edith, staked:true, activatedPower: 0, activationPeriod: 0 },
            { poolId: 2, owner: dave, staked:true, activatedPower: 0, activationPeriod: 0 }
          ];

          await checkTokenInfo({ address:collectible.address, tokenId:0, ownerTokenIndex:0, ...act[0] });
          await checkTokenInfo({ address:collectible.address, tokenId:1, ownerTokenIndex:1, ...unact[0] });
          await checkTokenInfo({ address:collectible.address, tokenId:2, ownerTokenIndex:2, ...act[0] });
          await checkTokenInfo({ address:collectible.address, tokenId:4, ownerTokenIndex:0, ...act[1] });
          await checkTokenInfo({ address:collectible2.address, tokenId:0, ownerTokenIndex:0, ...unact[2] });
          await checkTokenInfo({ address:collectible2.address, tokenId:1, ownerTokenIndex:1, ...act[2] });
          await checkTokenInfo({ address:collectible2.address, tokenId:2, ownerTokenIndex:2, ...act[2] });
        });

        it('(internal) activate updates userInfo', async () => {
          const { pool, collectible, collectible2, food } = this;

          async function checkUserInfo(address, period, power) {
            const info = await pool.userInfo(address);
            assert.equal(info.activatedPower, `${power}`);
            assert.equal(info.activationPeriod, `${period}`);
            assert.equal(info.accumulatedRewardPrec, '0');
            assert.equal(info.harvestedReward, '0');
          }

          await checkUserInfo(carol, 2, 0);
          await checkUserInfo(edith, 2, 0);
          await checkUserInfo(dave, 2, 0);

          await pool.activate(0, [0, 2], [], { from:bob });
          await pool.activate(1, [4], [0, 1], { from:bob });
          await pool.activate(2, [1, 2], [2, 3, 4, 5, 6, 7], { from:bob });

          await checkUserInfo(carol, 2, 200);
          await checkUserInfo(edith, 2, 1000);
          await checkUserInfo(dave, 2, 2);
        });
      });

      context('with tokens unactivated via period transition', () => {
        beforeEach(async () => {
          const { pool } = this;
          await nextPeriod(pool);
        });

        it('activate reverts for any unstaked token', async () => {
          const { pool, collectible, collectible2, food } = this;

          await expectRevert(
            pool.activate(0, [0, 1, 2, 3], [], { from:bob }),
            "RaraCollectibleMining: token not staked"
          );

          await expectRevert(
            pool.activate(1, [5, 4], [4, 5, 10, 11], { from:bob }),
            "RaraCollectibleMining: token not staked"
          );

          await expectRevert(
            pool.activate(2, [0, 3, 1], [0, 1, 2, 3, 4, 5, 6, 7, 8], { from:bob }),
            "RaraCollectibleMining: token not staked"
          );
        });

        it('activate reverts for any token not in pool', async () => {
          const { pool, collectible, collectible2, food } = this;

          await expectRevert(
            pool.activate(1, [0, 4], [4, 5, 6, 7], { from:bob }),
            "RaraCollectibleMining: token not in pool"
          );

          await expectRevert(
            pool.activate(0, [1, 4, 2], [], { from:bob }),
            "RaraCollectibleMining: token not in pool"
          );

          await expectRevert(
            pool.activate(3, [1, 2], [0, 1, 2, 3, 4, 5], { from:bob }),
            "RaraCollectibleMining: token not in pool"
          );
        });

        it('activate reverts for already manually activated token', async () => {
          const { pool, collectible, collectible2, food } = this;

          await pool.activate(0, [0], [], { from:bob });
          await pool.activate(1, [4], [0, 1], { from:bob });
          await pool.activate(2, [0], [2, 3, 4], { from:bob });

          await expectRevert(
            pool.activate(0, [0], [], { from:bob }),
            "RaraCollectibleMining: token already activated"
          );

          await expectRevert(
            pool.activate(1, [4], [6, 7], { from:bob }),
            "RaraCollectibleMining: token already activated"
          );

          await expectRevert(
            pool.activate(2, [0], [6, 7, 8], { from:bob }),
            "RaraCollectibleMining: token already activated"
          );
        });

        it('activate reverts for incorrect activation token quantity', async () => {
          const { pool, collectible, collectible2, food } = this;

          await expectRevert(
            pool.activate(0, [0], [0], { from:bob }),
            "RaraCollectibleMining: invalid activation token quantity"
          );

          await expectRevert(
            pool.activate(0, [0], [0, 1, 2], { from:bob }),
            "RaraCollectibleMining: invalid activation token quantity"
          );

          await expectRevert(
            pool.activate(1, [4], [4, 5, 10, 11], { from:bob }),
            "RaraCollectibleMining: invalid activation token quantity"
          );

          await expectRevert(
            pool.activate(2, [0], [], { from:bob }),
            "RaraCollectibleMining: invalid activation token quantity"
          );

          await expectRevert(
            pool.activate(2, [0], [0], { from:bob }),
            "RaraCollectibleMining: invalid activation token quantity"
          );

          await expectRevert(
            pool.activate(2, [0], [0, 1], { from:bob }),
            "RaraCollectibleMining: invalid activation token quantity"
          );
        });

        it('activate reverts for invalid activation tokenType', async () => {
          const { pool, collectible, collectible2, food } = this;

          await expectRevert(
            pool.activate(1, [4], [1, 2], { from:bob }),
            "RaraCollectibleMining: invalid tokenType"
          );

          await expectRevert(
            pool.activate(1, [4], [2, 1], { from:bob }),
            "RaraCollectibleMining: invalid tokenType"
          );
        });

        it('activate destroys activation tokens', async () => {
          const { pool, collectible, collectible2, food } = this;

          assert.equal(await collectible.totalSupply(), '6');
          assert.equal(await collectible2.totalSupply(), '6');
          assert.equal(await food.totalSupply(), '12');

          await pool.activate(0, [0, 2], [], { from:bob });
          assert.equal(await collectible.totalSupply(), '6');
          assert.equal(await collectible2.totalSupply(), '6');
          assert.equal(await food.totalSupply(), '12');

          await pool.activate(1, [4], [0, 1], { from:bob });
          assert.equal(await collectible.totalSupply(), '6');
          assert.equal(await collectible2.totalSupply(), '6');
          assert.equal(await food.totalSupply(), '10');
          await expectRevert.unspecified(food.ownerOf(0));
          await expectRevert.unspecified(food.ownerOf(1));
          assert.equal(await food.ownerOf(2), bob);
          assert.equal(await food.ownerOf(3), bob);

          await pool.activate(2, [1, 2], [2, 3, 4, 5, 6, 7], { from:bob });
          assert.equal(await collectible.totalSupply(), '6');
          assert.equal(await collectible2.totalSupply(), '6');
          assert.equal(await food.totalSupply(), '4');
          await expectRevert.unspecified(food.ownerOf(0));
          await expectRevert.unspecified(food.ownerOf(1));
          await expectRevert.unspecified(food.ownerOf(2));
          await expectRevert.unspecified(food.ownerOf(3));
          await expectRevert.unspecified(food.ownerOf(4));
          await expectRevert.unspecified(food.ownerOf(5));
          await expectRevert.unspecified(food.ownerOf(6));
          await expectRevert.unspecified(food.ownerOf(7));
          assert.equal(await food.ownerOf(8), bob);
          assert.equal(await food.ownerOf(9), bob);
        });

        it('(internal) activate updates tokenInfo', async () => {
          const { pool, collectible, collectible2, food } = this;

          await pool.activate(0, [0, 2], [], { from:bob });
          await pool.activate(1, [4], [0, 1], { from:bob });
          await pool.activate(2, [1, 2], [2, 3, 4, 5, 6, 7], { from:bob });

          async function checkTokenInfo(opts) {
            const { address, tokenId, poolId, owner, ownerTokenIndex, staked, activatedPower, activationPeriod } = opts;
            const info = await pool.tokenInfo(address, tokenId);
            assert.equal(info.poolId, `${poolId}`);
            assert.equal(info.owner, owner);
            assert.equal(info.ownerTokenIndex, `${ownerTokenIndex}`);
            assert.equal(info.staked, staked);
            assert.equal(info.activatedPower, `${activatedPower}`);
            assert.equal(info.activationPeriod, `${activationPeriod}`);
          }

          const act = [
            { poolId: 0, owner: carol, staked:true, activatedPower: 100, activationPeriod: 3 },
            { poolId: 1, owner: edith, staked:true, activatedPower: 1000, activationPeriod: 3 },
            { poolId: 2, owner: dave, staked:true, activatedPower: 1, activationPeriod: 3 }
          ];

          const unact = [
            { poolId: 0, owner: carol, staked:true, activatedPower: 100, activationPeriod: 2 },
            { poolId: 1, owner: edith, staked:true, activatedPower: 1000, activationPeriod: 2 },
            { poolId: 2, owner: dave, staked:true, activatedPower: 1, activationPeriod: 2 }
          ];

          await checkTokenInfo({ address:collectible.address, tokenId:0, ownerTokenIndex:0, ...act[0] });
          await checkTokenInfo({ address:collectible.address, tokenId:1, ownerTokenIndex:1, ...unact[0] });
          await checkTokenInfo({ address:collectible.address, tokenId:2, ownerTokenIndex:2, ...act[0] });
          await checkTokenInfo({ address:collectible.address, tokenId:4, ownerTokenIndex:0, ...act[1] });
          await checkTokenInfo({ address:collectible2.address, tokenId:0, ownerTokenIndex:0, ...unact[2] });
          await checkTokenInfo({ address:collectible2.address, tokenId:1, ownerTokenIndex:1, ...act[2] });
          await checkTokenInfo({ address:collectible2.address, tokenId:2, ownerTokenIndex:2, ...act[2] });
        });

        it('(internal) activate updates userInfo', async () => {
          const { pool, collectible, collectible2, food } = this;

          async function checkUserInfo(address, period, power) {
            const info = await pool.userInfo(address);
            assert.equal(info.activatedPower, `${power}`);
            assert.equal(info.activationPeriod, `${period}`);
            assert.equal(info.accumulatedRewardPrec, '0');
            assert.equal(info.harvestedReward, '0');
          }

          await checkUserInfo(carol, 2, 300);
          await checkUserInfo(edith, 2, 1000);
          await checkUserInfo(dave, 2, 3);

          await pool.activate(0, [0, 2], [], { from:bob });
          await pool.activate(1, [4], [0, 1], { from:bob });
          await pool.activate(2, [1, 2], [2, 3, 4, 5, 6, 7], { from:bob });

          await checkUserInfo(carol, 3, 200);
          await checkUserInfo(edith, 3, 1000);
          await checkUserInfo(dave, 3, 2);
        });

        it('(internal) activate updates tokenInfo when registry provides multiplier', async () => {
          const { pool, collectible, collectible2, food } = this;
          const registry = await MockVotingRegistry.new();
          await pool.setRegistry(registry.address, { from:manager });

          await registry.set(carol, 100, 1);  // x2
          await registry.set(edith, 200, 3);  // x6
          await registry.set(dave, 300, 10);  // x20

          await pool.activate(0, [0, 2], [], { from:bob });
          await pool.activate(1, [4], [0, 1], { from:bob });
          await pool.activate(2, [1, 2], [2, 3, 4, 5, 6, 7], { from:bob });

          async function checkTokenInfo(opts) {
            const { address, tokenId, poolId, owner, ownerTokenIndex, staked, activatedPower, activationPeriod } = opts;
            const info = await pool.tokenInfo(address, tokenId);
            assert.equal(info.poolId, `${poolId}`);
            assert.equal(info.owner, owner);
            assert.equal(info.ownerTokenIndex, `${ownerTokenIndex}`);
            assert.equal(info.staked, staked);
            assert.equal(info.activatedPower, `${activatedPower}`);
            assert.equal(info.activationPeriod, `${activationPeriod}`);
          }

          const act = [
            { poolId: 0, owner: carol, staked:true, activatedPower: 200, activationPeriod: 3 },
            { poolId: 1, owner: edith, staked:true, activatedPower: 6000, activationPeriod: 3 },
            { poolId: 2, owner: dave, staked:true, activatedPower: 20, activationPeriod: 3 }
          ];

          const unact = [
            { poolId: 0, owner: carol, staked:true, activatedPower: 100, activationPeriod: 2 },
            { poolId: 1, owner: edith, staked:true, activatedPower: 1000, activationPeriod: 2 },
            { poolId: 2, owner: dave, staked:true, activatedPower: 1, activationPeriod: 2 }
          ];

          await checkTokenInfo({ address:collectible.address, tokenId:0, ownerTokenIndex:0, ...act[0] });
          await checkTokenInfo({ address:collectible.address, tokenId:1, ownerTokenIndex:1, ...unact[0] });
          await checkTokenInfo({ address:collectible.address, tokenId:2, ownerTokenIndex:2, ...act[0] });
          await checkTokenInfo({ address:collectible.address, tokenId:4, ownerTokenIndex:0, ...act[1] });
          await checkTokenInfo({ address:collectible2.address, tokenId:0, ownerTokenIndex:0, ...unact[2] });
          await checkTokenInfo({ address:collectible2.address, tokenId:1, ownerTokenIndex:1, ...act[2] });
          await checkTokenInfo({ address:collectible2.address, tokenId:2, ownerTokenIndex:2, ...act[2] });
        });

        it('(internal) activate updates userInfo', async () => {
          const { pool, collectible, collectible2, food } = this;
          const registry = await MockVotingRegistry.new();
          await pool.setRegistry(registry.address, { from:manager });

          await registry.set(carol, 100, 1);  // x2
          await registry.set(edith, 200, 3);  // x6
          await registry.set(dave, 300, 10);  // x20

          async function checkUserInfo(address, period, power) {
            const info = await pool.userInfo(address);
            assert.equal(info.activatedPower, `${power}`);
            assert.equal(info.activationPeriod, `${period}`);
            assert.equal(info.accumulatedRewardPrec, '0');
            assert.equal(info.harvestedReward, '0');
          }

          await checkUserInfo(carol, 2, 300);
          await checkUserInfo(edith, 2, 1000);
          await checkUserInfo(dave, 2, 3);

          await pool.activate(0, [0, 2], [], { from:bob });
          await pool.activate(1, [4], [0, 1], { from:bob });
          await pool.activate(2, [1, 2], [2, 3, 4, 5, 6, 7], { from:bob });

          await checkUserInfo(carol, 3, 400);
          await checkUserInfo(edith, 3, 6000);
          await checkUserInfo(dave, 3, 40);
        });
      });
    });

    context('testing period transition', () => {
      beforeEach(async () => {
        const { pool, collectible, collectible2, food } = this;

        await collectible.addTokenType(`Type 0`, `T0`, 0, { from:minter });
        await collectible.addTokenType(`Type 1`, `T1`, 0, { from:minter });
        await collectible.addTokenType(`Type 2`, `T2`, 0, { from:minter });

        await collectible2.addTokenType(`Domino 0`, `D0`, 0, { from:minter });
        await collectible2.addTokenType(`Domino 1`, `D1`, 0, { from:minter });
        await collectible2.addTokenType(`Domino 2`, `D2`, 0, { from:minter });

        await food.addTokenType(`Food 0`, `F0`, 0, { from:minter });
        await food.addTokenType(`Food 1`, `F1`, 0, { from:minter });
        await food.addTokenType(`Food 2`, `F2`, 0, { from:minter });

        await pool.addPool(collectible.address, '100', false, 0, { from:alice });
        await pool.addPool(collectible.address, '1000', true, 2, { from:manager });
        await pool.addPool(collectible2.address, '1', false, 0, { from:manager });
        await pool.addPool(collectible2.address, '2', false, 0, { from:manager });

        await pool.setPoolActivation(0, '100', ZERO_ADDRESS, 0, false, 0, { from:alice });
        await pool.setPoolActivation(1, '1000', food.address, 2, true, 0, { from:alice });
        await pool.setPoolActivation(2, '1', food.address, 3, false, 0, { from:alice });
        await pool.setPoolActivation(3, '2', food.address, 3, false, 0, { from:alice });

        await pool.setPeriod('1000', '0', { from:alice });
        await pool.initialize({ from:manager });

        const initBlockNumber = await web3.eth.getBlockNumber();
        const initBlock = await web3.eth.getBlock(initBlockNumber);
        const initTimestamp = Number(initBlock.timestamp.toString());
        const stepMargin = initTimestamp % 1000;
        this.startTimestamp = stepMargin >= 0
          ? initTimestamp - (stepMargin - 0)
          : initTimestamp - (stepMargin + 1000) + 0;

        await time.increaseTo(this.startTimestamp + 1000);

        await collectible.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await collectible.setApprovalForAll(this.pool.address, true, { from:bob });

        await collectible2.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await collectible2.setApprovalForAll(this.pool.address, true, { from:bob });

        await food.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await food.setApprovalForAll(this.pool.address, true, { from:bob });

        await pool.updatePeriod();
      });

      const percent = [0, 10, 25, 50, 75, 90];

      for (const p of percent) {
        it(`test delayed period transition (~${p}%)`, async () => {
          const { pool, collectible, collectible2, food, emitter, reward } = this;

          // deposit 1100 worth of mining power
          await pool.deposit(0, carol, [0], { from:bob });
          await pool.deposit(1, edith, [4], { from:bob });

          // provide 1100 * 1.1 * 100 = 121000 of reward
          await emitter.addOwed(pool.address, '121000');

          // currently on period 2
          let startTime = Number((await pool.currentPeriodStartTime()).toString());
          await nextPeriod(pool, p * 10);  //  p% overshoot
          // what's the overshoot?
          let timestamp = await time.latest();
          let initTimestamp = Number((await pool.periodInfo(2)).initTime.toString());
          let periodTime = (startTime + 1000) - initTimestamp;
          let totalTime = timestamp - initTimestamp;
          let periodShare = Math.floor(121000 * (periodTime / totalTime));
          let interimShare = 0;
          let advanceShare = 121000 - periodShare;

          // verify period annotation
          let info = await pool.periodInfo(2);
          assert.equal(info.power, '1100');
          assert.equal((info.reward).toString(), `${periodShare}`);
          assert.equal((info.startTime).toString(), `${startTime}`);
          assert.equal((info.endTime).toString(), `${startTime + 1000}`);
          info = await pool.periodInfo(3);
          assert.equal(info.power, '0');
          assert.equal((info.reward).toString(), `${advanceShare}`);
          assert.equal((info.startTime).toString(), `${startTime + 1000}`);
          assert.equal((info.initTime).toString(), `${timestamp}`);

          // verify user entitlement
          assert.equal(await pool.pendingReward(alice), '0');
          assert.equal(await pool.pendingReward(bob), '0');
          assert.equal(
            Number((await pool.pendingReward(carol)).toString()),
            Math.floor((periodShare * 100) / 1100)
          );
          assert.equal(await pool.pendingReward(dave), '0');
          assert.equal(
            Number((await pool.pendingReward(edith)).toString()),
            Math.floor((periodShare * 1000) / 1100)
          );

          // verify remaining balance
          assert.equal(await reward.balanceOf(pool.address), `${periodShare + advanceShare}`);

          // check that the remainder goes out to investors in the next period
          await pool.deposit(2, dave, [0], { from:bob });
          await nextPeriod(pool);
          assert.equal(await pool.pendingReward(dave), `${advanceShare}`);
        });
      }

      for (const p of percent) {
        it(`test delayed period transition (~${200 + p}%)`, async () => {
          const { pool, collectible, collectible2, food, emitter, reward } = this;

          // deposit 1100 worth of mining power
          await pool.deposit(0, carol, [0], { from:bob });
          await pool.deposit(1, edith, [4], { from:bob });

          // provide 1100 * 1.1 * 100 = 121000 of reward
          await emitter.addOwed(pool.address, '121000');

          // currently on period 2
          let startTime = Number((await pool.currentPeriodStartTime()).toString());
          let res = await nextPeriod(pool, 2000 + p * 10);  //  (500 + p)% overshoot
          // what's the overshoot?
          let timestamp = await time.latest();
          let initTimestamp = Number((await pool.periodInfo(2)).initTime.toString());
          let periodTime = (startTime + 1000) - initTimestamp;
          let totalTime = timestamp - initTimestamp;
          let periodShare = Math.floor(121000 * (periodTime / totalTime));
          let interimShare = Math.floor(121000 * (2000 / totalTime));
          let advanceShare = 121000 - (periodShare + interimShare);

          // verify period annotation
          let info = await pool.periodInfo(2);
          assert.equal(info.power, '1100');
          assert.equal((info.reward).toString(), `${periodShare}`);
          assert.equal((info.startTime).toString(), `${startTime}`);
          assert.equal((info.endTime).toString(), `${startTime + 1000}`);
          info = await pool.periodInfo(3);
          assert.equal(info.power, '0');
          assert.equal((info.reward).toString(), `${advanceShare}`);
          assert.equal((info.startTime).toString(), `${startTime + 3000}`);
          assert.equal((info.initTime).toString(), `${timestamp}`);

          // verify user entitlement
          assert.equal(await pool.pendingReward(alice), '0');
          assert.equal(await pool.pendingReward(bob), '0');
          assert.equal(
            Number((await pool.pendingReward(carol)).toString()),
            Math.floor((periodShare * 100) / 1100)
          );
          assert.equal(await pool.pendingReward(dave), '0');
          assert.equal(
            Number((await pool.pendingReward(edith)).toString()),
            Math.floor((periodShare * 1000) / 1100)
          );

          // verify burn
          await expectEvent.inTransaction(res.tx, reward, "Transfer", {
            from: pool.address,
            to: ZERO_ADDRESS,
            value: `${interimShare}`
          });

          // verify remaining balance
          assert.equal(await reward.balanceOf(pool.address), `${periodShare + advanceShare}`);

          // check that the remainder goes out to investors in the next period
          await pool.deposit(2, dave, [0], { from:bob });
          await nextPeriod(pool);
          assert.equal(await pool.pendingReward(dave), `${advanceShare}`);
        });
      }

      for (const p of percent) {
        it(`test re-anchored period transition (+20% anchor with ${p}% overshoot)`, async () => {
          const { pool, collectible, collectible2, food, emitter, reward } = this;

          // deposit 1100 worth of mining power
          await pool.deposit(0, carol, [0], { from:bob });
          await pool.deposit(1, edith, [4], { from:bob });

          // provide 1100 * 1.1 * 100 = 121000 of reward
          await emitter.addOwed(pool.address, '121000');

          // currently on period 2
          let startTime = Number((await pool.currentPeriodStartTime()).toString());
          await pool.setPeriod('1000', '200');
          let res = await nextPeriod(pool, 200 + p * 10);  //  (500 + p)% overshoot
          // what's the overshoot?
          let timestamp = await time.latest();
          let initTimestamp = Number((await pool.periodInfo(2)).initTime.toString());
          let periodTime = (startTime + 1000) - initTimestamp;
          let totalTime = timestamp - initTimestamp;
          let periodShare = Math.floor(121000 * (periodTime / totalTime));
          let interimShare = Math.floor(121000 * (200 / totalTime));
          let advanceShare = 121000 - (periodShare + interimShare);

          // verify period annotation
          let info = await pool.periodInfo(2);
          assert.equal(info.power, '1100');
          assert.equal((info.reward).toString(), `${periodShare}`);
          assert.equal((info.startTime).toString(), `${startTime}`);
          assert.equal((info.endTime).toString(), `${startTime + 1000}`);
          info = await pool.periodInfo(3);
          assert.equal(info.power, '0');
          assert.equal((info.reward).toString(), `${advanceShare}`);
          assert.equal((info.startTime).toString(), `${startTime + 1200}`);
          assert.equal((info.initTime).toString(), `${timestamp}`);

          // verify user entitlement
          assert.equal(await pool.pendingReward(alice), '0');
          assert.equal(await pool.pendingReward(bob), '0');
          assert.equal(
            Number((await pool.pendingReward(carol)).toString()),
            Math.floor((periodShare * 100) / 1100)
          );
          assert.equal(await pool.pendingReward(dave), '0');
          assert.equal(
            Number((await pool.pendingReward(edith)).toString()),
            Math.floor((periodShare * 1000) / 1100)
          );

          // verify burn
          await expectEvent.inTransaction(res.tx, reward, "Transfer", {
            from: pool.address,
            to: ZERO_ADDRESS,
            value: `${interimShare}`
          });

          // verify remaining balance
          assert.equal(await reward.balanceOf(pool.address), `${periodShare + advanceShare}`);

          // check that the remainder goes out to investors in the next period
          await pool.deposit(2, dave, [0], { from:bob });
          await nextPeriod(pool);
          assert.equal(await pool.pendingReward(dave), `${advanceShare}`);
        });
      }

      for (const p of percent) {
        it(`test re-anchored period transition (+20% anchor with ${300 + p}% overshoot)`, async () => {
          const { pool, collectible, collectible2, food, emitter, reward } = this;

          // deposit 1100 worth of mining power
          await pool.deposit(0, carol, [0], { from:bob });
          await pool.deposit(1, edith, [4], { from:bob });

          // provide 1100 * 1.1 * 100 = 121000 of reward
          await emitter.addOwed(pool.address, '121000');

          // currently on period 2
          let startTime = Number((await pool.currentPeriodStartTime()).toString());
          await pool.setPeriod('1000', '200');
          let res = await nextPeriod(pool, 3200 + p * 10);  //  (500 + p)% overshoot
          // what's the overshoot?
          let timestamp = await time.latest();
          let initTimestamp = Number((await pool.periodInfo(2)).initTime.toString());
          let periodTime = (startTime + 1000) - initTimestamp;
          let totalTime = timestamp - initTimestamp;
          let periodShare = Math.floor(121000 * (periodTime / totalTime));
          let interimShare = Math.floor(121000 * (3200 / totalTime));
          let advanceShare = 121000 - (periodShare + interimShare);

          // verify period annotation
          let info = await pool.periodInfo(2);
          assert.equal(info.power, '1100');
          assert.equal((info.reward).toString(), `${periodShare}`);
          assert.equal((info.startTime).toString(), `${startTime}`);
          assert.equal((info.endTime).toString(), `${startTime + 1000}`);
          info = await pool.periodInfo(3);
          assert.equal(info.power, '0');
          assert.equal((info.reward).toString(), `${advanceShare}`);
          assert.equal((info.startTime).toString(), `${startTime + 4200}`);
          assert.equal((info.initTime).toString(), `${timestamp}`);

          // verify user entitlement
          assert.equal(await pool.pendingReward(alice), '0');
          assert.equal(await pool.pendingReward(bob), '0');
          assert.equal(
            Number((await pool.pendingReward(carol)).toString()),
            Math.floor((periodShare * 100) / 1100)
          );
          assert.equal(await pool.pendingReward(dave), '0');
          assert.equal(
            Number((await pool.pendingReward(edith)).toString()),
            Math.floor((periodShare * 1000) / 1100)
          );

          // verify burn
          await expectEvent.inTransaction(res.tx, reward, "Transfer", {
            from: pool.address,
            to: ZERO_ADDRESS,
            value: `${interimShare}`
          });

          // verify remaining balance
          assert.equal(await reward.balanceOf(pool.address), `${periodShare + advanceShare}`);

          // check that the remainder goes out to investors in the next period
          await pool.deposit(2, dave, [0], { from:bob });
          await nextPeriod(pool);
          assert.equal(await pool.pendingReward(dave), `${advanceShare}`);
        });
      }

      for (const p of percent) {
        it(`test re-anchored and overlapping period transition (-60% anchor with ${p}% step past current end)`, async () => {
          const { pool, collectible, collectible2, food, emitter, reward } = this;

          // deposit 1100 worth of mining power
          await pool.deposit(0, carol, [0], { from:bob });
          await pool.deposit(1, edith, [4], { from:bob });

          // provide 1100 * 1.1 * 100 = 121000 of reward
          await emitter.addOwed(pool.address, '121000');

          // currently on period 2
          let startTime = Number((await pool.currentPeriodStartTime()).toString());
          await pool.setPeriod('1000', '400');
          let res = await nextPeriod(pool, p * 10);  //  (p)% overshoot
          // what's the overshoot?
          let timestamp = await time.latest();
          let initTimestamp = Number((await pool.periodInfo(2)).initTime.toString());
          let periodTime = (startTime + 1000) - initTimestamp;
          let totalTime = timestamp - initTimestamp;
          let periodShare = Math.floor(121000 * (periodTime / totalTime));
          let interimShare = p >= 40 ? Math.floor(121000 * (400 / totalTime)) : 0;
          let advanceShare = 121000 - (periodShare + interimShare);

          // verify period annotation
          let info = await pool.periodInfo(2);
          assert.equal(info.power, '1100');
          assert.equal((info.reward).toString(), `${periodShare}`);
          assert.equal((info.startTime).toString(), `${startTime}`);
          assert.equal((info.endTime).toString(), `${startTime + 1000}`);
          info = await pool.periodInfo(3);
          assert.equal(info.power, '0');
          assert.equal((info.reward).toString(), `${advanceShare}`);
          assert.equal((info.startTime).toString(), `${p >= 40 ? startTime + 1400 : startTime + 400}`);
          assert.equal((info.initTime).toString(), `${timestamp}`);

          // verify user entitlement
          assert.equal(await pool.pendingReward(alice), '0');
          assert.equal(await pool.pendingReward(bob), '0');
          assert.equal(
            Number((await pool.pendingReward(carol)).toString()),
            Math.floor((periodShare * 100) / 1100)
          );
          assert.equal(await pool.pendingReward(dave), '0');
          assert.equal(
            Number((await pool.pendingReward(edith)).toString()),
            Math.floor((periodShare * 1000) / 1100)
          );

          // verify burn
          if (interimShare > 0) {
            await expectEvent.inTransaction(res.tx, reward, "Transfer", {
              from: pool.address,
              to: ZERO_ADDRESS,
              value: `${interimShare}`
            });
          }

          // verify remaining balance
          assert.equal(await reward.balanceOf(pool.address), `${periodShare + advanceShare}`);

          // check that the remainder goes out to investors in the next period
          await pool.deposit(2, dave, [0], { from:bob });
          await nextPeriod(pool);
          assert.equal(await pool.pendingReward(dave), `${advanceShare}`);
        });
      }
    });

    context('holistic testing', () => {
      beforeEach(async () => {
        const { pool, collectible, collectible2, food } = this;

        await collectible.addTokenType(`Type 0`, `T0`, 0, { from:minter });
        await collectible.addTokenType(`Type 1`, `T1`, 0, { from:minter });
        await collectible.addTokenType(`Type 2`, `T2`, 0, { from:minter });

        await collectible2.addTokenType(`Domino 0`, `D0`, 0, { from:minter });
        await collectible2.addTokenType(`Domino 1`, `D1`, 0, { from:minter });
        await collectible2.addTokenType(`Domino 2`, `D2`, 0, { from:minter });

        await food.addTokenType(`Food 0`, `F0`, 0, { from:minter });
        await food.addTokenType(`Food 1`, `F1`, 0, { from:minter });
        await food.addTokenType(`Food 2`, `F2`, 0, { from:minter });

        await pool.addPool(collectible.address, '100', false, 0, { from:alice });
        await pool.addPool(collectible.address, '1000', true, 2, { from:manager });
        await pool.addPool(collectible2.address, '1', false, 0, { from:manager });
        await pool.addPool(collectible2.address, '2', false, 0, { from:manager });

        await pool.setPoolActivation(0, '100', ZERO_ADDRESS, 0, false, 0, { from:alice });
        await pool.setPoolActivation(1, '1000', food.address, 2, true, 0, { from:alice });
        await pool.setPoolActivation(2, '1', food.address, 3, false, 0, { from:alice });
        await pool.setPoolActivation(3, '2', food.address, 3, false, 0, { from:alice });

        await pool.setPeriod('1000', '0', { from:alice });
        await pool.initialize({ from:manager });

        const initBlockNumber = await web3.eth.getBlockNumber();
        const initBlock = await web3.eth.getBlock(initBlockNumber);
        const initTimestamp = Number(initBlock.timestamp.toString());
        const stepMargin = initTimestamp % 1000;
        this.startTimestamp = stepMargin >= 0
          ? initTimestamp - (stepMargin - 0)
          : initTimestamp - (stepMargin + 1000) + 0;

        await time.increaseTo(this.startTimestamp + 1000);

        await collectible.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await collectible.setApprovalForAll(this.pool.address, true, { from:bob });

        await collectible2.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await collectible2.setApprovalForAll(this.pool.address, true, { from:bob });

        await food.massMint(bob, [0, 0, 1, 1, 2, 2], { from:minter });
        await food.setApprovalForAll(this.pool.address, true, { from:bob });

        await pool.updatePeriod();
      });

      it('test behavior with basic mining power', async () => {
        const { pool, collectible, collectible2, emitter, reward } = this;

        // deposit 1303 mining power
        await pool.deposit(0, carol, [0, 2, 4], { from:bob });
        await pool.deposit(1, edith, [5], { from:bob });
        await pool.deposit(2, dave, [1, 2, 3], { from:bob });

        // grant 2404 money
        await emitter.addOwed(pool.address, '2404');
        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal(await pool.pendingReward(carol), '0');
        assert.equal(await pool.pendingReward(dave), '0');
        assert.equal(await pool.pendingReward(edith), '0');

        // withdraw
        await pool.withdraw(0, bob, [0], { from:carol });
        await pool.withdraw(2, bob, [3], { from:dave });

        // advance and update
        await nextPeriod(pool);

        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal((await pool.pendingReward(carol)).valueOf().toString(), '400');
        assert.equal((await pool.pendingReward(dave)).valueOf().toString(), '4');
        assert.equal((await pool.pendingReward(edith)).valueOf().toString(), '2000');

        // harvest
        await pool.harvest(bob, { from: bob });
        await pool.harvest(carol, { from:carol });
        await pool.harvest(dave, { from:dave });
        await pool.harvest(edith, { from:edith });

        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal(await pool.pendingReward(carol), '0');
        assert.equal(await pool.pendingReward(dave), '0');
        assert.equal(await pool.pendingReward(edith), '0');

        assert.equal(await reward.balanceOf(alice), '0');
        assert.equal(await reward.balanceOf(bob), '0');
        assert.equal(await reward.balanceOf(carol), '400');
        assert.equal(await reward.balanceOf(dave), '4');
        assert.equal(await reward.balanceOf(edith), '2000');

        // grant 2606 money and deposit, but don't activate
        await emitter.addOwed(pool.address, '2606');
        await pool.deposit(0, carol, [0], { from:bob });
        await pool.deposit(2, dave, [3], { from:bob });
        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal(await pool.pendingReward(carol), '0');
        assert.equal(await pool.pendingReward(dave), '0');
        assert.equal(await pool.pendingReward(edith), '0');

        // advance and update
        await nextPeriod(pool);

        //assert.equal(await reward.balanceOf(pool.address), '0');
        assert.equal(await emitter.owed(pool.address), '0');

        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal(await pool.pendingReward(carol), '0');
        assert.equal(await pool.pendingReward(dave), '0');
        assert.equal(await pool.pendingReward(edith), '0');

        // grant and activate
        await emitter.addOwed(pool.address, '2602');
        await pool.activate(0, [0, 2, 4], [], { from:bob });    // no cost
        await pool.activate(1, [5], [0, 1], { from:bob });      // takes 2 of type 0
        await pool.activate(2, [1], [2, 3, 4], { from:bob });   // takes 3 of any type

        await nextPeriod(pool);

        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal((await pool.pendingReward(carol)).valueOf().toString(), '600');
        assert.equal((await pool.pendingReward(dave)).valueOf().toString(), '2');
        assert.equal((await pool.pendingReward(edith)).valueOf().toString(), '2000');

        // harvest
        await pool.harvest(bob, { from: bob });
        await pool.harvest(carol, { from:carol });
        await pool.harvest(dave, { from:dave });
        await pool.harvest(edith, { from:edith });

        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal(await pool.pendingReward(carol), '0');
        assert.equal(await pool.pendingReward(dave), '0');
        assert.equal(await pool.pendingReward(edith), '0');

        assert.equal(await reward.balanceOf(alice), '0');
        assert.equal(await reward.balanceOf(bob), '0');
        assert.equal(await reward.balanceOf(carol), '1000');
        assert.equal(await reward.balanceOf(dave), '6');
        assert.equal(await reward.balanceOf(edith), '4000');
      });

      it('test behavior with registry-multiplied mining power', async () => {
        const { pool, collectible, collectible2, emitter, reward } = this;
        const registry = await MockVotingRegistry.new();
        await pool.setRegistry(registry.address, { from:manager });

        // carol gets x2, edith x4, dave x6
        await registry.set(carol, 100, 1);
        await registry.set(edith, 200, 2);
        await registry.set(dave, 300, 3);

        // deposit 600 + 4000 + 18 mining power
        await pool.deposit(0, carol, [0, 2, 4], { from:bob });
        await pool.deposit(1, edith, [5], { from:bob });
        await pool.deposit(2, dave, [1, 2, 3], { from:bob });

        // grant 4412 x2 money
        await emitter.addOwed(pool.address, 8824);
        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal(await pool.pendingReward(carol), '0');
        assert.equal(await pool.pendingReward(dave), '0');
        assert.equal(await pool.pendingReward(edith), '0');

        // withdraw to 400 + 4000 + 12
        await pool.withdraw(0, bob, [0], { from:carol });
        await pool.withdraw(2, bob, [3], { from:dave });

        // advance and update
        await nextPeriod(pool);

        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal((await pool.pendingReward(carol)).valueOf().toString(), '800');
        assert.equal((await pool.pendingReward(dave)).valueOf().toString(), '24');
        assert.equal((await pool.pendingReward(edith)).valueOf().toString(), '8000');

        // harvest
        await pool.harvest(bob, { from: bob });
        await pool.harvest(carol, { from:carol });
        await pool.harvest(dave, { from:dave });
        await pool.harvest(edith, { from:edith });

        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal(await pool.pendingReward(carol), '0');
        assert.equal(await pool.pendingReward(dave), '0');
        assert.equal(await pool.pendingReward(edith), '0');

        assert.equal(await reward.balanceOf(alice), '0');
        assert.equal(await reward.balanceOf(bob), '0');
        assert.equal(await reward.balanceOf(carol), '800');
        assert.equal(await reward.balanceOf(dave), '24');
        assert.equal(await reward.balanceOf(edith), '8000');

        // grant 2606 money and deposit, but don't activate
        await emitter.addOwed(pool.address, '2606');
        await pool.deposit(0, carol, [0], { from:bob });
        await pool.deposit(2, dave, [3], { from:bob });
        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal(await pool.pendingReward(carol), '0');
        assert.equal(await pool.pendingReward(dave), '0');
        assert.equal(await pool.pendingReward(edith), '0');

        // advance and update
        await nextPeriod(pool);

        //assert.equal(await reward.balanceOf(pool.address), '0');
        assert.equal(await emitter.owed(pool.address), '0');

        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal(await pool.pendingReward(carol), '0');
        assert.equal(await pool.pendingReward(dave), '0');
        assert.equal(await pool.pendingReward(edith), '0');

        // alter registry: carol x1, edith x2, dave x10
        await registry.set(carol, 100, 0);
        await registry.set(edith, 200, 1);
        await registry.set(dave, 300, 5);

        // grant and activate 300 x1 + 1000 x2 + 1 x10 = 2310.
        // give funds for 3x this amount
        await emitter.addOwed(pool.address, '6930');
        await pool.activate(0, [0, 2, 4], [], { from:bob });    // no cost
        await pool.activate(1, [5], [0, 1], { from:bob });      // takes 2 of type 0
        await pool.activate(2, [1], [2, 3, 4], { from:bob });   // takes 3 of any type

        await nextPeriod(pool);

        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal((await pool.pendingReward(carol)).valueOf().toString(), '900');
        assert.equal((await pool.pendingReward(dave)).valueOf().toString(), '30');
        assert.equal((await pool.pendingReward(edith)).valueOf().toString(), '6000');

        // harvest
        await pool.harvest(bob, { from: bob });
        await pool.harvest(carol, { from:carol });
        await pool.harvest(dave, { from:dave });
        await pool.harvest(edith, { from:edith });

        assert.equal(await pool.pendingReward(alice), '0');
        assert.equal(await pool.pendingReward(bob), '0');
        assert.equal(await pool.pendingReward(carol), '0');
        assert.equal(await pool.pendingReward(dave), '0');
        assert.equal(await pool.pendingReward(edith), '0');

        assert.equal(await reward.balanceOf(alice), '0');
        assert.equal(await reward.balanceOf(bob), '0');
        assert.equal(await reward.balanceOf(carol), '1700');
        assert.equal(await reward.balanceOf(dave), '54');
        assert.equal(await reward.balanceOf(edith), '14000');
      });
    });
  });
});
