const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const ERC721CollectibleProxyExchanger = artifacts.require('ERC721CollectibleProxyExchanger');
const ERC721CollectibleReferenceOracle = artifacts.require('ERC721CollectibleReferenceOracle');
const ERC721ValuableCollectibleToken = artifacts.require('ERC721ValuableCollectibleToken');
const MockERC721Valuable = artifacts.require('MockERC721Valuable');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('ERC721CollectibleProxyExchanger', ([alice, bob, carol, dave, edith, manager, minter, pauser]) => {
    const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');
    const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
    const PAUSER_ROLE = web3.utils.soliditySha3('PAUSER_ROLE');

    beforeEach(async () => {
      this.collectible = await ERC721ValuableCollectibleToken.new("ProxyToken", "PT", "https://rara.farm/collectible/", { from: alice });
      await this.collectible.grantRole(MANAGER_ROLE, manager);
      await this.collectible.grantRole(MINTER_ROLE, minter);
      await this.collectible.grantRole(PAUSER_ROLE, pauser);

      this.token0 = await MockERC721Valuable.new("Token 0", "T0");
      this.token1 = await MockERC721Valuable.new("Token 1", "T1");
      this.token2 = await MockERC721Valuable.new("Token 2", "T2");

      this.oracle = await ERC721CollectibleReferenceOracle.new(this.collectible.address);
      await this.oracle.grantRole(MANAGER_ROLE, manager);

      this.exchanger = await ERC721CollectibleProxyExchanger.new(this.collectible.address, this.oracle.address);
      await this.collectible.grantRole(MINTER_ROLE, this.exchanger.address);
    });

    it('should have appropriate starting values', async () => {
      const { exchanger } = this;
      assert.equal(await exchanger.proxyToken(), this.collectible.address);
      assert.equal(await exchanger.oracle(), this.oracle.address);
    });

    context('with token types and oracle settings', () => {
      beforeEach(async () => {
        const { collectible, oracle, token0, token1, token2 } = this;

        await collectible.addTokenType("Possum Fruit", "AFPOS", 0);
        await collectible.addTokenType("Shiba Rice", "AFSHI", 0);
        await collectible.addTokenType("Zebra Flower", "AFZEB", 0);
        await collectible.addTokenType("Possum", "APOS", 10);
        await collectible.addTokenType("Shiba", "ASHI", 30);
        await collectible.addTokenType("Zebra", "AZEB", 100);

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

        // 12 each from other tokens
        for (let i = 0; i < 3; i++) {
          const token = [token0, token1, token2][i];
          const owner = [alice, bob, carol][i];
          for (let i = 0; i < 12; i++) {
            await token.mint(owner, 0);
          }
        }

        // oracle config
        await oracle.setTokenEnabled(token0.address, true);
        await oracle.setTokenEnabled(token1.address, true);
        await oracle.setTokenEnabled(token2.address, true);

        // set oracle token types: 4 raccoons, 2 shibas, one each of the rest.
        // tokenX has id X offset
        for (let i = 0; i < 3; i++) {
          const token = [token0, token1, token2][i];

          await oracle.setTokenTypes(token.address, [0 + i, 1 + i, 2 + i, 3 + i], 0, { from:alice });
          await oracle.setTokenTypes(token.address, [4 + i, 5 + i], 1, { from:alice });
          await oracle.setTokenTypes(token.address, [6 + i], 2, { from:alice });
          await oracle.setTokenTypes(token.address, [7 + i], 3, { from:alice });
          await oracle.setTokenTypes(token.address, [8 + i], 4, { from:alice });
          await oracle.setTokenTypes(token.address, [9 + i], 5, { from:alice });
        }
      });

      it('issueProxyTokens fails for proxy token itself', async () => {
        const { exchanger, collectible } = this;

        await collectible.setApprovalForAll(exchanger.address, true, { from:alice });

        await expectRevert(
          exchanger.issueProxyTokens(collectible.address, [0, 5], alice, { from:alice }),
          "ERC721CollectibleProxyExchanger: can't issue proxy tokens for the proxy token itself"
        );
      });

      it('issueProxyTokens fails for non-oracle-supported tokens', async () => {
        const { exchanger, token0, token1, token2 } = this;

        await token0.setApprovalForAll(exchanger.address, true, { from:alice });
        await token1.setApprovalForAll(exchanger.address, true, { from:bob });
        await token2.setApprovalForAll(exchanger.address, true, { from:carol });

        await expectRevert(
          exchanger.issueProxyTokens(token0.address, [8, 9, 10], alice, { from:alice }),
          "ERC721CollectibleReferenceOracle: no token type defined"
        );

        await expectRevert(
          exchanger.issueProxyTokens(token1.address, [0, 1, 2], bob, { from:bob }),
          "ERC721CollectibleReferenceOracle: no token type defined"
        );

        await expectRevert(
          exchanger.issueProxyTokens(token2.address, [3, 2, 1], carol, { from:carol }),
          "ERC721CollectibleReferenceOracle: no token type defined"
        );
      });

      it('issueProxyTokens works as expected', async () => {
        const { exchanger, collectible, token0, token1, token2 } = this;

        await token0.setApprovalForAll(exchanger.address, true, { from:alice });
        await token1.setApprovalForAll(exchanger.address, true, { from:bob });
        await token2.setApprovalForAll(exchanger.address, true, { from:carol });

        await exchanger.issueProxyTokens(token0.address, [0, 5, 8], alice, { from:alice });

        assert.equal(await collectible.balanceOf(alice), '13');
        assert.equal(await collectible.tokenType(10), '0');
        assert.equal(await collectible.tokenType(11), '1');
        assert.equal(await collectible.tokenType(12), '4');

        assert.equal(await token0.ownerOf(0), exchanger.address);
        assert.equal(await token0.ownerOf(1), alice);
        assert.equal(await token0.ownerOf(5), exchanger.address);
        assert.equal(await token0.ownerOf(8), exchanger.address);

        await exchanger.issueProxyTokens(token1.address, [5, 6, 7, 8], bob, { from:bob });

        assert.equal(await collectible.balanceOf(bob), '4');
        assert.equal(await collectible.tokenType(13), '1');
        assert.equal(await collectible.tokenType(14), '1');
        assert.equal(await collectible.tokenType(15), '2');
        assert.equal(await collectible.tokenType(16), '3');

        assert.equal(await token1.ownerOf(0), bob);
        assert.equal(await token1.ownerOf(5), exchanger.address);
        assert.equal(await token1.ownerOf(6), exchanger.address);
        assert.equal(await token1.ownerOf(7), exchanger.address);
        assert.equal(await token1.ownerOf(8), exchanger.address);
        assert.equal(await token1.ownerOf(9), bob);

        await exchanger.issueProxyTokens(token2.address, [8, 9, 10], carol, { from:carol });

        assert.equal(await collectible.balanceOf(carol), '3');
        assert.equal(await collectible.tokenType(17), '2');
        assert.equal(await collectible.tokenType(18), '3');
        assert.equal(await collectible.tokenType(19), '4');

        assert.equal(await token2.ownerOf(7), carol);
        assert.equal(await token2.ownerOf(8), exchanger.address);
        assert.equal(await token2.ownerOf(9), exchanger.address);
        assert.equal(await token2.ownerOf(10), exchanger.address);
        assert.equal(await token2.ownerOf(11), carol);

        await exchanger.issueProxyTokens(token2.address, [3, 4, 5, 6], bob, { from:carol });

        assert.equal(await collectible.balanceOf(bob), '8');
        assert.equal(await collectible.tokenType(20), '0');
        assert.equal(await collectible.tokenType(21), '0');
        assert.equal(await collectible.tokenType(22), '0');
        assert.equal(await collectible.tokenType(23), '1');

        assert.equal(await token2.ownerOf(3), exchanger.address);
        assert.equal(await token2.ownerOf(4), exchanger.address);
        assert.equal(await token2.ownerOf(5), exchanger.address);
        assert.equal(await token2.ownerOf(6), exchanger.address);
      });

      it('issueProxyTokens updates exchanger state', async () => {
        const { exchanger, collectible, token0, token1, token2 } = this;

        await token0.setApprovalForAll(exchanger.address, true, { from:alice });
        await token1.setApprovalForAll(exchanger.address, true, { from:bob });
        await token2.setApprovalForAll(exchanger.address, true, { from:carol });

        await expectRevert(exchanger.tokenForProxy(9), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
        await expectRevert(exchanger.proxyForToken(token0.address, 0), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

        await exchanger.issueProxyTokens(token0.address, [0, 5, 8], alice, { from:alice });

        await expectRevert(exchanger.tokenForProxy(9), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
        await expectRevert(exchanger.proxyForToken(token0.address, 1), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

        assert.equal((await exchanger.tokenForProxy(10))["token"], token0.address);
        assert.equal((await exchanger.tokenForProxy(10))["tokenId"], '0');
        assert.equal(await exchanger.proxyForToken(token0.address, 0), '10');

        assert.equal((await exchanger.tokenForProxy(11))["token"], token0.address);
        assert.equal((await exchanger.tokenForProxy(11))["tokenId"], '5');
        assert.equal(await exchanger.proxyForToken(token0.address, 5), '11');

        assert.equal((await exchanger.tokenForProxy(12))["token"], token0.address);
        assert.equal((await exchanger.tokenForProxy(12))["tokenId"], '8');
        assert.equal(await exchanger.proxyForToken(token0.address, 8), '12');

        await expectRevert(exchanger.tokenForProxy(13), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
        await expectRevert(exchanger.proxyForToken(token0.address, 1), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

        await exchanger.issueProxyTokens(token1.address, [5, 6, 7, 8], bob, { from:bob });

        assert.equal((await exchanger.tokenForProxy(13))["token"], token1.address);
        assert.equal((await exchanger.tokenForProxy(13))["tokenId"], '5');
        assert.equal(await exchanger.proxyForToken(token1.address, 5), '13');

        assert.equal((await exchanger.tokenForProxy(14))["token"], token1.address);
        assert.equal((await exchanger.tokenForProxy(14))["tokenId"], '6');
        assert.equal(await exchanger.proxyForToken(token1.address, 6), '14');

        assert.equal((await exchanger.tokenForProxy(15))["token"], token1.address);
        assert.equal((await exchanger.tokenForProxy(15))["tokenId"], '7');
        assert.equal(await exchanger.proxyForToken(token1.address, 7), '15');

        assert.equal((await exchanger.tokenForProxy(16))["token"], token1.address);
        assert.equal((await exchanger.tokenForProxy(16))["tokenId"], '8');
        assert.equal(await exchanger.proxyForToken(token1.address, 8), '16');

        await expectRevert(exchanger.tokenForProxy(17), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
        await expectRevert(exchanger.proxyForToken(token1.address, 1), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

        await exchanger.issueProxyTokens(token2.address, [8, 9, 10], carol, { from:carol });

        assert.equal((await exchanger.tokenForProxy(17))["token"], token2.address);
        assert.equal((await exchanger.tokenForProxy(17))["tokenId"], '8');
        assert.equal(await exchanger.proxyForToken(token2.address, 8), '17');

        assert.equal((await exchanger.tokenForProxy(18))["token"], token2.address);
        assert.equal((await exchanger.tokenForProxy(18))["tokenId"], '9');
        assert.equal(await exchanger.proxyForToken(token2.address, 9), '18');

        assert.equal((await exchanger.tokenForProxy(19))["token"], token2.address);
        assert.equal((await exchanger.tokenForProxy(19))["tokenId"], '10');
        assert.equal(await exchanger.proxyForToken(token2.address, 10), '19');

        await expectRevert(exchanger.tokenForProxy(20), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
        await expectRevert(exchanger.proxyForToken(token2.address, 1), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

        await exchanger.issueProxyTokens(token2.address, [3, 4, 5, 6], bob, { from:carol });

        assert.equal((await exchanger.tokenForProxy(20))["token"], token2.address);
        assert.equal((await exchanger.tokenForProxy(20))["tokenId"], '3');
        assert.equal(await exchanger.proxyForToken(token2.address, 3), '20');

        assert.equal((await exchanger.tokenForProxy(21))["token"], token2.address);
        assert.equal((await exchanger.tokenForProxy(21))["tokenId"], '4');
        assert.equal(await exchanger.proxyForToken(token2.address, 4), '21');

        assert.equal((await exchanger.tokenForProxy(22))["token"], token2.address);
        assert.equal((await exchanger.tokenForProxy(22))["tokenId"], '5');
        assert.equal(await exchanger.proxyForToken(token2.address, 5), '22');

        assert.equal((await exchanger.tokenForProxy(23))["token"], token2.address);
        assert.equal((await exchanger.tokenForProxy(23))["tokenId"], '6');
        assert.equal(await exchanger.proxyForToken(token2.address, 6), '23');
      });

      context('with proxy tokens issued', () => {
        beforeEach(async () => {
          const { exchanger, collectible, token0, token1, token2 } = this;

          await token0.setApprovalForAll(exchanger.address, true, { from:alice });
          await token1.setApprovalForAll(exchanger.address, true, { from:bob });
          await token2.setApprovalForAll(exchanger.address, true, { from:carol });

          await exchanger.issueProxyTokens(token0.address, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], alice, { from:alice });
          await exchanger.issueProxyTokens(token1.address, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], bob, { from:bob });
          await exchanger.issueProxyTokens(token2.address, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], carol, { from:carol });
        });

        it('redeemProxyTokens fails for non-issued token', async () => {
          const { exchanger, collectible } = this;

          await collectible.setApprovalForAll(exchanger.address, true, { from:alice });

          await expectRevert(
            exchanger.redeemProxyTokens([0, 1, 2], alice, { from:alice }),
            "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger"
          );

          await expectRevert(
            exchanger.redeemProxyTokens([11, 12, 9], alice, { from:alice }),
            "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger"
          );
        });

        it('redeemProxyTokens functions as expected', async () => {
          const { exchanger, collectible, token0, token1, token2 } = this;

          await collectible.setApprovalForAll(exchanger.address, true,  { from:alice });
          await collectible.setApprovalForAll(exchanger.address, true,  { from:bob });
          await collectible.setApprovalForAll(exchanger.address, true,  { from:carol });

          await exchanger.redeemProxyTokens([10, 11, 17], alice, { from:alice });

          assert.equal(await collectible.balanceOf(alice), '17');
          assert.equal(await token0.balanceOf(alice), '5');
          assert.equal(await token0.ownerOf(0), alice);
          assert.equal(await token0.ownerOf(1), alice);
          assert.equal(await token0.ownerOf(2), exchanger.address);
          assert.equal(await token0.ownerOf(6), exchanger.address);
          assert.equal(await token0.ownerOf(7), alice);
          assert.equal(await token0.ownerOf(8), exchanger.address);

          await exchanger.redeemProxyTokens([22, 23, 24], bob, { from:bob });

          assert.equal(await collectible.balanceOf(bob), '7');
          assert.equal(await token1.balanceOf(bob), '5');
          assert.equal(await token1.ownerOf(2), exchanger.address);
          assert.equal(await token1.ownerOf(3), bob);
          assert.equal(await token1.ownerOf(4), bob);
          assert.equal(await token1.ownerOf(5), bob);
          assert.equal(await token1.ownerOf(6), exchanger.address);

          await exchanger.redeemProxyTokens([35], carol, { from:carol });

          assert.equal(await collectible.balanceOf(carol), '9');
          assert.equal(await token2.balanceOf(carol), '3');
          assert.equal(await token2.ownerOf(6), exchanger.address);
          assert.equal(await token2.ownerOf(7), carol);
          assert.equal(await token2.ownerOf(8), exchanger.address);

          await exchanger.redeemProxyTokens([31, 36], bob, { from:carol });

          assert.equal(await collectible.balanceOf(carol), '7');
          assert.equal(await token2.balanceOf(bob), '2');
          assert.equal(await token2.ownerOf(2), exchanger.address);
          assert.equal(await token2.ownerOf(3), bob);
          assert.equal(await token2.ownerOf(4), exchanger.address);
          assert.equal(await token2.ownerOf(7), carol);
          assert.equal(await token2.ownerOf(8), bob);
          assert.equal(await token2.ownerOf(9), exchanger.address);
        });

        it('redeemProxyTokens updates exchanger state', async () => {
          const { exchanger, collectible, token0, token1, token2 } = this;

          await collectible.setApprovalForAll(exchanger.address, true,  { from:alice });
          await collectible.setApprovalForAll(exchanger.address, true,  { from:bob });
          await collectible.setApprovalForAll(exchanger.address, true,  { from:carol });

          await exchanger.redeemProxyTokens([10, 11, 17], alice, { from:alice });

          await expectRevert(exchanger.tokenForProxy(10), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
          await expectRevert(exchanger.proxyForToken(token0.address, 0), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          await expectRevert(exchanger.tokenForProxy(11), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
          await expectRevert(exchanger.proxyForToken(token0.address, 1), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          assert.equal((await exchanger.tokenForProxy(12))["token"], token0.address);
          assert.equal((await exchanger.tokenForProxy(12))["tokenId"], '2');
          assert.equal(await exchanger.proxyForToken(token0.address, 2), '12');

          await expectRevert(exchanger.tokenForProxy(17), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
          await expectRevert(exchanger.proxyForToken(token0.address, 7), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          await exchanger.redeemProxyTokens([22, 23, 24], bob, { from:bob });

          assert.equal((await exchanger.tokenForProxy(21))["token"], token1.address);
          assert.equal((await exchanger.tokenForProxy(21))["tokenId"], '2');
          assert.equal(await exchanger.proxyForToken(token1.address, 2), '21');

          await expectRevert(exchanger.tokenForProxy(22), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
          await expectRevert(exchanger.proxyForToken(token1.address, 3), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          await expectRevert(exchanger.tokenForProxy(23), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
          await expectRevert(exchanger.proxyForToken(token1.address, 4), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          await expectRevert(exchanger.tokenForProxy(24), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
          await expectRevert(exchanger.proxyForToken(token1.address, 5), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          assert.equal((await exchanger.tokenForProxy(25))["token"], token1.address);
          assert.equal((await exchanger.tokenForProxy(25))["tokenId"], '6');
          assert.equal(await exchanger.proxyForToken(token1.address, 6), '25');

          await exchanger.redeemProxyTokens([35], carol, { from:carol });

          assert.equal((await exchanger.tokenForProxy(34))["token"], token2.address);
          assert.equal((await exchanger.tokenForProxy(34))["tokenId"], '6');
          assert.equal(await exchanger.proxyForToken(token2.address, 6), '34');

          await expectRevert(exchanger.tokenForProxy(35), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
          await expectRevert(exchanger.proxyForToken(token2.address, 7), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          assert.equal((await exchanger.tokenForProxy(36))["token"], token2.address);
          assert.equal((await exchanger.tokenForProxy(36))["tokenId"], '8');
          assert.equal(await exchanger.proxyForToken(token2.address, 8), '36');

          await exchanger.redeemProxyTokens([31, 36], bob, { from:carol });

          assert.equal((await exchanger.tokenForProxy(30))["token"], token2.address);
          assert.equal((await exchanger.tokenForProxy(30))["tokenId"], '2');
          assert.equal(await exchanger.proxyForToken(token2.address, 2), '30');

          await expectRevert(exchanger.tokenForProxy(31), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
          await expectRevert(exchanger.proxyForToken(token2.address, 3), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          await expectRevert(exchanger.tokenForProxy(36), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
          await expectRevert(exchanger.proxyForToken(token2.address, 8), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          assert.equal((await exchanger.tokenForProxy(37))["token"], token2.address);
          assert.equal((await exchanger.tokenForProxy(37))["tokenId"], '9');
          assert.equal(await exchanger.proxyForToken(token2.address, 9), '37');
        });

        it('issueProxyTokens functions as expected after redeemProxyTokens', async () => {
          const { exchanger, collectible, token0, token1, token2 } = this;

          await collectible.setApprovalForAll(exchanger.address, true, { from:alice });
          await collectible.setApprovalForAll(exchanger.address, true, { from:bob });
          await collectible.setApprovalForAll(exchanger.address, true, { from:carol });

          await exchanger.redeemProxyTokens([10, 11, 17], alice, { from:alice });
          await exchanger.redeemProxyTokens([22, 23, 24], bob, { from:bob });
          await exchanger.redeemProxyTokens([35], carol, { from:carol });
          await exchanger.redeemProxyTokens([31, 36], bob, { from:carol });

          // total collectible supply is 31; next ID is 40
          // alice has token0 ids 0, 1, 7.
          // bob has token1 ids 3, 4, 5
          // carol has token2 ids 7
          // bob has token2 ids 3, 8

          await exchanger.issueProxyTokens(token0.address, [1, 7], dave, { from:alice });

          assert.equal(await collectible.balanceOf(dave), '2');
          assert.equal(await collectible.totalSupply(), '33');
          assert.equal(await collectible.tokenType(40), '0');
          assert.equal(await collectible.tokenType(41), '3');

          await exchanger.issueProxyTokens(token1.address, [3], edith, { from:bob });

          assert.equal(await collectible.balanceOf(edith), '1');
          assert.equal(await collectible.totalSupply(), '34');
          assert.equal(await collectible.tokenType(42), '0');

          await exchanger.issueProxyTokens(token2.address, [7], edith, { from:carol });

          assert.equal(await collectible.balanceOf(edith), '2');
          assert.equal(await collectible.totalSupply(), '35');
          assert.equal(await collectible.tokenType(43), '1');
        });

        it('issueProxyTokens updates exchanger state after redeemProxyTokens', async () => {
          const { exchanger, collectible, token0, token1, token2 } = this;

          await collectible.setApprovalForAll(exchanger.address, true, { from:alice });
          await collectible.setApprovalForAll(exchanger.address, true, { from:bob });
          await collectible.setApprovalForAll(exchanger.address, true, { from:carol });

          await exchanger.redeemProxyTokens([10, 11, 17], alice, { from:alice });
          await exchanger.redeemProxyTokens([22, 23, 24], bob, { from:bob });
          await exchanger.redeemProxyTokens([35], carol, { from:carol });
          await exchanger.redeemProxyTokens([31, 36], bob, { from:carol });

          // total collectible supply is 31; next ID is 40
          // alice has token0 ids 0, 1, 7.
          // bob has token1 ids 3, 4, 5
          // carol has token2 ids 7
          // bob has token2 ids 3, 8

          await exchanger.issueProxyTokens(token0.address, [1, 7], dave, { from:alice });

          await expectRevert(exchanger.tokenForProxy(10), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
          await expectRevert(exchanger.proxyForToken(token0.address, 0), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          await expectRevert(exchanger.tokenForProxy(11), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
          await expectRevert(exchanger.tokenForProxy(17), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          assert.equal((await exchanger.tokenForProxy(40))["token"], token0.address);
          assert.equal((await exchanger.tokenForProxy(40))["tokenId"], '1');
          assert.equal(await exchanger.proxyForToken(token0.address, 1), '40');

          assert.equal((await exchanger.tokenForProxy(41))["token"], token0.address);
          assert.equal((await exchanger.tokenForProxy(41))["tokenId"], '7');
          assert.equal(await exchanger.proxyForToken(token0.address, 7), '41');

          await exchanger.issueProxyTokens(token1.address, [3], edith, { from:bob });

          await expectRevert(exchanger.tokenForProxy(23), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
          await expectRevert(exchanger.proxyForToken(token1.address, 4), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          await expectRevert(exchanger.tokenForProxy(24), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");
          await expectRevert(exchanger.proxyForToken(token1.address, 5), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          await expectRevert(exchanger.tokenForProxy(22), "ERC721CollectibleProxyExchanger: proxy not issued by this exchanger");

          assert.equal((await exchanger.tokenForProxy(42))["token"], token1.address);
          assert.equal((await exchanger.tokenForProxy(42))["tokenId"], '3');
          assert.equal(await exchanger.proxyForToken(token1.address, 3), '42');

          await exchanger.issueProxyTokens(token2.address, [7], edith, { from:carol });

          assert.equal((await exchanger.tokenForProxy(43))["token"], token2.address);
          assert.equal((await exchanger.tokenForProxy(43))["tokenId"], '7');
          assert.equal(await exchanger.proxyForToken(token2.address, 7), '43');
        });
      });
    });
  });
