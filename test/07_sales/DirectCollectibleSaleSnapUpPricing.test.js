const { expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');
const MockERC20 = artifacts.require('MockERC20');
const ERC721ValuableCollectibleToken = artifacts.require('ERC721ValuableCollectibleToken');
const DirectCollectibleSaleSnapUpPricing = artifacts.require('DirectCollectibleSaleSnapUpPricing');
const FractionalExponents = artifacts.require('FractionalExponents');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('DirectCollectibleSaleSnapUpPricing', ([alice, bob, carol, dave, edith, fred, manager, minter, salter]) => {
  const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');
  const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');

  before(async () => {
    this.fexp = await FractionalExponents.new();
  })

  beforeEach(async () => {
    this.token = await MockERC20.new("Token", "T", "1000000000", { from:minter });

    this.animal = await ERC721ValuableCollectibleToken.new("Rara Animal Series", "NFT", "https://rara.farm/animal/", { from: alice });
    for (let i = 0; i < 4; i++) {
      await this.animal.addTokenType(`Animal ${i}`, `A${i}`, i);
    }

    this.food = await ERC721ValuableCollectibleToken.new("Rara Animal Food Series", "NFT_Food", "https://rara.farm/food/", { from: alice });
    for (let i = 0; i < 4; i++) {
      await this.food.addTokenType(`Food ${i}`, `A${i}`, i);
    }

    this.sale = await DirectCollectibleSaleSnapUpPricing.new(this.token.address, this.fexp.address, ZERO_ADDRESS);
    this.animal.grantRole(MINTER_ROLE, this.sale.address);
    this.food.grantRole(MINTER_ROLE, this.sale.address);
    this.sale.grantRole(MANAGER_ROLE, manager);
  });

  it('should have set initial state', async () => {
    const { token, animal, sale } = this;

    assert.equal(await sale.purchaseToken(), token.address);

    assert.equal(await sale.recipient(), ZERO_ADDRESS);

    assert.equal(await sale.receiptCountBy(alice), '0');
    assert.equal(await sale.receiptCountBy(carol), '0');

    assert.equal(await sale.totalReceipts(), '0');
    assert.equal(await sale.itemCount(), '0');
  });

  it('claimProceeds reverts for non-manager', async () => {
    const { token, sale } = this;

    await token.transfer(sale.address, '10000', { from:minter });
    await expectRevert(
      sale.claimProceeds(alice, 1000, { from:bob }),
      "BaseDirectCollectibleSale: must have MANAGER role to claimProceeds"
    );

    await expectRevert(
      sale.claimProceeds(manager, 1000, { from:salter }),
      "BaseDirectCollectibleSale: must have MANAGER role to claimProceeds"
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
      "BaseDirectCollectibleSale: must have MANAGER role to claimAllProceeds"
    );

    await expectRevert(
      sale.claimAllProceeds(manager, { from:salter }),
      "BaseDirectCollectibleSale: must have MANAGER role to claimAllProceeds"
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
    const { token, animal, sale } = this;

    await expectRevert(
      sale.setRecipient(bob, { from:bob }),
      "BaseDirectCollectibleSale: must have MANAGER role to setRecipient"
    );

    await expectRevert(
      sale.setRecipient(dave, { from:carol }),
      "BaseDirectCollectibleSale: must have MANAGER role to setRecipient"
    );

    await expectRevert(
      sale.setRecipient(ZERO_ADDRESS, { from:dave }),
      "BaseDirectCollectibleSale: must have MANAGER role to setRecipient"
    );
  });

  it('setRecipient should alter recipient', async () => {
    const { token, animal, sale } = this;

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

  it('createItem should revert for non-managers', async () => {
    const { token, animal, sale } = this;

    await expectRevert(
      sale.createItem(
        animal.address,
        0,      // token type
        true,   // available
        100,
        0,
        0,
        [0, 1],
        [0, 1],
        { from:bob }
      ),
      "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to create item"
    );
  });

  it('createItem should revert for invalid parameters', async () => {
    const { token, animal, sale } = this;

    await expectRevert.unspecified(
      sale.createItem(token.address, 0, true, 100, 0, 0, [0, 1], [0, 1], { from:alice })
    );

    await expectRevert(
      sale.createItem(animal.address, 5, true, 100, 0, 0, [0, 1], [0, 1], { from:manager }),
      "BaseDirectCollectibleSale: nonexistent tokenType"
    );

    await expectRevert(
      sale.createItem(animal.address, 1, true, 100, 0, 0, [0], [0, 1], { from:alice }),
      "BaseDirectCollectibleSaleSnapUpPricing: scalar and exp must have length 2 (numerator and demoninator)"
    );

    await expectRevert(
      sale.createItem(animal.address, 1, true, 100, 0, 0, [0, 1], [0, 1, 2], { from:manager }),
      "BaseDirectCollectibleSaleSnapUpPricing: scalar and exp must have length 2 (numerator and demoninator)"
    );

    await expectRevert(
      sale.createItem(animal.address, 1, true, 100, 0, 0, [0, 0], [0, 1], { from:alice }),
      "BaseDirectCollectibleSaleSnapUpPricing: denominators must be nonzero"
    );

    await expectRevert(
      sale.createItem(animal.address, 1, true, 100, 0, 0, [0, 1], [0, 0], { from:manager }),
      "BaseDirectCollectibleSaleSnapUpPricing: denominators must be nonzero"
    );
  });

  it('createItem should set public state appropriately', async () => {
    const { food, animal, sale } = this;

    await sale.createItem(animal.address, 1, true, 100, 0, 0, [0, 1], [0, 1], { from:manager });
    assert.equal(await sale.itemCount(), '1');
    assert.equal(await sale.availableItemSupply(0), '0');
    await expectRevert.unspecified(sale.purchasePrice(0, 1));
    assert.equal(await sale.itemReceiptCount(0), '0');
    assert.equal(await sale.totalReceipts(), '0');
    assert.equal(await sale.itemToken(0), animal.address);
    assert.equal(await sale.itemTokenType(0), 1);

    await sale.createItem(food.address, 3, false, 150, 2, 100, [2, 9], [1, 5], { from:manager });
    assert.equal(await sale.itemCount(), '2');
    assert.equal(await sale.availableItemSupply(1), '0');
    await expectRevert.unspecified(sale.purchasePrice(1, 1));
    assert.equal(await sale.itemReceiptCount(1), '0');
    assert.equal(await sale.totalReceipts(), '0');
    assert.equal(await sale.itemToken(1), food.address);
    assert.equal(await sale.itemTokenType(1), 3);
  });

  it('(internal) createItem should set internal state appropriately', async () => {
    const { food, animal, sale } = this;

    await sale.createItem(animal.address, 1, true, 100, 0, 0, [0, 1], [0, 1], { from:manager });
    let info = await sale.itemInfo(0);
    assert.equal(info.token, animal.address);
    assert.equal(info.tokenType, '1');
    assert.equal(info.available, true);

    info = await sale.itemSupplyInfo(0);
    assert.equal(info.supply, '0');
    assert.equal(info.duration, '0');
    assert.equal(info.anchorTime, '0');
    assert.equal(info.openTime, '0');
    assert.equal(info.closeTime, '0');
    assert.equal(info.totalSupply, '0');
    assert.equal(info.currentPeriodStartTime, '0');

    info = await sale.itemPricing(0);
    assert.equal(info.minimum, '100');
    assert.equal(info.scale, '1');
    assert.equal(info.thresholdSupply, '0');
    assert.equal(info.scalarN, '0');
    assert.equal(info.scalarD, '1');
    assert.equal(info.expN, '0');
    assert.equal(info.expD, '1');

    await sale.createItem(food.address, 3, false, 150, 2, 100, [5, 1], [4, 3], { from:manager });
    info = await sale.itemInfo(1);
    assert.equal(info.token, food.address);
    assert.equal(info.tokenType, '3');
    assert.equal(info.available, false);

    info = await sale.itemSupplyInfo(1);
    assert.equal(info.supply, '0');
    assert.equal(info.duration, '0');
    assert.equal(info.anchorTime, '0');
    assert.equal(info.openTime, '0');
    assert.equal(info.closeTime, '0');
    assert.equal(info.totalSupply, '0');
    assert.equal(info.currentPeriodStartTime, '0');

    info = await sale.itemPricing(1);
    assert.equal(info.minimum, '15000');
    assert.equal(info.scale, '100');
    assert.equal(info.thresholdSupply, '100');
    assert.equal(info.scalarN, '5');
    assert.equal(info.scalarD, '1');
    assert.equal(info.expN, '4');
    assert.equal(info.expD, '3');
  });

  it('createItemWithResupplyPricing should revert for non-managers', async () => {
    const { token, animal, sale } = this;

    await expectRevert(
      sale.createItemWithResupplyPricing(
        animal.address, 2,
        [250, 0, 0], [20, '100500900400'],
        100, 1, [3, 2], [5, 1],
        { from:bob }
      ),
      "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to create item"
    );
  });

  it('createItemWithResupplyPricing should revert for invalid parameters', async () => {
    const { token, animal, sale } = this;

    await expectRevert.unspecified(
      sale.createItemWithResupplyPricing(
        token.address, 0,
        [250, 1000, 0], [20, '100500900400'],
        100, 1, [3, 2], [5, 1],
        { from:alice }
      )
    );

    await expectRevert(
      sale.createItemWithResupplyPricing(
        animal.address, 5,
        [250, 1000, 0], [20, '100500900400'],
        100, 1, [3, 2], [5, 1],
        { from:alice }
      ),
      "BaseDirectCollectibleSale: nonexistent tokenType"
    );

    await expectRevert(
      sale.createItemWithResupplyPricing(
        animal.address, 2,
        [250, 1000, 0], [20, '100500900400'],
        100, 1, [3], [5, 1],
        { from:alice }
      ),
      "BaseDirectCollectibleSaleSnapUpPricing: scalar and exp must have length 2 (numerator and demoninator)"
    );

    await expectRevert(
      sale.createItemWithResupplyPricing(
        animal.address, 2,
        [250, 1000, 0], [20, '100500900400'],
        100, 1, [3, 2], [5, 1, 4],
        { from:alice }
      ),
      "BaseDirectCollectibleSaleSnapUpPricing: scalar and exp must have length 2 (numerator and demoninator)"
    );

    await expectRevert(
      sale.createItemWithResupplyPricing(
        animal.address, 2,
        [250, 1000, 0], [20, '100500900400'],
        100, 1, [3, 0], [5, 1],
        { from:alice }
      ),
      "BaseDirectCollectibleSaleSnapUpPricing: denominators must be nonzero"
    );

    await expectRevert(
      sale.createItemWithResupplyPricing(
        animal.address, 2,
        [250, 1000, 0], [20, '100500900400'],
        100, 1, [3, 2], [5, 0],
        { from:alice }
      ),
      "BaseDirectCollectibleSaleSnapUpPricing: denominators must be nonzero"
    );

    await expectRevert(
      sale.createItemWithResupplyPricing(
        animal.address, 2,
        [250, 0, 10], [20, '100500900400'],
        100, 1, [3, 2], [5, 0],
        { from:alice }
      ),
      "BaseDirectCollectibleSaleRegularResupply: duration 0 (unlimited) requires anchorTime 0 and immediate update"
    );
  });

  it('createItemWithResupplyPricing should set public state appropriately', async () => {
    const { food, animal, sale } = this;

    await sale.createItemWithResupplyPricing(
      animal.address, 2,
      [250, 0, 0], [20, 100500900400],
      10, 1, [3, 2], [5, 1],
      { from:alice }
    );
    assert.equal(await sale.itemCount(), '1');
    assert.equal(await sale.availableItemSupply(0), '250');
    assert.equal(await sale.purchasePrice(0, 1), '100');
    assert.equal(await sale.itemReceiptCount(0), '0');
    assert.equal(await sale.totalReceipts(), '0');
    assert.equal(await sale.itemToken(0), animal.address);
    assert.equal(await sale.itemTokenType(0), 2);

    await sale.createItemWithResupplyPricing(
      food.address, 1,
      [311, 1000, 10], [0, 0],
      130, 2, [2, 500], [1, 4],
      { from:manager }
    );
    assert.equal(await sale.itemCount(), '2');
    assert.equal(await sale.availableItemSupply(1), '311');
    assert.equal(await sale.purchasePrice(1, 1), '13000');
    assert.equal(await sale.itemReceiptCount(1), '0');
    assert.equal(await sale.totalReceipts(), '0');
    assert.equal(await sale.itemToken(1), food.address);
    assert.equal(await sale.itemTokenType(1), 1);
  });

  it('(internal) createItemWithResupplyPricing should set internal state appropriately', async () => {
    const { food, animal, sale } = this;

    await sale.createItemWithResupplyPricing(
      animal.address, 2,
      [250, 0, 0], [20, 100500900400],
      100, 1, [3, 2], [5, 1],
      { from:alice }
    );
    let info = await sale.itemInfo(0);
    assert.equal(info.token, animal.address);
    assert.equal(info.tokenType, '2');
    assert.equal(info.available, true);

    info = await sale.itemSupplyInfo(0);
    assert.equal(info.supply, '250');
    assert.equal(info.duration, '0');
    assert.equal(info.anchorTime, '0');
    assert.equal(info.openTime, '20');
    assert.equal(info.closeTime, '100500900400');
    assert.equal(info.totalSupply, '250');
    assert.equal(info.currentPeriodStartTime, '0');

    info = await sale.itemPricing(0);
    assert.equal(info.minimum, '1000');
    assert.equal(info.scale, '10');
    assert.equal(info.thresholdSupply, '250');
    assert.equal(info.scalarN, '3');
    assert.equal(info.scalarD, '2');
    assert.equal(info.expN, '5');
    assert.equal(info.expD, '1');

    await sale.createItemWithResupplyPricing(
      food.address, 1,
      [311, 1000, 10], [0, 0],
      130, 2, [2, 5], [1, 2],
      { from:manager }
    );
    info = await sale.itemInfo(1);
    assert.equal(info.token, food.address);
    assert.equal(info.tokenType, '1');
    assert.equal(info.available, true);

    info = await sale.itemSupplyInfo(1);
    assert.equal(info.supply, '311');
    assert.equal(info.duration, '1000');
    assert.equal(info.anchorTime, '10');
    assert.equal(info.openTime, '0');
    assert.equal(info.closeTime, '0');
    assert.equal(info.totalSupply, '311');
    assert.equal((info.currentPeriodStartTime).toString(), `${Math.floor((await time.latest() - 10) / 1000) * 1000 + 10}`);

    info = await sale.itemPricing(1);
    assert.equal(info.minimum, '13000');
    assert.equal(info.scale, '100');
    assert.equal(info.thresholdSupply, '311');
    assert.equal(info.scalarN, '2');
    assert.equal(info.scalarD, '5');
    assert.equal(info.expN, '1');
    assert.equal(info.expD, '2');
  });

  context('with items for sale', () => {
    let anchorTime, anchorOffset;
    beforeEach(async  () => {
      const { token, animal, food, sale } = this;

      anchorTime = Number(await time.latest());
      anchorOffset = anchorTime % 1000;
      // food sales
      await sale.createItemWithResupplyPricing(food.address, 2, [1850, 1000, anchorTime], [0, 0], 16, 0, [1, 4], [1, 2], { from:alice });
      await sale.createItemWithResupplyPricing(food.address, 1, [420, 1000, anchorTime], [0, 0], 45, 0, [10, 1], [1, 2], { from:manager });
      await sale.createItemWithResupplyPricing(food.address, 0, [260, 1000, anchorTime], [0, 0], 100, 0, [100, 1], [1, 2], { from:alice });

      // animal sales
      await sale.createItem(animal.address, 2, true, 100, 0, 100, [0, 1], [1, 1], { from:alice });
      await sale.createItem(animal.address, 1, true, 200, 0, 100, [0, 1], [1, 1], { from:alice });
      await sale.createItem(animal.address, 0, true, 500, 0, 100, [0, 1], [1, 1], { from:alice });
    });

    it('setItemSupply reverts for non-manager', async () => {
      const { sale } = this;
      await expectRevert(
        sale.setItemSupply(0, 100, { from:bob }),
        "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item supply or pricing"
      );

      await expectRevert(
        sale.setItemSupply(0, 100, { from:carol }),
        "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item supply or pricing"
      );
    });

    it('setItemSupply reverts for invalid itemId', async () => {
      const { sale } = this;
      await expectRevert(
        sale.setItemSupply(6, 100, { from:alice }),
        "DirectCollectibleSaleSnapUpPricing: invalid itemId"
      );

      await expectRevert(
        sale.setItemSupply(7, 100, { from:manager }),
        "DirectCollectibleSaleSnapUpPricing: invalid itemId"
      );
    });

    it('setItemSupply alters availableSupply', async () => {
      const { sale } = this;
      await sale.setItemSupply(0, 999, { from:alice });
      assert.equal(await sale.availableItemSupply(0), '999');

      await sale.setItemSupply(3, 2, { from:manager });
      assert.equal(await sale.availableItemSupply(3), '2');
    });

    it('addItemSupply reverts for non-manager', async () => {
      const { sale } = this;
      await expectRevert(
        sale.addItemSupply(0, 100, { from:bob }),
        "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item supply or pricing"
      );

      await expectRevert(
        sale.addItemSupply(0, 100, { from:carol }),
        "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item supply or pricing"
      );
    });

    it('addItemSupply reverts for invalid itemId', async () => {
      const { sale } = this;
      await expectRevert(
        sale.addItemSupply(6, 100, { from:alice }),
        "DirectCollectibleSaleSnapUpPricing: invalid itemId"
      );

      await expectRevert(
        sale.addItemSupply(7, 100, { from:manager }),
        "DirectCollectibleSaleSnapUpPricing: invalid itemId"
      );
    });

    it('addItemSupply alters availableSupply', async () => {
      const { sale } = this;
      await sale.addItemSupply(0, 999, { from:alice });
      assert.equal(await sale.availableItemSupply(0), '2849');

      await sale.addItemSupply(3, 2, { from:manager });
      assert.equal(await sale.availableItemSupply(3), '2');
    });

    it('setItemResupplyPricing and related methods reverts for non-manager', async () => {
      const { sale } = this;
      await expectRevert(
        sale.setItemResupplyPricing(2, [177, 500, 0], [50, 100], true, 45, 0, [10, 1], [1, 2], { from:bob }),
        "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item supply or pricing"
      );

      await expectRevert(
        sale.setItemPricing(1, 45, 0, 100, [10, 1], [1, 2], { from:carol }),
        "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item supply or pricing"
      );

      await expectRevert(
        sale.setItemResupply(0, [177, 500, 0], [50, 100], true, { from:dave }),
        "DirectCollectibleSaleSnapUpPricing: must have MANAGER role to set item supply or pricing"
      );
    });

    it('setItemResupplyPricing and related methods reverts for invalid params', async () => {
      const { sale } = this;

      // invalid itemId
      await expectRevert(
        sale.setItemResupplyPricing(6, [177, 500, 0], [50, 100], true, 45, 0, [10, 1], [1, 2], { from:alice }),
        "DirectCollectibleSaleSnapUpPricing: invalid itemId"
      );

      await expectRevert(
        sale.setItemPricing(7, 45, 0, 100, [10, 1], [1, 2], { from:manager }),
        "DirectCollectibleSaleSnapUpPricing: invalid itemId"
      );

      await expectRevert(
        sale.setItemResupply(10, [177, 500, 0], [50, 100], true, { from:alice }),
        "DirectCollectibleSaleSnapUpPricing: invalid itemId"
      );

      // invalid pricing array length
      await expectRevert(
        sale.setItemResupplyPricing(2, [177, 500, 0], [50, 100], true, 45, 0, [10], [1, 2], { from:alice }),
        "BaseDirectCollectibleSaleSnapUpPricing: scalar and exp must have length 2 (numerator and demoninator)"
      );
      await expectRevert(
        sale.setItemResupplyPricing(2, [177, 500, 0], [50, 100], true, 45, 0, [10, 1], [1, 2, 3], { from:alice }),
        "BaseDirectCollectibleSaleSnapUpPricing: scalar and exp must have length 2 (numerator and demoninator)"
      );
      await expectRevert(
        sale.setItemPricing(3, 45, 0, 100, [10, 1], [1], { from:manager }),
        "BaseDirectCollectibleSaleSnapUpPricing: scalar and exp must have length 2 (numerator and demoninator)"
      );
      await expectRevert(
        sale.setItemPricing(3, 45, 0, 100, [10, 1], [1, 2, 4], { from:manager }),
        "BaseDirectCollectibleSaleSnapUpPricing: scalar and exp must have length 2 (numerator and demoninator)"
      );

      // invalid pricing denominators
      await expectRevert(
        sale.setItemResupplyPricing(2, [177, 500, 0], [50, 100], true, 45, 0, [10, 0], [1, 2], { from:alice }),
        "BaseDirectCollectibleSaleSnapUpPricing: denominators must be nonzero"
      );
      await expectRevert(
        sale.setItemResupplyPricing(2, [177, 500, 0], [50, 100], true, 45, 0, [10, 1], [1, 0], { from:alice }),
        "BaseDirectCollectibleSaleSnapUpPricing: denominators must be nonzero"
      );
      await expectRevert(
        sale.setItemPricing(1, 45, 0, 100, [10, 0], [1, 2], { from:manager }),
        "BaseDirectCollectibleSaleSnapUpPricing: denominators must be nonzero"
      );
      await expectRevert(
        sale.setItemPricing(1, 45, 0, 100, [10, 1], [1, 0], { from:manager }),
        "BaseDirectCollectibleSaleSnapUpPricing: denominators must be nonzero"
      );

      // invalid resupply period settings
      await expectRevert(
        sale.setItemResupplyPricing(1, [14, 0, 50], [50, 100], true, 45, 0, [10, 1], [1, 2], { from:alice }),
        "BaseDirectCollectibleSaleRegularResupply: duration 0 (unlimited) requires anchorTime 0 and immediate update"
      );

      await expectRevert(
        sale.setItemResupplyPricing(2, [177, 0, 0], [50, 100], false, 45, 0, [10, 0], [1, 2], { from:alice }),
        "BaseDirectCollectibleSaleRegularResupply: duration 0 (unlimited) requires anchorTime 0 and immediate update"
      );

      await expectRevert(
        sale.setItemResupply(0, [177, 0, 104], [50, 100], true, { from:alice }),
        "BaseDirectCollectibleSaleRegularResupply: duration 0 (unlimited) requires anchorTime 0 and immediate update"
      );

      await expectRevert(
        sale.setItemResupply(0, [177, 0, 0], [50, 100], false, { from:alice }),
        "BaseDirectCollectibleSaleRegularResupply: duration 0 (unlimited) requires anchorTime 0 and immediate update"
      );
    });

    it('setItemResupplyPricing updates public state as expected', async () => {
      const { sale, food } = this;

      await sale.setItemResupplyPricing(2, [177, 500, 0], [50, '100030300030044'], true, 45, 0, [10, 4], [1, 2], { from:alice });
      assert.equal(await sale.itemCount(), '6');
      assert.equal(await sale.availableItemSupply(2), '177');
      assert.equal(await sale.purchasePrice(2, 1), '45');
      assert.equal(await sale.itemReceiptCount(2), '0');
      assert.equal(await sale.totalReceipts(), '0');
      assert.equal(await sale.itemToken(2), food.address);
      assert.equal(await sale.itemTokenType(2), 0);

      await sale.setItemResupplyPricing(1, [177, 500, 0], [50, '100030300030044'], false, 45, 1, [10, 4], [1, 2], { from:alice });
      assert.equal(await sale.itemCount(), '6');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.purchasePrice(1, 1), '450');
      assert.equal(await sale.itemReceiptCount(1), '0');
      assert.equal(await sale.totalReceipts(), '0');
      assert.equal(await sale.itemToken(1), food.address);
      assert.equal(await sale.itemTokenType(1), 1);
    });

    it('(internal) setItemResupplyPricing updates internal state as expected', async () => {
      const { sale, food } = this;

      await sale.setItemResupplyPricing(2, [177, 500, 0], [50, '100030300030044'], true, 45, 0, [10, 4], [1, 2], { from:alice });

      let info = await sale.itemInfo(2);
      assert.equal(info.token, food.address);
      assert.equal(info.tokenType, '0');
      assert.equal(info.available, true);

      info = await sale.itemSupplyInfo(2);
      assert.equal(info.supply, '177');
      assert.equal(info.duration, '500');
      assert.equal(info.anchorTime, '0');
      assert.equal(info.openTime, '50');
      assert.equal(info.closeTime, '100030300030044');
      assert.equal(info.totalSupply, '177');
      assert.equal((info.currentPeriodStartTime).toString(), `${Math.floor((await time.latest()) / 500) * 500}`);

      info = await sale.itemPricing(2);
      assert.equal(info.minimum, '45');
      assert.equal(info.scale, '1');
      assert.equal(info.thresholdSupply, '177');
      assert.equal(info.scalarN, '10');
      assert.equal(info.scalarD, '4');
      assert.equal(info.expN, '1');
      assert.equal(info.expD, '2');

      await sale.setItemResupplyPricing(1, [177, 500, 0], [50, '100030300030044'], false, 45, 0, [10, 4], [1, 2], { from:alice });

      info = await sale.itemInfo(1);
      assert.equal(info.token, food.address);
      assert.equal(info.tokenType, '1');
      assert.equal(info.available, true);

      info = await sale.itemSupplyInfo(1);
      assert.equal(info.supply, '177');
      assert.equal(info.duration, '500');
      assert.equal(info.anchorTime, '0');
      assert.equal(info.openTime, '50');
      assert.equal(info.closeTime, '100030300030044');
      assert.equal(info.totalSupply, '420');
      assert.equal((info.currentPeriodStartTime).toString(), `${Math.floor((anchorTime - anchorOffset) / 1000) * 1000 + anchorOffset}`);

      info = await sale.itemPricing(2);
      assert.equal(info.minimum, '45');
      assert.equal(info.scale, '1');
      assert.equal(info.thresholdSupply, '177');
      assert.equal(info.scalarN, '10');
      assert.equal(info.scalarD, '4');
      assert.equal(info.expN, '1');
      assert.equal(info.expD, '2');
    });

    it('setItemPricing updates public state as expected', async () => {
      const { sale, food } = this;

      await sale.setItemPricing(2, 45, 0, 2, [10, 4], [1, 2], { from:alice });
      assert.equal(await sale.itemCount(), '6');
      assert.equal(await sale.availableItemSupply(2), '260');
      assert.equal(await sale.purchasePrice(2, 1), '45');
      assert.equal(await sale.itemReceiptCount(2), '0');
      assert.equal(await sale.totalReceipts(), '0');
      assert.equal(await sale.itemToken(2), food.address);
      assert.equal(await sale.itemTokenType(2), 0);
    });

    it('(internal) setItemPricing updates internal state as expected', async () => {
      const { sale, food } = this;

      await sale.setItemPricing(2, 45, 0, 2, [10, 4], [2, 3], { from:alice });

      let info = await sale.itemInfo(2);
      assert.equal(info.token, food.address);
      assert.equal(info.tokenType, '0');
      assert.equal(info.available, true);

      info = await sale.itemSupplyInfo(2);
      assert.equal(info.supply, '260');
      assert.equal(info.duration, '1000');
      assert.equal(info.anchorTime, `${anchorTime}`);
      assert.equal(info.openTime, '0');
      assert.equal(info.closeTime, '0');
      assert.equal(info.totalSupply, '260');
      assert.equal((info.currentPeriodStartTime).toString(), `${Math.floor((anchorTime - anchorOffset) / 1000) * 1000 + anchorOffset}`);

      info = await sale.itemPricing(2);
      assert.equal(info.minimum, '45');
      assert.equal(info.scale, '1');
      assert.equal(info.thresholdSupply, '2');
      assert.equal(info.scalarN, '10');
      assert.equal(info.scalarD, '4');
      assert.equal(info.expN, '2');
      assert.equal(info.expD, '3');
    });

    it('setItemResupply updates public state as expected', async () => {
      const { sale, food } = this;

      await sale.setItemResupply(2, [177, 500, 0], [50, '100030300030044'], true, { from:alice });
      assert.equal(await sale.itemCount(), '6');
      assert.equal(await sale.availableItemSupply(2), '177');
      assert.equal(await sale.purchasePrice(2, 1), '100');
      assert.equal(await sale.itemReceiptCount(2), '0');
      assert.equal(await sale.totalReceipts(), '0');
      assert.equal(await sale.itemToken(2), food.address);
      assert.equal(await sale.itemTokenType(2), 0);

      await sale.setItemResupply(1, [177, 500, 0], [50, '100030300030044'], false, { from:alice });
      assert.equal(await sale.itemCount(), '6');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.purchasePrice(1, 1), '45');
      assert.equal(await sale.itemReceiptCount(1), '0');
      assert.equal(await sale.totalReceipts(), '0');
      assert.equal(await sale.itemToken(1), food.address);
      assert.equal(await sale.itemTokenType(1), 1);
    });

    it('(internal) setItemResupply updates internal state as expected', async () => {
      const { sale, food } = this;

      await sale.setItemResupply(2, [177, 500, 0], [50, '100030300030044'], true, { from:alice });

      let info = await sale.itemInfo(2);
      assert.equal(info.token, food.address);
      assert.equal(info.tokenType, '0');
      assert.equal(info.available, true);

      info = await sale.itemSupplyInfo(2);
      assert.equal(info.supply, '177');
      assert.equal(info.duration, '500');
      assert.equal(info.anchorTime, '0');
      assert.equal(info.openTime, '50');
      assert.equal(info.closeTime, '100030300030044');
      assert.equal(info.totalSupply, '177');
      assert.equal((info.currentPeriodStartTime).toString(), `${Math.floor((await time.latest()) / 500) * 500}`);

      info = await sale.itemPricing(2);
      assert.equal(info.minimum, '100');
      assert.equal(info.scale, '1');
      assert.equal(info.thresholdSupply, '260');
      assert.equal(info.scalarN, '100');
      assert.equal(info.scalarD, '1');
      assert.equal(info.expN, '1');
      assert.equal(info.expD, '2');

      await sale.setItemResupply(1, [177, 500, 0], [50, '100030300030044'], false, { from:alice });

      info = await sale.itemInfo(1);
      assert.equal(info.token, food.address);
      assert.equal(info.tokenType, '1');
      assert.equal(info.available, true);

      info = await sale.itemSupplyInfo(1);
      assert.equal(info.supply, '177');
      assert.equal(info.duration, '500');
      assert.equal(info.anchorTime, '0');
      assert.equal(info.openTime, '50');
      assert.equal(info.closeTime, '100030300030044');
      assert.equal(info.totalSupply, '420');
      assert.equal((info.currentPeriodStartTime).toString(), `${Math.floor((anchorTime - anchorOffset) / 1000) * 1000 + anchorOffset}`);

      info = await sale.itemPricing(1);
      assert.equal(info.minimum, '45');
      assert.equal(info.scale, '1');
      assert.equal(info.thresholdSupply, '420');
      assert.equal(info.scalarN, '10');
      assert.equal(info.scalarD, '1');
      assert.equal(info.expN, '1');
      assert.equal(info.expD, '2');
    });

    it('purchaseItems: can buy an available item', async () => {
      const { sale, food, animal, token } = this;

      await token.transfer(bob, '100000', { from:minter });
      await token.approve(sale.address, '100000', { from:bob });

      // buy food 2
      await sale.purchaseItems(0, carol, 2, 40, { from:bob });  // costs 32
      // token transfer
      assert.equal(await token.balanceOf(bob), '99968');
      assert.equal(await token.balanceOf(sale.address), '32');
      // item transfer
      assert.equal(await food.totalSupply(), '2');
      assert.equal(await food.balanceOf(carol), '2');
      assert.equal(await food.tokenType(0), '2');
      assert.equal(await food.tokenType(1), '2');
      // receipt info
      assert.equal(await sale.totalReceipts(), '2');
      assert.equal(await sale.receiptCountBy(bob), '0');
      assert.equal(await sale.receiptCountBy(carol), '2');
      assert.equal(await sale.itemReceiptCount(0), '2');
      assert.equal(await sale.itemReceiptCount(1), '0');
      // check receipt token
      assert.equal(await sale.receiptTokenId(0), '0');
      assert.equal(await sale.receiptTokenId(1), '1');
      assert.equal(await sale.receiptTokenType(0), '2');
      assert.equal(await sale.receiptTokenType(1), '2');
      // check available items
      assert.equal(await sale.availableItemSupply(0), '1848');
    });

    async function buyItem(contracts, from, itemId, to, count, price) {
      const { sale, food, animal, token } = contracts;

      const prizeToken = itemId < 3 ? food : animal;
      const prizeTokenType = 2 - (itemId % 3);
      const prizeTokenSupply = Number((await prizeToken.totalSupply()).toString());
      const prizeTokenOwned = Number((await prizeToken.balanceOf(to)).toString());
      const typeTokenSupply = Number((await prizeToken.totalSupplyByType(prizeTokenType)).toString());
      const typeTokenOwned = Number((await prizeToken.balanceOfOwnerByType(to, prizeTokenType)).toString());

      const fromBalance = Number((await token.balanceOf(from)).toString());
      const recipientAddrs = await sale.recipient();
      const recipient = recipientAddrs == ZERO_ADDRESS ? sale.address : recipientAddrs;
      const recipientBalance = recipient == ZERO_ADDRESS
        ? Number((await token.balanceOf(sale.address)).toString())
        : Number((await token.balanceOf(recipient)).toString());

      const supply = Number((await sale.availableItemSupply(itemId)).toString());
      const receipts = Number((await sale.totalReceipts()).toString());
      const ownerReceipts = Number((await sale.receiptCountBy(to)).toString());
      const itemReceipts = Number((await  sale.itemReceiptCount(itemId)).toString());

      await token.transfer(from, price, { from:minter });
      await token.approve(sale.address, price, { from });
      await sale.purchaseItems(itemId, to, count, price, { from });

      // token transfer
      assert.equal(await token.balanceOf(bob), `${fromBalance}`);
      assert.equal(await token.balanceOf(recipient), `${recipientBalance + price}`);
      // item transfer
      assert.equal(await prizeToken.totalSupply(), `${prizeTokenSupply + count}`);
      assert.equal(await prizeToken.balanceOf(to), `${prizeTokenOwned + count}`);
      for (let i = 0; i < count; i++) {
        assert.equal(await prizeToken.tokenType(prizeTokenSupply + i), `${prizeTokenType}`);
        assert.equal(await sale.receiptTokenId(receipts + i), `${prizeTokenSupply + i}`);
        assert.equal(await sale.receiptTokenType(receipts + i), `${prizeTokenType}`);
      }
      // receipt info
      assert.equal(await sale.totalReceipts(), `${receipts + count}`);
      assert.equal(await sale.receiptCountBy(to), `${ownerReceipts + count}`);
      assert.equal(await sale.itemReceiptCount(itemId), `${itemReceipts + count}`);
      // check available items
      assert.equal(await sale.availableItemSupply(itemId), `${supply - count}`);
    }

    it('purchaseItems: can buy multiple available items', async () => {
      await buyItem(this, bob, 0, carol, 2, 32);
      await buyItem(this, bob, 1, dave, 10, 450);
      await buyItem(this, edith, 2, alice, 1, 100);
    });

    it('purchaseItems: can buy items multiple times', async () => {
      await buyItem(this, bob, 0, carol, 2, 32);
      await buyItem(this, dave, 0, edith, 10, 160);
      await buyItem(this, alice, 0, alice, 4, 64);
    });

    it('purchaseItems: can buy items after supply added', async () => {
      const { sale, food, animal, token } = this;

      await sale.setItemSupply(3, 10, { from:manager });
      await buyItem(this, bob, 3, carol, 2, 200);

      await sale.addItemSupply(4, 2, { from:manager });
      await buyItem(this, bob, 4, carol, 2, 400);
    });

    it('purchaseItems: reverts for invalid itemId', async () => {
      const { sale, food, animal, token } = this;

      await expectRevert(
        sale.purchaseItems(6, carol, 1, 10000, { from:bob }),
        "BaseDirectCollectibleSale: invalid itemId"
      );

      await expectRevert(
        sale.purchaseItems(40, carol, 1, 10000, { from:bob }),
        "BaseDirectCollectibleSale: invalid itemId"
      );
    });

    it('purchaseItems: reverts for buying more than supply', async () => {
      const { sale, food, animal, token } = this;

      await sale.setItemSupply(3, 10, { from:manager });
      await expectRevert(
        sale.purchaseItems(3, carol, 11, 10000, { from:bob }),
        "BaseDirectCollectibleSale: not enough supply"
      );

      await sale.addItemSupply(4, 2, { from:manager });
      await expectRevert(
        sale.purchaseItems(4, carol, 3, 10000, { from:bob }),
        "BaseDirectCollectibleSale: not enough supply"
      );
    });

    it('purchaseItems: reverts for not enough maximumPrice', async () => {
      const { sale, food, animal, token } = this;

      await expectRevert(
        sale.purchaseItems(2, carol, 2, 31, { from:bob }),
        "BaseDirectCollectibleSale: too expensive"
      );

      await sale.setItemSupply(3, 10, { from:manager });
      await expectRevert(
        sale.purchaseItems(3, carol, 10, 999, { from:bob }),
        "BaseDirectCollectibleSale: too expensive"
      );
    });

    it('purchasePrice: expected price curve for y = (x/m)^(1/n) with m = 0.01, n = 2', async () => {
      const { sale, food, animal, token } = this;

      const supply = 260;
      const values = [
        { x: 0, price: 100 },   // minimum price applies
        { x: 100, price: 100 },
        { x: 110, price: 105 },
        { x: 120, price: 110 },
        { x: 130, price: 114 },
        { x: 140, price: 118 },
        { x: 150, price: 122 },
        { x: 160, price: 126 },
        { x: 170, price: 130 },
        { x: 180, price: 134 },
        { x: 190, price: 138 },
        { x: 200, price: 141 },
        { x: 210, price: 145 },
        { x: 220, price: 148 },
        { x: 230, price: 152 },
        { x: 240, price: 155 },
        { x: 250, price: 158 }
      ];

      for (const v of values) {
        const { x, price } = v;
        await sale.setItemSupply(2, supply - x);
        const itemPrice = Number((await sale.purchasePrice(2, 1)).toString());
        assert.ok(price - 1 <= itemPrice && itemPrice <= price, `price ${itemPrice} is about ${price}`);

        await buyItem(this, bob, 2, carol, 1, itemPrice);
      }
    });

    it('purchasePrice: expected price curve for y = (x/m)^(1/n) with m = 0.1, n = 2', async () => {
      const { sale, food, animal, token } = this;

      const supply = 420;
      const values = [
        { x: 200, price: 45 },   // minimum price applies
        { x: 210, price: 46 },
        { x: 220, price: 47 },
        { x: 230, price: 48 },
        { x: 240, price: 49 },
        { x: 250, price: 50 },
        { x: 260, price: 51 },
        { x: 270, price: 52 },
        { x: 280, price: 53 },
        { x: 290, price: 54 },
        { x: 300, price: 55 },
        { x: 310, price: 56 },
        { x: 320, price: 57 },
        { x: 330, price: 58 },
        { x: 340, price: 58 },
        { x: 350, price: 59 },
        { x: 360, price: 60 },
        { x: 370, price: 61 },
        { x: 380, price: 62 },
        { x: 390, price: 62 },
        { x: 400, price: 63 },
        { x: 410, price: 64 }
      ];

      for (const v of values) {
        const { x, price } = v;
        await sale.setItemSupply(1, supply - x);
        const itemPrice = Number((await sale.purchasePrice(1, 1)).toString());
        assert.ok(price - 1 <= itemPrice && itemPrice <= price, `price ${itemPrice} is about ${price}`);

        await buyItem(this, bob, 1, carol, 1, itemPrice);
      }
    });

    it('purchasePrice: expected price curve for y = (x/m)^(1/n) with m = 4, n = 2', async () => {
      const { sale, food, animal, token } = this;

      const supply = 1850;
      const values = [
        { x: 1000, price: 16 },   // minimum price applies
        { x: 1080, price: 16 },
        { x: 1090, price: 17 },
        { x: 1220, price: 17 },
        { x: 1230, price: 18 },
        { x: 1360, price: 18 },
        { x: 1370, price: 19 },
        { x: 1520, price: 19 },
        { x: 1530, price: 20 },
        { x: 1680, price: 20 },
        { x: 1690, price: 21 },
        { x: 1840, price: 21 }
      ];

      for (const v of values) {
        const { x, price } = v;
        await sale.setItemSupply(0, supply - x);
        const itemPrice = Number((await sale.purchasePrice(0, 1)).toString());
        assert.ok(price - 1 <= itemPrice && itemPrice <= price, `price ${itemPrice} is about ${price}`);

        await buyItem(this, bob, 0, carol, 1, itemPrice);
      }
    });

    it('purchasePrice: expected price when cost curve is scaled at x * 10', async () => {
      const { sale, food, animal, token } = this;

      // scale up the item 0 curve by 10
      await sale.setItemResupplyPricing(0, [185, 1000, anchorTime], [0, 0], true, 16, 0, [10, 4], [1, 2], { from:manager });

      const supply = 185;
      const values = [
        { x: 100, price: 16 },   // minimum price applies
        { x: 108, price: 16 },
        { x: 109, price: 17 },
        { x: 122, price: 17 },
        { x: 123, price: 18 },
        { x: 136, price: 18 },
        { x: 137, price: 19 },
        { x: 152, price: 19 },
        { x: 153, price: 20 },
        { x: 168, price: 20 },
        { x: 169, price: 21 },
        { x: 184, price: 21 }
      ];

      for (const v of values) {
        const { x, price } = v;
        await sale.setItemSupply(0, supply - x);
        const itemPrice = Number((await sale.purchasePrice(0, 1)).toString());
        assert.ok(price - 1 <= itemPrice && itemPrice <= price, `price ${itemPrice} is about ${price}`);

        await buyItem(this, bob, 0, carol, 1, itemPrice);
      }
    });

    it('purchasePrice: expected price for multiple items', async () => {
      const { sale, food, animal, token } = this;

      // scale up the item 0 curve by 10
      await sale.setItemResupplyPricing(0, [185, 1000, anchorTime], [0, 0], true, 16, 0, [10, 4], [1, 2], { from:manager });

      const supply = 185;
      const values = [
        { x: 100, price: 16 },   // minimum price applies
        { x: 108, price: 16 },
        { x: 109, price: 17 },
        { x: 122, price: 17 },
        { x: 123, price: 18 },
        { x: 136, price: 18 },
        { x: 137, price: 19 },
        { x: 152, price: 19 },
        { x: 153, price: 20 },
        { x: 168, price: 20 },
        { x: 169, price: 21 }
      ];

      function priceForItem(x) {
        let price = 16;
        for (const v of values) {
          if (v.x <= x) {
            price = v.price;
          }
        }
        return price;
      }

      for (const v of values) {
        // try buying 2, 5 and 10
        const { x } = v;
        for (const count of [2, 5, 10]) {
          let price = 0;
          for (let j = 0; j < count; j++) {
            price += priceForItem(x + j);
          }

          await sale.setItemSupply(0, supply - x);
          const itemPrice = Number((await sale.purchasePrice(0, count)).toString());
          assert.ok(price - 1 <= itemPrice && itemPrice <= price, `price ${itemPrice} is about ${price}`);
          await buyItem(this, bob, 0, carol, count, itemPrice);
        }
      }
    });

    it('resupply occurs as expected after manual supply changes', async () => {
      const { sale, food, animal, token } = this;

      // test initial
      assert.equal(await sale.availableItemSupply(0), '1850');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');

      // advance; no change
      await time.increaseTo(anchorTime + 1000);
      assert.equal(await sale.availableItemSupply(0), '1850');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');

      // manual change
      await sale.setItemSupply(0, '319');
      await sale.setItemSupply(1, '277');
      await sale.setItemSupply(2, '15');

      assert.equal(await sale.availableItemSupply(0), '319');
      assert.equal(await sale.availableItemSupply(1), '277');
      assert.equal(await sale.availableItemSupply(2), '15');

      // advance (not enough)
      await time.increaseTo(anchorTime + 1995);
      assert.equal(await sale.availableItemSupply(0), '319');
      assert.equal(await sale.availableItemSupply(1), '277');
      assert.equal(await sale.availableItemSupply(2), '15');

      // advance (resupply)
      await time.increaseTo(anchorTime + 2000);
      assert.equal(await sale.availableItemSupply(0), '1850');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');
    });

    it('resupply occurs at item-specific intervals after manual supply changes', async () => {
      const { sale, food, animal, token } = this;

      await sale.setItemResupply(1, [420, 500, anchorTime], [0, 0], true, { from:manager });
      await sale.setItemResupply(2, [260, 200, anchorTime], [0, 0], true, { from:manager });

      // test initial
      assert.equal(await sale.availableItemSupply(0), '1850');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');

      // manual change
      await sale.setItemSupply(0, '319');
      await sale.setItemSupply(1, '277');
      await sale.setItemSupply(2, '15');

      // advance (not enough)
      await time.increaseTo(anchorTime + 195);
      assert.equal(await sale.availableItemSupply(0), '319');
      assert.equal(await sale.availableItemSupply(1), '277');
      assert.equal(await sale.availableItemSupply(2), '15');

      // advance (resupply 2)
      await time.increaseTo(anchorTime + 200);
      assert.equal(await sale.availableItemSupply(0), '319');
      assert.equal(await sale.availableItemSupply(1), '277');
      assert.equal(await sale.availableItemSupply(2), '260');

      await sale.setItemSupply(2, '20');
      assert.equal(await sale.availableItemSupply(0), '319');
      assert.equal(await sale.availableItemSupply(1), '277');
      assert.equal(await sale.availableItemSupply(2), '20');

      await time.increaseTo(anchorTime + 400);
      assert.equal(await sale.availableItemSupply(0), '319');
      assert.equal(await sale.availableItemSupply(1), '277');
      assert.equal(await sale.availableItemSupply(2), '260');

      await time.increaseTo(anchorTime + 450);
      await sale.setItemSupply(2, '39');
      await time.increaseTo(anchorTime + 498);
      assert.equal(await sale.availableItemSupply(0), '319');
      assert.equal(await sale.availableItemSupply(1), '277');
      assert.equal(await sale.availableItemSupply(2), '39');

      await time.increaseTo(anchorTime + 500);
      assert.equal(await sale.availableItemSupply(0), '319');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '39');

      await time.increaseTo(anchorTime + 598);
      assert.equal(await sale.availableItemSupply(0), '319');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '39');

      await time.increaseTo(anchorTime + 600);
      assert.equal(await sale.availableItemSupply(0), '319');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');

      await time.increaseTo(anchorTime + 950);
      await sale.setItemSupply(1, '1');
      await sale.setItemSupply(2, '2');
      assert.equal(await sale.availableItemSupply(0), '319');
      assert.equal(await sale.availableItemSupply(1), '1');
      assert.equal(await sale.availableItemSupply(2), '2');

      await time.increaseTo(anchorTime + 1000);
      assert.equal(await sale.availableItemSupply(0), '1850');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');
    });

    it('(internal) resupply reflected as expected in internal state after manual supply changes', async () => {
      const { sale, food, animal, token } = this;
      let startTime = Math.floor((await time.latest() - anchorOffset) / 1000) * 1000 + anchorOffset;
      let info;

      // manual change
      await sale.setItemSupply(0, '319');
      await sale.setItemSupply(1, '277');
      await sale.setItemSupply(2, '15');

      info = await sale.itemSupplyInfo(0);
      assert.equal(info.supply, '1850');
      assert.equal(info.duration, '1000');
      assert.equal(info.anchorTime, `${anchorTime}`);
      assert.equal(info.openTime, '0');
      assert.equal(info.closeTime, '0');
      assert.equal(info.totalSupply, '319');
      assert.equal((info.currentPeriodStartTime).toString(), `${startTime}`);

      info = await sale.itemSupplyInfo(1);
      assert.equal(info.supply, '420');
      assert.equal(info.totalSupply, '277');

      info = await sale.itemSupplyInfo(2);
      assert.equal(info.supply, '260');
      assert.equal(info.totalSupply, '15');

      assert.equal(await sale.availableItemSupply(0), '319');
      assert.equal(await sale.availableItemSupply(1), '277');
      assert.equal(await sale.availableItemSupply(2), '15');

      // advance; shouldn't change internal info
      await time.increaseTo(anchorTime + 1000);
      assert.equal(await sale.availableItemSupply(0), '1850');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');

      info = await sale.itemSupplyInfo(0);
      assert.equal(info.supply, '1850');
      assert.equal(info.totalSupply, '319');

      info = await sale.itemSupplyInfo(1);
      assert.equal(info.supply, '420');
      assert.equal(info.totalSupply, '277');

      info = await sale.itemSupplyInfo(2);
      assert.equal(info.supply, '260');
      assert.equal(info.totalSupply, '15');

      // "update item" should change internal info
      await sale.updateItem(0);
      assert.equal(await sale.availableItemSupply(0), '1850');
      info = await sale.itemSupplyInfo(0);
      assert.equal(info.supply, '1850');
      assert.equal(info.duration, '1000');
      assert.equal(info.anchorTime, `${anchorTime}`);
      assert.equal(info.openTime, '0');
      assert.equal(info.closeTime, '0');
      assert.equal(info.totalSupply, '1850');
      assert.equal((info.currentPeriodStartTime).toString(), `${startTime + 1000}`);

      // purchase should change internal info
      await buyItem(this, bob, 1, carol, 1, 45);
      assert.equal(await sale.availableItemSupply(1), '419');
      info = await sale.itemSupplyInfo(1);
      assert.equal(info.supply, '420');
      assert.equal(info.duration, '1000');
      assert.equal(info.anchorTime, `${anchorTime}`);
      assert.equal(info.openTime, '0');
      assert.equal(info.closeTime, '0');
      assert.equal(info.totalSupply, '420');
      assert.equal((info.currentPeriodStartTime).toString(), `${startTime + 1000}`);
    });

    it('resupply occurs as expected after purchassess', async () => {
      const { sale, food, animal, token } = this;

      // test initial
      assert.equal(await sale.availableItemSupply(0), '1850');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');

      // advance; no change
      await time.increaseTo(anchorTime + 1000);
      assert.equal(await sale.availableItemSupply(0), '1850');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');

      // buy some
      await buyItem(this, bob, 0, carol, 1, 16);
      await buyItem(this, alice, 1, edith, 10, 450);
      await buyItem(this, dave, 2, bob, 7, 700);

      assert.equal(await sale.availableItemSupply(0), '1849');
      assert.equal(await sale.availableItemSupply(1), '410');
      assert.equal(await sale.availableItemSupply(2), '253');

      // advance (not enough)
      await time.increaseTo(anchorTime + 1900);
      assert.equal((await sale.availableItemSupply(0)).toString(), '1849');
      assert.equal(await sale.availableItemSupply(1), '410');
      assert.equal(await sale.availableItemSupply(2), '253');
      await time.increaseTo(anchorTime + 1950);
      assert.equal((await sale.availableItemSupply(0)).toString(), '1849');
      assert.equal(await sale.availableItemSupply(1), '410');
      assert.equal(await sale.availableItemSupply(2), '253');
      await time.increaseTo(anchorTime + 1990);
      assert.equal((await sale.availableItemSupply(0)).toString(), '1849');
      assert.equal(await sale.availableItemSupply(1), '410');
      assert.equal(await sale.availableItemSupply(2), '253');

      await time.increaseTo(anchorTime + 1995);
      assert.equal((await sale.availableItemSupply(0)).toString(), '1849');
      assert.equal(await sale.availableItemSupply(1), '410');
      assert.equal(await sale.availableItemSupply(2), '253');

      // advance (resupply)
      await time.increaseTo(anchorTime + 2000);
      assert.equal(await sale.availableItemSupply(0), '1850');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');
    });

    it('resupply occurs at item-specific intervals after purchases', async () => {
      const { sale, food, animal, token } = this;

      await sale.setItemResupply(1, [420, 500, anchorTime], [0, 0], true, { from:manager });
      await sale.setItemResupply(2, [260, 200, anchorTime], [0, 0], true, { from:manager });

      // test initial
      assert.equal(await sale.availableItemSupply(0), '1850');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');

      // buy some
      await buyItem(this, bob, 0, carol, 1, 16);
      await buyItem(this, alice, 1, edith, 10, 450);
      await buyItem(this, dave, 2, bob, 7, 700);

      // advance (not enough)
      await time.increaseTo(anchorTime + 195);
      assert.equal(await sale.availableItemSupply(0), '1849');
      assert.equal(await sale.availableItemSupply(1), '410');
      assert.equal(await sale.availableItemSupply(2), '253');

      // advance (resupply 2)
      await time.increaseTo(anchorTime + 200);
      assert.equal(await sale.availableItemSupply(0), '1849');
      assert.equal(await sale.availableItemSupply(1), '410');
      assert.equal(await sale.availableItemSupply(2), '260');

      await buyItem(this, bob, 1, alice, 5, 225);
      await buyItem(this, alice, 2, carol, 3, 300);
      assert.equal(await sale.availableItemSupply(0), '1849');
      assert.equal(await sale.availableItemSupply(1), '405');
      assert.equal(await sale.availableItemSupply(2), '257');

      await time.increaseTo(anchorTime + 400);
      assert.equal(await sale.availableItemSupply(0), '1849');
      assert.equal(await sale.availableItemSupply(1), '405');
      assert.equal(await sale.availableItemSupply(2), '260');

      await time.increaseTo(anchorTime + 450);
      await buyItem(this, bob, 0, alice, 2, 32);
      await buyItem(this, bob, 1, alice, 1, 45);
      await buyItem(this, alice, 2, carol, 1, 100);
      await time.increaseTo(anchorTime + 495);
      assert.equal(await sale.availableItemSupply(0), '1847');
      assert.equal(await sale.availableItemSupply(1), '404');
      assert.equal(await sale.availableItemSupply(2), '259');

      await time.increaseTo(anchorTime + 500);
      assert.equal(await sale.availableItemSupply(0), '1847');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '259');

      await time.increaseTo(anchorTime + 595);
      assert.equal(await sale.availableItemSupply(0), '1847');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '259');

      await time.increaseTo(anchorTime + 600);
      assert.equal(await sale.availableItemSupply(0), '1847');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');

      await time.increaseTo(anchorTime + 950);
      await buyItem(this, bob, 0, alice, 1, 16);
      await buyItem(this, bob, 1, alice, 3, 135);
      await buyItem(this, alice, 2, carol, 10, 1000);
      assert.equal(await sale.availableItemSupply(0), '1846');
      assert.equal(await sale.availableItemSupply(1), '417');
      assert.equal(await sale.availableItemSupply(2), '250');

      await time.increaseTo(anchorTime + 1000);
      assert.equal(await sale.availableItemSupply(0), '1850');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');
    });

    it('(internal) resupply reflected as expected in internal state after purchases', async () => {
      const { sale, food, animal, token } = this;
      let startTime = Math.floor((await time.latest() - anchorOffset) / 1000) * 1000 + anchorOffset;
      let info;

      // buy some
      await buyItem(this, bob, 0, carol, 1, 16);
      await buyItem(this, alice, 1, edith, 10, 450);
      await buyItem(this, dave, 2, bob, 7, 700);

      info = await sale.itemSupplyInfo(0);
      assert.equal(info.supply, '1850');
      assert.equal(info.duration, '1000');
      assert.equal(info.anchorTime, `${anchorTime}`);
      assert.equal(info.openTime, '0');
      assert.equal(info.closeTime, '0');
      assert.equal(info.totalSupply, '1850');
      assert.equal((info.currentPeriodStartTime).toString(), `${startTime}`);

      info = await sale.itemSupplyInfo(1);
      assert.equal(info.supply, '420');
      assert.equal(info.totalSupply, '420');

      info = await sale.itemSupplyInfo(2);
      assert.equal(info.supply, '260');
      assert.equal(info.totalSupply, '260');

      assert.equal(await sale.availableItemSupply(0), '1849');
      assert.equal(await sale.availableItemSupply(1), '410');
      assert.equal(await sale.availableItemSupply(2), '253');

      // advance; shouldn't change internal info
      await time.increaseTo(anchorTime + 1000);
      assert.equal(await sale.availableItemSupply(0), '1850');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');

      info = await sale.itemSupplyInfo(0);
      assert.equal(info.supply, '1850');
      assert.equal(info.totalSupply, '1850');

      info = await sale.itemSupplyInfo(1);
      assert.equal(info.supply, '420');
      assert.equal(info.totalSupply, '420');

      info = await sale.itemSupplyInfo(2);
      assert.equal(info.supply, '260');
      assert.equal(info.totalSupply, '260');

      // "update item" should change internal info
      await sale.updateItem(0);
      assert.equal(await sale.availableItemSupply(0), '1850');
      info = await sale.itemSupplyInfo(0);
      assert.equal(info.supply, '1850');
      assert.equal(info.duration, '1000');
      assert.equal(info.anchorTime, `${anchorTime}`);
      assert.equal(info.openTime, '0');
      assert.equal(info.closeTime, '0');
      assert.equal(info.totalSupply, '1851');
      assert.equal((info.currentPeriodStartTime).toString(), `${startTime + 1000}`);

      // purchase should change internal info
      await buyItem(this, bob, 1, carol, 1, 45);
      assert.equal(await sale.availableItemSupply(1), '419');
      info = await sale.itemSupplyInfo(1);
      assert.equal(info.supply, '420');
      assert.equal(info.duration, '1000');
      assert.equal(info.anchorTime, `${anchorTime}`);
      assert.equal(info.openTime, '0');
      assert.equal(info.closeTime, '0');
      assert.equal(info.totalSupply, '430');  // does not include most recent
      assert.equal((info.currentPeriodStartTime).toString(), `${startTime + 1000}`);

      await buyItem(this, bob, 2, carol, 2, 200);
      assert.equal(await sale.availableItemSupply(2), '258');
      info = await sale.itemSupplyInfo(2);
      assert.equal(info.supply, '260');
      assert.equal(info.duration, '1000');
      assert.equal(info.anchorTime, `${anchorTime}`);
      assert.equal(info.openTime, '0');
      assert.equal(info.closeTime, '0');
      assert.equal(info.totalSupply, '267');  // does not include most recent
      assert.equal((info.currentPeriodStartTime).toString(), `${startTime + 1000}`);

      await time.increaseTo(anchorTime + 2000);
      assert.equal(await sale.availableItemSupply(0), '1850');
      assert.equal(await sale.availableItemSupply(1), '420');
      assert.equal(await sale.availableItemSupply(2), '260');

      info = await sale.itemSupplyInfo(0);
      assert.equal(info.supply, '1850');
      assert.equal(info.totalSupply, '1851');

      info = await sale.itemSupplyInfo(1);
      assert.equal(info.supply, '420');
      assert.equal(info.totalSupply, '430');

      info = await sale.itemSupplyInfo(2);
      assert.equal(info.supply, '260');
      assert.equal(info.totalSupply, '267');

      // purchase should change internal info
      await buyItem(this, bob, 1, carol, 1, 45);
      assert.equal(await sale.availableItemSupply(1), '419');
      info = await sale.itemSupplyInfo(1);
      assert.equal(info.supply, '420');
      assert.equal(info.duration, '1000');
      assert.equal(info.anchorTime, `${anchorTime}`);
      assert.equal(info.openTime, '0');
      assert.equal(info.closeTime, '0');
      assert.equal(info.totalSupply, '431');  // does not include most recent
      assert.equal((info.currentPeriodStartTime).toString(), `${startTime + 2000}`);

      await buyItem(this, bob, 2, carol, 2, 200);
      assert.equal(await sale.availableItemSupply(2), '258');
      info = await sale.itemSupplyInfo(2);
      assert.equal(info.supply, '260');
      assert.equal(info.duration, '1000');
      assert.equal(info.anchorTime, `${anchorTime}`);
      assert.equal(info.openTime, '0');
      assert.equal(info.closeTime, '0');
      assert.equal(info.totalSupply, '269');  // does not include most recent
      assert.equal((info.currentPeriodStartTime).toString(), `${startTime + 2000}`);
    });
  });

  context('with items for sale at high-scale prices', () => {
    let anchorTime, anchorOffset;
    beforeEach(async  () => {
      const { token, animal, food, sale } = this;

      anchorTime = Number(await time.latest());
      anchorOffset = anchorTime % 1000;
      // food sales
      await sale.createItemWithResupplyPricing(food.address, 2, [1850, 1000, anchorTime], [0, 0], 16, 8, [1, 4], [1, 2], { from:alice });
      await sale.createItemWithResupplyPricing(food.address, 1, [420, 1000, anchorTime], [0, 0], 45, 8, [10, 1], [1, 2], { from:manager });
      await sale.createItemWithResupplyPricing(food.address, 0, [260, 1000, anchorTime], [0, 0], 100, 8, [100, 1], [1, 2], { from:alice });

      // animal sales
      await sale.createItem(animal.address, 2, true, 100, 8, 100, [0, 1], [1, 1], { from:alice });
      await sale.createItem(animal.address, 1, true, 200, 8, 100, [0, 1], [1, 1], { from:alice });
      await sale.createItem(animal.address, 0, true, 500, 8, 100, [0, 1], [1, 1], { from:alice });
    });

    it('purchasePrice: expected price curve for y = (x/m)^(1/n) with m = 0.01, n = 2', async () => {
      const { sale, food, animal, token } = this;

      const scale = 100000000;
      const supply = 260;
      const values = [
        { x: 0, price: 100 },   // minimum price applies
        { x: 100, price: 100 },
        { x: 110, price: 105 },
        { x: 120, price: 110 },
        { x: 130, price: 114 },
        { x: 140, price: 118 },
        { x: 150, price: 122 },
        { x: 160, price: 126 },
        { x: 170, price: 130 },
        { x: 180, price: 134 },
        { x: 190, price: 138 },
        { x: 200, price: 141 },
        { x: 210, price: 145 },
        { x: 220, price: 148 },
        { x: 230, price: 152 },
        { x: 240, price: 155 },
        { x: 250, price: 158 }
      ];

      for (const v of values) {
        let { x, price } = v;
        price = price * scale;
        await sale.setItemSupply(2, supply - x);
        const itemPrice = Number((await sale.purchasePrice(2, 1)).toString());
        assert.ok(itemPrice == price - scale || itemPrice == price, `price ${itemPrice} is about ${price}`);
      }
    });

    it('purchasePrice: expected price curve for y = (x/m)^(1/n) with m = 0.1, n = 2', async () => {
      const { sale, food, animal, token } = this;

      const scale = 100000000;
      const supply = 420;
      const values = [
        { x: 200, price: 45 },   // minimum price applies
        { x: 210, price: 46 },
        { x: 220, price: 47 },
        { x: 230, price: 48 },
        { x: 240, price: 49 },
        { x: 250, price: 50 },
        { x: 260, price: 51 },
        { x: 270, price: 52 },
        { x: 280, price: 53 },
        { x: 290, price: 54 },
        { x: 300, price: 55 },
        { x: 310, price: 56 },
        { x: 320, price: 57 },
        { x: 330, price: 58 },
        { x: 340, price: 58 },
        { x: 350, price: 59 },
        { x: 360, price: 60 },
        { x: 370, price: 61 },
        { x: 380, price: 62 },
        { x: 390, price: 62 },
        { x: 400, price: 63 },
        { x: 410, price: 64 }
      ];

      for (const v of values) {
        let { x, price } = v;
        price = price * scale;
        await sale.setItemSupply(1, supply - x);
        const itemPrice = Number((await sale.purchasePrice(1, 1)).toString());
        assert.ok(itemPrice == price - scale || itemPrice == price, `price ${itemPrice} is about ${price}`);
      }
    });

    it('purchasePrice: expected price curve for y = (x/m)^(1/n) with m = 4, n = 2', async () => {
      const { sale, food, animal, token } = this;

      const scale = 100000000;
      const supply = 1850;
      const values = [
        { x: 1000, price: 16 },   // minimum price applies
        { x: 1080, price: 16 },
        { x: 1090, price: 17 },
        { x: 1220, price: 17 },
        { x: 1230, price: 18 },
        { x: 1360, price: 18 },
        { x: 1370, price: 19 },
        { x: 1520, price: 19 },
        { x: 1530, price: 20 },
        { x: 1680, price: 20 },
        { x: 1690, price: 21 },
        { x: 1840, price: 21 }
      ];

      for (const v of values) {
        let { x, price } = v;
        price = price * scale;
        await sale.setItemSupply(0, supply - x);
        const itemPrice = Number((await sale.purchasePrice(0, 1)).toString());
        assert.ok(itemPrice == price - scale || itemPrice == price, `price ${itemPrice} is about ${price}`);
      }
    });
  });
});
