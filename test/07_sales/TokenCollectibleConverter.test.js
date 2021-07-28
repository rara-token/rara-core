const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const MockERC20 = artifacts.require('MockERC20');
const ERC721ValuableCollectibleToken = artifacts.require('ERC721ValuableCollectibleToken');
const BasicCollectibleConverter = artifacts.require('BasicCollectibleConverter');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('TokenCollectibleBlindBoxFactory', ([alice, bob, carol, dave, edith, manager, creator, minter]) => {
  const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');
  const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');

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

      this.converter = await BasicCollectibleConverter.new(this.collectible.address, this.token.address, ZERO_ADDRESS);
      this.converter.grantRole(MANAGER_ROLE, manager);
  });

  it('should have set initial state', async () => {
    const { token, collectible, converter } = this;

    assert.equal(await converter.token(), collectible.address);
    assert.equal(await converter.purchaseToken(), token.address);
    assert.equal(await converter.active(), true);
    assert.equal(await converter.recipient(), ZERO_ADDRESS);

    assert.equal(await converter.recipeCount(), '0');
  });

  it('createRecipe reverts for non-managers', async () => {
    const { token, collectible, converter } = this;

    await expectRevert(
      converter.createRecipe([0, 1, 2, 3], [4], 0, true, { from:bob }),
      "BasicCollectibleConverter: must have MANAGER role to createRecipe"
    );

    await expectRevert(
      converter.createRecipe([4, 5, 6, 7], [8], 100, false, { from:carol }),
      "BasicCollectibleConverter: must have MANAGER role to createRecipe"
    );
  });

  it('createRecipe creates a recipe', async () => {
    const { token, collectible, converter } = this;

    await converter.createRecipe([0, 1, 2, 3], [4], 0, true, { from:alice });
    assert.equal(await converter.recipeCount(), '1');
    assert.equal(await converter.recipeAvailable(0), true);
    assert.equal(await converter.recipePrice(0), '0');
    assert.deepEqual((await converter.recipeInput(0)).map(a => a.toString()), ["0", "1", "2", "3"]);
    assert.deepEqual((await converter.recipeOutput(0)).map(a => a.toString()), ["4"]);

    await converter.createRecipe([4, 5, 6, 7], [8], 100, false, { from:manager });
    assert.equal(await converter.recipeCount(), '2');
    assert.equal(await converter.recipeAvailable(1), false);
    assert.equal(await converter.recipePrice(1), '100');
    assert.deepEqual((await converter.recipeInput(1)).map(a => a.toString()), ["4", "5", "6", "7"]);
    assert.deepEqual((await converter.recipeOutput(1)).map(a => a.toString()), ["8"]);

    await converter.createRecipe([0, 4], [8, 9, 10, 11], 1500, true, { from:manager });
    assert.equal(await converter.recipeCount(), '3');
    assert.equal(await converter.recipeAvailable(2), true);
    assert.equal(await converter.recipePrice(2), '1500');
    assert.deepEqual((await converter.recipeInput(2)).map(a => a.toString()), ["0", "4"]);
    assert.deepEqual((await converter.recipeOutput(2)).map(a => a.toString()), ["8", "9", "10", "11"]);

    await converter.createRecipe([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 0, 0, 0, 0], 0, true, { from:alice });
    assert.equal(await converter.recipeCount(), '4');
    assert.equal(await converter.recipeAvailable(3), true);
    assert.equal(await converter.recipePrice(3), '0');
    assert.deepEqual((await converter.recipeInput(3)).map(a => a.toString()), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
    assert.deepEqual((await converter.recipeOutput(3)).map(a => a.toString()), ["0", "0", "0", "0", "0"]);
  });

  context('with recipes', () => {
    beforeEach(async () => {
      const { token, collectible, converter } = this;
      await converter.createRecipe([0, 1, 2, 3], [4], 0, true, { from:alice });
      await converter.createRecipe([4, 5, 6, 7], [8], 100, false, { from:manager });
      await converter.createRecipe([0, 4], [8, 9, 10, 11], 1500, true, { from:manager });
      await converter.createRecipe([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 0, 0, 0, 0], 0, true, { from:alice });
    });

    it('setRecipe reverts for non-manager', async () => {
      const { token, collectible, converter } = this;

      await expectRevert(
        converter.setRecipe(0, 10, false, { from:bob }),
        "BasicCollectibleConverter: must have MANAGER role to setRecipe"
      );

      await expectRevert(
        converter.setRecipe(3, 0, true, { from:carol }),
        "BasicCollectibleConverter: must have MANAGER role to setRecipe"
      );
    });

    it('setRecipe reverts for invalid recipeId', async () => {
      const { token, collectible, converter } = this;

      await expectRevert(
        converter.setRecipe(5, 10, false, { from:alice }),
        "BasicCollectibleConverter: nonexistent recipe"
      );
    });

    it('setRecipe alters price and availability', async () => {
      const { token, collectible, converter } = this;

      await converter.setRecipe(0, 10, false, { from:alice });
      assert.equal(await converter.recipeCount(), '4');
      assert.equal(await converter.recipeAvailable(0), false);
      assert.equal(await converter.recipePrice(0), '10');
      assert.deepEqual((await converter.recipeInput(0)).map(a => a.toString()), ["0", "1", "2", "3"]);
      assert.deepEqual((await converter.recipeOutput(0)).map(a => a.toString()), ["4"]);

      await converter.setRecipe(2, 0, true, { from:manager });
      assert.equal(await converter.recipeCount(), '4');
      assert.equal(await converter.recipeAvailable(2), true);
      assert.equal(await converter.recipePrice(2), '0');
      assert.deepEqual((await converter.recipeInput(2)).map(a => a.toString()), ["0", "4"]);
      assert.deepEqual((await converter.recipeOutput(2)).map(a => a.toString()), ["8", "9", "10", "11"]);
    });
  })
});
