const { expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');
const MockERC20 = artifacts.require('MockERC20');
const ERC721ValuableCollectibleToken = artifacts.require('ERC721ValuableCollectibleToken');
const BlindCollectibleManagedFlowGachaRack = artifacts.require('BlindCollectibleManagedFlowGachaRack');
const BlindCollectibleManagedFlowGachaRackHelper = artifacts.require('BlindCollectibleManagedFlowGachaRackHelper');
const MockERC165 = artifacts.require('MockERC165');
const MockContract = artifacts.require('MockContract');
const EIP210 = artifacts.require('EIP210');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('BlindCollectibleManagedFlowGachaRack', ([alice, bob, carol, dave, edith, fred, manager, minter, salter]) => {
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
      this.sale = await BlindCollectibleManagedFlowGachaRack.new(this.collectible.address, this.token.address, this.eip210.address, ZERO_ADDRESS);
      this.helper = await BlindCollectibleManagedFlowGachaRackHelper.new(this.sale.address);

      this.collectible.grantRole(MINTER_ROLE, this.sale.address);
      this.sale.grantRole(MANAGER_ROLE, manager);
      this.sale.grantRole(SALTER_ROLE, salter);

      this.sale.grantRole(MANAGER_ROLE, this.helper.address);
      this.helper.grantRole(MANAGER_ROLE, manager);
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

  it('claimProceeds reverts for non-manager', async () => {
    const { token, sale } = this;

    await token.transfer(sale.address, '10000', { from:minter });
    await expectRevert(
      sale.claimProceeds(alice, 1000, { from:bob }),
      "AUTH"
    );

    await expectRevert(
      sale.claimProceeds(manager, 1000, { from:salter }),
      "AUTH"
    );
  });

  it('claimProceeds functions as expected', async () => {
    const { token, sale } = this;

    await token.transfer(sale.address, '10000', { from:minter });
    await sale.claimProceeds(bob, 1000, { from:alice });
    assert.equal(await token.balanceOf(bob), '1000');

    await sale.claimProceeds(edith, 5000, { from:manager });
    assert.equal(await token.balanceOf(edith), '5000');
  });

  it('claimAllProceeds reverts for non-manager', async () => {
    const { token, sale } = this;

    await token.transfer(sale.address, '10000', { from:minter });
    await expectRevert(
      sale.claimAllProceeds(alice, { from:bob }),
      "AUTH"
    );

    await expectRevert(
      sale.claimAllProceeds(manager, { from:salter }),
      "AUTH"
    );
  });

  it('claimAllProceeds functions as expected', async () => {
    const { token, sale } = this;

    await token.transfer(sale.address, '10000', { from:minter });
    await sale.claimAllProceeds(bob, { from:alice });
    assert.equal(await token.balanceOf(bob), '10000');

    await token.transfer(sale.address, '6000', { from:minter });
    await sale.claimAllProceeds(edith, { from:manager });
    assert.equal(await token.balanceOf(edith), '6000');
  });

  it('setRecipient should revert for non-managers', async () => {
    const { token, collectible, sale } = this;

    await expectRevert(
      sale.setRecipient(bob, { from:bob }),
      "AUTH"
    );

    await expectRevert(
      sale.setRecipient(dave, { from:carol }),
      "AUTH"
    );

    await expectRevert(
      sale.setRecipient(ZERO_ADDRESS, { from:dave }),
      "AUTH"
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

  it('createUnactivatedGame should revert for non-managers', async () => {
    const { token, collectible, sale, helper } = this;

    await expectRevert(
      helper.createUnactivatedGame(
        100,    // draw price
        15,     // blocks to reveal
        50,     // prize supply: 50
        0,      // prize flow numerator: 0
        1,      // prize flow denominator: 1
        0,      // start block: immediately
        [],
        [],
        { from:bob }
      ),
      "AUTH"
    );

    await expectRevert(
      helper.createUnactivatedGame(
        100,    // draw price
        15,     // blocks to reveal
        50,     // prize supply: 50
        0,      // prize flow numerator: 0
        1,      // prize flow denominator: 1
        0,      // start block: immediately
        [],
        [],
        { from:salter }
      ),
      "AUTH"
    );
  });

  it('createUnactivatedGame should revert for invalid parameters', async () => {
    const { token, collectible, sale, helper } = this;

    await expectRevert(
      helper.createUnactivatedGame(100, 15, 50, 0, 0, 0, [], [], { from:alice }),
      "NONZERO"
    );

    await expectRevert(
      helper.createUnactivatedGame(100, 15, 50, '10000000000000000000000000', 1, 0, [], [], { from:manager }),
      "PRECISION"
    );

    await expectRevert(
      helper.createUnactivatedGame(100, 15, 50, 0, 1, 0, [0], [], { from:alice }),
      "LENGTH"
    );

    await expectRevert(
      helper.createUnactivatedGame(100, 15, 50, 0, 1, 0, [0, 1], [10, 10, 30], { from:manager }),
      "LENGTH"
    );

    await expectRevert(
      helper.createUnactivatedGame(100, 15, 50, 0, 1, 0, [20, 1], [10, 10], { from:manager }),
      "NO_TYPE"
    );
  });

  it('createUnactivatedGame should set state appropriately', async () => {
    const { token, collectible, sale, helper } = this;

    await helper.createUnactivatedGame(100, 15, 50, 0, 1, 0, [2, 3], [10, 30], { from:alice });
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

    const blockNumber = await web3.eth.getBlockNumber();
    await helper.createUnactivatedGame(120, 10, 20, 10, 1, blockNumber + 100, [5, 6, 7], [5, 2, 1], { from:alice });
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
    const { token, collectible, sale, helper } = this;

    await expectRevert(
      helper.createActivatedGame(
        false,
        100,    // draw price
        15,     // blocks to reveal
        50,     // prize supply: 50
        0,      // prize flow numerator: 0
        1,      // prize flow denominator: 1
        0,      // start block: immediately
        [],
        [],
        { from:bob }
      ),
      "AUTH"
    );

    await expectRevert(
      helper.createActivatedGame(
        true,
        100,    // draw price
        15,     // blocks to reveal
        50,     // prize supply: 50
        0,      // prize flow numerator: 0
        1,      // prize flow denominator: 1
        0,      // start block: immediately
        [],
        [],
        { from:salter }
      ),
      "AUTH"
    );
  });

  it('createActivatedGame should revert for invalid parameters', async () => {
    const { token, collectible, sale, helper } = this;

    await expectRevert(
      helper.createActivatedGame(false, 100, 15, 50, 0, 0, 0, [], [], { from:alice }),
      "NONZERO"
    );

    await expectRevert(
      helper.createActivatedGame(true, 100, 15, 50, '10000000000000000000000000', 1, 0, [], [], { from:manager }),
      "PRECISION"
    );

    await expectRevert(
      helper.createActivatedGame(false, 100, 15, 50, 0, 1, 0, [0], [], { from:alice }),
      "LENGTH"
    );

    await expectRevert(
      helper.createActivatedGame(true, 100, 15, 50, 0, 1, 0, [0, 1], [10, 10, 30], { from:manager }),
      "LENGTH"
    );

    await expectRevert(
      helper.createActivatedGame(false, 100, 15, 50, 0, 1, 0, [20, 1], [10, 10], { from:manager }),
      "NO_TYPE"
    );
  });

  it('createActivatedGame should set state appropriately', async () => {
    const { token, collectible, sale, helper } = this;

    await helper.createActivatedGame(false, 100, 15, 50, 0, 1, 0, [2, 3], [10, 30], { from:alice });
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

    const blockNumber = await web3.eth.getBlockNumber();
    await helper.createActivatedGame(true, 120, 10, 20, 10, 1, blockNumber + 100, [5, 6, 7], [5, 2, 1], { from:alice });
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
    const { token, collectible, sale, helper } = this;

    await helper.createUnactivatedGame(100, 15, 50, 0, 1, 0, [2, 3], [10, 30], { from:alice });

    await expectRevert(
      helper.createPrizes(0, [8], [10], { from:bob }),
      "AUTH"
    );

    await expectRevert(
      helper.createPrizes(0, [8], [10], { from:salter }),
      "AUTH"
    );
  });

  it('createPrizes should revert for invalid parameters', async () => {
    const { token, collectible, sale, helper } = this;

    await expectRevert(
      helper.createPrizes(0, [8], [10], { from:alice }),
      "OOB"
    );

    await helper.createUnactivatedGame(100, 15, 50, 0, 1, 0, [2, 3], [10, 30], { from:alice });

    await expectRevert(
      helper.createPrizes(1, [8], [10], { from:manager }),
      "OOB"
    );

    await expectRevert(
      helper.createPrizes(0, [8], [10, 20], { from:alice }),
      "LENGTH"
    );

    await expectRevert(
      helper.createPrizes(0, [8], [], { from:manager }),
      "LENGTH"
    );

    await expectRevert(
      helper.createPrizes(0, [20], [10], { from:manager }),
      "NO_TYPE"
    );
  });

  it('createPrizes should revert for activated games', async () => {
    const { token, collectible, sale, helper } = this;

    const blockNumber = await web3.eth.getBlockNumber();
    await helper.createActivatedGame(false, 100, 15, 50, 0, 1, 0, [2, 3], [10, 30], { from:alice });
    await helper.createActivatedGame(true, 120, 10, 20, 10, 1, blockNumber + 100, [5, 6, 7], [5, 2, 1], { from:manager });

    await expectRevert(
      helper.createPrizes(0, [4, 5], [5, 5], { from:alice }),
      "ACTIVE"
    );

    await expectRevert(
      helper.createPrizes(1, [0, 1, 2], [10, 15, 20], { from:manager }),
      "ACTIVE"
    );
  });

  it('createPrizes should function as expected', async () => {
    const { token, collectible, sale, helper } = this;

    const blockNumber = await web3.eth.getBlockNumber();
    await helper.createUnactivatedGame(100, 15, 50, 0, 1, 0, [2, 3], [10, 30], { from:alice });
    await helper.createUnactivatedGame(120, 10, 20, 10, 1, blockNumber + 100, [5, 6, 7], [5, 2, 1], { from:manager });
    await helper.createPrizes(0, [4, 5], [5, 5], { from:alice });
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

    await helper.createPrizes(1, [0, 1, 2], [10, 15, 20], { from:manager });
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
    const { token, collectible, sale, helper } = this;

    const blockNumber = await web3.eth.getBlockNumber();
    await helper.createUnactivatedGame(100, 15, 50, 0, 1, 0, [2, 3], [10, 30], { from:alice });
    await helper.createUnactivatedGame(120, 10, 20, 10, 1, blockNumber + 100, [5, 6, 7], [5, 2, 1], { from:manager });

    await expectRevert(
      helper.activateGame(0, false, { from:bob }),
      "AUTH"
    );

    await expectRevert(
      helper.activateGame(1, true, { from:salter }),
      "AUTH"
    );
  });

  it('activateGame reverts for invalid parameters', async () => {
    const { token, collectible, sale, helper } = this;

    const blockNumber = await web3.eth.getBlockNumber();
    await helper.createUnactivatedGame(100, 15, 50, 0, 1, 0, [2, 3], [10, 30], { from:alice });
    await helper.createUnactivatedGame(120, 10, 20, 10, 1, blockNumber + 100, [5, 6, 7], [5, 2, 1], { from:manager });

    await expectRevert(
      helper.activateGame(2, false, { from:alice }),
      "OOB"
    );

    await expectRevert(
      helper.activateGame(3, true, { from:manager }),
      "OOB"
    );
  });

  it('activateGame behaves as expected', async () => {
    const { token, collectible, sale, helper } = this;

    const blockNumber = await web3.eth.getBlockNumber();
    await helper.createUnactivatedGame(100, 15, 50, 0, 1, 0, [2, 3], [10, 30], { from:alice });
    await helper.createUnactivatedGame(120, 10, 20, 10, 1, blockNumber + 100, [5, 6, 7], [5, 2, 1], { from:manager });

    await assertActivated(sale, 0, false);

    let res = await helper.activateGame(0, false, { from:alice });
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

    res = await helper.activateGame(1, true, { from:manager });
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
      const { token, collectible, sale, helper } = this;

      blockNumber = await web3.eth.getBlockNumber();
      await helper.createActivatedGame(true, 100, 15, 50, 0, 1, 0, [2, 3], [10, 30], { from:alice });
      await helper.createActivatedGame(false, 120, 10, 20, 10, 1, blockNumber + 100, [5, 6, 7], [5, 2, 1], { from:manager });
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
      const { token, collectible, sale, helper } = this;

      const blockNumber = await web3.eth.getBlockNumber();
      await helper.createActivatedGame(false, 80, 5, 20, 10, 1, blockNumber + 500, [8, 1], [100, 1], { from:alice });

      await expectRevert(
        helper.assignGame(0, [alice, bob], { from:bob }),
        "AUTH"
      );

      await expectRevert(
        helper.assignGame(2, [carol], { from:salter }),
        "AUTH"
      );
    });

    it('assignGame reverts for nonexistent game', async () => {
      const { token, collectible, sale, helper } = this;

      await expectRevert(
        helper.assignGame(2, [alice, bob], { from:alice }),
        "OOB"
      );

      const blockNumber = await web3.eth.getBlockNumber();
      await helper.createActivatedGame(false, 80, 5, 20, 10, 1, blockNumber + 500, [8, 1], [100, 1], { from:alice });

      await expectRevert(
        helper.assignGame(3, [carol], { from:manager }),
        "OOB"
      );
    });

    it('assignGame works as expected', async () => {
      const { token, collectible, sale, helper } = this;

      const blockNumber = await web3.eth.getBlockNumber();
      await helper.createActivatedGame(false, 25, 5, 80, 10, 1, blockNumber + 500, [8, 1], [100, 1], { from:alice });

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

      await helper.assignGame(1, [alice, bob], { from:alice });
      [alice, bob].forEach(a => gameFor[a] = 1);
      await assertAssignments();

      await helper.assignGame(2, [carol, dave, edith], { from:manager });
      [carol, dave, edith].forEach(a => gameFor[a] = 2);
      await assertAssignments();

      await helper.assignGame(0, [alice, dave], { from:manager });
      [alice, dave].forEach(a => gameFor[a] = 0);
      await assertAssignments();

      await sale.setDefaultGame(1);
      await assertAssignments();
    });

    it('clearAssignedGame reverts for non-managers', async () => {
      const { token, collectible, sale, helper } = this;

      const blockNumber = await web3.eth.getBlockNumber();
      await helper.assignGame(1, [alice, bob, carol, dave]);

      await expectRevert(
        helper.clearAssignedGame([alice, bob], { from:bob }),
        "AUTH"
      );

      await expectRevert(
        helper.clearAssignedGame([carol], { from:salter }),
        "AUTH"
      );
    });

    it('clearAssignedGame works as expected', async () => {
      const { token, collectible, sale, helper } = this;

      const blockNumber = await web3.eth.getBlockNumber();
      await helper.createActivatedGame(false, 25, 5, 80, 10, 1, blockNumber + 500, [8, 1], [100, 1], { from:alice });

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

      await helper.assignGame(1, [alice, bob], { from:alice });
      [alice, bob].forEach(a => gameFor[a] = 1);
      await helper.assignGame(2, [carol, dave, edith], { from:manager });
      [carol, dave, edith].forEach(a => gameFor[a] = 2);

      await helper.clearAssignedGame([], { from:alice });
      await assertAssignments();

      await helper.clearAssignedGame([alice, carol], { from:alice });
      [alice, carol].forEach(a => gameFor[a] = null);
      await assertAssignments();

      await helper.clearAssignedGame([edith, manager, minter, alice], { from:alice });
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
          "BLOCK"
        );
      }

      await expectRevert(
        sale.revealDraws(bob, [0, 1, 2, 3, 4], { from:bob }),
        "BLOCK"
      );

      await time.advanceBlockTo(revealBlocks[0] + 10);
      for (let i = 0; i < 5; i++) {
        assert.equal(await sale.drawIdBy(bob, i), `${i}`);
        assert.equal(await sale.drawGameId(i), `0`);
        assert.equal(await sale.drawRevealed(i), false);
        assert.equal(await sale.drawRevealable(i), true);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);
      }

      const peekResult = await sale.peekDrawPrizes([0, 1, 2, 3, 4]);
      const peekTokenTypes = peekResult["prizeTokenTypes"];

      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.balanceOf(bob), '0');
      await sale.revealDraws(bob, [0, 1, 2, 3, 4], { from:bob });

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
        assert.equal(await sale.drawTokenType(i), (peekTokenTypes[i]).toString());
      }

      const peekResultAfter = await sale.peekDrawPrizes([0, 1, 2, 3, 4]);
      const peekTokenTypesAfter = peekResult["prizeTokenTypes"];

      for (let i = 0; i < 5; i++) {
        assert.equal(await sale.drawTokenType(i), (peekTokenTypesAfter[i]).toString());
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
          "BLOCK"
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

      const peekResult = await sale.peekDrawPrizes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const peekTokenTypes = peekResult["prizeTokenTypes"];

      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.balanceOf(alice), '0');
      assert.equal(await collectible.balanceOf(bob), '0');

      await expectRevert(
        sale.revealDraws(bob, [0], { from:bob }),
        "OWNER"
      );

      await expectRevert(
        sale.revealDraws(alice, [5], { from:alice }),
        "OWNER"
      );

      await sale.revealDraws(alice, [0, 1, 2, 3, 4], { from:alice });
      assert.equal(await collectible.totalSupply(), '5');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '0');

      await sale.revealDraws(bob, [5, 6, 7, 8, 9], { from:bob });
      assert.equal(await collectible.totalSupply(), '10');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '5');

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
        assert.equal(await sale.drawTokenType(i), (peekTokenTypes[i]).toString());
      }

      const peekResultAfter = await sale.peekDrawPrizes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const peekTokenTypesAfter = peekResult["prizeTokenTypes"];

      for (let i = 0; i < 10; i++) {
        assert.equal(await sale.drawTokenType(i), (peekTokenTypesAfter[i]).toString());
      }
    });

    it('revealDraws selects a prize and mints a token when using a non-default game', async () => {
      const { token, collectible, sale, helper } = this;

      await token.transfer(bob, '1000', { from:minter });
      await token.approve(sale.address, '1000', { from:bob });

      await helper.assignGame(1, [bob], { from:manager });

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
          "BLOCK"
        );
      }

      await expectRevert(
        sale.revealDraws(bob, [0, 1, 2, 3, 4], { from:bob }),
        "BLOCK"
      );

      await time.advanceBlockTo(revealBlocks[0] + 10);
      for (let i = 0; i < 5; i++) {
        assert.equal(await sale.drawIdBy(bob, i), `${i}`);
        assert.equal(await sale.drawGameId(i), `1`);
        assert.equal(await sale.drawRevealed(i), false);
        assert.equal(await sale.drawRevealable(i), true);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);
      }

      const peekResult = await sale.peekDrawPrizes([0, 1, 2, 3, 4]);
      const peekTokenTypes = peekResult["prizeTokenTypes"];

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
        assert.equal(await sale.drawTokenType(i), (peekTokenTypes[i]).toString());
      }

      const peekResultAfter = await sale.peekDrawPrizes([0, 1, 2, 3, 4]);
      const peekTokenTypesAfter = peekResult["prizeTokenTypes"];

      for (let i = 0; i < 5; i++) {
        assert.equal(await sale.drawTokenType(i), (peekTokenTypesAfter[i]).toString());
      }
    });

    it('awardDraws reverts when not allowed', async () => {
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

      const peekResult = await sale.peekDrawPrizes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const peekTokenTypes = peekResult["prizeTokenTypes"];

      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.balanceOf(alice), '0');
      assert.equal(await collectible.balanceOf(bob), '0');

      await expectRevert(
        sale.awardDraws([0], { from:alice }),
        "DISABLED"
      );

      await expectRevert(
        sale.awardDraws([0], { from:bob }),
        "DISABLED"
      );

      await expectRevert(
        sale.awardDraws([5], { from:alice }),
        "DISABLED"
      );

      await expectRevert(
        sale.awardDraws([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], { from:alice }),
        "DISABLED"
      );
    });

    it('awardDraws selects a prize and mints a token when multiple users have purchased draws', async () => {
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

      await sale.setAllowAwarding(true, { from:manager });

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
          sale.awardDraws([i], { from:buyer }),
          "BLOCK"
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

      const peekResult = await sale.peekDrawPrizes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const peekTokenTypes = peekResult["prizeTokenTypes"];

      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.balanceOf(alice), '0');
      assert.equal(await collectible.balanceOf(bob), '0');

      await sale.awardDraws([0, 2, 4, 6, 8], { from:carol });
      assert.equal(await collectible.totalSupply(), '5');
      assert.equal(await collectible.balanceOf(alice), '3');
      assert.equal(await collectible.balanceOf(bob), '2');

      await sale.awardDraws([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], { from:bob });
      assert.equal(await collectible.totalSupply(), '10');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '5');

      for (let i = 0; i < 10; i++) {
        const buyer = i < 5 ? alice : bob;
        const index = i < 5 ? i : i - 5;
        const tokenId = ['0', '5', '1', '6', '2', '7', '3', '8', '4', '9'][i];
        assert.equal(await sale.drawIdBy(buyer, index), `${i}`);
        assert.equal(await sale.drawGameId(i), `0`);
        assert.equal(await sale.drawRevealed(i), true);
        assert.equal(await sale.drawRevealable(i), false);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);
        assert.equal(await sale.drawTokenId(i), tokenId.toString());
        assert.equal(await sale.drawTokenType(i), (await collectible.tokenType(tokenId)).toString());
        assert.equal(await sale.drawTokenType(i), (peekTokenTypes[i]).toString());
      }

      const peekResultAfter = await sale.peekDrawPrizes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const peekTokenTypesAfter = peekResult["prizeTokenTypes"];

      for (let i = 0; i < 10; i++) {
        assert.equal(await sale.drawTokenType(i), (peekTokenTypesAfter[i]).toString());
      }
    });

    it('awardQueuedDraws reverts when not allowed', async () => {
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

      const peekResult = await sale.peekDrawPrizes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const peekTokenTypes = peekResult["prizeTokenTypes"];

      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.balanceOf(alice), '0');
      assert.equal(await collectible.balanceOf(bob), '0');

      await expectRevert(
        sale.awardQueuedDraws(0, { from:alice }),
        "DISABLED"
      );

      await expectRevert(
        sale.awardQueuedDraws(3, { from:bob }),
        "DISABLED"
      );

      await expectRevert(
        sale.awardQueuedDraws(7, { from:alice }),
        "DISABLED"
      );

      await expectRevert(
        sale.awardQueuedDraws(10, { from:alice }),
        "DISABLED"
      );
    });

    it('awardQueuedDraws selects a prize and mints a token when multiple users have purchased draws', async () => {
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

      await sale.setAllowAwarding(true, { from:manager });

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
          sale.awardDraws([i], { from:buyer }),
          "BLOCK"
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

      const peekResult = await sale.peekDrawPrizes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const peekTokenTypes = peekResult["prizeTokenTypes"];

      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.balanceOf(alice), '0');
      assert.equal(await collectible.balanceOf(bob), '0');

      await sale.awardQueuedDraws(4, { from:carol });
      assert.equal(await collectible.totalSupply(), '4');
      assert.equal(await collectible.balanceOf(alice), '4');
      assert.equal(await collectible.balanceOf(bob), '0');

      await sale.awardQueuedDraws(10, { from:bob });
      assert.equal(await collectible.totalSupply(), '10');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '5');

      for (let i = 0; i < 10; i++) {
        const buyer = i < 5 ? alice : bob;
        const index = i < 5 ? i : i - 5;
        const tokenId = `${i}`;
        assert.equal(await sale.drawIdBy(buyer, index), `${i}`);
        assert.equal(await sale.drawGameId(i), `0`);
        assert.equal(await sale.drawRevealed(i), true);
        assert.equal(await sale.drawRevealable(i), false);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);
        assert.equal(await sale.drawTokenId(i), tokenId.toString());
        assert.equal(await sale.drawTokenType(i), (await collectible.tokenType(tokenId)).toString());
        assert.equal(await sale.drawTokenType(i), (peekTokenTypes[i]).toString());
      }

      const peekResultAfter = await sale.peekDrawPrizes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const peekTokenTypesAfter = peekResult["prizeTokenTypes"];

      for (let i = 0; i < 10; i++) {
        assert.equal(await sale.drawTokenType(i), (peekTokenTypesAfter[i]).toString());
      }
    });

    it('awardStaleDraws reverts when not allowed', async () => {
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

      const peekResult = await sale.peekDrawPrizes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const peekTokenTypes = peekResult["prizeTokenTypes"];

      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.balanceOf(alice), '0');
      assert.equal(await collectible.balanceOf(bob), '0');

      await expectRevert(
        sale.awardStaleDraws(0,  0, { from:alice }),
        "DISABLED"
      );

      await expectRevert(
        sale.awardStaleDraws(0, 3, { from:bob }),
        "DISABLED"
      );

      await expectRevert(
        sale.awardStaleDraws(0, 7, { from:alice }),
        "DISABLED"
      );

      await expectRevert(
        sale.awardStaleDraws(0, 10, { from:alice }),
        "DISABLED"
      );
    });

    it('awardStaleDraws selects a prize and mints a token when multiple users have purchased draws', async () => {
      const { token, collectible, sale } = this;

      const buyers = [alice, bob];

      const revealBlocks = []
      for (const buyer of buyers) {
        await token.transfer(buyer, '1000', { from:minter });
        await token.approve(sale.address, '1000', { from:buyer });
      }

      for (const buyer of buyers) {
        for (let i = 0; i < 5; i++) {
          await sale.purchaseDraws(buyer, 1, 100, { from:buyer });
          revealBlocks.push(await web3.eth.getBlockNumber() + 15);
        }
      }

      await sale.setAllowAwarding(true, { from:manager });

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
          sale.awardDraws([i], { from:buyer }),
          "BLOCK"
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

      const peekResult = await sale.peekDrawPrizes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const peekTokenTypes = peekResult["prizeTokenTypes"];

      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.balanceOf(alice), '0');
      assert.equal(await collectible.balanceOf(bob), '0');

      await sale.awardStaleDraws(30, 10, { from:carol });
      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.balanceOf(alice), '0');
      assert.equal(await collectible.balanceOf(bob), '0');

      // staleness at next block:
      // 16, 15, 14, 13, 12, 11, 10, 9, 8, 7
      await sale.awardStaleDraws(13, 20, { from:carol });
      assert.equal(await collectible.totalSupply(), '4');
      assert.equal(await collectible.balanceOf(alice), '4');
      assert.equal(await collectible.balanceOf(bob), '0');

      // staleness at next block:
      // 13, 12, 11, 10, 9, 8
      await sale.awardStaleDraws(10, 10, { from:bob });
      assert.equal(await collectible.totalSupply(), '8');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '3');

      await sale.awardStaleDraws(5, 10, { from:bob });
      assert.equal(await collectible.totalSupply(), '10');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '5');

      for (let i = 0; i < 10; i++) {
        const buyer = i < 5 ? alice : bob;
        const index = i < 5 ? i : i - 5;
        const tokenId = `${i}`;
        assert.equal(await sale.drawIdBy(buyer, index), `${i}`);
        assert.equal(await sale.drawGameId(i), `0`);
        assert.equal(await sale.drawRevealed(i), true);
        assert.equal(await sale.drawRevealable(i), false);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);
        assert.equal(await sale.drawTokenId(i), tokenId.toString());
        assert.equal(await sale.drawTokenType(i), (await collectible.tokenType(tokenId)).toString());
        assert.equal(await sale.drawTokenType(i), (peekTokenTypes[i]).toString());
      }

      const peekResultAfter = await sale.peekDrawPrizes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const peekTokenTypesAfter = peekResult["prizeTokenTypes"];

      for (let i = 0; i < 10; i++) {
        assert.equal(await sale.drawTokenType(i), (peekTokenTypesAfter[i]).toString());
      }
    });

    it('revealDraws, awardDraws, awardQueuedDraws, awardStaleDraws mix sensibly', async () => {
      const { token, collectible, sale } = this;

      const buyers = [alice, bob, carol, dave, edith];

      await sale.setAllowAwarding(true, { from:manager });

      const revealBlocks = []
      for (const buyer of buyers) {
        await token.transfer(buyer, '1000', { from:minter });
        await token.approve(sale.address, '1000', { from:buyer });
      }

      for (const buyer of buyers) {
        for (let i = 0; i < 5; i++) {
          await sale.purchaseDraws(buyer, 1, 100, { from:buyer });
          revealBlocks.push(await web3.eth.getBlockNumber() + 15);
        }
      }

      assert.equal(await sale.availableSupply(), '25');
      assert.equal(await sale.drawPrice(), '100');
      assert.equal(await sale.currentGameFor(alice), '0');
      assert.equal(await sale.availableSupplyForUser(alice), '25');
      assert.equal(await sale.currentGame(), '0');

      assert.equal(await sale.totalDraws(), '25');
      assert.equal(await sale.gameDrawCount(0), '25');
      assert.equal(await sale.gameDrawCount(1), '0');

      assert.equal(await sale.drawCountBy(alice), '5');
      assert.equal(await sale.drawCountBy(bob), '5');
      assert.equal(await sale.drawCountBy(carol), '5');
      assert.equal(await sale.drawCountBy(dave), '5');
      assert.equal(await sale.drawCountBy(edith), '5');

      // drawIds queued and next-tx-staleness:
      // 0  1  2  3  4  5  6  7  8  9  10 11  12  13  14  15  16  17  18  19  20  21  22  23  24
      // 9  8  7  6  5  4  3  2  1  0  -1 -2  -3  -4  -5  -6  -7  -8  -9 -10 -11 -12 -13 -14 -15

      assert.equal(await sale.queuedDrawsCount(), '25');
      assert.equal(await sale.queuedDrawId(0), '0');
      assert.equal(await sale.queuedDrawBlocksStale(0), '8'); // will be "9" in next tx
      assert.equal(await sale.queuedDrawBlocksStale(7), '1'); // will be "2" in next tx

      const revealed = [];

      // alice and bob should be revealable
      await sale.revealDraws(alice, [0, 2, 3], { from:alice });
      await sale.revealDraws(bob, [5], { from:bob });
      revealed.push("0", "2", "3", "5");

      // drawIds queued and next-tx-staleness:
      // 1   24  23  4  22  6  7  8  9  10 11  12  13  14  15  16  17  18  19  20  21
      // 10 -13 -12  7 -11  5  4  3  2  1  0   -1  -2  -3  -4  -5  -6  -7 -8  -9  -10
      // revealed: 0, 2, 3, 5

      assert.equal(await collectible.totalSupply(), '4');
      assert.equal(await collectible.balanceOf(alice), '3');
      assert.equal(await collectible.balanceOf(bob), '1');

      assert.equal(await sale.queuedDrawsCount(), '21');
      assert.equal(await sale.queuedDrawId(0), '1');
      assert.equal(await sale.queuedDrawId(1), '24');
      assert.equal(await sale.queuedDrawId(2), '23');
      assert.equal(await sale.queuedDrawId(3), '4');
      assert.equal(await sale.queuedDrawId(4), '22');
      assert.equal(await sale.queuedDrawId(5), '6');
      assert.equal(await sale.queuedDrawBlocksStale(0), '9');
      assert.equal(await sale.queuedDrawBlocksStale(1), '0');
      assert.equal(await sale.queuedDrawBlocksStale(2), '0');
      assert.equal(await sale.queuedDrawBlocksStale(3), '6');
      assert.equal(await sale.queuedDrawBlocksStale(4), '0');
      assert.equal(await sale.queuedDrawBlocksStale(5), '4');

      // award stale
      await sale.awardStaleDraws(4, 10);
      revealed.push("1", "4", "6", "7");

      // drawIds queued and next-tx-staleness:
      //  24  23  21  22  20  19  8  9  10 11  12  13  14  15  16  17  18
      // -12 -11 -9  -10  -8  -7  4  3  2  1   0   -1  -2  -3  -4  -5  -6
      // revealed: 0, 2, 3, 5, 1, 4, 6, 7

      assert.equal(await collectible.totalSupply(), '8');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '3');

      assert.equal(await sale.queuedDrawsCount(), '17');
      assert.equal(await sale.queuedDrawId(0), '24');
      assert.equal(await sale.queuedDrawId(1), '23');
      assert.equal(await sale.queuedDrawId(2), '21');
      assert.equal(await sale.queuedDrawId(3), '22');
      assert.equal(await sale.queuedDrawId(4), '20');
      assert.equal(await sale.queuedDrawId(5), '19');
      assert.equal(await sale.queuedDrawId(8), '10');
      assert.equal(await sale.queuedDrawBlocksStale(0), '0');
      assert.equal(await sale.queuedDrawBlocksStale(1), '0');
      assert.equal(await sale.queuedDrawBlocksStale(2), '0');
      assert.equal(await sale.queuedDrawBlocksStale(3), '0');
      assert.equal(await sale.queuedDrawBlocksStale(4), '0');
      assert.equal(await sale.queuedDrawBlocksStale(5), '0');
      assert.equal(await sale.queuedDrawBlocksStale(8), '1');

      // award stale
      await sale.awardQueuedDraws(20);
      revealed.push("8", "9", "10", "11", "12");

      // drawIds queued and next-tx-staleness:
      //  24  23  21  22  20  19  18  17  16  15  14  13
      // -11 -10 -8  -9  -7  -6  -5  -4  -3  -2  -1   0
      // revealed: 0, 2, 3, 5, 1, 4, 6, 7, 8, 9, 10, 11, 12

      assert.equal(await collectible.totalSupply(), '13');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '5');
      assert.equal(await collectible.balanceOf(carol), '3');

      assert.equal(await sale.queuedDrawsCount(), '12');
      assert.equal(await sale.queuedDrawId(0), '24');
      assert.equal(await sale.queuedDrawId(1), '23');
      assert.equal(await sale.queuedDrawId(2), '21');
      assert.equal(await sale.queuedDrawId(3), '22');
      assert.equal(await sale.queuedDrawId(4), '20');
      assert.equal(await sale.queuedDrawId(5), '19');
      assert.equal(await sale.queuedDrawId(6), '18');
      assert.equal(await sale.queuedDrawBlocksStale(0), '0');
      assert.equal(await sale.queuedDrawBlocksStale(1), '0');
      assert.equal(await sale.queuedDrawBlocksStale(2), '0');
      assert.equal(await sale.queuedDrawBlocksStale(3), '0');
      assert.equal(await sale.queuedDrawBlocksStale(4), '0');
      assert.equal(await sale.queuedDrawBlocksStale(5), '0');
      assert.equal(await sale.queuedDrawBlocksStale(6), '0');

      await time.advanceBlockTo(revealBlocks[18]);

      // drawIds queued and next-tx-staleness:
      //  24  23  21  22  20  19  18  17  16  15  14  13
      // -6   -5  -3  -4  -2  -1   0   1   2   3   4   5
      // revealed: 0, 2, 3, 5, 1, 4, 6, 7, 8, 9, 10, 11, 12

      await sale.awardDraws([17, 15]);
      revealed.push('17', '15');

      // drawIds queued and next-tx-staleness:
      //  24  23  21  22  20  19  18  13  16  14
      // -5   -4  -2  -3  -1   0   1   6   3   5
      // revealed: 0, 2, 3, 5, 1, 4, 6, 7, 8, 9, 10, 11, 12, 17, 15

      assert.equal(await collectible.totalSupply(), '15');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '5');
      assert.equal(await collectible.balanceOf(carol), '3');
      assert.equal(await collectible.balanceOf(dave), '2');

      await time.advanceBlockTo(revealBlocks[24]);

      // drawIds queued and next-tx-staleness:
      //  24  23  21  22  20  19  18  13  16  14
      //   0   1   3   2   4   5   6  10  8  9
      // revealed: 0, 2, 3, 5, 1, 4, 6, 7, 8, 9, 10, 11, 12, 17, 15

      await sale.awardDraws([23, 20, 21]);
      revealed.push("23", "20", "21");

      // drawIds queued and next-tx-staleness:
      //  24  14  13  22  16  19  18
      //   1  11   12  3   9   6   7
      // revealed: 0, 2, 3, 5, 1, 4, 6, 7, 8, 9, 10, 11, 12, 17, 15, 23, 20, 21

      assert.equal(await collectible.totalSupply(), '18');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '5');
      assert.equal(await collectible.balanceOf(carol), '3');
      assert.equal(await collectible.balanceOf(dave), '2');
      assert.equal(await collectible.balanceOf(edith), '3');

      assert.equal(await sale.queuedDrawsCount(), '7');
      assert.equal(await sale.queuedDrawId(0), '24');
      assert.equal(await sale.queuedDrawId(1), '14');
      assert.equal(await sale.queuedDrawId(2), '13');
      assert.equal(await sale.queuedDrawId(3), '22');
      assert.equal(await sale.queuedDrawId(4), '16');
      assert.equal(await sale.queuedDrawId(5), '19');
      assert.equal(await sale.queuedDrawId(6), '18');
      assert.equal(await sale.queuedDrawBlocksStale(0), '0');
      assert.equal(await sale.queuedDrawBlocksStale(1), '10');
      assert.equal(await sale.queuedDrawBlocksStale(2), '11');
      assert.equal(await sale.queuedDrawBlocksStale(3), '2');
      assert.equal(await sale.queuedDrawBlocksStale(4), '8');
      assert.equal(await sale.queuedDrawBlocksStale(5), '5');
      assert.equal(await sale.queuedDrawBlocksStale(6), '6');

      await sale.awardStaleDraws(5, 10);
      revealed.push("14", "13", "16", "19", "18");

      // drawIds queued and next-tx-staleness:
      //  24  22
      //   2  4
      // revealed: 0, 2, 3, 5, 1, 4, 6, 7, 8, 9, 10, 11, 12, 17, 15, 23, 20, 21, 14, 13, 16, 19, 18

      assert.equal(await collectible.totalSupply(), '23');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '5');
      assert.equal(await collectible.balanceOf(carol), '5');
      assert.equal(await collectible.balanceOf(dave), '5');
      assert.equal(await collectible.balanceOf(edith), '3');

      assert.equal(await sale.queuedDrawsCount(), '2');
      assert.equal(await sale.queuedDrawId(0), '24');
      assert.equal(await sale.queuedDrawId(1), '22');
      assert.equal(await sale.queuedDrawBlocksStale(0), '1');
      assert.equal(await sale.queuedDrawBlocksStale(1), '3');

      await sale.awardQueuedDraws(10);
      revealed.push("24", "22");

      assert.equal(await collectible.totalSupply(), '25');
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.balanceOf(bob), '5');
      assert.equal(await collectible.balanceOf(carol), '5');
      assert.equal(await collectible.balanceOf(dave), '5');
      assert.equal(await collectible.balanceOf(edith), '5');

      assert.equal(await sale.queuedDrawsCount(), '0');

      const peekResult = await sale.peekDrawPrizes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
      const peekTokenTypes = peekResult["prizeTokenTypes"];

      for (let i = 0; i < 25; i++) {
        const buyer = buyers[Math.floor(i / 5)];
        const index = i % 5;
        const tokenId = `${revealed.indexOf(`${i}`)}`;
        assert.equal(await sale.drawIdBy(buyer, index), `${i}`);
        assert.equal(await sale.drawGameId(i), `0`);
        assert.equal(await sale.drawRevealed(i), true);
        assert.equal(await sale.drawRevealable(i), false);
        assert.equal(await sale.drawRevealableBlock(i), `${revealBlocks[i]}`);
        assert.equal(await sale.drawTokenId(i), tokenId.toString());
        assert.equal(await sale.drawTokenType(i), (await collectible.tokenType(tokenId)).toString());
        assert.equal(await sale.drawTokenType(i), (peekTokenTypes[i]).toString());
      }
    });
  });

  context('with prize flow', () => {
    let blockNumber;
    beforeEach(async  () => {
      const { token, collectible, sale, helper } = this;

      await token.transfer(alice, '10000000', { from:minter });
      await token.transfer(bob, '10000000', { from:minter });
      await token.transfer(carol, '10000000', { from:minter });
      await token.approve(sale.address, '10000000', { from:alice });
      await token.approve(sale.address, '10000000', { from:bob });
      await token.approve(sale.address, '10000000', { from:carol });

      await helper.createActivatedGame(true, 100, 15, 50, 0, 1, 0, [2, 3], [10, 30], { from:alice });
      blockNumber = await web3.eth.getBlockNumber();
      await helper.createActivatedGame(false, 120, 10, 20, 10, 1, blockNumber + 20, [5, 6, 7], [5, 2, 1], { from:manager });
      await helper.createActivatedGame(false, 5, 10, 0, 1, 3, blockNumber + 30, [0, 1, 2], [100, 10, 1], { from:alice });
    });

    it('(internal): set GameDrawFlow appropriately', async () => {
      const { token, collectible, sale } = this;

      let info = await sale.gameDrawFlow(0);
      assert.equal(info["numerator"], '0');
      assert.equal(info["denominator"], '1');
      assert.equal((info["updateBlock"]).toString(), `${blockNumber}`);  // next block after reading
      assert.equal(info["updateDraws"], '50');

      info = await sale.gameDrawFlow(1);
      assert.equal(info["numerator"], '10');
      assert.equal(info["denominator"], '1');
      assert.equal(info["updateBlock"], `${blockNumber + 20}`);
      assert.equal(info["updateDraws"], `20`);

      info = await sale.gameDrawFlow(2);
      assert.equal(info["numerator"], '1');
      assert.equal(info["denominator"], '3');
      assert.equal(info["updateBlock"], `${blockNumber + 30}`);
      assert.equal(info["updateDraws"], `0`);
    });

    it('availableSupply: reports expected flow', async () => {
      const { token, collectible, sale } = this;

      // expected supply
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await time.advanceBlockTo(blockNumber + 20);
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '30');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '40');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '50');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await time.advanceBlockTo(blockNumber + 30);
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '120');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await time.advanceBlock();
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '140');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '150');
      assert.equal(await sale.availableSupplyForGame(2), '1');

      await time.advanceBlock();
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '170');
      assert.equal(await sale.availableSupplyForGame(2), '1');

      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '180');
      assert.equal(await sale.availableSupplyForGame(2), '2');

      await time.advanceBlock();
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '200');
      assert.equal(await sale.availableSupplyForGame(2), '2');

      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '210');
      assert.equal(await sale.availableSupplyForGame(2), '3');
    });

    it('purchaseDraws: able to purchase up to available supply', async () => {
      const { token, collectible, sale, helper } = this;

      await helper.assignGame(0, [alice]);
      await helper.assignGame(1, [bob]);
      await helper.assignGame(2, [carol]);

      // expected supply
      assert.equal(await sale.availableSupplyForGame(0), '50');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      // buy
      await sale.purchaseDraws(alice, 25, 100000, { from:alice });
      assert.equal(await sale.availableSupplyForGame(0), '25');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await sale.purchaseDraws(alice, 25, 100000, { from:alice });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await sale.purchaseDraws(bob, 20, 100000, { from:bob });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '0');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await time.advanceBlockTo(blockNumber + 19);
      // none for bob this block, but some next time
      await expectRevert(
        sale.purchaseDraws(bob, 1, 100000, { from:bob }),
        "SUPPLY"
      );
      await sale.purchaseDraws(bob, 1, 10000, { from:bob });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '9');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await sale.purchaseDraws(bob, 10, 10000, { from:bob });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '9');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await sale.purchaseDraws(bob, 19, 10000, { from:bob });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '0');
      assert.equal(await sale.availableSupplyForGame(2), '0');

      await time.advanceBlockTo(blockNumber + 30);
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '70');
      assert.equal(await sale.availableSupplyForGame(2), '0');
      // advance 3 more and buy
      await expectRevert(
        sale.purchaseDraws(carol, 1, 100000, { from:carol }),
        "SUPPLY"
      );
      await expectRevert(
        sale.purchaseDraws(carol, 1, 100000, { from:carol }),
        "SUPPLY"
      );
      await sale.purchaseDraws(carol, 1, 100000, { from:carol });
      assert.equal(await sale.availableSupplyForGame(0), '0');
      assert.equal(await sale.availableSupplyForGame(1), '100');
      assert.equal(await sale.availableSupplyForGame(2), '0');
    });

    it('setGameDrawFlowAndSupply and related methods reverts for non-manager', async () => {
      const { token, collectible, sale } = this;

      await expectRevert(
        sale.setGameDrawFlowAndSupply(0, 100, 0, 1, 0, { from:bob }),
        "AUTH"
      );

      await expectRevert(
        sale.setGameSupply(1, 1000, { from:carol }),
        "AUTH"
      );

      await expectRevert(
        sale.setGameDrawFlow(2, 14, 2, blockNumber + 100, { from:bob }),
        "AUTH"
      );
    });

    it('setGameDrawFlowAndSupply and related methods revert for invalid params', async () => {
      const { token, collectible, sale } = this;

      // game id
      await expectRevert(
        sale.setGameDrawFlowAndSupply(3, 100, 0, 1, 0, { from:alice }),
        "OOB"
      );

      await expectRevert(
        sale.setGameSupply(4, 1000, { from:manager }),
        "OOB"
      );

      await expectRevert(
        sale.setGameDrawFlow(5, 14, 2, blockNumber + 100, { from:manager }),
        "OOB"
      );

      // _denominator
      await expectRevert(
        sale.setGameDrawFlowAndSupply(1, 100, 0, 0, 0, { from:alice }),
        "NONZERO"
      );

      await expectRevert(
        sale.setGameDrawFlow(2, 14, 0, blockNumber + 100, { from:manager }),
        "NONZERO"
      );

      // precision
      await expectRevert(
        sale.setGameDrawFlowAndSupply(1, 100, 0, '10000000000000000000000000000000', 0, { from:alice }),
        "PRECISION"
      );

      await expectRevert(
        sale.setGameDrawFlow(2, '1400000000000000000000000000000000000', 1, blockNumber + 100, { from:manager }),
        "PRECISION"
      );
    });

    it('setGameDrawFlowAndSupply updates values as expected', async () => {
      const { token, collectible, sale } = this;

      await sale.setGameDrawFlowAndSupply(0, 137, 5, 10, 0, { from:alice });
      let info = await sale.gameDrawFlow(0);
      assert.equal(info["numerator"], '5');
      assert.equal(info["denominator"], '10');
      assert.equal((info["updateBlock"]).toString(), `${await web3.eth.getBlockNumber()}`);  // next block after reading
      assert.equal(info["updateDraws"], '137');
      assert.equal(await sale.availableSupplyForGame(0), '137');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '137');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '138');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '138');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '139');

      blockNumber = await web3.eth.getBlockNumber();
      await sale.setGameDrawFlowAndSupply(1, 20, 10, 3, blockNumber + 5); // now current + 4
      info = await sale.gameDrawFlow(1);
      assert.equal(info["numerator"], '10');
      assert.equal(info["denominator"], '3');
      assert.equal((info["updateBlock"]).toString(), `${blockNumber + 5}`);  // next block after reading
      assert.equal(info["updateDraws"], '20');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      await time.advanceBlockTo(blockNumber + 5);
      assert.equal(await sale.availableSupplyForGame(1), '20');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '23');   // 20 + 10/3=3.3
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '26');   // 20 + 20/3=6.7
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '30');   // 20 + 30/3=10
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '33');   // 20 + 40/3=13.3
    });

    it('setGameDrawFlowAndSupply updates values as expected even when purchase have been made', async () => {
      const { token, collectible, sale, helper } = this;

      await helper.assignGame(0, [alice]);
      await helper.assignGame(1, [bob]);

      await sale.purchaseDraws(alice, 25, 1000000, { from:alice });
      await sale.setGameDrawFlowAndSupply(0, 137, 5, 10, 0, { from:alice });
      let info = await sale.gameDrawFlow(0);
      assert.equal(info["numerator"], '5');
      assert.equal(info["denominator"], '10');
      assert.equal((info["updateBlock"]).toString(), `${await web3.eth.getBlockNumber()}`);  // next block after reading
      assert.equal((info["updateDraws"]).toString(), '162'); // 137 + 25
      assert.equal(await sale.availableSupplyForGame(0), '137');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '137');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '138');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '138');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '139');

      await sale.purchaseDraws(bob, 12, 1000000, { from:bob });
      blockNumber = await web3.eth.getBlockNumber();
      await sale.setGameDrawFlowAndSupply(1, 20, 10, 3, blockNumber + 5); // now current + 4
      info = await sale.gameDrawFlow(1);
      assert.equal(info["numerator"], '10');
      assert.equal(info["denominator"], '3');
      assert.equal((info["updateBlock"]).toString(), `${blockNumber + 5}`);  // next block after reading
      assert.equal(info["updateDraws"], '32');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      await time.advanceBlockTo(blockNumber + 5);
      assert.equal(await sale.availableSupplyForGame(1), '20');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '23');   // 20 + 10/3=3.3
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '26');   // 20 + 20/3=6.7
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '30');   // 20 + 30/3=10
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '33');   // 20 + 40/3=13.3
    });

    it('setGameDrawFlow updates values as expected', async () => {
      const { token, collectible, sale } = this;

      await sale.setGameDrawFlow(0, 5, 10, 0, { from:alice });
      let info = await sale.gameDrawFlow(0);
      assert.equal(info["numerator"], '5');
      assert.equal(info["denominator"], '10');
      assert.equal((info["updateBlock"]).toString(), `${await web3.eth.getBlockNumber()}`);  // next block after reading
      assert.equal(info["updateDraws"], '50');
      assert.equal(await sale.availableSupplyForGame(0), '50');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '50');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '51');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '51');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '52');

      blockNumber = await web3.eth.getBlockNumber();
      await sale.setGameDrawFlow(1, 10, 3, blockNumber + 5); // now current + 4
      info = await sale.gameDrawFlow(1);
      assert.equal(info["numerator"], '10');
      assert.equal(info["denominator"], '3');
      assert.equal((info["updateBlock"]).toString(), `${blockNumber + 5}`);  // next block after reading
      assert.equal(info["updateDraws"], '20');
      assert.equal(await sale.availableSupplyForGame(1), '20');
      await time.advanceBlockTo(blockNumber + 5);
      assert.equal(await sale.availableSupplyForGame(1), '20');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '23');   // 20 + 10/3=3.3
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '26');   // 20 + 20/3=6.7
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '30');   // 20 + 30/3=10
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '33');   // 20 + 40/3=13.3
    });

    it('setGameDrawFlow updates values as expected even when purchase have been made', async () => {
      const { token, collectible, sale, helper } = this;

      await helper.assignGame(0, [alice]);
      await helper.assignGame(1, [bob]);

      await sale.purchaseDraws(alice, 25, 1000000, { from:alice });
      await sale.setGameDrawFlow(0, 5, 10, 0, { from:alice });
      let info = await sale.gameDrawFlow(0);
      assert.equal(info["numerator"], '5');
      assert.equal(info["denominator"], '10');
      assert.equal((info["updateBlock"]).toString(), `${await web3.eth.getBlockNumber()}`);  // next block after reading
      assert.equal((info["updateDraws"]).toString(), '50');
      assert.equal(await sale.availableSupplyForGame(0), '25');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '25');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '26');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '26');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '27');

      await sale.purchaseDraws(bob, 12, 1000000, { from:bob });
      blockNumber = await web3.eth.getBlockNumber();
      await sale.setGameDrawFlow(1, 10, 3, blockNumber + 5); // now current + 4
      info = await sale.gameDrawFlow(1);
      assert.equal(info["numerator"], '10');
      assert.equal(info["denominator"], '3');
      assert.equal((info["updateBlock"]).toString(), `${blockNumber + 5}`);  // next block after reading
      assert.equal(info["updateDraws"], '20');
      assert.equal(await sale.availableSupplyForGame(1), '8');
      await time.advanceBlockTo(blockNumber + 5);
      assert.equal(await sale.availableSupplyForGame(1), '8');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '11');   // 20 + 10/3=3.3
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '14');   // 20 + 20/3=6.7
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '18');   // 20 + 30/3=10
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '21');   // 20 + 40/3=13.3
    });

    it('setGameSupply updates values as expected', async () => {
      const { token, collectible, sale } = this;

      await sale.setGameSupply(0, 111, { from:alice });
      let info = await sale.gameDrawFlow(0);
      assert.equal(info["numerator"], '0');
      assert.equal(info["denominator"], '1');
      assert.equal((info["updateBlock"]).toString(), `${await web3.eth.getBlockNumber()}`);  // next block after reading
      assert.equal(info["updateDraws"], '111');
      assert.equal(await sale.availableSupplyForGame(0), '111');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '111');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '111');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '111');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(0), '111');

      await sale.setGameSupply(1, 77);
      info = await sale.gameDrawFlow(1);
      assert.equal(info["numerator"], '10');
      assert.equal(info["denominator"], '1');
      assert.equal((info["updateBlock"]).toString(), `${blockNumber + 20}`);  // next block after reading
      assert.equal(info["updateDraws"], '77');
      await time.advanceBlockTo(blockNumber + 20);
      assert.equal(await sale.availableSupplyForGame(1), '77');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '87');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '97');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '107');
      await time.advanceBlock();
      assert.equal(await sale.availableSupplyForGame(1), '117');
    });
  });
});
