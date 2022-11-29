const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const MockERC20 = artifacts.require('MockERC20');
const ERC721ValuableCollectibleToken = artifacts.require('ERC721ValuableCollectibleToken');
const BankableCollectibleConverter = artifacts.require('BankableCollectibleConverter');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('BankableCollectibleConverter', ([alice, bob, carol, dave, edith, manager, creator, minter]) => {
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
      for (let i = 0; i < 2; i++) {
        await this.collectible.addTokenType(`Triune ${i}`, `T${i}`, i + 30);
      }

      this.converter = await BankableCollectibleConverter.new(this.collectible.address, this.token.address, ZERO_ADDRESS);
      this.converter.grantRole(MANAGER_ROLE, manager);

      this.collectible.grantRole(MINTER_ROLE, this.converter.address);
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
      await converter.createRecipe([4, 5, 6, 7], [8], 100, true, { from:manager });
      await converter.createRecipe([0, 4], [8, 9, 10, 11], 1500, true, { from:manager });
      await converter.createRecipe([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 0, 0, 0, 0], 0, true, { from:alice });
      await converter.createRecipe([0, 0, 0, 0], [1], 0, true, { from:manager });
      await converter.createRecipe([0, 1, 2, 3], [4], 0, false, { from:alice });
      await converter.createRecipe([0, 1, 1, 2], [4], 0, true, { from:alice });
      await converter.createRecipe([0, 4, 8], [12], 0, true, { from:alice });
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
        converter.setRecipe(8, 10, false, { from:alice }),
        "BasicCollectibleConverter: nonexistent recipe"
      );

      await expectRevert(
        converter.setRecipe(20, 10, false, { from:alice }),
        "BasicCollectibleConverter: nonexistent recipe"
      );
    });

    it('setRecipe alters price and availability', async () => {
      const { token, collectible, converter } = this;

      await converter.setRecipe(0, 10, false, { from:alice });
      assert.equal(await converter.recipeCount(), '8');
      assert.equal(await converter.recipeAvailable(0), false);
      assert.equal(await converter.recipePrice(0), '10');
      assert.deepEqual((await converter.recipeInput(0)).map(a => a.toString()), ["0", "1", "2", "3"]);
      assert.deepEqual((await converter.recipeOutput(0)).map(a => a.toString()), ["4"]);

      await converter.setRecipe(2, 0, true, { from:manager });
      assert.equal(await converter.recipeCount(), '8');
      assert.equal(await converter.recipeAvailable(2), true);
      assert.equal(await converter.recipePrice(2), '0');
      assert.deepEqual((await converter.recipeInput(2)).map(a => a.toString()), ["0", "4"]);
      assert.deepEqual((await converter.recipeOutput(2)).map(a => a.toString()), ["8", "9", "10", "11"]);
    });

    it('canConvert reports false if tokenId array wrong length', async () => {
      const { token, collectible, converter } = this;

      await collectible.mint(alice, 0);
      await collectible.mint(alice, 1);
      await collectible.mint(alice, 2);
      await collectible.mint(alice, 3);
      await collectible.mint(alice, 0);

      assert.equal(await converter.canConvert(0, 0, []), false);
      assert.equal(await converter.canConvert(1, 200, [0, 1, 2]), false);
      assert.equal(await converter.canConvert(0, 0, [0, 1, 2, 3, 4]), false);
    });

    it('canConvert reports false if insufficient cost specified', async () => {
      const { token, collectible, converter } = this;

      await collectible.massMint(alice, [0, 1, 2, 3, 4, 5, 6, 7]);

      assert.equal(await converter.canConvert(1, 0, [4, 5, 6, 7]), false);
      assert.equal(await converter.canConvert(1, 99, [0, 1, 2, 3]), false);
      assert.equal(await converter.canConvert(2, 1499, [0, 4]), false);
      assert.equal(await converter.canConvert(2, 1499, [1, 2]), false);
    });

    it('canConvert reports false if tokens do not match required input types', async () => {
      const { token, collectible, converter } = this;

      await collectible.massMint(alice, [0, 1, 2, 3, 4, 5, 6, 7]);

      assert.equal(await converter.canConvert(0, 0, [0, 1, 2, 4]), false);
      assert.equal(await converter.canConvert(1, 100, [3, 5, 6, 7]), false);
      assert.equal(await converter.canConvert(2, 1500, [0, 3]), false);
      assert.equal(await converter.canConvert(2, 1500, [1, 4]), false);
    });

    /*
    it('canConvert reports false if tokens repeat', async () => {
      const { token, collectible, converter } = this;

      // 0-11 match types
      await collectible.massMint(alice, [0, 1, 2, 3, 4, 5]);
      await collectible.massMint(alice, [6, 7, 8, 9, 10, 11]);

      // pack with zeroes to get to 20
      await collectible.massMint(alice, [0, 0, 0, 0, 0, 0, 0, 0]);

      // 20-31 match types + 20
      await collectible.massMint(alice, [0, 1, 2, 3, 4, 5]);
      await collectible.massMint(alice, [6, 7, 8, 9, 10, 11]);

      assert.equal(await converter.canConvert(4, 0, [0, 0, 0, 0]), false);
      assert.equal(await converter.canConvert(4, 0, [0, 12, 13, 12]), false);
      assert.equal(await converter.canConvert(6, 0, [0, 1, 1, 2]), false);
    });
    */

    it('canConvert reports true if okay to swap', async () => {
      const { token, collectible, converter } = this;

      // 0-11 match types
      await collectible.massMint(alice, [0, 1, 2, 3, 4, 5]);
      await collectible.massMint(alice, [6, 7, 8, 9, 10, 11]);

      // pack with zeroes to get to 20
      await collectible.massMint(alice, [0, 0, 0, 0, 0, 0, 0, 0]);

      // 20-31 match types + 20
      await collectible.massMint(alice, [0, 1, 2, 3, 4, 5]);
      await collectible.massMint(alice, [6, 7, 8, 9, 10, 11]);

      assert.equal(await converter.canConvert(0, 0, [0, 1, 2, 3]), true);
      assert.equal(await converter.canConvert(1, 100, [4, 5, 6, 7]), true);
      assert.equal(await converter.canConvert(2, 1500, [0, 4]), true);
      assert.equal(await converter.canConvert(3, 0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), true);
      assert.equal(await converter.canConvert(4, 0, [0, 12, 13, 14]), true);
      assert.equal(await converter.canConvert(5, 0, [0, 1, 2, 3]), false);
      assert.equal(await converter.canConvert(6, 0, [0, 1, 21, 22]), true);
    });

    it("convert rejects for unavailable conversion", async () => {
      const { token, collectible, converter } = this;

      // 0-11 match types
      await collectible.massMint(alice, [0, 1, 2, 3, 4, 5]);
      await collectible.massMint(alice, [6, 7, 8, 9, 10, 11]);

      // pack with zeroes to get to 20
      await collectible.massMint(alice, [0, 0, 0, 0, 0, 0, 0, 0]);

      // 20-31 match types + 20
      await collectible.massMint(alice, [0, 1, 2, 3, 4, 5]);
      await collectible.massMint(alice, [6, 7, 8, 9, 10, 11]);

      await expectRevert(
        converter.convert(5, 100, [0, 1, 2, 3]),
        "BankableCollectibleConverter: unavailable"
      );

      await converter.setActive(false, { from:manager });
      await expectRevert(
        converter.convert(0, 100, [0, 1, 2, 3]),
        "BankableCollectibleConverter: unavailable"
      );
    });

    it("convert rejects for incorrect parameters", async () => {
      const { token, collectible, converter } = this;

      // 0-11 match types
      await collectible.massMint(alice, [0, 1, 2, 3, 4, 5]);
      await collectible.massMint(alice, [6, 7, 8, 9, 10, 11]);

      // pack with zeroes to get to 20
      await collectible.massMint(alice, [0, 0, 0, 0, 0, 0, 0, 0]);

      // 20-31 match types + 20
      await collectible.massMint(alice, [0, 1, 2, 3, 4, 5]);
      await collectible.massMint(alice, [6, 7, 8, 9, 10, 11]);

      await expectRevert(
        converter.convert(1, 200, [0, 1, 2]),
        "BankableCollectibleConverter: invalid tokens"
      );

      await expectRevert(
        converter.convert(2, 1499, [0, 4]),
        "BankableCollectibleConverter: insufficient funds"
      );

      await expectRevert(
        converter.convert(1, 100, [3, 5, 6, 7]),
        "BankableCollectibleConverter: invalid tokens"
      );
    });

    it("conversions work as expected", async () => {
      const { token, collectible, converter } = this;

      const accounts = [alice, bob, carol];
      let supply = 0;
      let typeSupply = {};
      let userBalance = {};
      let userTypeSupply = {};
      for (const account of accounts) {
        // 0-11 match types
        await collectible.massMint(account, [0, 1, 2, 3, 4, 5]);
        await collectible.massMint(account, [6, 7, 8, 9, 10, 11]);

        // pack with zeroes to get to 20
        await collectible.massMint(account, [0, 0, 0, 0, 0, 0, 0, 0]);

        // 20-31 match types + 20
        await collectible.massMint(account, [0, 1, 2, 3, 4, 5]);
        await collectible.massMint(account, [6, 7, 8, 9, 10, 11]);

        // mint 1s to get to 1
        await collectible.massMint(account, [1, 1, 1, 1, 1, 1, 1, 1]);

        userBalance[account] = 40;
        supply = supply + 40;
        const ts = {};
        ts[0] = ts[1] = 10;
        for (let i = 2; i < 12; i++) {
          ts[i] = 2;
        }

        userTypeSupply[account] = { ...ts };
        for (let i = 0; i < 12; i++) {
          typeSupply[i] = (typeSupply[i] || 0) + ts[i];
        }

        await token.mint(account, 100000, { from:minter });
        await token.approve(converter.address, 100000, { from:account });
        await collectible.setApprovalForAll(converter.address, true, { from:account });
      }

      async function verifyAmounts() {
        assert.equal(await collectible.totalSupply(), `${supply}`);
        for (const account of accounts) {
          assert.equal(await collectible.balanceOf(account), `${userBalance[account]}`);
          for (let type = 0; type < 12; type++) {
            assert.equal(await collectible.balanceOfOwnerByType(account, type), `${userTypeSupply[account][type]}`);
          }
        }
        for (let type = 0; type < 12; type++) {
          assert.equal(await collectible.totalSupplyByType(type), `${typeSupply[type]}`);
        }
      }

      function alterAmounts(account, burnTypes, mintTypes) {
        supply += mintTypes.length - burnTypes.length;
        userBalance[account] += mintTypes.length - burnTypes.length;
        for (const type of burnTypes) {
          typeSupply[type]--;
          userTypeSupply[account][type]--;
        }
        for (const type of mintTypes) {
          typeSupply[type]++;
          userTypeSupply[account][type]++;
        }
      }

      // verify that counts are correct
      await verifyAmounts();

      // do some conversion for alice
      await converter.convert(0, 10000, [0, 1, 2, 3], { from:alice });   // cost 0
      await alterAmounts(alice, [0, 1, 2, 3], [4]); // the recipe
      assert.equal(await token.balanceOf(alice), '100000');
      assert.equal(await collectible.ownerOf(120), alice);
      assert.equal(await collectible.tokenType(120), '4');
      await verifyAmounts();

      await converter.convert(1, 10000, [4, 5, 6, 7], { from:alice });   // cost 0
      await alterAmounts(alice, [4, 5, 6, 7], [8]); // the recipe
      assert.equal(await token.balanceOf(alice), '99900');
      assert.equal(await collectible.ownerOf(121), alice);
      assert.equal(await collectible.tokenType(121), '8');
      await verifyAmounts();

      await converter.convert(2, 10000, [20, 24], { from:alice });   // cost 0
      await alterAmounts(alice, [0, 4], [8, 9, 10, 11]); // the recipe
      assert.equal(await token.balanceOf(alice), '98400');
      assert.equal(await collectible.ownerOf(122), alice);
      assert.equal(await collectible.ownerOf(123), alice);
      assert.equal(await collectible.ownerOf(124), alice);
      assert.equal(await collectible.ownerOf(125), alice);
      assert.equal(await collectible.tokenType(122), '8');
      assert.equal(await collectible.tokenType(123), '9');
      assert.equal(await collectible.tokenType(124), '10');
      assert.equal(await collectible.tokenType(125), '11');
      await verifyAmounts();

      // for bob
      await expectRevert.unspecified(
        converter.convert(3, 10000, [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51], { from:alice })
      )
      await converter.convert(3, 10000, [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51], { from:bob });   // cost 0
      await alterAmounts(bob, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 0, 0, 0, 0]); // the recipe
      assert.equal(await token.balanceOf(bob), '100000');
      assert.equal(await collectible.ownerOf(126), bob);
      assert.equal(await collectible.ownerOf(127), bob);
      assert.equal(await collectible.ownerOf(128), bob);
      assert.equal(await collectible.ownerOf(129), bob);
      assert.equal(await collectible.ownerOf(130), bob);
      assert.equal(await collectible.tokenType(126), '0');
      assert.equal(await collectible.tokenType(127), '0');
      assert.equal(await collectible.tokenType(128), '0');
      assert.equal(await collectible.tokenType(129), '0');
      assert.equal(await collectible.tokenType(130), '0');
      await verifyAmounts();

      await converter.convert(4, 10000, [126, 127, 128, 129], { from:bob });   // cost 0
      await alterAmounts(bob, [0, 0, 0, 0], [1]); // the recipe
      assert.equal(await token.balanceOf(bob), '100000');
      assert.equal(await collectible.ownerOf(131), bob);
      assert.equal(await collectible.tokenType(131), '1');
      await verifyAmounts();

      // for carol
      await expectRevert(
        converter.convert(5, 10000, [80, 81, 82, 83], { from:carol }),
        "BankableCollectibleConverter: unavailable"
      );

      await converter.convert(6, 10000, [80, 81, 101, 102], { from:carol });
      await alterAmounts(carol, [0, 1, 1, 2], [4]); // the recipe
      assert.equal(await token.balanceOf(bob), '100000');
      assert.equal(await collectible.ownerOf(132), carol);
      assert.equal(await collectible.tokenType(132), '4');
      await verifyAmounts();
    });

    it("conversions emit Conversion event", async () => {
      const { token, collectible, converter } = this;

      const accounts = [alice, bob, carol];
      let supply = 0;
      let typeSupply = {};
      let userBalance = {};
      let userTypeSupply = {};
      for (const account of accounts) {
        // 0-11 match types
        await collectible.massMint(account, [0, 1, 2, 3, 4, 5]);
        await collectible.massMint(account, [6, 7, 8, 9, 10, 11]);

        // pack with zeroes to get to 20
        await collectible.massMint(account, [0, 0, 0, 0, 0, 0, 0, 0]);

        // 20-31 match types + 20
        await collectible.massMint(account, [0, 1, 2, 3, 4, 5]);
        await collectible.massMint(account, [6, 7, 8, 9, 10, 11]);

        // mint 1s to get to 1
        await collectible.massMint(account, [1, 1, 1, 1, 1, 1, 1, 1]);

        userBalance[account] = 40;
        supply = supply + 40;
        const ts = {};
        ts[0] = ts[1] = 10;
        for (let i = 2; i < 12; i++) {
          ts[i] = 2;
        }

        userTypeSupply[account] = { ...ts };
        for (let i = 0; i < 12; i++) {
          typeSupply[i] = (typeSupply[i] || 0) + ts[i];
        }

        await token.mint(account, 100000, { from:minter });
        await token.approve(converter.address, 100000, { from:account });
        await collectible.setApprovalForAll(converter.address, true, { from:account });
      }

      // do some conversion for alice
      let res = await converter.convert(0, 10000, [0, 1, 2, 3], { from:alice });   // cost 0
      await expectEvent.inTransaction(res.tx, converter, "Conversion", {
          owner: alice,
          recipeId: '0',
          price: '0',
          tokenIdsIn: ['0', '1', '2', '3'],
          tokenTypesIn: ['0', '1', '2', '3'],
          tokenIdsOut: ['120']
      });

      res = await converter.convert(1, 10000, [4, 5, 6, 7], { from:alice });   // cost 0
      await expectEvent.inTransaction(res.tx, converter, "Conversion", {
          owner: alice,
          recipeId: '1',
          price: '100',
          tokenIdsIn: ['4', '5', '6', '7'],
          tokenTypesIn: ['4', '5', '6', '7'],
          tokenIdsOut: ['121']
      });

      res = await converter.convert(2, 10000, [20, 24], { from:alice });   // cost 0
      await expectEvent.inTransaction(res.tx, converter, "Conversion", {
          owner: alice,
          recipeId: '2',
          price: '1500',
          tokenIdsIn: ['20', '24'],
          tokenTypesIn: ['0', '4'],
          tokenIdsOut: ['122', '123', '124', '125']
      });

      // for bob
      await expectRevert.unspecified(
        converter.convert(3, 10000, [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51], { from:alice })
      )
      res = await converter.convert(3, 10000, [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51], { from:bob });   // cost 0
      await expectEvent.inTransaction(res.tx, converter, "Conversion", {
          owner: bob,
          recipeId: '3',
          price: '0',
          tokenIdsIn: ['41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51'],
          tokenTypesIn: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
          tokenIdsOut: ['126', '127', '128', '129', '130']
      });

      res = await converter.convert(4, 10000, [126, 127, 128, 129], { from:bob });   // cost 0
      await expectEvent.inTransaction(res.tx, converter, "Conversion", {
          owner: bob,
          recipeId: '4',
          price: '0',
          tokenIdsIn: ['126', '127', '128', '129'],
          tokenTypesIn: ['0', '0', '0', '0'],
          tokenIdsOut: ['131']
      });

      // for carol
      await expectRevert(
        converter.convert(5, 10000, [80, 81, 82, 83], { from:carol }),
        "BankableCollectibleConverter: unavailable"
      );

      res = await converter.convert(6, 10000, [80, 81, 101, 102], { from:carol });
      await expectEvent.inTransaction(res.tx, converter, "Conversion", {
          owner: carol,
          recipeId: '6',
          price: '0',
          tokenIdsIn: ['80', '81', '101', '102'],
          tokenTypesIn: ['0', '1', '1', '2'],
          tokenIdsOut: ['132']
      });
    });

    it('bank reverts for tokens of type unused for input', async () => {
      const { token, collectible, converter } = this;
      await collectible.massMint(alice, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
      await collectible.setApprovalForAll(converter.address, true, { from:alice });

      await expectRevert(
          converter.bank([12], { from:alice }),
          "BankableCollectibleConverter: invalid tokenType"
      );

      await expectRevert(
          converter.bank([13], { from:alice }),
          "BankableCollectibleConverter: invalid tokenType"
      );

      await expectRevert(
          converter.bank([0, 1, 2, 3, 12, 4, 5, 6, 7], { from:alice }),
          "BankableCollectibleConverter: invalid tokenType"
      );
    });

    it('bank removes tokens and update state accordingly', async () => {
      const { token, collectible, converter } = this;
      await collectible.massMint(alice, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      await collectible.massMint(bob, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      await collectible.massMint(carol, [0, 0, 0, 0, 0, 1, 1, 1, 1, 2]);
      await collectible.setApprovalForAll(converter.address, true, { from:alice });
      await collectible.setApprovalForAll(converter.address, true, { from:bob });
      await collectible.setApprovalForAll(converter.address, true, { from:carol });

      assert.equal(await collectible.balanceOf(alice), '10');
      await converter.bank([0, 1, 2, 3, 4], { from:alice });
      assert.equal(await collectible.balanceOf(alice), '5');
      assert.equal(await collectible.totalSupply(), '25');
      assert.equal(await converter.bankedBalance(alice, 0), '1');
      assert.equal(await converter.bankedBalance(alice, 1), '1');
      assert.equal(await converter.bankedBalance(alice, 2), '1');
      assert.equal(await converter.bankedBalance(alice, 3), '1');
      assert.equal(await converter.bankedBalance(alice, 4), '1');
      assert.equal(await converter.bankedBalance(alice, 5), '0');
      assert.equal(await converter.bankedBalance(alice, 6), '0');
      assert.equal(await converter.bankedBalance(alice, 7), '0');
      assert.equal(await converter.bankedBalance(alice, 8), '0');
      assert.equal(await converter.bankedBalance(alice, 9), '0');

      assert.equal(await collectible.balanceOf(bob), '10');
      await converter.bank([10, 12, 14, 16, 18], { from:bob });
      assert.equal(await collectible.balanceOf(bob), '5');
      assert.equal(await collectible.totalSupply(), '20');
      assert.equal(await converter.bankedBalance(bob, 0), '1');
      assert.equal(await converter.bankedBalance(bob, 1), '0');
      assert.equal(await converter.bankedBalance(bob, 2), '1');
      assert.equal(await converter.bankedBalance(bob, 3), '0');
      assert.equal(await converter.bankedBalance(bob, 4), '1');
      assert.equal(await converter.bankedBalance(bob, 5), '0');
      assert.equal(await converter.bankedBalance(bob, 6), '1');
      assert.equal(await converter.bankedBalance(bob, 7), '0');
      assert.equal(await converter.bankedBalance(bob, 8), '1');
      assert.equal(await converter.bankedBalance(bob, 9), '0');

      assert.equal(await collectible.balanceOf(carol), '10');
      await converter.bank([20, 21, 22, 25, 26, 27, 28, 29], { from:carol });
      assert.equal(await collectible.balanceOf(carol), '2');
      assert.equal(await collectible.totalSupply(), '12');
      assert.equal(await converter.bankedBalance(carol, 0), '3');
      assert.equal(await converter.bankedBalance(carol, 1), '4');
      assert.equal(await converter.bankedBalance(carol, 2), '1');
      assert.equal(await converter.bankedBalance(carol, 3), '0');
      assert.equal(await converter.bankedBalance(carol, 4), '0');
      assert.equal(await converter.bankedBalance(carol, 5), '0');
      assert.equal(await converter.bankedBalance(carol, 6), '0');
      assert.equal(await converter.bankedBalance(carol, 7), '0');
      assert.equal(await converter.bankedBalance(carol, 8), '0');
      assert.equal(await converter.bankedBalance(carol, 9), '0');
    });

    it('bank emits Bank events', async () => {
      const { token, collectible, converter } = this;
      await collectible.massMint(alice, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      await collectible.massMint(bob, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      await collectible.massMint(carol, [0, 0, 0, 0, 0, 1, 1, 1, 1, 2]);
      await collectible.setApprovalForAll(converter.address, true, { from:alice });
      await collectible.setApprovalForAll(converter.address, true, { from:bob });
      await collectible.setApprovalForAll(converter.address, true, { from:carol });

      let res = await converter.bank([0, 1, 2, 3, 4], { from:alice });
      await expectEvent.inTransaction(res.tx, converter, 'Bank', {
        owner: alice,
        tokenIds: ['0', '1', '2', '3', '4'],
        tokenTypes: ['0', '1', '2', '3', '4']
      });

      res = await converter.bank([10, 12, 14, 16, 18], { from:bob });
      await expectEvent.inTransaction(res.tx, converter, 'Bank', {
        owner: bob,
        tokenIds: ['10', '12', '14', '16', '18'],
        tokenTypes: ['0', '2', '4', '6', '8']
      });

      res = await converter.bank([20, 21, 22, 25, 26, 27, 28, 29], { from:carol });
      await expectEvent.inTransaction(res.tx, converter, 'Bank', {
        owner: carol,
        tokenIds: ['20', '21', '22', '25', '26', '27', '28', '29'],
        tokenTypes: ['0', '0', '0', '1', '1', '1', '1', '2']
      });
    });

    it("conversions use banked tokens when necessary", async () => {
      const { token, collectible, converter } = this;

      const accounts = [alice, bob, carol];
      let supply = 0;
      let typeSupply = {};
      let userBalance = {};
      let userTypeSupply = {};
      let userTypeBanked = {}
      for (const account of accounts) {
        // 0-11 match types
        await collectible.massMint(account, [0, 1, 2, 3, 4, 5]);
        await collectible.massMint(account, [6, 7, 8, 9, 10, 11]);

        // pack with zeroes to get to 20
        await collectible.massMint(account, [0, 0, 0, 0, 0, 0, 0, 0]);

        // 20-31 match types + 20
        await collectible.massMint(account, [0, 1, 2, 3, 4, 5]);
        await collectible.massMint(account, [6, 7, 8, 9, 10, 11]);

        // mint 1s to get to 1
        await collectible.massMint(account, [1, 1, 1, 1, 1, 1, 1, 1]);

        userBalance[account] = 40;
        supply = supply + 40;
        const ts = {};
        ts[0] = ts[1] = 10;
        for (let i = 2; i < 12; i++) {
          ts[i] = 2;
        }

        userTypeSupply[account] = { ...ts };
        for (let i = 0; i < 12; i++) {
          typeSupply[i] = (typeSupply[i] || 0) + ts[i];
        }
        userTypeBanked[account] = new Array(12).fill(0);

        await token.mint(account, 100000, { from:minter });
        await token.approve(converter.address, 100000, { from:account });
        await collectible.setApprovalForAll(converter.address, true, { from:account });
      }

      await collectible.massMint(alice, [0, 0, 0, 0, 0]);
      await converter.bank([120, 121, 122, 123, 124], { from:alice });
      await collectible.massMint(alice, [1, 1, 1, 1, 1]);
      await converter.bank([125, 126, 127, 128, 129], { from:alice });

      await collectible.massMint(bob, [0, 0, 0, 0, 0]);
      await converter.bank([130, 131, 132, 133, 134], { from:bob });
      await collectible.massMint(bob, [1, 1, 1, 1, 1]);
      await converter.bank([135, 136, 137, 138, 139], { from:bob });

      await collectible.massMint(carol, [0, 0, 0, 0, 0]);
      await converter.bank([140, 141, 142, 143, 144], { from:carol });
      await collectible.massMint(carol, [1, 1, 1, 1, 1]);
      await converter.bank([145, 146, 147, 148, 149], { from:carol });

      for (const account of accounts) {
        userTypeBanked[account][0] = 5;
        userTypeBanked[account][1] = 5;
      }

      async function verifyAmounts() {
        assert.equal(await collectible.totalSupply(), `${supply}`);
        for (const account of accounts) {
          assert.equal(await collectible.balanceOf(account), `${userBalance[account]}`);
          for (let type = 0; type < 12; type++) {
            assert.equal(await collectible.balanceOfOwnerByType(account, type), `${userTypeSupply[account][type]}`);
            assert.equal(await converter.bankedBalance(account, type), `${userTypeBanked[account][type]}`);
          }
        }
        for (let type = 0; type < 12; type++) {
          assert.equal(await collectible.totalSupplyByType(type), `${typeSupply[type]}`);
        }
      }

      function alterAmounts(account, burnTypes, bankTypes, mintTypes) {
        supply += mintTypes.length - burnTypes.length;
        userBalance[account] += mintTypes.length - burnTypes.length;
        for (const type of burnTypes) {
          typeSupply[type]--;
          userTypeSupply[account][type]--;
        }
        for (const type of bankTypes) {
          userTypeBanked[account][type]--;
        }
        for (const type of mintTypes) {
          typeSupply[type]++;
          userTypeSupply[account][type]++;
        }
      }

      // verify that counts are correct
      await verifyAmounts();

      // do some conversion for alice
      await converter.convert(0, 10000, [2, 3], { from:alice });   // spend a 0 and a 1
      await alterAmounts(alice, [2, 3], [0, 1], [4]); // the recipe
      assert.equal(await token.balanceOf(alice), '100000');
      assert.equal(await collectible.ownerOf(150), alice);
      assert.equal(await collectible.tokenType(150), '4');
      await verifyAmounts();

      await converter.convert(1, 10000, [4, 5, 6, 7], { from:alice });   // cost 0
      await alterAmounts(alice, [4, 5, 6, 7], [], [8]); // the recipe
      assert.equal(await token.balanceOf(alice), '99900');
      assert.equal(await collectible.ownerOf(151), alice);
      assert.equal(await collectible.tokenType(151), '8');
      await verifyAmounts();

      await converter.convert(2, 10000, [24], { from:alice });   // spend a 0
      await alterAmounts(alice, [4], [0], [8, 9, 10, 11]); // the recipe
      assert.equal(await token.balanceOf(alice), '98400');
      assert.equal(await collectible.ownerOf(152), alice);
      assert.equal(await collectible.ownerOf(153), alice);
      assert.equal(await collectible.ownerOf(154), alice);
      assert.equal(await collectible.ownerOf(155), alice);
      assert.equal(await collectible.tokenType(152), '8');
      assert.equal(await collectible.tokenType(153), '9');
      assert.equal(await collectible.tokenType(154), '10');
      assert.equal(await collectible.tokenType(155), '11');
      await verifyAmounts();

      // for bob
      await expectRevert.unspecified(
        converter.convert(3, 10000, [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51], { from:alice })
      )
      await converter.convert(3, 10000, [42, 43, 44, 45, 46, 47, 48, 49, 50, 51], { from:bob });   // spend a 1
      await alterAmounts(bob, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [1], [0, 0, 0, 0, 0]); // the recipe
      assert.equal(await token.balanceOf(bob), '100000');
      assert.equal(await collectible.ownerOf(156), bob);
      assert.equal(await collectible.ownerOf(157), bob);
      assert.equal(await collectible.ownerOf(158), bob);
      assert.equal(await collectible.ownerOf(159), bob);
      assert.equal(await collectible.ownerOf(160), bob);
      assert.equal(await collectible.tokenType(156), '0');
      assert.equal(await collectible.tokenType(157), '0');
      assert.equal(await collectible.tokenType(158), '0');
      assert.equal(await collectible.tokenType(159), '0');
      assert.equal(await collectible.tokenType(160), '0');
      await verifyAmounts();

      await converter.convert(4, 10000, [], { from:bob });   // spend 4 from type 0 bank
      await alterAmounts(bob, [], [0, 0, 0, 0], [1]); // the recipe
      assert.equal(await token.balanceOf(bob), '100000');
      assert.equal(await collectible.ownerOf(161), bob);
      assert.equal(await collectible.tokenType(161), '1');
      await verifyAmounts();

      // for carol
      await expectRevert(
        converter.convert(5, 10000, [82, 83], { from:carol }),
        "BankableCollectibleConverter: unavailable"
      );

      await converter.convert(6, 10000, [101, 102], { from:carol });  // spend 0 and 1
      await alterAmounts(carol, [1, 2], [0, 1], [4]); // the recipe
      assert.equal(await token.balanceOf(bob), '100000');
      assert.equal(await collectible.ownerOf(162), carol);
      assert.equal(await collectible.tokenType(162), '4');
      await verifyAmounts();
    });

    it("conversions using banked tokens emit Conversion events", async () => {
      const { token, collectible, converter } = this;

      const accounts = [alice, bob, carol];
      let supply = 0;
      let typeSupply = {};
      let userBalance = {};
      let userTypeSupply = {};
      let userTypeBanked = {}
      for (const account of accounts) {
        // 0-11 match types
        await collectible.massMint(account, [0, 1, 2, 3, 4, 5]);
        await collectible.massMint(account, [6, 7, 8, 9, 10, 11]);

        // pack with zeroes to get to 20
        await collectible.massMint(account, [0, 0, 0, 0, 0, 0, 0, 0]);

        // 20-31 match types + 20
        await collectible.massMint(account, [0, 1, 2, 3, 4, 5]);
        await collectible.massMint(account, [6, 7, 8, 9, 10, 11]);

        // mint 1s to get to 1
        await collectible.massMint(account, [1, 1, 1, 1, 1, 1, 1, 1]);

        userBalance[account] = 40;
        supply = supply + 40;
        const ts = {};
        ts[0] = ts[1] = 10;
        for (let i = 2; i < 12; i++) {
          ts[i] = 2;
        }

        userTypeSupply[account] = { ...ts };
        for (let i = 0; i < 12; i++) {
          typeSupply[i] = (typeSupply[i] || 0) + ts[i];
        }
        userTypeBanked[account] = new Array(12).fill(0);

        await token.mint(account, 100000, { from:minter });
        await token.approve(converter.address, 100000, { from:account });
        await collectible.setApprovalForAll(converter.address, true, { from:account });
      }

      await collectible.massMint(alice, [0, 0, 0, 0, 0]);
      await converter.bank([120, 121, 122, 123, 124], { from:alice });
      await collectible.massMint(alice, [1, 1, 1, 1, 1]);
      await converter.bank([125, 126, 127, 128, 129], { from:alice });

      await collectible.massMint(bob, [0, 0, 0, 0, 0]);
      await converter.bank([130, 131, 132, 133, 134], { from:bob });
      await collectible.massMint(bob, [1, 1, 1, 1, 1]);
      await converter.bank([135, 136, 137, 138, 139], { from:bob });

      await collectible.massMint(carol, [0, 0, 0, 0, 0]);
      await converter.bank([140, 141, 142, 143, 144], { from:carol });
      await collectible.massMint(carol, [1, 1, 1, 1, 1]);
      await converter.bank([145, 146, 147, 148, 149], { from:carol });

      for (const account of accounts) {
        userTypeBanked[account][0] = 5;
        userTypeBanked[account][1] = 5;
      }

      // do some conversion for alice
      let res = await converter.convert(0, 10000, [2, 3], { from:alice });   // spend a 0 and a 1
      await expectEvent.inTransaction(res.tx, converter, "Conversion", {
          owner: alice,
          recipeId: '0',
          price: '0',
          tokenIdsIn: ['2', '3'],
          tokenTypesIn: ['2', '3'],
          tokenIdsOut: ['150']
      });

      res = await converter.convert(1, 10000, [4, 5, 6, 7], { from:alice });   // cost 0
      await expectEvent.inTransaction(res.tx, converter, "Conversion", {
          owner: alice,
          recipeId: '1',
          price: '100',
          tokenIdsIn: ['4', '5', '6', '7'],
          tokenTypesIn: ['4', '5', '6', '7'],
          tokenIdsOut: ['151']
      });

      res = await converter.convert(2, 10000, [24], { from:alice });   // spend a 0
      await expectEvent.inTransaction(res.tx, converter, "Conversion", {
          owner: alice,
          recipeId: '2',
          price: '1500',
          tokenIdsIn: ['24'],
          tokenTypesIn: ['4'],
          tokenIdsOut: ['152', '153', '154', '155']
      });

      // for bob
      await expectRevert.unspecified(
        converter.convert(3, 10000, [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51], { from:alice })
      )
      res = await converter.convert(3, 10000, [42, 43, 44, 45, 46, 47, 48, 49, 50, 51], { from:bob });   // spend a 1
      await expectEvent.inTransaction(res.tx, converter, "Conversion", {
          owner: bob,
          recipeId: '3',
          price: '0',
          tokenIdsIn: ['42', '43', '44', '45', '46', '47', '48', '49', '50', '51'],
          tokenTypesIn: ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
          tokenIdsOut: ['156', '157', '158', '159', '160']
      });

      res = await converter.convert(4, 10000, [], { from:bob });   // spend 4 from type 0 bank
      await expectEvent.inTransaction(res.tx, converter, "Conversion", {
          owner: bob,
          recipeId: '4',
          price: '0',
          tokenIdsIn: [],
          tokenTypesIn: [],
          tokenIdsOut: ['161']
      });

      // for carol
      await expectRevert(
        converter.convert(5, 10000, [82, 83], { from:carol }),
        "BankableCollectibleConverter: unavailable"
      );

      res = await converter.convert(6, 10000, [101, 102], { from:carol });  // spend 0 and 1
      await expectEvent.inTransaction(res.tx, converter, "Conversion", {
          owner: carol,
          recipeId: '6',
          price: '0',
          tokenIdsIn: ['101', '102'],
          tokenTypesIn: ['1', '2'],
          tokenIdsOut: ['162']
      });
    });
  })
});
