const { expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');
const MockERC20 = artifacts.require('MockERC20');
const ERC721ValuableCollectibleToken = artifacts.require('ERC721ValuableCollectibleToken');
const BlindCollectibleManagedResupplyGachaRack = artifacts.require('BlindCollectibleManagedResupplyGachaRack');
const MockERC165 = artifacts.require('MockERC165');
const MockContract = artifacts.require('MockContract');
const EIP210 = artifacts.require('EIP210');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('BlindCollectibleManagedResupplyGachaRack', ([alice, bob, carol, dave, edith, fred, manager, minter, salter]) => {
  const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');
  const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
  const SALTER_ROLE = web3.utils.soliditySha3('SALTER_ROLE');

  async function assertActivated(sale, gameId, activated) {
    const info = await sale.gameInfo(0);
    assert.equal(`${info["activated"]}`, `${activated}`);
  }

  beforeEach(async () => {
      this.token = await MockERC20.new("Token", "T", "1000000000", { from:minter });

      this.collectible = await ERC721ValuableCollectibleToken.new("Rara NFT Series", "NFT", "https://rara.farm/collectible/", { from: alice });
      for (let i = 0; i < 4; i++) {
        await this.collectible.addTokenType(`Void ${i}`, `V${i}`, i);
      }
      for (let i = 0; i < 4; i++) {
        await this.collectible.addTokenType(`Medal ${i}`, `M${i}`, i + 10);
      }
      for (let i = 0; i < 4; i++) {
        await this.collectible.addTokenType(`Domino ${i}`, `D${i}`, i + 20);
      }

      this.eip210 = await EIP210.new();
      this.sale = await BlindCollectibleManagedResupplyGachaRack.new(this.collectible.address, this.token.address, this.eip210.address, ZERO_ADDRESS);
      this.collectible.grantRole(MINTER_ROLE, this.sale.address);
      this.sale.grantRole(MANAGER_ROLE, manager);
      this.sale.grantRole(SALTER_ROLE, salter);
  });

  it('should have set initial state', async () => {
    const { token, collectible, sale } = this;

    assert.equal(await sale.prizeToken(), collectible.address);
    assert.equal(await sale.purchaseToken(), token.address);

    assert.equal(await sale.recipient(), ZERO_ADDRESS);

    assert.equal(await sale.drawCountBy(alice), '0');
    assert.equal(await sale.drawCountBy(carol), '0');

    assert.equal(await sale.totalDraws(), '0');
    assert.equal(await sale.gameCount(), '0');
  });

  it('setRecipient should revert for non-managers', async () => {
    const { token, collectible, sale } = this;

    await expectRevert(
      sale.setRecipient(bob, { from:bob }),
      "BlindCollectibleGachaRack: must have MANAGER role to setRecipient"
    );

    await expectRevert(
      sale.setRecipient(dave, { from:carol }),
      "BlindCollectibleGachaRack: must have MANAGER role to setRecipient"
    );

    await expectRevert(
      sale.setRecipient(ZERO_ADDRESS, { from:dave }),
      "BlindCollectibleGachaRack: must have MANAGER role to setRecipient"
    );
  });

  it('setRecipient should alter recipient', async () => {
    const { token, collectible, sale } = this;

    await sale.setRecipient(bob, { from:alice });
    assert.equal(await sale.recipient(), bob);

    await sale.setRecipient(ZERO_ADDRESS, { from:manager });
    assert.equal(await sale.recipient(), ZERO_ADDRESS);

    await sale.setRecipient(alice, { from:manager });
    assert.equal(await sale.recipient(), alice);
  });

  it('periodStartTime should calculate period boundaries as expected', async () => {
    const { sale } = this;
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
        (await this.sale.periodStartTime(t.time, t.duration, t.anchor)).valueOf().toString(),
        `${t.result}`
      );
    }
  });

  it('createUnactivatedGame should revert for non-managers', async () => {
    const { token, collectible, sale } = this;

    await expectRevert(
      sale.createUnactivatedGame(
        100,    // draw price
        15,     // blocks to reveal
        50,     // prize supply: 50
        1,      // prize period duration: 0
        0,      // prize period anchor: 0
        0,      // open time: 0
        0,      // close time: 0
        [],
        [],
        { from:bob }
      ),
      "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to create game"
    );

    await expectRevert(
      sale.createUnactivatedGame(
        100,    // draw price
        15,     // blocks to reveal
        50,     // prize supply: 50
        1,      // prize period duration: 0
        0,      // prize period anchor: 0
        0,      // open time: 0
        0,      // close time: 0
        [],
        [],
        { from:salter }
      ),
      "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to create game"
    );
  });

  it('createUnactivatedGame should revert for invalid parameters', async () => {
    const { token, collectible, sale } = this;

    await expectRevert(
      sale.createUnactivatedGame(100, 15, 50, 0, 0, 0, 0, [], [], { from:alice }),
      "BlindCollectibleGachaRackRegularResupply: duration must be nonzero"
    );

    await expectRevert(
      sale.createUnactivatedGame(100, 15, 50, 1, 0, 0, 0, [0], [], { from:alice }),
      "BlindCollectibleManagedResupplyGachaRack: prize types and weights must match length"
    );

    await expectRevert(
      sale.createUnactivatedGame(100, 15, 50, 1, 0, 0, 0, [0, 1], [10, 10, 30], { from:manager }),
      "BlindCollectibleManagedResupplyGachaRack: prize types and weights must match length"
    );

    await expectRevert(
      sale.createUnactivatedGame(100, 15, 50, 1, 0, 0, 0, [20, 1], [10, 10], { from:manager }),
      "BlindCollectibleGachaRack: nonexistent tokenType"
    );
  });

  it('createUnactivatedGame should set state appropriately', async () => {
    const { token, collectible, sale } = this;

    await sale.createUnactivatedGame(100, 15, 50, 1, 0, 0, 0, [2, 3], [10, 30], { from:alice });
    await assertActivated(sale, 0, false);
    // game 0 is the default for all people, even when unactivated
    assert.equal(await sale.availableSupply(), '50');
    assert.equal(await sale.drawPrice(), '100');
    assert.equal(await sale.currentGameFor(alice), '0');
    assert.equal(await sale.availableSupplyForUser(alice), '50');
    assert.equal(await sale.availableSupplyForGame(0), '50');

    assert.equal(await sale.drawCountBy(alice), '0');
    assert.equal(await sale.drawCountBy(bob), '0');
    assert.equal(await sale.totalDraws(), '0');

    assert.equal(await sale.gameCount(), '1');
    assert.equal(await sale.currentGame(), '0');
    assert.equal(await sale.prizeCount(0), '2');
    assert.equal(await sale.totalPrizeWeight(0), '40');
    assert.equal(await sale.prizeWeight(0, 0), '10');
    assert.equal(await sale.prizeWeight(0, 1), '30');

    assert.equal(await sale.gameDrawCount(0), '0');

    const timeNow = Number(await time.latest());
    await sale.createUnactivatedGame(120, 10, 20, 10, 1234, timeNow - 100, timeNow + 100, [5, 6, 7], [5, 2, 1], { from:alice });
    await assertActivated(sale, 1, false);
    // game 0 is the default for all people, even when unactivated
    assert.equal(await sale.availableSupply(), '50');
    assert.equal(await sale.drawPrice(), '100');
    assert.equal(await sale.currentGameFor(alice), '0');
    assert.equal(await sale.availableSupplyForUser(alice), '50');
    assert.equal(await sale.availableSupplyForGame(0), '50');
    assert.equal(await sale.availableSupplyForUser(bob), '50');
    assert.equal(await sale.availableSupplyForGame(1), '20');

    assert.equal(await sale.drawCountBy(alice), '0');
    assert.equal(await sale.drawCountBy(bob), '0');
    assert.equal(await sale.totalDraws(), '0');

    assert.equal(await sale.gameCount(), '2');
    assert.equal(await sale.currentGame(), '0');
    assert.equal(await sale.prizeCount(1), '3');
    assert.equal(await sale.totalPrizeWeight(1), '8');
    assert.equal(await sale.prizeWeight(1, 0), '5');
    assert.equal(await sale.prizeWeight(1, 1), '2');
    assert.equal(await sale.prizeWeight(1, 2), '1');
  });

  it('createActivatedGame should revert for non-managers', async () => {
    const { token, collectible, sale } = this;

    await expectRevert(
      sale.createActivatedGame(
        false,
        100,    // draw price
        15,     // blocks to reveal
        50,     // prize supply: 50
        1,      // prize period duration: 0
        0,      // prize period anchor: 0
        0,      // open time: 0
        0,      // close time: 0
        [],
        [],
        { from:bob }
      ),
      "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to create game"
    );

    await expectRevert(
      sale.createActivatedGame(
        true,
        100,    // draw price
        15,     // blocks to reveal
        50,     // prize supply: 50
        1,      // prize period duration: 0
        0,      // prize period anchor: 0
        0,      // open time: 0
        0,      // close time: 0
        [],
        [],
        { from:salter }
      ),
      "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to create game"
    );
  });

  it('createActivatedGame should revert for invalid parameters', async () => {
    const { token, collectible, sale } = this;

    await expectRevert(
      sale.createActivatedGame(false, 100, 15, 50, 0, 0, 0, 0, [], [], { from:alice }),
      "BlindCollectibleGachaRackRegularResupply: duration must be nonzero"
    );

    await expectRevert(
      sale.createActivatedGame(false, 100, 15, 50, 1, 0, 0, 0, [0], [], { from:alice }),
      "BlindCollectibleManagedResupplyGachaRack: prize types and weights must match length"
    );

    await expectRevert(
      sale.createActivatedGame(true, 100, 15, 50, 1, 0, 0, 0, [0, 1], [10, 10, 30], { from:manager }),
      "BlindCollectibleManagedResupplyGachaRack: prize types and weights must match length"
    );

    await expectRevert(
      sale.createActivatedGame(false, 100, 15, 50, 1, 0, 0, 0, [20, 1], [10, 10], { from:manager }),
      "BlindCollectibleGachaRack: nonexistent tokenType"
    );
  });

  it('createActivatedGame should set state appropriately', async () => {
    const { token, collectible, sale } = this;

    await sale.createActivatedGame(false, 100, 15, 50, 1, 0, 0, 0, [2, 3], [10, 30], { from:alice });
    await assertActivated(sale, 0, true);
    // game 0 is the default for all people, even when unactivated
    assert.equal(await sale.availableSupply(), '50');
    assert.equal(await sale.drawPrice(), '100');
    assert.equal(await sale.currentGameFor(alice), '0');
    assert.equal(await sale.availableSupplyForUser(alice), '50');
    assert.equal(await sale.availableSupplyForGame(0), '50');

    assert.equal(await sale.drawCountBy(alice), '0');
    assert.equal(await sale.drawCountBy(bob), '0');
    assert.equal(await sale.totalDraws(), '0');

    assert.equal(await sale.gameCount(), '1');
    assert.equal(await sale.currentGame(), '0');
    assert.equal(await sale.prizeCount(0), '2');
    assert.equal(await sale.totalPrizeWeight(0), '40');
    assert.equal(await sale.prizeWeight(0, 0), '10');
    assert.equal(await sale.prizeWeight(0, 1), '30');

    assert.equal(await sale.gameDrawCount(0), '0');

    const timeNow = Number(await time.latest());
    await sale.createActivatedGame(true, 120, 10, 20, 10, 1, timeNow - 100, timeNow + 100, [5, 6, 7], [5, 2, 1], { from:alice });
    await assertActivated(sale, 1, true);
    // game 0 is the default for all people, even when unactivated
    assert.equal(await sale.availableSupply(), '20');
    assert.equal(await sale.drawPrice(), '120');
    assert.equal(await sale.currentGameFor(alice), '1');
    assert.equal(await sale.availableSupplyForUser(alice), '20');
    assert.equal(await sale.availableSupplyForGame(0), '50');
    assert.equal(await sale.availableSupplyForUser(bob), '20');
    assert.equal(await sale.availableSupplyForGame(1), '20');

    assert.equal(await sale.drawCountBy(alice), '0');
    assert.equal(await sale.drawCountBy(bob), '0');
    assert.equal(await sale.totalDraws(), '0');

    assert.equal(await sale.gameCount(), '2');
    assert.equal(await sale.currentGame(), '1');
    assert.equal(await sale.prizeCount(1), '3');
    assert.equal(await sale.totalPrizeWeight(1), '8');
    assert.equal(await sale.prizeWeight(1, 0), '5');
    assert.equal(await sale.prizeWeight(1, 1), '2');
    assert.equal(await sale.prizeWeight(1, 2), '1');
  });

  it('createPrizes should revert for non-managers', async () => {
    const { token, collectible, sale } = this;

    await sale.createUnactivatedGame(100, 15, 50, 1, 0, 0, 0, [2, 3], [10, 30], { from:alice });

    await expectRevert(
      sale.createPrizes(0, [8], [10], { from:bob }),
      "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to createPrizes"
    );

    await expectRevert(
      sale.createPrizes(0, [8], [10], { from:salter }),
      "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to createPrizes"
    );
  });

  it('createPrizes should revert for invalid parameters', async () => {
    const { token, collectible, sale } = this;

    await expectRevert(
      sale.createPrizes(0, [8], [10], { from:alice }),
      "BlindCollectibleManagedResupplyGachaRack: invalid gameId"
    );

    await sale.createUnactivatedGame(100, 15, 50, 1, 0, 0, 0, [2, 3], [10, 30], { from:alice });

    await expectRevert(
      sale.createPrizes(1, [8], [10], { from:manager }),
      "BlindCollectibleManagedResupplyGachaRack: invalid gameId"
    );

    await expectRevert(
      sale.createPrizes(0, [8], [10, 20], { from:alice }),
      "BlindCollectibleManagedResupplyGachaRack: prize types and weights must match length"
    );

    await expectRevert(
      sale.createPrizes(0, [8], [], { from:manager }),
      "BlindCollectibleManagedResupplyGachaRack: prize types and weights must match length"
    );

    await expectRevert(
      sale.createPrizes(0, [20], [10], { from:manager }),
      "BlindCollectibleGachaRack: nonexistent tokenType"
    );
  });

  it('createPrizes should revert for activated games', async () => {
    const { token, collectible, sale } = this;

    const timeNow = Number(await time.latest());
    await sale.createActivatedGame(false, 100, 15, 50, 1, 0, 0, 0, [2, 3], [10, 30], { from:alice });
    await sale.createActivatedGame(true, 120, 10, 20, 10, 1234, timeNow - 100, timeNow + 100, [5, 6, 7], [5, 2, 1], { from:manager });

    await expectRevert(
      sale.createPrizes(0, [4, 5], [5, 5], { from:alice }),
      "BlindCollectibleGachaRack: game has been activated"
    );

    await expectRevert(
      sale.createPrizes(1, [0, 1, 2], [10, 15, 20], { from:manager }),
      "BlindCollectibleGachaRack: game has been activated"
    );
  });

  it('createPrizes should function as expected', async () => {
    const { token, collectible, sale } = this;

    const timeNow = Number(await time.latest());
    await sale.createUnactivatedGame(100, 15, 50, 1, 0, 0, 0, [2, 3], [10, 30], { from:alice });
    await sale.createUnactivatedGame(120, 10, 20, 10, 1234, timeNow - 100, timeNow + 100, [5, 6, 7], [5, 2, 1], { from:manager });
    await sale.createPrizes(0, [4, 5], [5, 5], { from:alice });
    // default game is 0
    assert.equal(await sale.availableSupply(), '50');
    assert.equal(await sale.drawPrice(), '100');
    assert.equal(await sale.currentGameFor(alice), '0');
    assert.equal(await sale.availableSupplyForUser(alice), '50');
    assert.equal(await sale.availableSupplyForGame(0), '50');

    assert.equal(await sale.drawCountBy(alice), '0');
    assert.equal(await sale.drawCountBy(bob), '0');
    assert.equal(await sale.totalDraws(), '0');

    assert.equal(await sale.gameCount(), '2');
    assert.equal(await sale.currentGame(), '0');
    assert.equal(await sale.prizeCount(0), '4');
    assert.equal(await sale.totalPrizeWeight(0), '50');
    assert.equal(await sale.prizeWeight(0, 0), '10');
    assert.equal(await sale.prizeWeight(0, 1), '30');
    assert.equal(await sale.prizeWeight(0, 2), '5');
    assert.equal(await sale.prizeWeight(0, 3), '5');

    assert.equal(await sale.gameDrawCount(0), '0');

    await sale.createPrizes(1, [0, 1, 2], [10, 15, 20], { from:manager });
    // default game is still 0
    assert.equal(await sale.availableSupply(), '50');
    assert.equal(await sale.drawPrice(), '100');
    assert.equal(await sale.currentGameFor(alice), '0');
    assert.equal(await sale.availableSupplyForUser(alice), '50');
    assert.equal(await sale.availableSupplyForGame(1), '20');

    assert.equal(await sale.drawCountBy(alice), '0');
    assert.equal(await sale.drawCountBy(bob), '0');
    assert.equal(await sale.totalDraws(), '0');

    assert.equal(await sale.gameCount(), '2');
    assert.equal(await sale.currentGame(), '0');
    assert.equal(await sale.prizeCount(1), '6');
    assert.equal(await sale.totalPrizeWeight(1), '53');
    assert.equal(await sale.prizeWeight(1, 0), '5');
    assert.equal(await sale.prizeWeight(1, 1), '2');
    assert.equal(await sale.prizeWeight(1, 2), '1');
    assert.equal(await sale.prizeWeight(1, 3), '10');
    assert.equal(await sale.prizeWeight(1, 4), '15');
    assert.equal(await sale.prizeWeight(1, 5), '20');

    assert.equal(await sale.gameDrawCount(1), '0');
  });

  it('activateGame reverts for non-manager', async () => {
    const { token, collectible, sale } = this;

    const timeNow = Number(await time.latest());
    await sale.createUnactivatedGame(100, 15, 50, 1, 0, 0, 0, [2, 3], [10, 30], { from:alice });
    await sale.createUnactivatedGame(120, 10, 20, 10, 1234, timeNow - 100, timeNow + 100, [5, 6, 7], [5, 2, 1], { from:manager });

    await expectRevert(
      sale.activateGame(0, false, { from:bob }),
      "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to activate game"
    );

    await expectRevert(
      sale.activateGame(1, true, { from:salter }),
      "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to activate game"
    );
  });

  it('activateGame reverts for invalid parameters', async () => {
    const { token, collectible, sale } = this;

    const timeNow = Number(await time.latest());
    await sale.createUnactivatedGame(100, 15, 50, 1, 0, 0, 0, [2, 3], [10, 30], { from:alice });
    await sale.createUnactivatedGame(120, 10, 20, 10, 1234, timeNow - 100, timeNow + 100, [5, 6, 7], [5, 2, 1], { from:manager });

    await expectRevert(
      sale.activateGame(2, false, { from:alice }),
      "BlindCollectibleManagedResupplyGachaRack: invalid gameId"
    );

    await expectRevert(
      sale.activateGame(3, true, { from:manager }),
      "BlindCollectibleManagedResupplyGachaRack: invalid gameId"
    );
  });

  it('activateGame behaves as expected', async () => {
    const { token, collectible, sale } = this;

    const timeNow = Number(await time.latest());
    await sale.createUnactivatedGame(100, 15, 50, 1, 0, 0, 0, [2, 3], [10, 30], { from:alice });
    await sale.createUnactivatedGame(120, 10, 20, 10, 1234, timeNow - 100, timeNow + 100, [5, 6, 7], [5, 2, 1], { from:manager });

    await assertActivated(sale, 0, false);

    let res = await sale.activateGame(0, false, { from:alice });
    await assertActivated(sale, 0, true);
    await expectEvent.inTransaction(res.tx, sale, 'GameUpdate', {
      gameId: '0',
      drawPrice: '100',
      blocksToReveal: '15',
      activated: true
    });

    assert.equal(await sale.availableSupply(), '50');
    assert.equal(await sale.drawPrice(), '100');
    assert.equal(await sale.currentGameFor(alice), '0');
    assert.equal(await sale.availableSupplyForUser(alice), '50');
    assert.equal(await sale.currentGame(), '0');

    res = await sale.activateGame(1, true, { from:manager });
    await assertActivated(sale, 1, true);
    await expectEvent.inTransaction(res.tx, sale, 'GameUpdate', {
      gameId: '1',
      drawPrice: '120',
      blocksToReveal: '10',
      activated: true
    });

    assert.equal(await sale.availableSupply(), '20');
    assert.equal(await sale.drawPrice(), '120');
    assert.equal(await sale.currentGameFor(alice), '1');
    assert.equal(await sale.availableSupplyForUser(alice), '20');
    assert.equal(await sale.currentGame(), '1');
  });

  context('with games and prizes', () => {
    let blockNumber;
    beforeEach(async  () => {
      const { token, collectible, sale } = this;

      const timeNow = Number(await time.latest());
      await sale.createActivatedGame(true, 100, 15, 50, 1000000, 0, 0, 0, [2, 3], [10, 30], { from:alice });
      await sale.createActivatedGame(false, 120, 10, 20, 1000, 1234, timeNow - 100, timeNow + 100, [5, 6, 7], [5, 2, 1], { from:manager });
    });

    it('(internal): set GameInfo appropriately', async () => {
      const { token, collectible, sale } = this;

      let info = await sale.gameInfo(0);
      assert.equal(info["drawPrice"], '100');
      assert.equal(info["blocksToReveal"], '15');
      assert.equal(info["totalWeight"], '40');
      assert.equal(info["activated"], true);

      info = await sale.gameInfo(1);
      assert.equal(info["drawPrice"], '120');
      assert.equal(info["blocksToReveal"], '10');
      assert.equal(info["totalWeight"], '8');
      assert.equal(info["activated"], true);
    });

    it('assignGame reverts for non-managers', async () => {
      const { token, collectible, sale } = this;

      const timeNow = Number(await time.latest());
      await sale.createActivatedGame(false, 80, 5, 20, 10, 1, timeNow - 500, timeNow + 500, [8, 1], [100, 1], { from:alice });

      await expectRevert(
        sale.assignGame(0, [alice, bob], { from:bob }),
        "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to assignGame"
      );

      await expectRevert(
        sale.assignGame(2, [carol], { from:salter }),
        "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to assignGame"
      );
    });

    it('assignGame reverts for nonexistent game', async () => {
      const { token, collectible, sale } = this;

      await expectRevert(
        sale.assignGame(2, [alice, bob], { from:alice }),
        "BlindCollectibleManagedResupplyGachaRack: invalid gameId"
      );

      const timeNow = Number(await time.latest());
      await sale.createActivatedGame(false, 80, 5, 20, 10, 1, timeNow - 500, timeNow + 500, [8, 1], [100, 1], { from:alice });

      await expectRevert(
        sale.assignGame(3, [carol], { from:manager }),
        "BlindCollectibleManagedResupplyGachaRack: invalid gameId"
      );
    });

    it('assignGame works as expected', async () => {
      const { token, collectible, sale } = this;

      const timeNow = Number(await time.latest());
      await sale.createActivatedGame(false, 25, 5, 80, 10, 1, timeNow - 500, timeNow + 500, [8, 1], [100, 1], { from:alice });

      const gameSupply =  [50, 20, 80];
      const gamePrice = [100, 120, 25];
      const gameFor = {};

      async function assertAssignments() {
        const defaultGameId = Number((await sale.defaultGameId()).toString());
        const accounts = [alice, bob, carol, dave, edith, fred, manager, salter, minter];
        for (const account of accounts) {
          let gameId = gameFor[account];
          if (gameId == undefined || gameId == null) {
            gameId = defaultGameId;
          } else {
            // check internal assignment
            const index = await sale.gameAssignmentIndex(account);
            const assignment = await sale.gameAssignment(index);
            assert.equal(assignment.user, account);
            assert.equal(assignment.gameId, `${gameId}`);
          }

          const supply = gameSupply[gameId];
          const drawPrice = gamePrice[gameId];

          assert.equal(await sale.currentGame({ from:account }), `${gameId}`);
          assert.equal(await sale.availableSupply({ from:account }), `${supply}`);
          assert.equal(await sale.drawPrice({ from:account }), `${drawPrice}`);

          assert.equal(await sale.currentGameFor(account), `${gameId}`);
          assert.equal(await sale.availableSupplyForUser(account), `${supply}`);
        }
      }

      await sale.assignGame(1, [alice, bob], { from:alice });
      [alice, bob].forEach(a => gameFor[a] = 1);
      await assertAssignments();

      await sale.assignGame(2, [carol, dave, edith], { from:manager });
      [carol, dave, edith].forEach(a => gameFor[a] = 2);
      await assertAssignments();

      await sale.assignGame(0, [alice, dave], { from:manager });
      [alice, dave].forEach(a => gameFor[a] = 0);
      await assertAssignments();

      await sale.setDefaultGame(1);
      await assertAssignments();
    });

    it('clearAssignedGame reverts for non-managers', async () => {
      const { token, collectible, sale } = this;

      const blockNumber = await web3.eth.getBlockNumber();
      await sale.assignGame(1, [alice, bob, carol, dave]);

      await expectRevert(
        sale.clearAssignedGame([alice, bob], { from:bob }),
        "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to clearAssignedGame"
      );

      await expectRevert(
        sale.clearAssignedGame([carol], { from:salter }),
        "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to clearAssignedGame"
      );
    });

    it('clearAssignedGame works as expected', async () => {
      const { token, collectible, sale } = this;

      const timeNow = Number(await time.latest());
      await sale.createActivatedGame(false, 25, 5, 80, 10, 1, timeNow - 500, timeNow + 500, [8, 1], [100, 1], { from:alice });

      const gameSupply =  [50, 20, 80];
      const gamePrice = [100, 120, 25];
      const gameFor = {};

      async function assertAssignments() {
        const defaultGameId = Number((await sale.defaultGameId()).toString());
        const accounts = [alice, bob, carol, dave, edith, fred, manager, salter, minter];
        for (const account of accounts) {
          let gameId = gameFor[account];
          if (gameId == undefined || gameId == null) {
            gameId = defaultGameId;
          } else {
            // check internal assignment
            const index = await sale.gameAssignmentIndex(account);
            const assignment = await sale.gameAssignment(index);
            assert.equal(assignment.user, account);
            assert.equal(assignment.gameId, `${gameId}`);
          }

          const supply = gameSupply[gameId];
          const drawPrice = gamePrice[gameId];

          assert.equal(await sale.currentGame({ from:account }), `${gameId}`);
          assert.equal(await sale.availableSupply({ from:account }), `${supply}`);
          assert.equal(await sale.drawPrice({ from:account }), `${drawPrice}`);

          assert.equal(await sale.currentGameFor(account), `${gameId}`);
          assert.equal(await sale.availableSupplyForUser(account), `${supply}`);
        }
      }

      await sale.assignGame(1, [alice, bob], { from:alice });
      [alice, bob].forEach(a => gameFor[a] = 1);
      await sale.assignGame(2, [carol, dave, edith], { from:manager });
      [carol, dave, edith].forEach(a => gameFor[a] = 2);

      await sale.clearAssignedGame([], { from:alice });
      await assertAssignments();

      await sale.clearAssignedGame([alice, carol], { from:alice });
      [alice, carol].forEach(a => gameFor[a] = null);
      await assertAssignments();

      await sale.clearAssignedGame([edith, manager, minter, alice], { from:alice });
      [edith].forEach(a => gameFor[a] = null);
      await assertAssignments();
    });

    it('revealDraws selects a prize and mints a token', async () => {
      const { token, collectible, sale } = this;

      await token.transfer(bob, '1000', { from:minter });
      await token.approve(sale.address, '1000', { from:bob });

      const revealBlocks = []
      for (let i = 0; i < 5; i++) {
        await sale.purchaseDraws(bob, 1, 100, { from:bob });
        revealBlocks.push(await web3.eth.getBlockNumber() + 15);
      }

      assert.equal(await sale.availableSupply(), '45');
      assert.equal(await sale.drawPrice(), '100');
      assert.equal(await sale.currentGameFor(alice), '0');
      assert.equal(await sale.availableSupplyForUser(alice), '45');
      assert.equal(await sale.currentGame(), '0');

      assert.equal(await sale.totalDraws(), '5');
      assert.equal(await sale.gameDrawCount(0), '5');
      assert.equal(await sale.gameDrawCount(1), '0');

      assert.equal(await sale.drawCountBy(alice), '0');
      assert.equal(await sale.drawCountBy(bob), '5');
      for (let i = 0; i < 5; i++) {
        assert.equal(await sale.drawIdBy(bob, i), `${i}`);
        assert.equal(await sale.drawGameId(i), `0`);
        assert.equal(await sale.drawRevealed(i), false);
        assert.equal(await sale.drawRevealable(i), false);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);

        await expectRevert(
          sale.revealDraws(bob, [i], { from:bob }),
          "BlindCollectibleGachaRack: not revealable"
        );
      }

      await expectRevert(
        sale.revealDraws(bob, [0, 1, 2, 3, 4], { from:bob }),
        "BlindCollectibleGachaRack: not revealable"
      );

      await time.advanceBlockTo(revealBlocks[0] + 10);
      for (let i = 0; i < 5; i++) {
        assert.equal(await sale.drawIdBy(bob, i), `${i}`);
        assert.equal(await sale.drawGameId(i), `0`);
        assert.equal(await sale.drawRevealed(i), false);
        assert.equal(await sale.drawRevealable(i), true);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);
      }

      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.balanceOf(bob), '0');
      await sale.revealDraws(bob, [0, 1, 2, 3, 4], { from:bob });
      await expectRevert(
        sale.revealDraws(bob, [0, 1, 2, 3, 4], { from:bob }),
        "BlindCollectibleGachaRack: drawId already revealed"
      );
      assert.equal(await collectible.totalSupply(), '5');
      assert.equal(await collectible.balanceOf(bob), '5');
      for (let i = 0; i < 5; i++) {
        assert.equal(await sale.drawIdBy(bob, i), `${i}`);
        assert.equal(await sale.drawGameId(i), `0`);
        assert.equal(await sale.drawRevealed(i), true);
        assert.equal(await sale.drawRevealable(i), false);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);
        const tokenId = await collectible.tokenOfOwnerByIndex(bob, i);
        assert.equal(await sale.drawTokenId(i), tokenId.toString());
        assert.equal(await sale.drawTokenType(i), (await collectible.tokenType(tokenId)).toString());
      }
    });

    it('revealDraws selects a prize and mints a token when multiple users have purchased draws', async () => {
      const { token, collectible, sale } = this;

      const buyers = [alice, bob];

      const revealBlocks = []
      for (const buyer of buyers) {
        await token.transfer(buyer, '1000', { from:minter });
        await token.approve(sale.address, '1000', { from:buyer });

        for (let i = 0; i < 5; i++) {
          await sale.purchaseDraws(buyer, 1, 100, { from:buyer });
          revealBlocks.push(await web3.eth.getBlockNumber() + 15);
        }
      }

      assert.equal(await sale.availableSupply(), '40');
      assert.equal(await sale.drawPrice(), '100');
      assert.equal(await sale.currentGameFor(alice), '0');
      assert.equal(await sale.availableSupplyForUser(alice), '40');
      assert.equal(await sale.currentGame(), '0');

      assert.equal(await sale.totalDraws(), '10');
      assert.equal(await sale.gameDrawCount(0), '10');
      assert.equal(await sale.gameDrawCount(1), '0');

      assert.equal(await sale.drawCountBy(alice), '5');
      assert.equal(await sale.drawCountBy(bob), '5');
      assert.equal(await sale.drawCountBy(carol), '0');
      for (let i = 0; i < 10; i++) {
        const buyer = i < 5 ? alice : bob;
        const index = i < 5 ? i : i - 5;
        assert.equal(await sale.drawIdBy(buyer, index), `${i}`);
        assert.equal(await sale.drawGameId(i), `0`);
        assert.equal(await sale.drawRevealed(i), false);
        assert.equal(await sale.drawRevealable(i), false);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);

        await expectRevert(
          sale.revealDraws(buyer, [i], { from:buyer }),
          "BlindCollectibleGachaRack: not revealable"
        );
      }

      await time.advanceBlockTo(revealBlocks[0] + 15);
      for (let i = 0; i < 10; i++) {
        const buyer = i < 5 ? alice : bob;
        const index = i < 5 ? i : i - 5;
        assert.equal(await sale.drawIdBy(buyer, index), `${i}`);
        assert.equal(await sale.drawGameId(i), `0`);
        assert.equal(await sale.drawRevealed(i), false);
        assert.equal(await sale.drawRevealable(i), true);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);
      }

      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.balanceOf(alice), '0');
      assert.equal(await collectible.balanceOf(bob), '0');

      await expectRevert(
        sale.revealDraws(bob, [0], { from:bob }),
        "BlindCollectibleGachaRack: drawId not owned by caller"
      );

      await expectRevert(
        sale.revealDraws(alice, [5], { from:alice }),
        "BlindCollectibleGachaRack: drawId not owned by caller"
      );

      await sale.revealDraws(alice, [0, 1, 2, 3, 4], { from:alice });
      assert.equal(await collectible.totalSupply(), '5');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '0');
      await expectRevert(
        sale.revealDraws(bob, [0, 1, 2, 3, 4], { from:alice }),
        "BlindCollectibleGachaRack: drawId already revealed"
      );
      await sale.revealDraws(bob, [5, 6, 7, 8, 9], { from:bob });
      assert.equal(await collectible.totalSupply(), '10');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '5');
      await expectRevert(
        sale.revealDraws(bob, [5, 6, 7, 8, 9], { from:bob }),
        "BlindCollectibleGachaRack: drawId already revealed"
      );
      for (let i = 0; i < 10; i++) {
        const buyer = i < 5 ? alice : bob;
        const index = i < 5 ? i : i - 5;
        assert.equal(await sale.drawIdBy(buyer, index), `${i}`);
        assert.equal(await sale.drawGameId(i), `0`);
        assert.equal(await sale.drawRevealed(i), true);
        assert.equal(await sale.drawRevealable(i), false);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);
        const tokenId = await collectible.tokenOfOwnerByIndex(buyer, index);
        assert.equal(await sale.drawTokenId(i), tokenId.toString());
        assert.equal(await sale.drawTokenType(i), (await collectible.tokenType(tokenId)).toString());
      }
    });

    it('revealDraws selects a prize and mints a token when using a non-default game', async () => {
      const { token, collectible, sale } = this;

      await token.transfer(bob, '1000', { from:minter });
      await token.approve(sale.address, '1000', { from:bob });

      await sale.assignGame(1, [bob], { from:manager });

      const revealBlocks = []
      for (let i = 0; i < 5; i++) {
        await sale.purchaseDraws(bob, 1, 120, { from:bob });
        revealBlocks.push(await web3.eth.getBlockNumber() + 10);
      }

      assert.equal(await sale.availableSupply(), '50');
      assert.equal(await sale.drawPrice(), '100');
      assert.equal(await sale.currentGameFor(bob), '1');
      assert.equal(await sale.availableSupplyForUser(bob), '15');
      assert.equal(await sale.currentGame(), '0');
      assert.equal(await sale.currentGameFor(bob), '1');

      assert.equal(await sale.totalDraws(), '5');
      assert.equal(await sale.gameDrawCount(0), '0');
      assert.equal(await sale.gameDrawCount(1), '5');

      assert.equal(await sale.drawCountBy(alice), '0');
      assert.equal(await sale.drawCountBy(bob), '5');
      for (let i = 0; i < 5; i++) {
        assert.equal(await sale.drawIdBy(bob, i), `${i}`);
        assert.equal(await sale.drawGameId(i), `1`);
        assert.equal(await sale.drawRevealed(i), false);
        assert.equal(await sale.drawRevealable(i), false);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);

        await expectRevert(
          sale.revealDraws(bob, [i], { from:bob }),
          "BlindCollectibleGachaRack: not revealable"
        );
      }

      await expectRevert(
        sale.revealDraws(bob, [0, 1, 2, 3, 4], { from:bob }),
        "BlindCollectibleGachaRack: not revealable"
      );

      await time.advanceBlockTo(revealBlocks[0] + 10);
      for (let i = 0; i < 5; i++) {
        assert.equal(await sale.drawIdBy(bob, i), `${i}`);
        assert.equal(await sale.drawGameId(i), `1`);
        assert.equal(await sale.drawRevealed(i), false);
        assert.equal(await sale.drawRevealable(i), true);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);
      }

      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.balanceOf(bob), '0');
      await sale.revealDraws(bob, [0, 1, 2, 3, 4], { from:bob });
      assert.equal(await collectible.totalSupply(), '5');
      assert.equal(await collectible.balanceOf(bob), '5');
      for (let i = 0; i < 5; i++) {
        assert.equal(await sale.drawIdBy(bob, i), `${i}`);
        assert.equal(await sale.drawGameId(i), `1`);
        assert.equal(await sale.drawRevealed(i), true);
        assert.equal(await sale.drawRevealable(i), false);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);
        const tokenId = await collectible.tokenOfOwnerByIndex(bob, i);
        assert.equal(await sale.drawTokenId(i), tokenId.toString());
        assert.equal(await sale.drawTokenType(i), (await collectible.tokenType(tokenId)).toString());
      }
    });
  });

  context('with prize flow', () => {
    let timeNow;
    beforeEach(async  () => {
      const { token, collectible, sale } = this;

      await token.transfer(alice, '10000000', { from:minter });
      await token.transfer(bob, '10000000', { from:minter });
      await token.transfer(carol, '10000000', { from:minter });
      await token.approve(sale.address, '10000000', { from:alice });
      await token.approve(sale.address, '10000000', { from:bob });
      await token.approve(sale.address, '10000000', { from:carol });

      timeNow = Number(await time.latest());

      await sale.createActivatedGame(true, 100, 15, 50, 100000000, timeNow + 100000000, 0, 0, [2, 3], [10, 30], { from:alice });
      await sale.createActivatedGame(false, 120, 10, 20, 60, 1, timeNow + 100, 0, [5, 6, 7], [5, 2, 1], { from:manager });
      await sale.createActivatedGame(false, 5, 10, 40, 700, 1234, timeNow + 1000, timeNow + 2000, [0, 1, 2], [100, 10, 1], { from:alice });
    });

    it('(internal): set GameDrawFlow appropriately', async () => {
      const { token, collectible, sale } = this;

      let info = await sale.gameSupplyInfo(0);
      assert.equal(info["supply"], '50');
      assert.equal(info["duration"], '100000000');
      assert.equal(info["anchorTime"], `${timeNow + 100000000}`);
      assert.equal(info["openTime"], '0');
      assert.equal(info["closeTime"], '0');
      assert.equal(info["currentSupply"], '50');
      assert.equal(info["currentPeriodStartTime"], `${await sale.periodStartTime(timeNow, 100000000, timeNow + 100000000)}`);

      info = await sale.gameSupplyInfo(1);
      assert.equal(info["supply"], '20');
      assert.equal(info["duration"], '60');
      assert.equal(info["anchorTime"], '1');
      assert.equal(info["openTime"], `${timeNow + 100}`);
      assert.equal(info["closeTime"], '0');
      assert.equal(info["currentSupply"], '20');
      assert.equal(info["currentPeriodStartTime"], `${await sale.periodStartTime(timeNow, 60, 1)}`);

      info = await sale.gameSupplyInfo(2);
      assert.equal(info["supply"], '40');
      assert.equal(info["duration"], '700');
      assert.equal(info["anchorTime"], '1234');
      assert.equal(info["openTime"], `${timeNow + 1000}`);
      assert.equal(info["closeTime"], `${timeNow + 2000}`);
      assert.equal(info["currentSupply"], '40');
      assert.equal(info["currentPeriodStartTime"], `${await sale.periodStartTime(timeNow, 700, 1234)}`);
    });

    it('availableSupply: reports expected amount', async () => {
      const { token, collectible, sale } = this;

      // expected supply
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '0');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      // advance to 90 (no changes)
      await time.increaseTo(timeNow + 90);
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '0');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      // open up game 1
      await time.increaseTo(timeNow + 100);
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      // almost open game 2
      await time.increaseTo(timeNow + 990);
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      // open game 2
      await time.increaseTo(timeNow + 1000);
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '40');

      // roll on
      await time.increaseTo(timeNow + 1990);
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '40');

      // close game 2
      await time.increaseTo(timeNow + 2000);
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '0');
    });

    it('purchaseDraws: able to purchase up to available supply', async () => {
      const { token, collectible, sale } = this;

      await sale.assignGame(0, [alice]);
      await sale.assignGame(1, [bob]);
      await sale.assignGame(2, [carol]);

      // expected supply
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '0');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      // buy
      await sale.purchaseDraws(alice, 25, 100000, { from:alice });
      assert.equal(await sale.availableSupplyForGame(0), '25');
      assert.equal(await sale.availableSupplyForGame(1), '0');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await sale.purchaseDraws(alice, 25, 100000, { from:alice });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '0');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await time.increaseTo(timeNow + 90);
      // none for bob this block, but some next time
      await expectRevert(
        sale.purchaseDraws(bob, 1, 100000, { from:bob }),
        "BlindCollectibleGachaRack: not enough supply"
      );
      await time.increaseTo(timeNow + 100);
      await sale.purchaseDraws(bob, 1, 10000, { from:bob });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '19');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      let startTime = Number((await sale.gameSupplyInfo(1))["currentPeriodStartTime"].toString());
      await time.increaseTo(startTime + 60);
      await sale.purchaseDraws(bob, 8, 10000, { from:bob });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '12');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await sale.purchaseDraws(bob, 12, 10000, { from:bob });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '0');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await time.increaseTo(startTime + 90);
      assert.equal(await sale.availableSupplyForGame(1), '0');
      await expectRevert(
        sale.purchaseDraws(bob, 1, 100000, { from:bob }),
        "BlindCollectibleGachaRack: not enough supply"
      );

      await time.increaseTo(startTime + 120);
      assert.equal(await sale.availableSupplyForGame(1), '20');
      await sale.purchaseDraws(bob, 4, 10000, { from:bob });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '16');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await expectRevert(
        sale.purchaseDraws(carol, 1, 100000, { from:carol }),
        "BlindCollectibleGachaRack: not enough supply"
      );

      // open game 2 w/ 40 supply, 700 second refresh.
      await time.increaseTo(timeNow + 1000);
      await sale.purchaseDraws(carol, 4, 10000, { from:carol });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '36');

      startTime = Number((await sale.gameSupplyInfo(2))["currentPeriodStartTime"].toString());
      await time.increaseTo(startTime + 690);
      await sale.purchaseDraws(carol, 3, 10000, { from:carol });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '33');

      await time.increaseTo(startTime + 710);
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '40');
      await sale.purchaseDraws(carol, 9, 10000, { from:carol });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '31');

      await time.increaseTo(timeNow + 2000);
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '0');
      await expectRevert(
        sale.purchaseDraws(carol, 1, 100000, { from:carol }),
        "BlindCollectibleGachaRack: not enough supply"
      );
    });

    it('setGameSupplyPeriod and related methods reverts for non-manager', async () => {
      const { token, collectible, sale } = this;

      await expectRevert(
        sale.setGameSupplyPeriod(0, 100, 100, 0, true, { from:bob }),
        "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to alter game supply"
      );

      await expectRevert(
        sale.setGameTime(0, 100, 1000, { from:carol }),
        "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to alter game supply"
      );

      await expectRevert(
        sale.setGameSupply(0, 100, { from:minter }),
        "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to alter game supply"
      );

      await expectRevert(
        sale.addGameSupply(0, 100, { from:salter }),
        "BlindCollectibleManagedResupplyGachaRack: must have MANAGER role to alter game supply"
      );
    });

    it('setGameSupplyPeriod and related methods revert for invalid params', async () => {
      const { token, collectible, sale } = this;

      // game id
      await expectRevert(
        sale.setGameSupplyPeriod(3, 100, 100, 0, true, { from:alice }),
        "BlindCollectibleManagedResupplyGachaRack: nonexistent gameId"
      );

      await expectRevert(
        sale.setGameTime(3, 100, 1000, { from:manager }),
        "BlindCollectibleManagedResupplyGachaRack: nonexistent gameId"
      );

      await expectRevert(
        sale.setGameSupply(3, 100, { from:alice }),
        "BlindCollectibleManagedResupplyGachaRack: nonexistent gameId"
      );

      await expectRevert(
        sale.addGameSupply(3, 100, { from:manager }),
        "BlindCollectibleManagedResupplyGachaRack: nonexistent gameId"
      );

      // _duration
      await expectRevert(
        sale.setGameSupplyPeriod(2, 100, 0, 0, true, { from:alice }),
        "BaseBlindCollectibleGachaRackRegularResupply: duration must be nonzero"
      );
    });

    it('setGameSupplyPeriod updates values as expected', async () => {
      const { token, collectible, sale } = this;

      await sale.setGameSupplyPeriod(0, 137, 30, timeNow - 5, true, { from:alice });
      let info = await sale.gameSupplyInfo(0);
      assert.equal(info["supply"], '137');
      assert.equal(info["duration"], '30');
      assert.equal(info["anchorTime"], `${timeNow - 5}`);
      assert.equal(info["openTime"], '0');
      assert.equal(info["closeTime"], '0');
      assert.equal(info["currentSupply"], '137');
      assert.equal(info["currentPeriodStartTime"], `${await sale.periodStartTime(timeNow + 3, 30, timeNow - 5)}`);

      await sale.setGameSupplyPeriod(0, 240, 60, timeNow - 2, false, { from:alice });
      info = await sale.gameSupplyInfo(0);
      assert.equal(info["supply"], '240');
      assert.equal(info["duration"], '60');
      assert.equal(info["anchorTime"], `${timeNow - 2}`);
      assert.equal(info["openTime"], '0');
      assert.equal(info["closeTime"], '0');
      assert.equal(info["currentSupply"], '137');
      assert.equal(info["currentPeriodStartTime"], `${await sale.periodStartTime(timeNow + 3, 30, timeNow - 5)}`);

      await sale.setGameSupplyPeriod(0, 300, 61, timeNow - 3, true, { from:alice });
      info = await sale.gameSupplyInfo(0);
      assert.equal(info["supply"], '300');
      assert.equal(info["duration"], '61');
      assert.equal(info["anchorTime"], `${timeNow - 3}`);
      assert.equal(info["openTime"], '0');
      assert.equal(info["closeTime"], '0');
      assert.equal(info["currentSupply"], '300');
      assert.equal(info["currentPeriodStartTime"], `${await sale.periodStartTime(timeNow + 6, 61, timeNow - 3)}`);

      let startTime = Number((await sale.periodStartTime(timeNow + 6, 61, timeNow - 3)).toString());
      await sale.purchaseDraws(alice, 25, 100000, { from:alice });
      assert.equal(await sale.availableSupplyForGame(0), '275');
      await time.increaseTo(startTime + 61);
      assert.equal(await sale.availableSupplyForGame(0), '300');

      await sale.setGameSupplyPeriod(1, 44, 1000, timeNow - 2, true, { from:alice });
      info = await sale.gameSupplyInfo(1);
      assert.equal(info["supply"], '44');
      assert.equal(info["duration"], '1000');
      assert.equal(info["anchorTime"], `${timeNow - 2}`);
      assert.equal(info["openTime"], `${timeNow + 100}`);
      assert.equal(info["closeTime"], '0');
      assert.equal(info["currentSupply"], '44');
      assert.equal(info["currentPeriodStartTime"], `${await sale.periodStartTime(timeNow + 3, 1000, timeNow - 2)}`);
    });
  });
});
