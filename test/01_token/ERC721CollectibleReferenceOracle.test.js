const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const ERC721CollectibleReferenceOracle = artifacts.require('ERC721CollectibleReferenceOracle');
const ERC721ValuableCollectibleToken = artifacts.require('ERC721ValuableCollectibleToken');
const MockERC721Valuable = artifacts.require('MockERC721Valuable');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('ERC721CollectibleReferenceOracle', ([alice, bob, carol, dave, edith, manager, minter, pauser]) => {
    const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');
    const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
    const PAUSER_ROLE = web3.utils.soliditySha3('PAUSER_ROLE');

    beforeEach(async () => {
      this.collectible = await ERC721ValuableCollectibleToken.new("ReferenceToken", "RT", "https://rara.farm/collectible/", { from: alice });
      await this.collectible.grantRole(MANAGER_ROLE, manager);
      await this.collectible.grantRole(MINTER_ROLE, minter);
      await this.collectible.grantRole(PAUSER_ROLE, pauser);

      this.token0 = await MockERC721Valuable.new("Token 0", "T0");
      this.token1 = await MockERC721Valuable.new("Token 1", "T1");
      this.token2 = await MockERC721Valuable.new("Token 2", "T2");

      this.oracle = await ERC721CollectibleReferenceOracle.new(this.collectible.address);
      await this.oracle.grantRole(MANAGER_ROLE, manager);
    });

    it('should have appropriate starting values', async () => {
      const { oracle } = this;
      assert.equal(await oracle.totalTypes(), '0');
    });

    it('non-managers cannot setTokenEnabled', async () =>  {
      const { oracle } = this;

      await expectRevert(
        this.oracle.setTokenEnabled(this.token0.address, true, { from: bob }),
        "ERC721CollectibleReferenceOracle: must have manager role to set token enabled",
      );

      await expectRevert(
        this.oracle.setTokenEnabled(this.token1.address, false, { from: carol }),
        "ERC721CollectibleReferenceOracle: must have manager role to set token enabled",
      );

      await expectRevert(
        this.oracle.setTokenEnabled(this.token2.address, true, { from: minter }),
        "ERC721CollectibleReferenceOracle: must have manager role to set token enabled",
      );
    });

    it('cannot setTokenEnabled on reference token', async () =>  {
      const { oracle } = this;

      await expectRevert(
        oracle.setTokenEnabled(this.collectible.address, true, { from: manager }),
        "ERC721CollectibleReferenceOracle: cannot alter reference token",
      );

      await expectRevert(
        oracle.setTokenEnabled(this.collectible.address, false, { from: alice }),
        "ERC721CollectibleReferenceOracle: cannot alter reference token",
      );
    });

    it('setTokenEnabled behaves as expected', async () => {
      const { oracle } = this;

      await oracle.setTokenEnabled(this.token0.address, true, { from:manager });
      await oracle.setTokenEnabled(this.token1.address, true, { from:manager });
      await oracle.setTokenEnabled(this.token2.address, false, { from:manager });

      assert.equal(await oracle.tokenEnabled(this.token0.address), true);
      assert.equal(await oracle.tokenEnabled(this.token1.address), true);
      assert.equal(await oracle.tokenEnabled(this.token2.address), false);

      await oracle.setTokenEnabled(this.token0.address, false, { from:alice });
      await oracle.setTokenEnabled(this.token1.address, true, { from:alice });
      await oracle.setTokenEnabled(this.token2.address, true, { from:alice });

      assert.equal(await oracle.tokenEnabled(this.token0.address), false);
      assert.equal(await oracle.tokenEnabled(this.token1.address), true);
      assert.equal(await oracle.tokenEnabled(this.token2.address), true);

      await oracle.setTokenEnabled(this.token0.address, false, { from:manager });
      await oracle.setTokenEnabled(this.token1.address, false, { from:manager });
      await oracle.setTokenEnabled(this.token2.address, true, { from:manager });

      assert.equal(await oracle.tokenEnabled(this.token0.address), false);
      assert.equal(await oracle.tokenEnabled(this.token1.address), false);
      assert.equal(await oracle.tokenEnabled(this.token2.address), true);
    });

    context('with token types', () => {
      beforeEach(async () => {
        const { collectible } = this;
        await collectible.addTokenType("Possum Fruit", "AFPOS", 0);
        await collectible.addTokenType("Shiba Rice", "AFSHI", 0);
        await collectible.addTokenType("Zebra Flower", "AFZEB", 0);
        await collectible.addTokenType("Possum", "APOS", 10);
        await collectible.addTokenType("Shiba", "ASHI", 30);
        await collectible.addTokenType("Zebra", "AZEB", 100);
      });

      it('should have appropriate token types', async () => {
        const { oracle } = this;

        assert.equal(await oracle.totalTypes(), '6');

        assert.equal(await oracle.typeName(0),  'Possum Fruit');
        assert.equal(await oracle.typeName(1),  'Shiba Rice');
        assert.equal(await oracle.typeName(2),  'Zebra Flower');
        assert.equal(await oracle.typeName(3),  'Possum');
        assert.equal(await oracle.typeName(4),  'Shiba');
        assert.equal(await oracle.typeName(5),  'Zebra');

        assert.equal(await oracle.typeSymbol(0),  'AFPOS');
        assert.equal(await oracle.typeSymbol(1),  'AFSHI');
        assert.equal(await oracle.typeSymbol(2),  'AFZEB');
        assert.equal(await oracle.typeSymbol(3),  'APOS');
        assert.equal(await oracle.typeSymbol(4),  'ASHI');
        assert.equal(await oracle.typeSymbol(5),  'AZEB');
      });

      context('with tokens', () => {
        beforeEach(async () => {
          const { collectible, token0, token1, token2 } = this;

          await collectible.mint(alice, 0, { from:alice });
          await collectible.mint(alice, 0, { from:alice });
          await collectible.mint(alice, 0, { from:alice });
          await collectible.mint(alice, 0, { from:alice });
          await collectible.mint(alice, 1, { from:alice });
          await collectible.mint(alice, 1, { from:alice });
          await collectible.mint(alice, 2, { from:alice });

          await collectible.mint(alice, 3, { from:alice });
          await collectible.mint(alice, 4, { from:alice });
          await collectible.mint(alice, 5, { from:alice });

          // 10 each from other tokens
          for (const token of [token0, token1, token2]) {
            for (let i = 0; i < 10; i++) {
              await token.mint(alice, 0);
            }
          }
        });

        it('should report reference token types', async () => {
          const { collectible, oracle } = this;

          assert.equal(await oracle.tokenType(collectible.address, 0), 0);
          assert.equal(await oracle.tokenType(collectible.address, 1), 0);
          assert.equal(await oracle.tokenType(collectible.address, 2), 0);
          assert.equal(await oracle.tokenType(collectible.address, 3), 0);
          assert.equal(await oracle.tokenType(collectible.address, 4), 1);
          assert.equal(await oracle.tokenType(collectible.address, 5), 1);
          assert.equal(await oracle.tokenType(collectible.address, 6), 2);
          assert.equal(await oracle.tokenType(collectible.address, 7), 3);
          assert.equal(await oracle.tokenType(collectible.address, 8), 4);
          assert.equal(await oracle.tokenType(collectible.address, 9), 5);
        });

        it('setTokenTypes reverts for non-managers', async () => {
          const { oracle, token0, token1, token2 } = this;
          await expectRevert(
            oracle.setTokenTypes(token0.address, [0, 1, 2, 3, 4], 0, { from: bob }),
            "ERC721CollectibleReferenceOracle: must have manager role to alter token types",
          );

          await expectRevert(
            oracle.setTokenTypes(token1.address, [3, 4], 5, { from: carol }),
            "ERC721CollectibleReferenceOracle: must have manager role to alter token types",
          );
        });

        it('setTokenTypes reverts for reference token', async () => {
          const { oracle, collectible } = this;
          await expectRevert(
            oracle.setTokenTypes(collectible.address, [0, 1, 2, 3, 4], 0, { from: alice }),
            "ERC721CollectibleReferenceOracle: cannot alter reference token",
          );

          await expectRevert(
            oracle.setTokenTypes(collectible.address, [5, 7], 0, { from: manager }),
            "ERC721CollectibleReferenceOracle: cannot alter reference token",
          );
        });

        it('setTokenTypes reverts for invalid type', async () => {
          const { oracle, token0, token1, token2 } = this;
          await expectRevert(
            oracle.setTokenTypes(token0.address, [0, 1, 2, 3, 4], 6, { from: alice }),
            "ERC721CollectibleReferenceOracle: tokenType not found in reference token",
          );

          await expectRevert(
            oracle.setTokenTypes(token1.address, [3, 4], 10, { from: manager }),
            "ERC721CollectibleReferenceOracle: tokenType not found in reference token",
          );
        });

        it('setTokenTypes functions as expected', async () => {
          const { oracle, token0, token1, token2 } = this;

          await oracle.setTokenTypes(token0.address, [0, 1, 2, 3], 5, { from:alice });
          await oracle.setTokenTypes(token0.address, [4, 5, 6], 2, { from:manager });

          await oracle.setTokenTypes(token1.address, [1, 2, 3], 0, { from:alice });
          await oracle.setTokenTypes(token1.address, [4, 5, 6], 1, { from:manager });
          await oracle.setTokenTypes(token1.address, [7, 8, 9], 2, { from:manager });

          await expectRevert(
            oracle.tokenType(token0.address, 0),
            "ERC721CollectibleReferenceOracle: token not enabled",
          );

          await expectRevert(
            oracle.tokenType(token1.address, 1),
            "ERC721CollectibleReferenceOracle: token not enabled",
          );

          await oracle.setTokenEnabled(token0.address, true, { from:alice });
          await oracle.setTokenEnabled(token1.address, true, { from:manager });
          await oracle.setTokenEnabled(token2.address, true, { from:manager });

          assert.equal(await oracle.tokenType(token0.address, 0), '5');
          assert.equal(await oracle.tokenType(token0.address, 1), '5');
          assert.equal(await oracle.tokenType(token0.address, 2), '5');
          assert.equal(await oracle.tokenType(token0.address, 3), '5');
          assert.equal(await oracle.tokenType(token0.address, 4), '2');
          assert.equal(await oracle.tokenType(token0.address, 5), '2');
          assert.equal(await oracle.tokenType(token0.address, 6), '2');
          await expectRevert(
            oracle.tokenType(token0.address, 7),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );

          await expectRevert(
            oracle.tokenType(token1.address, 0),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          assert.equal(await oracle.tokenType(token1.address, 1), '0');
          assert.equal(await oracle.tokenType(token1.address, 2), '0');
          assert.equal(await oracle.tokenType(token1.address, 3), '0');
          assert.equal(await oracle.tokenType(token1.address, 4), '1');
          assert.equal(await oracle.tokenType(token1.address, 5), '1');
          assert.equal(await oracle.tokenType(token1.address, 6), '1');
          assert.equal(await oracle.tokenType(token1.address, 7), '2');
          assert.equal(await oracle.tokenType(token1.address, 8), '2');
          assert.equal(await oracle.tokenType(token1.address, 9), '2');

          await expectRevert(
            oracle.tokenType(token2.address, 0),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );

          await oracle.setTokenTypes(token0.address, [2, 3, 4], 3, { from:alice });
          await oracle.setTokenTypes(token1.address, [3, 4, 5], 4, { from:alice });
          await oracle.setTokenTypes(token2.address, [0], 0, { from:manager });
          await oracle.setTokenEnabled(token2.address, false, { from:manager });

          assert.equal(await oracle.tokenType(token0.address, 0), '5');
          assert.equal(await oracle.tokenType(token0.address, 1), '5');
          assert.equal(await oracle.tokenType(token0.address, 2), '3');
          assert.equal(await oracle.tokenType(token0.address, 3), '3');
          assert.equal(await oracle.tokenType(token0.address, 4), '3');
          assert.equal(await oracle.tokenType(token0.address, 5), '2');
          assert.equal(await oracle.tokenType(token0.address, 6), '2');
          await expectRevert(
            oracle.tokenType(token0.address, 7),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );

          await expectRevert(
            oracle.tokenType(token1.address, 0),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          assert.equal(await oracle.tokenType(token1.address, 1), '0');
          assert.equal(await oracle.tokenType(token1.address, 2), '0');
          assert.equal(await oracle.tokenType(token1.address, 3), '4');
          assert.equal(await oracle.tokenType(token1.address, 4), '4');
          assert.equal(await oracle.tokenType(token1.address, 5), '4');
          assert.equal(await oracle.tokenType(token1.address, 6), '1');
          assert.equal(await oracle.tokenType(token1.address, 7), '2');
          assert.equal(await oracle.tokenType(token1.address, 8), '2');
          assert.equal(await oracle.tokenType(token1.address, 9), '2');

          await expectRevert(
            oracle.tokenType(token2.address, 0),
            "ERC721CollectibleReferenceOracle: token not enabled",
          );
        });

        it('clearTokenTypes reverts for non-managers', async () => {
          const { oracle, token0, token1, token2 } = this;
          await expectRevert(
            oracle.clearTokenTypes(token0.address, [0, 1, 2, 3, 4], { from: bob }),
            "ERC721CollectibleReferenceOracle: must have manager role to alter token types",
          );

          await oracle.setTokenTypes(token0.address, [0, 1, 2, 3], 0, { from: manager });

          await expectRevert(
            oracle.clearTokenTypes(token0.address, [0, 1, 2, 3, 4], { from: bob }),
            "ERC721CollectibleReferenceOracle: must have manager role to alter token types",
          );
        });

        it('clearTokenTypes reverts for reference token', async () => {
          const { oracle, collectible } = this;
          await expectRevert(
            oracle.clearTokenTypes(collectible.address, [0, 1, 2, 3, 4], { from: alice }),
            "ERC721CollectibleReferenceOracle: cannot alter reference token",
          );
        });

        it('clearTokenTypes functions as expected', async () => {
          const { oracle, token0, token1, token2 } = this;

          await oracle.setTokenEnabled(token0.address, true, { from:alice });
          await oracle.setTokenEnabled(token1.address, true, { from:manager });

          await oracle.clearTokenTypes(token0.address, [0, 1, 2], { from:manager });
          await expectRevert(
            oracle.tokenType(token0.address, 0),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          await expectRevert(
            oracle.tokenType(token0.address, 1),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          await expectRevert(
            oracle.tokenType(token0.address, 2),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );

          await oracle.setTokenTypes(token0.address, [0, 1, 2, 3], 5, { from:alice });
          await oracle.setTokenTypes(token0.address, [4, 5, 6], 2, { from:manager });

          await oracle.setTokenTypes(token1.address, [1, 2, 3], 0, { from:alice });
          await oracle.setTokenTypes(token1.address, [4, 5, 6], 1, { from:manager });
          await oracle.setTokenTypes(token1.address, [7, 8, 9], 2, { from:manager });

          await oracle.clearTokenTypes(token0.address, [0, 3, 6], { from:alice });
          await oracle.clearTokenTypes(token1.address, [1, 5, 9], { from:manager });

          await expectRevert(
            oracle.tokenType(token0.address, 0),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          assert.equal(await oracle.tokenType(token0.address, 1), '5');
          assert.equal(await oracle.tokenType(token0.address, 2), '5');
          await expectRevert(
            oracle.tokenType(token0.address, 3),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          assert.equal(await oracle.tokenType(token0.address, 4), '2');
          assert.equal(await oracle.tokenType(token0.address, 5), '2');
          await expectRevert(
            oracle.tokenType(token0.address, 6),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          await expectRevert(
            oracle.tokenType(token0.address, 7),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );

          await expectRevert(
            oracle.tokenType(token1.address, 0),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          await expectRevert(
            oracle.tokenType(token1.address, 1),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          assert.equal(await oracle.tokenType(token1.address, 2), '0');
          assert.equal(await oracle.tokenType(token1.address, 3), '0');
          assert.equal(await oracle.tokenType(token1.address, 4), '1');
          await expectRevert(
            oracle.tokenType(token1.address, 5),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          assert.equal(await oracle.tokenType(token1.address, 6), '1');
          assert.equal(await oracle.tokenType(token1.address, 7), '2');
          assert.equal(await oracle.tokenType(token1.address, 8), '2');
          await expectRevert(
            oracle.tokenType(token1.address, 9),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );

          await oracle.setTokenTypes(token0.address, [2, 3, 4], 3, { from:alice });
          await oracle.setTokenTypes(token1.address, [3, 4, 5], 4, { from:alice });

          await oracle.clearTokenTypes(token0.address, [1, 4, 5, 8]);
          await oracle.clearTokenTypes(token1.address, [2, 5, 6, 9]);


          await expectRevert(
            oracle.tokenType(token0.address, 0),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          await expectRevert(
            oracle.tokenType(token0.address, 1),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          assert.equal(await oracle.tokenType(token0.address, 2), '3');
          assert.equal(await oracle.tokenType(token0.address, 3), '3');
          await expectRevert(
            oracle.tokenType(token0.address, 4),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          await expectRevert(
            oracle.tokenType(token0.address, 5),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          await expectRevert(
            oracle.tokenType(token0.address, 6),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          await expectRevert(
            oracle.tokenType(token0.address, 7),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          await expectRevert(
            oracle.tokenType(token0.address, 8),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );

          await expectRevert(
            oracle.tokenType(token1.address, 0),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          await expectRevert(
            oracle.tokenType(token1.address, 1),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          await expectRevert(
            oracle.tokenType(token1.address, 2),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          assert.equal(await oracle.tokenType(token1.address, 3), '4');
          assert.equal(await oracle.tokenType(token1.address, 4), '4');
          await expectRevert(
            oracle.tokenType(token1.address, 5),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          await expectRevert(
            oracle.tokenType(token1.address, 6),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
          assert.equal(await oracle.tokenType(token1.address, 7), '2');
          assert.equal(await oracle.tokenType(token1.address, 8), '2');
          await expectRevert(
            oracle.tokenType(token1.address, 9),
            "ERC721CollectibleReferenceOracle: no token type defined",
          );
        });
      });
    });
  });
