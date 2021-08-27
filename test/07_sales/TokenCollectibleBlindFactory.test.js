const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const MockERC20 = artifacts.require('MockERC20');
const ERC721ValuableCollectibleToken = artifacts.require('ERC721ValuableCollectibleToken');
const BlindCollectiblePrizeBag = artifacts.require('BlindCollectiblePrizeBag');
const BlindCollectiblePrizeBagFactory = artifacts.require('BlindCollectiblePrizeBagFactory');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('BlindCollectiblePrizeBagFactory', ([alice, bob, carol, dave, edith, manager, creator, minter]) => {
  const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');
  const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
  const CREATOR_ROLE =  web3.utils.soliditySha3("CREATOR_ROLE");
  const SALTER_ROLE = web3.utils.soliditySha3('SALTER_ROLE');

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

      this.factory = await BlindCollectiblePrizeBagFactory.new(this.collectible.address, this.token.address);
      this.factory.grantRole(MANAGER_ROLE, manager);
      this.factory.grantRole(CREATOR_ROLE, creator);
  });

  it('should have set initial state', async () => {
    const { token, collectible, factory } = this;

    assert.equal(await factory.prizeToken(), collectible.address);
    assert.equal(await factory.purchaseToken(), token.address);
    assert.equal(await factory.saleCount(), '0');
  });

  it('createSale reverts for non-managers and non-creators', async () => {
    const { token, collectible, factory } = this;

    await expectRevert(
      factory.createSale("Test Sale", true, 0, 0, 100, ZERO_ADDRESS, { from:bob }),
      "BlindCollectiblePrizeBagFactory: must have MANAGER or CREATOR role to create sale"
    );

    await expectRevert(
      factory.createSaleWithPrizes("Test Sale", false, 0, 110, 100, ZERO_ADDRESS, [1], [100], { from:minter }),
      "BlindCollectiblePrizeBagFactory: must have MANAGER or CREATOR role to create sale"
    );
  });

  it('createSale creates a sale', async () => {
    const { token, collectible, factory } = this;

    await factory.createSale("Test Sale 1", true, 0, 0, 100, bob, { from:alice });
    assert.equal(await factory.saleCount(), '1');
    assert.equal(await factory.saleName(0), "Test Sale 1");
    assert.equal(await factory.saleCreator(0), alice);
    assert.equal(await factory.saleManaged(0), true);

    let sale = await BlindCollectiblePrizeBag.at(await factory.sales(0));
    assert.equal(await sale.availableSupply(), '0');
    assert.equal(await sale.totalSupply(), '0');
    assert.equal(await sale.prizeToken(), collectible.address);
    assert.equal(await sale.purchaseToken(), token.address);
    assert.equal(await sale.drawPrice(), '100');
    assert.equal(await sale.recipient(), bob);
    assert.equal(await sale.startTime(), '0');
    assert.equal(await sale.endTime(), '0');
    assert.equal(await sale.drawCountBy(alice), '0');
    assert.equal(await sale.drawCountBy(carol), '0');
    assert.equal(await sale.totalDraws(), '0');
    assert.equal(await sale.prizeCount(), '0');

    await factory.createSaleWithPrizes("Test Sale 2", false, 50, 110, 7, ZERO_ADDRESS, [1, 5], [100, 10], { from:creator });
    assert.equal(await factory.saleCount(), '2');
    assert.equal(await factory.saleName(1), "Test Sale 2");
    assert.equal(await factory.saleCreator(1), creator);
    assert.equal(await factory.saleManaged(1), false);

    sale = await BlindCollectiblePrizeBag.at(await factory.sales(1));
    assert.equal(await sale.availableSupply(), '110');
    assert.equal(await sale.totalSupply(), '110');
    assert.equal(await sale.prizeToken(), collectible.address);
    assert.equal(await sale.purchaseToken(), token.address);
    assert.equal(await sale.drawPrice(), '7');
    assert.equal(await sale.recipient(), ZERO_ADDRESS);
    assert.equal(await sale.startTime(), '50');
    assert.equal(await sale.endTime(), '110');
    assert.equal(await sale.drawCountBy(alice), '0');
    assert.equal(await sale.drawCountBy(carol), '0');
    assert.equal(await sale.totalDraws(), '0');
    assert.equal(await sale.prizeCount(), '2');
    assert.equal(await sale.availablePrizeSupply(0), '100');
    assert.equal(await sale.totalPrizeSupply(0), '100');
    assert.equal(await sale.prizeDrawCount(0), '0');
    assert.equal(await sale.prizeTokenType(0), '1');
    assert.equal(await sale.availablePrizeSupply(1), '10');
    assert.equal(await sale.totalPrizeSupply(1), '10');
    assert.equal(await sale.prizeDrawCount(1), '0');
    assert.equal(await sale.prizeTokenType(1), '5');
  });

  context('with sales', () => {
    beforeEach(async () => {
      const { token, collectible, factory } = this;
      await factory.createSale("Test Sale 1", true, 0, 0, 100, bob, { from:creator });
      await factory.createSale("Test Sale 2", true, 0, 0, 100, bob, { from:manager });
      await factory.createSaleWithPrizes("Test Sale 3", false, 50, 110, 7, ZERO_ADDRESS, [1, 5], [100, 10], { from:manager });
    });

    it('claimSaleProceeds reverts for non-manager and non-creator', async () => {
      const { token, factory } = this;

      await token.transfer(await factory.sales(0), '10000', { from:minter });
      await expectRevert(
        factory.claimSaleProceeds(0, creator, 1000, { from:bob }),
        "BlindCollectiblePrizeBagFactory: not authorized"
      );
      await expectRevert(
        factory.claimSaleProceeds(0, manager, 1000, { from:carol }),
        "BlindCollectiblePrizeBagFactory: not authorized"
      );

      await token.transfer(await factory.sales(1), '10000', { from:minter });
      await expectRevert(
        factory.claimSaleProceeds(1, creator, 1000, { from:bob }),
        "BlindCollectiblePrizeBagFactory: not authorized"
      );
      await expectRevert(
        factory.claimSaleProceeds(1, manager, 1000, { from:creator }),
        "BlindCollectiblePrizeBagFactory: not authorized"
      );
    });

    it('claimProceeds functions as expected', async () => {
      const { token, factory } = this;

      await token.transfer(await factory.sales(0), '10000', { from:minter });
      await factory.claimSaleProceeds(0, bob, '1000', { from:creator });
      assert.equal(await token.balanceOf(bob), '1000');
      await factory.claimSaleProceeds(0, carol, '3000', { from:manager });
      assert.equal(await token.balanceOf(carol), '3000');

      await token.transfer(await factory.sales(1), '10000', { from:minter });
      await factory.claimSaleProceeds(1, dave, '1000', { from:manager });
      assert.equal(await token.balanceOf(dave), '1000');
      await factory.claimSaleProceeds(1, edith, '3000', { from:alice });
      assert.equal(await token.balanceOf(edith), '3000');
    });

    it('claimAllProceeds reverts for non-manager', async () => {
      const { token, factory } = this;

      await token.transfer(await factory.sales(0), '10000', { from:minter });
      await expectRevert(
        factory.claimAllSaleProceeds(0, creator, { from:bob }),
        "BlindCollectiblePrizeBagFactory: not authorized"
      );
      await expectRevert(
        factory.claimAllSaleProceeds(0, manager, { from:carol }),
        "BlindCollectiblePrizeBagFactory: not authorized"
      );

      await token.transfer(await factory.sales(1), '10000', { from:minter });
      await expectRevert(
        factory.claimAllSaleProceeds(1, creator, { from:bob }),
        "BlindCollectiblePrizeBagFactory: not authorized"
      );
      await expectRevert(
        factory.claimAllSaleProceeds(1, manager, { from:creator }),
        "BlindCollectiblePrizeBagFactory: not authorized"
      );
    });

    it('claimAllProceeds functions as expected', async () => {
      const { token, factory } = this;

      await token.transfer(await factory.sales(0), '1000', { from:minter });
      await factory.claimAllSaleProceeds(0, bob, { from:creator });
      assert.equal(await token.balanceOf(bob), '1000');
      await token.transfer(await factory.sales(0), '3000', { from:minter });
      await factory.claimAllSaleProceeds(0, carol, { from:manager });
      assert.equal(await token.balanceOf(carol), '3000');

      await token.transfer(await factory.sales(1), '1000', { from:minter });
      await factory.claimAllSaleProceeds(1, dave, { from:manager });
      assert.equal(await token.balanceOf(dave), '1000');
      await token.transfer(await factory.sales(1), '3000', { from:minter });
      await factory.claimAllSaleProceeds(1, edith, { from:alice });
      assert.equal(await token.balanceOf(edith), '3000');
    });

    it('setSaleTimes should revert for not managed by caller', async () => {
      const { token, collectible, factory } = this;

      await expectRevert(
        factory.setSaleTimes(0, 100, 10000, { from:bob }),
        "BlindCollectiblePrizeBagFactory: not authorized"
      );

      await expectRevert(
        factory.setSaleTimes(1, 100, 10000, { from:creator }),
        "BlindCollectiblePrizeBagFactory: not authorized"
      );

      await expectRevert(
        factory.setSaleTimes(2, 100, 10000, { from:manager }),
        "BlindCollectiblePrizeBagFactory: not authorized"
      );

      await expectRevert(
        factory.setSaleTimes(3, 100, 10000, { from:manager }),
        "BlindCollectiblePrizeBagFactory: invalid saleId"
      );
    });

    it('setSaleTimes should work as expected if sale managed by caller', async () => {
      const { token, collectible, factory } = this;

      await factory.setSaleTimes(0, 100, 10000, { from:creator });
      let sale = await BlindCollectiblePrizeBag.at(await factory.sales(0));
      assert.equal(await sale.startTime(), '100');
      assert.equal(await sale.endTime(), '10000');

      await factory.setSaleTimes(1, 7, 70, { from:manager });
      sale = await BlindCollectiblePrizeBag.at(await factory.sales(1));
      assert.equal(await sale.startTime(), '7');
      assert.equal(await sale.endTime(), '70');
    });
  });
});
