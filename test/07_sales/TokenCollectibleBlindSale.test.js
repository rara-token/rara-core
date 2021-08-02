const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const MockERC20 = artifacts.require('MockERC20');
const ERC721ValuableCollectibleToken = artifacts.require('ERC721ValuableCollectibleToken');
const BlindCollectiblePrizeBag = artifacts.require('BlindCollectiblePrizeBag');
const MockERC165 = artifacts.require('MockERC165');
const MockContract = artifacts.require('MockContract');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('BlindCollectiblePrizeBag', ([alice, bob, carol, dave, edith, manager, minter, pauser, salter]) => {
  const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');
  const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
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

      this.sale = await BlindCollectiblePrizeBag.new(this.collectible.address, this.token.address, '100', ZERO_ADDRESS);
      this.collectible.grantRole(MINTER_ROLE, this.sale.address);
      this.sale.grantRole(MANAGER_ROLE, manager);
  });

  it('should have set initial state', async () => {
    const { token, collectible, sale } = this;

    assert.equal(await sale.availableSupply(), '0');
    assert.equal(await sale.totalSupply(), '0');

    assert.equal(await sale.prizeToken(), collectible.address);
    assert.equal(await sale.purchaseToken(), token.address);
    assert.equal(await sale.drawPrice(), '100');

    assert.equal(await sale.recipient(), ZERO_ADDRESS);

    assert.equal(await sale.startTime(), '0');
    assert.equal(await sale.endTime(), '0');

    assert.equal(await sale.drawCountBy(alice), '0');
    assert.equal(await sale.drawCountBy(carol), '0');

    assert.equal(await sale.totalDraws(), '0');
    assert.equal(await sale.prizeCount(), '0');
  });

  it('setTimes should revert for non-managers', async () => {
    const { token, collectible, sale } = this;

    await expectRevert(
      sale.setTimes(100, 10000, { from:bob }),
      "BlindCollectiblePrizeBag: must have MANAGER role to setTimes"
    );

    await expectRevert(
      sale.setTimes(12345, 0, { from:carol }),
      "BlindCollectiblePrizeBag: must have MANAGER role to setTimes"
    );

    await expectRevert(
      sale.setTimes(0, 7777, { from:salter }),
      "BlindCollectiblePrizeBag: must have MANAGER role to setTimes"
    );
  });

  it('setTimes should adjust startTime and endTime', async () => {
    const { token, collectible, sale } = this;

    await sale.setTimes(100, 10000, { from:alice });
    assert.equal(await sale.startTime(), '100');
    assert.equal(await sale.endTime(), '10000');

    await sale.setTimes(12345, 0, { from:manager });
    assert.equal(await sale.startTime(), '12345');
    assert.equal(await sale.endTime(), '0');

    await sale.setTimes(0, 7777, { from:manager });
    assert.equal(await sale.startTime(), '0');
    assert.equal(await sale.endTime(), '7777');
  });

  it('setRecipient should revert for non-managers', async () => {
    const { token, collectible, sale } = this;

    await expectRevert(
      sale.setRecipient(bob, { from:bob }),
      "BlindCollectiblePrizeBag: must have MANAGER role to setRecipient"
    );

    await expectRevert(
      sale.setRecipient(dave, { from:carol }),
      "BlindCollectiblePrizeBag: must have MANAGER role to setRecipient"
    );

    await expectRevert(
      sale.setRecipient(ZERO_ADDRESS, { from:dave }),
      "BlindCollectiblePrizeBag: must have MANAGER role to setRecipient"
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

  it('createPrize should revert for non-managers', async () => {
    const { token, collectible, sale } = this;

    await expectRevert(
      sale.createPrize(15, 1000, { from:bob }),
      "BlindCollectiblePrizeBag: must have MANAGER role to addPrize"
    );

    await expectRevert(
      sale.createPrize(0, 10, { from:salter }),
      "BlindCollectiblePrizeBag: must have MANAGER role to addPrize"
    );
  });

  it('createPrize should revert for invalid types', async () => {
    const { token, collectible, sale } = this;

    await expectRevert(
      sale.createPrize(150, 1000, { from:alice }),
      "BlindCollectiblePrizeBag: nonexistent tokenType"
    );

    await expectRevert(
      sale.createPrize(30, 10, { from:manager }),
      "BlindCollectiblePrizeBag: nonexistent tokenType"
    );
  });

  it('createPrize should function as expected', async () => {
    const { token, collectible, sale } = this;

    await sale.createPrize(0, 1000, { from:alice });
    assert.equal(await sale.availableSupply(), '1000');
    assert.equal(await sale.totalSupply(), '1000');
    assert.equal(await sale.totalDraws(), '0');
    assert.equal(await sale.prizeCount(), '1');
    assert.equal(await sale.availablePrizeSupply(0), '1000');
    assert.equal(await sale.totalPrizeSupply(0), '1000');
    assert.equal(await sale.prizeDrawCount(0), '0');
    assert.equal(await sale.prizeTokenType(0), '0');

    await sale.createPrize(7, 205, { from:manager });
    assert.equal(await sale.availableSupply(), '1205');
    assert.equal(await sale.totalSupply(), '1205');
    assert.equal(await sale.totalDraws(), '0');
    assert.equal(await sale.prizeCount(), '2');
    assert.equal(await sale.availablePrizeSupply(0), '1000');
    assert.equal(await sale.totalPrizeSupply(0), '1000');
    assert.equal(await sale.prizeDrawCount(0), '0');
    assert.equal(await sale.prizeTokenType(0), '0');
    assert.equal(await sale.availablePrizeSupply(1), '205');
    assert.equal(await sale.totalPrizeSupply(1), '205');
    assert.equal(await sale.prizeDrawCount(1), '0');
    assert.equal(await sale.prizeTokenType(1), '7');
  });

  context('with prizes', () => {
    beforeEach(async () => {
      const { token, collectible, sale } = this;
      await sale.createPrize(1, 1000, { from:alice });
      await sale.createPrize(7, 100, { from:alice });
      await sale.createPrize(10, 10, { from:alice });
    });

    it('addSupply reverts for non-manager', async () => {
      const { token, collectible, sale } = this;

      await expectRevert(
        sale.addSupply(0, 100, { from:bob }),
        "BlindCollectiblePrizeBag: must have MANAGER role to addSupply"
      );

      await expectRevert(
        sale.addSupply(1, 0, { from:salter }),
        "BlindCollectiblePrizeBag: must have MANAGER role to addSupply"
      );
    });

    it('addSupply reverts for invalid-pid', async () => {
      const { token, collectible, sale } = this;

      await expectRevert(
        sale.addSupply(3, 100, { from:alice }),
        "BlindCollectiblePrizeBag: nonexistent pid"
      );

      await expectRevert(
        sale.addSupply(5, 0, { from:manager }),
        "BlindCollectiblePrizeBag: nonexistent pid"
      );
    });

    it('addSupply increases prize supply', async () => {
      const { token, collectible, sale } = this;

      assert.equal(await sale.availableSupply(), '1110');
      assert.equal(await sale.totalSupply(), '1110');
      assert.equal(await sale.totalDraws(), '0');
      assert.equal(await sale.prizeCount(), '3');
      assert.equal(await sale.availablePrizeSupply(0), '1000');
      assert.equal(await sale.totalPrizeSupply(0), '1000');
      assert.equal(await sale.availablePrizeSupply(1), '100');
      assert.equal(await sale.totalPrizeSupply(1), '100');
      assert.equal(await sale.availablePrizeSupply(2), '10');
      assert.equal(await sale.totalPrizeSupply(2), '10');

      await sale.addSupply(0, 3, { from:alice });
      assert.equal(await sale.availableSupply(), '1113');
      assert.equal(await sale.totalSupply(), '1113');
      assert.equal(await sale.totalDraws(), '0');
      assert.equal(await sale.prizeCount(), '3');
      assert.equal(await sale.availablePrizeSupply(0), '1003');
      assert.equal(await sale.totalPrizeSupply(0), '1003');
      assert.equal(await sale.availablePrizeSupply(1), '100');
      assert.equal(await sale.totalPrizeSupply(1), '100');
      assert.equal(await sale.availablePrizeSupply(2), '10');
      assert.equal(await sale.totalPrizeSupply(2), '10');

      await sale.addSupply(2, 10000, { from:alice });
      assert.equal(await sale.availableSupply(), '11113');
      assert.equal(await sale.totalSupply(), '11113');
      assert.equal(await sale.totalDraws(), '0');
      assert.equal(await sale.prizeCount(), '3');
      assert.equal(await sale.availablePrizeSupply(0), '1003');
      assert.equal(await sale.totalPrizeSupply(0), '1003');
      assert.equal(await sale.availablePrizeSupply(1), '100');
      assert.equal(await sale.totalPrizeSupply(1), '100');
      assert.equal(await sale.availablePrizeSupply(2), '10010');
      assert.equal(await sale.totalPrizeSupply(2), '10010');
    });

    it('removeSupply reverts for non-manager', async () => {
      const { token, collectible, sale } = this;

      await expectRevert(
        sale.removeSupply(0, 100, false, { from:bob }),
        "BlindCollectiblePrizeBag: must have MANAGER role to removeSupply"
      );

      await expectRevert(
        sale.removeSupply(1, 5, true, { from:salter }),
        "BlindCollectiblePrizeBag: must have MANAGER role to removeSupply"
      );
    });

    it('removeSupply reverts for invalid-pid', async () => {
      const { token, collectible, sale } = this;

      await expectRevert(
        sale.removeSupply(3, 100, false, { from:alice }),
        "BlindCollectiblePrizeBag: nonexistent pid"
      );

      await expectRevert(
        sale.removeSupply(5, 5, true, { from:manager }),
        "BlindCollectiblePrizeBag: nonexistent pid"
      );
    });

    it('removeSupply reverts with too much removed and _zeroSafe = false', async () => {
      const { token, collectible, sale } = this;

      await expectRevert.unspecified(
        sale.removeSupply(3, 100, false, { from:alice })
      );

      await expectRevert.unspecified(
        sale.removeSupply(0, 1001, false, { from:manager })
      );
    });

    it('removeSupply reduces prize supply', async () => {
      const { token, collectible, sale } = this;

      assert.equal(await sale.availableSupply(), '1110');
      assert.equal(await sale.totalSupply(), '1110');
      assert.equal(await sale.totalDraws(), '0');
      assert.equal(await sale.prizeCount(), '3');
      assert.equal(await sale.availablePrizeSupply(0), '1000');
      assert.equal(await sale.totalPrizeSupply(0), '1000');
      assert.equal(await sale.availablePrizeSupply(1), '100');
      assert.equal(await sale.totalPrizeSupply(1), '100');
      assert.equal(await sale.availablePrizeSupply(2), '10');
      assert.equal(await sale.totalPrizeSupply(2), '10');

      await sale.removeSupply(0, 100, false, { from:alice });
      assert.equal(await sale.availableSupply(), '1010');
      assert.equal(await sale.totalSupply(), '1010');
      assert.equal(await sale.totalDraws(), '0');
      assert.equal(await sale.prizeCount(), '3');
      assert.equal(await sale.availablePrizeSupply(0), '900');
      assert.equal(await sale.totalPrizeSupply(0), '900');
      assert.equal(await sale.availablePrizeSupply(1), '100');
      assert.equal(await sale.totalPrizeSupply(1), '100');
      assert.equal(await sale.availablePrizeSupply(2), '10');
      assert.equal(await sale.totalPrizeSupply(2), '10');

      await sale.removeSupply(2, 100, true, { from:alice });
      assert.equal(await sale.availableSupply(), '1000');
      assert.equal(await sale.totalSupply(), '1000');
      assert.equal(await sale.totalDraws(), '0');
      assert.equal(await sale.prizeCount(), '3');
      assert.equal(await sale.availablePrizeSupply(0), '900');
      assert.equal(await sale.totalPrizeSupply(0), '900');
      assert.equal(await sale.availablePrizeSupply(1), '100');
      assert.equal(await sale.totalPrizeSupply(1), '100');
      assert.equal(await sale.availablePrizeSupply(2), '0');
      assert.equal(await sale.totalPrizeSupply(2), '0');
    });

    it('purchaseDraws selects a prize and mints a token', async () => {
      const { token, collectible, sale } = this;

      await token.transfer(bob, '1000', { from:minter });
      await token.approve(sale.address, '1000', { from:bob });

      await sale.removeSupply(0, 900, false, { from:manager });  // 100, 100, and 10
      for (let i = 0; i < 5; i++) {
        await sale.purchaseDraws(bob, 1, 100, { from:bob });
      }

      assert.equal(await sale.availableSupply(), '205');
      assert.equal(await sale.totalSupply(), '210');
      assert.equal(await sale.totalDraws(), '5');
      assert.equal(await sale.prizeCount(), '3');
      let counts = [100, 100, 10];
      let remainingCounts = [].concat(counts);
      for (let i  = 0; i < 5; i++) {
        let prizeDrawn = Number((await sale.drawPrizeId(i)).toString());
        remainingCounts[prizeDrawn] = remainingCounts[prizeDrawn] - 1;

        console.log(`draw ${i} prize ${await sale.drawPrizeId(i)} token type ${await sale.drawTokenType(i)} drawTokenId ${await sale.drawTokenId(i)}`);
      }

      for (let i = 0; i < counts.length; i++) {
        assert.equal(await sale.availablePrizeSupply(i), `${remainingCounts[i]}`);
        assert.equal(await sale.totalPrizeSupply(i), `${counts[i]}`);
      }
    })

    it('purchaseDraws selects multiple prizes and mints multiple tokens', async () => {
      const { token, collectible, sale } = this;

      await token.transfer(bob, '1000', { from:minter });
      await token.approve(sale.address, '1000', { from:bob });

      await sale.removeSupply(0, 900, false, { from:manager });  // 100, 100, and 10
      await sale.purchaseDraws(bob, 5, 500, { from:bob });
      assert.equal(await sale.availableSupply(), '205');
      assert.equal(await sale.totalSupply(), '210');
      assert.equal(await sale.totalDraws(), '5');
      assert.equal(await sale.prizeCount(), '3');
      let counts = [100, 100, 10];
      let remainingCounts = [].concat(counts);
      for (let i  = 0; i < 5; i++) {
        let prizeDrawn = Number((await sale.drawPrizeId(i)).toString());
        remainingCounts[prizeDrawn] = remainingCounts[prizeDrawn] - 1;

        console.log(`draw ${i} prize ${await sale.drawPrizeId(i)} token type ${await sale.drawTokenType(i)} drawTokenId ${await sale.drawTokenId(i)}`);
      }

      for (let i = 0; i < counts.length; i++) {
        assert.equal(await sale.availablePrizeSupply(i), `${remainingCounts[i]}`);
        assert.equal(await sale.totalPrizeSupply(i), `${counts[i]}`);
      }
    })
  });

  context('with few prizes', () => {
    beforeEach(async () => {
      const { token, collectible, sale } = this;
      await sale.createPrize(1, 5, { from:alice });
      await sale.createPrize(7, 5, { from:alice });
      await sale.createPrize(10, 1, { from:alice });
    });

    it('can exhaust supply', async () => {
      const { token, collectible, sale } = this;

      await token.transfer(bob, '1100', { from:minter });
      await token.approve(sale.address, '1100', { from:bob });

      await sale.purchaseDraws(bob, 11, 1100, { from:bob });

      assert.equal(await sale.availableSupply(), '0');
      assert.equal(await sale.totalSupply(), '11');
      assert.equal(await sale.totalDraws(), '11');
      assert.equal(await sale.prizeCount(), '3');

      const counts = [5, 5, 1];
      for (let i = 0; i < counts.length; i++) {
        assert.equal(await sale.availablePrizeSupply(i), `0`);
        assert.equal(await sale.totalPrizeSupply(i), `${counts[i]}`);
      }

      assert.equal(await collectible.totalSupplyByType(1), '5');
      assert.equal(await collectible.totalSupplyByType(7), '5');
      assert.equal(await collectible.totalSupplyByType(10), '1');

      assert.equal(await collectible.balanceOfOwnerByType(bob, 1), '5');
      assert.equal(await collectible.balanceOfOwnerByType(bob, 7), '5');
      assert.equal(await collectible.balanceOfOwnerByType(bob, 10), '1');

      await expectRevert(
        sale.purchaseDraws(bob, 1, 100, { from:bob }),
        "BlindCollectiblePrizeBag: not enough supply"
      );
    });
  });

  context('with many prizes', () => {
    beforeEach(async () => {
      const { token, collectible, sale } = this;
      await sale.createPrize(8, 1, { from:alice });
      await sale.createPrize(9, 1, { from:alice });
      await sale.createPrize(10, 1, { from:alice });
      await sale.createPrize(11, 1, { from:alice });
      await sale.createPrize(4, 10, { from:alice });
      await sale.createPrize(5, 10, { from:alice });
      await sale.createPrize(6, 10, { from:alice });
      await sale.createPrize(7, 10, { from:alice });
      await sale.createPrize(0, 100, { from:alice });
      await sale.createPrize(1, 100, { from:alice });
      await sale.createPrize(2, 100, { from:alice });
      await sale.createPrize(3, 100, { from:alice });
    });

    it('can purchase 10 draws', async () => {
      const { token, collectible, sale } = this;

      await token.transfer(bob, '10000', { from:minter });
      await token.approve(sale.address, '10000', { from:bob });
      const draws = 10;

      await sale.purchaseDraws(bob, draws, 10000, { from:bob });
      assert.equal(await sale.availableSupply(), `${444 - draws}`);
      assert.equal(await sale.totalSupply(), '444');
      assert.equal(await sale.totalDraws(), `${draws}`);
      assert.equal(await sale.prizeCount(), '12');
      let counts = [1, 1, 1, 1, 10, 10, 10, 10, 100, 100, 100, 100];
      let remainingCounts = [].concat(counts);
      let ownedTypeBalance = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      let prizeTypes = [];
      let uniquePrizeTypes = [];
      for (let i  = 0; i < draws; i++) {
        const prizeDrawn = Number((await sale.drawPrizeId(i)).toString());
        const prizeType = Number((await sale.prizeTokenType(prizeDrawn)).toString());
        remainingCounts[prizeDrawn] = remainingCounts[prizeDrawn] - 1;
        ownedTypeBalance[prizeType] = ownedTypeBalance[prizeType] + 1;
        prizeTypes.push(prizeType);
        if (!uniquePrizeTypes.includes(prizeType)) uniquePrizeTypes.push(prizeType);

        console.log(`draw ${i} prize ${await sale.drawPrizeId(i)} token type ${await sale.drawTokenType(i)} drawTokenId ${await sale.drawTokenId(i)}`);
      }

      for (let i = 0; i < counts.length; i++) {
        assert.equal(await sale.availablePrizeSupply(i), `${remainingCounts[i]}`);
        assert.equal(await sale.totalPrizeSupply(i), `${counts[i]}`);
      }


      for (let i = 0; i < ownedTypeBalance.length; i++) {
        assert.equal(await collectible.balanceOfOwnerByType(bob, i), `${ownedTypeBalance[i]}`);
      }
      assert.equal(await collectible.ownerTypes(bob), `${uniquePrizeTypes.length}`);
      for (let i = 0; i < uniquePrizeTypes.length; i++) {
        assert.equal(await collectible.ownerTypeByIndex(bob, i), `${uniquePrizeTypes[i]}`);
      }
    });
  });
});
