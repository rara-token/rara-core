const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const RaraCollectible = artifacts.require('RaraCollectible');
const MockTokenCollectionListener = artifacts.require('MockTokenCollectionListener');
const MockERC165 = artifacts.require('MockERC165');
const MockContract = artifacts.require('MockContract');

const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers').constants;

contract('RaraCollectible', ([alice, bob, carol, dave, edith, manager, minter, pauser]) => {
    const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');
    const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');
    const PAUSER_ROLE = web3.utils.soliditySha3('PAUSER_ROLE');

    beforeEach(async () => {
      this.collectible = await RaraCollectible.new("https://rara.farm/collectible/", { from: alice });
      await this.collectible.grantRole(MANAGER_ROLE, manager);
      await this.collectible.grantRole(MINTER_ROLE, minter);
      await this.collectible.grantRole(PAUSER_ROLE, pauser);
    });

    it('should have correct name and symbol and decimal', async () => {
      const name = await this.collectible.name();
      const symbol = await this.collectible.symbol();
      assert.equal(name.valueOf(), 'Rara Collectible');
      assert.equal(symbol.valueOf(), 'cRARA');
    });

    it('should have appropriate starting values', async () => {
      const { collectible } = this;
      assert.equal(await collectible.totalTypes(), '0');
      assert.equal(await collectible.totalValue(), '0');
      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.ownerTypes(alice), '0');
      assert.equal(await collectible.ownerValue(alice), '0');
      assert.equal(await collectible.balanceOf(alice), '0');
    });

    it('non-managers cannot addTokenType', async () =>  {
      await expectRevert(
        this.collectible.addTokenType("Vault Boy", "VB", 100, { from: bob }),
        "ERC721ValuableCollectibleToken: must have manager role to add token type",
      );

      await expectRevert(
        this.collectible.addTokenType("Vault Boy", "VB", 100, { from: carol }),
        "ERC721ValuableCollectibleToken: must have manager role to add token type",
      );

      await expectRevert(
        this.collectible.addTokenType("Vault Boy", "VB", 100, { from: minter }),
        "ERC721ValuableCollectibleToken: must have manager role to add token type",
      );

      await expectRevert(
        this.collectible.addTokenType("Vault Boy", "VB", 100, { from: pauser }),
        "ERC721ValuableCollectibleToken: must have manager role to add token type",
      );
    });

    it('addTokenType behaves as expected', async () => {
      const { collectible } = this;
      await collectible.addTokenType("Vault Boy", "VB", 100, { from:alice });
      assert.equal(await collectible.totalTypes(), '1');
      assert.equal(await collectible.totalValue(), '0');
      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.ownerTypes(alice), '0');
      assert.equal(await collectible.ownerValue(alice), '0');
      assert.equal(await collectible.balanceOf(alice), '0');

      await collectible.addTokenType("Puzzle Master", "PM", 55, { from:manager });
      assert.equal(await collectible.totalTypes(), '2');
      assert.equal(await collectible.totalValue(), '0');
      assert.equal(await collectible.totalSupply(), '0');
      assert.equal(await collectible.ownerTypes(alice), '0');
      assert.equal(await collectible.ownerValue(alice), '0');
      assert.equal(await collectible.balanceOf(alice), '0');

      assert.equal(await collectible.typeName(0), "Vault Boy");
      assert.equal(await collectible.typeSymbol(0), "VB");
      assert.equal(await collectible.typeValue(0), "100");

      assert.equal(await collectible.typeName(1), "Puzzle Master");
      assert.equal(await collectible.typeSymbol(1), "PM");
      assert.equal(await collectible.typeValue(1), "55");
    });

    it('non-managers cannot setTokenCollectionListener', async () => {
      const listener = await MockTokenCollectionListener.new();
      await expectRevert(
        this.collectible.setTokenCollectionListener(listener.address, { from:bob }),
        "ERC721ValuableCollectibleToken: must have manager role to set token collection listener"
      );

      await expectRevert(
        this.collectible.setTokenCollectionListener(listener.address, { from:carol }),
        "ERC721ValuableCollectibleToken: must have manager role to set token collection listener"
      );

      await expectRevert(
        this.collectible.setTokenCollectionListener(ZERO_ADDRESS, { from:bob }),
        "ERC721ValuableCollectibleToken: must have manager role to set token collection listener"
      );
    });

    it('cannot setTokenCollectionListener to a non-listener', async () => {
      const erc165 = await MockERC165.new();
      await expectRevert(
        this.collectible.setTokenCollectionListener(erc165.address, { from:alice }),
        "ERC721ValuableCollectibleToken: address must be zero or implement ITokenListener"
      );

      const mock = await MockContract.new();
      await expectRevert(
        this.collectible.setTokenCollectionListener(mock.address, { from:manager }),
        "ERC721ValuableCollectibleToken: address must be zero or implement ITokenListener"
      );

      await expectRevert(
        this.collectible.setTokenCollectionListener(alice, { from:manager }),
        "ERC721ValuableCollectibleToken: address must be zero or implement ITokenListener"
      );
    });

    it('setTokenCollectionListener assigns the tokenCollectionListener', async () => {
      const listener = await MockTokenCollectionListener.new();
      await this.collectible.setTokenCollectionListener(listener.address, { from:alice });
      assert.equal(await this.collectible.tokenCollectionListener(), listener.address);

      await this.collectible.setTokenCollectionListener(ZERO_ADDRESS, { from:manager });
      assert.equal(await this.collectible.tokenCollectionListener(), ZERO_ADDRESS);
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

      context('mint', () => {
        it('non-minters cannot mint', async () =>  {
          await expectRevert(
            this.collectible.mint(alice, 0, { from:bob }),
            "ERC721ValuableCollectibleToken: must have minter role to mint",
          );

          await expectRevert(
            this.collectible.mint(carol, 0, { from:carol }),
            "ERC721ValuableCollectibleToken: must have minter role to mint",
          );
        });

        it('cannot mint invalid types', async () =>  {
          await expectRevert(
            this.collectible.mint(alice, 6, { from:alice }),
            "ERC721ValuableCollectibleToken: type out of bounds",
          );

          await expectRevert(
            this.collectible.mint(carol, 10, { from:minter }),
            "ERC721ValuableCollectibleToken: type out of bounds",
          );
        });

        it('minting creates a token owned by the address provided', async () => {
          const { collectible } = this;

          await collectible.mint(alice, 0, { from:alice });
          assert.equal(await collectible.totalValue(), '0');
          assert.equal(await collectible.totalSupply(), '1');
          assert.equal(await collectible.totalSupplyByType(0), '1');
          assert.equal(await collectible.totalSupplyByType(1), '0');
          assert.equal(await collectible.ownerTypes(alice), '1');
          assert.equal(await collectible.ownerTypeByIndex(alice, 0), '0');
          assert.equal(await collectible.ownerValue(alice), '0');
          assert.equal(await collectible.balanceOf(alice), '1');

          assert.equal(await collectible.balanceOfOwnerByType(alice, 0), '1');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 1), '0');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 0), '0');

          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 0, 0), '0');
          assert.equal(await collectible.tokenByTypeAndIndex(0, 0), '0');
          assert.equal(await collectible.tokenType(0), '0');

          await collectible.mint(alice, 3, { from:minter });
          await collectible.mint(alice, 3, { from:minter });
          await collectible.mint(alice, 4, { from:minter });
          await collectible.mint(bob, 0, { from:minter });
          await collectible.mint(bob, 1, { from:minter });
          await collectible.mint(bob, 1, { from:minter });
          await collectible.mint(bob, 4, { from:minter });
          await collectible.mint(bob, 5, { from:minter });

          assert.equal(await collectible.totalValue(), '180');
          assert.equal(await collectible.totalSupply(), '9');
          assert.equal(await collectible.totalSupplyByType(0), '2');
          assert.equal(await collectible.totalSupplyByType(1), '2');
          assert.equal(await collectible.totalSupplyByType(2), '0');
          assert.equal(await collectible.totalSupplyByType(3), '2');
          assert.equal(await collectible.totalSupplyByType(4), '2');
          assert.equal(await collectible.totalSupplyByType(5), '1');
          assert.equal(await collectible.ownerTypes(alice), '3');
          assert.equal(await collectible.ownerTypeByIndex(alice, 0), '0');
          assert.equal(await collectible.ownerTypeByIndex(alice, 1), '3');
          assert.equal(await collectible.ownerTypeByIndex(alice, 2), '4');
          assert.equal(await collectible.ownerValue(alice), '50');
          assert.equal(await collectible.balanceOf(alice), '4');
          assert.equal(await collectible.ownerTypes(bob), '4');
          assert.equal(await collectible.ownerTypeByIndex(bob, 0), '0');
          assert.equal(await collectible.ownerTypeByIndex(bob, 1), '1');
          assert.equal(await collectible.ownerTypeByIndex(bob, 2), '4');
          assert.equal(await collectible.ownerTypeByIndex(bob, 3), '5');
          assert.equal(await collectible.ownerValue(bob), '130');
          assert.equal(await collectible.balanceOf(bob), '5');

          assert.equal(await collectible.balanceOfOwnerByType(alice, 0), '1');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 1), '0');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 2), '0');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 3), '2');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 4), '1');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 5), '0');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 0), '1');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 1), '2');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 2), '0');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 3), '0');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 4), '1');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 5), '1');

          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 0, 0), '0');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 3, 0), '1');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 3, 1), '2');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 4, 0), '3');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 0, 0), '4');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 1, 0), '5');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 1, 1), '6');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 4, 0), '7');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 5, 0), '8');
          assert.equal(await collectible.tokenByTypeAndIndex(0, 0), '0');
          assert.equal(await collectible.tokenByTypeAndIndex(0, 1), '4');
          assert.equal(await collectible.tokenByTypeAndIndex(1, 0), '5');
          assert.equal(await collectible.tokenByTypeAndIndex(1, 1), '6');
          assert.equal(await collectible.tokenByTypeAndIndex(3, 0), '1');
          assert.equal(await collectible.tokenByTypeAndIndex(3, 1), '2');
          assert.equal(await collectible.tokenByTypeAndIndex(4, 0), '3');
          assert.equal(await collectible.tokenByTypeAndIndex(4, 1), '7');
          assert.equal(await collectible.tokenByTypeAndIndex(5, 0), '8');

          assert.equal(await collectible.tokenType(0), '0');
          assert.equal(await collectible.tokenType(1), '3');
          assert.equal(await collectible.tokenType(2), '3');
          assert.equal(await collectible.tokenType(3), '4');
          assert.equal(await collectible.tokenType(4), '0');
          assert.equal(await collectible.tokenType(5), '1');
          assert.equal(await collectible.tokenType(6), '1');
          assert.equal(await collectible.tokenType(7), '4');
          assert.equal(await collectible.tokenType(8), '5');
        });

        it('minting updates the listener', async () => {
          const { collectible } = this;
          const listener = await MockTokenCollectionListener.new();
          await collectible.setTokenCollectionListener(listener.address, { from:manager });

          let res = await collectible.mint(alice, 0, { from:alice });
          await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'1', ownerValue:'0' });

          res = await collectible.mint(alice, 3, { from:minter });
          await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'2', ownerValue:'10' });

          res = await collectible.mint(alice, 3, { from:minter });
          await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'3', ownerValue:'20' });

          res = await collectible.mint(alice, 4, { from:minter });
          await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'4', ownerValue:'50' });

          res = await collectible.mint(bob, 0, { from:minter });
          await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'1', ownerValue:'0' });

          res = await collectible.mint(bob, 1, { from:minter });
          await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'2', ownerValue:'0' });

          res = await collectible.mint(bob, 1, { from:minter });
          await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'3', ownerValue:'0' });

          res = await collectible.mint(bob, 4, { from:minter });
          await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'4', ownerValue:'30' });

          res = await collectible.mint(bob, 5, { from:minter });
          await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'5', ownerValue:'130' });
        });
      });

      context('massMint', () => {
        it('non-minters cannot massMint', async () =>  {
          await expectRevert(
            this.collectible.massMint(alice, [0], { from:bob }),
            "ERC721ValuableCollectibleToken: must have minter role to mint",
          );

          await expectRevert(
            this.collectible.massMint(carol, [0], { from:carol }),
            "ERC721ValuableCollectibleToken: must have minter role to mint",
          );
        });

        it('cannot massMint invalid types', async () =>  {
          await expectRevert(
            this.collectible.massMint(alice, [6], { from:alice }),
            "ERC721ValuableCollectibleToken: type out of bounds",
          );

          await expectRevert(
            this.collectible.massMint(carol, [10], { from:minter }),
            "ERC721ValuableCollectibleToken: type out of bounds",
          );
        });

        it('massMinting creates a token owned by the address provided', async () => {
          const { collectible } = this;

          await collectible.massMint(alice, [0], { from:alice });
          assert.equal(await collectible.totalValue(), '0');
          assert.equal(await collectible.totalSupply(), '1');
          assert.equal(await collectible.totalSupplyByType(0), '1');
          assert.equal(await collectible.totalSupplyByType(1), '0');
          assert.equal(await collectible.ownerTypes(alice), '1');
          assert.equal(await collectible.ownerTypeByIndex(alice, 0), '0');
          assert.equal(await collectible.ownerValue(alice), '0');
          assert.equal(await collectible.balanceOf(alice), '1');

          assert.equal(await collectible.balanceOfOwnerByType(alice, 0), '1');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 1), '0');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 0), '0');

          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 0, 0), '0');
          assert.equal(await collectible.tokenByTypeAndIndex(0, 0), '0');
          assert.equal(await collectible.tokenType(0), '0');

          await collectible.massMint(alice, [3, 3, 4], { from:minter });
          await collectible.massMint(bob, [], { from:minter });
          await collectible.massMint(bob, [0, 1, 1, 4, 5], { from:minter });

          assert.equal(await collectible.totalValue(), '180');
          assert.equal(await collectible.totalSupply(), '9');
          assert.equal(await collectible.totalSupplyByType(0), '2');
          assert.equal(await collectible.totalSupplyByType(1), '2');
          assert.equal(await collectible.totalSupplyByType(2), '0');
          assert.equal(await collectible.totalSupplyByType(3), '2');
          assert.equal(await collectible.totalSupplyByType(4), '2');
          assert.equal(await collectible.totalSupplyByType(5), '1');
          assert.equal(await collectible.ownerTypes(alice), '3');
          assert.equal(await collectible.ownerTypeByIndex(alice, 0), '0');
          assert.equal(await collectible.ownerTypeByIndex(alice, 1), '3');
          assert.equal(await collectible.ownerTypeByIndex(alice, 2), '4');
          assert.equal(await collectible.ownerValue(alice), '50');
          assert.equal(await collectible.balanceOf(alice), '4');
          assert.equal(await collectible.ownerTypes(bob), '4');
          assert.equal(await collectible.ownerTypeByIndex(bob, 0), '0');
          assert.equal(await collectible.ownerTypeByIndex(bob, 1), '1');
          assert.equal(await collectible.ownerTypeByIndex(bob, 2), '4');
          assert.equal(await collectible.ownerTypeByIndex(bob, 3), '5');
          assert.equal(await collectible.ownerValue(bob), '130');
          assert.equal(await collectible.balanceOf(bob), '5');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 0), '1');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 1), '0');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 2), '0');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 3), '2');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 4), '1');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 5), '0');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 0), '1');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 1), '2');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 2), '0');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 3), '0');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 4), '1');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 5), '1');

          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 0, 0), '0');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 3, 0), '1');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 3, 1), '2');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 4, 0), '3');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 0, 0), '4');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 1, 0), '5');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 1, 1), '6');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 4, 0), '7');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 5, 0), '8');
          assert.equal(await collectible.tokenByTypeAndIndex(0, 0), '0');
          assert.equal(await collectible.tokenByTypeAndIndex(0, 1), '4');
          assert.equal(await collectible.tokenByTypeAndIndex(1, 0), '5');
          assert.equal(await collectible.tokenByTypeAndIndex(1, 1), '6');
          assert.equal(await collectible.tokenByTypeAndIndex(3, 0), '1');
          assert.equal(await collectible.tokenByTypeAndIndex(3, 1), '2');
          assert.equal(await collectible.tokenByTypeAndIndex(4, 0), '3');
          assert.equal(await collectible.tokenByTypeAndIndex(4, 1), '7');
          assert.equal(await collectible.tokenByTypeAndIndex(5, 0), '8');

          assert.equal(await collectible.tokenType(0), '0');
          assert.equal(await collectible.tokenType(1), '3');
          assert.equal(await collectible.tokenType(2), '3');
          assert.equal(await collectible.tokenType(3), '4');
          assert.equal(await collectible.tokenType(4), '0');
          assert.equal(await collectible.tokenType(5), '1');
          assert.equal(await collectible.tokenType(6), '1');
          assert.equal(await collectible.tokenType(7), '4');
          assert.equal(await collectible.tokenType(8), '5');
        });

        it('massMinting updates the listener', async () => {
          const { collectible } = this;
          const listener = await MockTokenCollectionListener.new();
          await collectible.setTokenCollectionListener(listener.address, { from:manager });

          let res = await collectible.massMint(alice, [0], { from:alice });
          await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'1', ownerValue:'0' });

          res = await collectible.massMint(alice, [3, 3, 4], { from:minter });
          await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'4', ownerValue:'50' });

          res = await collectible.massMint(bob, [], { from:minter });
          await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'0', ownerValue:'0' });

          res = await collectible.massMint(bob, [0, 1, 1, 4, 5], { from:minter });
          await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'5', ownerValue:'130' });
        });
      });

      context('with existing collections', () => {
        beforeEach(async () => {
          const { collectible } = this;
          await collectible.massMint(alice, [0, 3, 3, 4], { from:minter });
          await collectible.massMint(bob, [0, 1, 1, 4, 5], { from:minter });
          await collectible.massMint(carol, [0, 0, 4, 5, 0, 5], { from:minter });
        });

        it('initial configuration matches expectations', async () => {
          const { collectible } = this;
          assert.equal(await collectible.totalValue(), '410');
          assert.equal(await collectible.totalSupply(), '15');
          assert.equal(await collectible.totalSupplyByType(0), '5');
          assert.equal(await collectible.totalSupplyByType(1), '2');
          assert.equal(await collectible.totalSupplyByType(2), '0');
          assert.equal(await collectible.totalSupplyByType(3), '2');
          assert.equal(await collectible.totalSupplyByType(4), '3');
          assert.equal(await collectible.totalSupplyByType(5), '3');
          assert.equal(await collectible.ownerTypes(alice), '3');
          assert.equal(await collectible.ownerTypeByIndex(alice, 0), '0');
          assert.equal(await collectible.ownerTypeByIndex(alice, 1), '3');
          assert.equal(await collectible.ownerTypeByIndex(alice, 2), '4');
          assert.equal(await collectible.ownerValue(alice), '50');
          assert.equal(await collectible.balanceOf(alice), '4');
          assert.equal(await collectible.ownerTypes(bob), '4');
          assert.equal(await collectible.ownerTypeByIndex(bob, 0), '0');
          assert.equal(await collectible.ownerTypeByIndex(bob, 1), '1');
          assert.equal(await collectible.ownerTypeByIndex(bob, 2), '4');
          assert.equal(await collectible.ownerTypeByIndex(bob, 3), '5');
          assert.equal(await collectible.ownerValue(bob), '130');
          assert.equal(await collectible.balanceOf(bob), '5');
          assert.equal(await collectible.ownerTypes(carol), '3');
          assert.equal(await collectible.ownerTypeByIndex(carol, 0), '0');
          assert.equal(await collectible.ownerTypeByIndex(carol, 1), '4');
          assert.equal(await collectible.ownerTypeByIndex(carol, 2), '5');
          assert.equal(await collectible.ownerValue(carol), '230');
          assert.equal(await collectible.balanceOf(carol), '6');

          assert.equal(await collectible.balanceOfOwnerByType(alice, 0), '1');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 1), '0');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 2), '0');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 3), '2');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 4), '1');
          assert.equal(await collectible.balanceOfOwnerByType(alice, 5), '0');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 0), '1');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 1), '2');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 2), '0');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 3), '0');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 4), '1');
          assert.equal(await collectible.balanceOfOwnerByType(bob, 5), '1');
          assert.equal(await collectible.balanceOfOwnerByType(carol, 0), '3');
          assert.equal(await collectible.balanceOfOwnerByType(carol, 1), '0');
          assert.equal(await collectible.balanceOfOwnerByType(carol, 2), '0');
          assert.equal(await collectible.balanceOfOwnerByType(carol, 3), '0');
          assert.equal(await collectible.balanceOfOwnerByType(carol, 4), '1');
          assert.equal(await collectible.balanceOfOwnerByType(carol, 5), '2');

          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 0, 0), '0');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 3, 0), '1');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 3, 1), '2');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 4, 0), '3');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 0, 0), '4');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 1, 0), '5');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 1, 1), '6');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 4, 0), '7');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 5, 0), '8');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 0), '9');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 1), '10');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 2), '13');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 4, 0), '11');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 5, 0), '12');
          assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 5, 1), '14');
          assert.equal(await collectible.tokenByTypeAndIndex(0, 0), '0');
          assert.equal(await collectible.tokenByTypeAndIndex(0, 1), '4');
          assert.equal(await collectible.tokenByTypeAndIndex(0, 2), '9');
          assert.equal(await collectible.tokenByTypeAndIndex(0, 3), '10');
          assert.equal(await collectible.tokenByTypeAndIndex(0, 4), '13');
          assert.equal(await collectible.tokenByTypeAndIndex(1, 0), '5');
          assert.equal(await collectible.tokenByTypeAndIndex(1, 1), '6');
          assert.equal(await collectible.tokenByTypeAndIndex(3, 0), '1');
          assert.equal(await collectible.tokenByTypeAndIndex(3, 1), '2');
          assert.equal(await collectible.tokenByTypeAndIndex(4, 0), '3');
          assert.equal(await collectible.tokenByTypeAndIndex(4, 1), '7');
          assert.equal(await collectible.tokenByTypeAndIndex(4, 2), '11');
          assert.equal(await collectible.tokenByTypeAndIndex(5, 0), '8');
          assert.equal(await collectible.tokenByTypeAndIndex(5, 1), '12');
          assert.equal(await collectible.tokenByTypeAndIndex(5, 2), '14');

          assert.equal(await collectible.tokenType(0), '0');
          assert.equal(await collectible.tokenType(1), '3');
          assert.equal(await collectible.tokenType(2), '3');
          assert.equal(await collectible.tokenType(3), '4');
          assert.equal(await collectible.tokenType(4), '0');
          assert.equal(await collectible.tokenType(5), '1');
          assert.equal(await collectible.tokenType(6), '1');
          assert.equal(await collectible.tokenType(7), '4');
          assert.equal(await collectible.tokenType(8), '5');
          assert.equal(await collectible.tokenType(9), '0');
          assert.equal(await collectible.tokenType(10), '0');
          assert.equal(await collectible.tokenType(11), '4');
          assert.equal(await collectible.tokenType(12), '5');
          assert.equal(await collectible.tokenType(13), '0');
          assert.equal(await collectible.tokenType(14), '5');
        });

        context('burnFrom', () => {
          it('strangers cannot burn tokens', async () => {
            await expectRevert(
              this.collectible.burnFrom(alice, 0, { from:bob }),
              "ERC721ValuableCollectibleToken: burnFrom caller is not owner, burner, nor approved",
            );

            await expectRevert(
              this.collectible.burnFrom(alice, 1, { from:manager }),
              "ERC721ValuableCollectibleToken: burnFrom caller is not owner, burner, nor approved",
            );

            await this.collectible.approve(minter, 5, { from:bob });
            await this.collectible.approve(alice, 6, { from:bob });

            await expectRevert(
              this.collectible.burnFrom(bob, 5, { from:alice }),
              "ERC721ValuableCollectibleToken: burnFrom caller is not owner, burner, nor approved",
            );

            await expectRevert(
              this.collectible.burnFrom(bob, 6, { from:minter }),
              "ERC721ValuableCollectibleToken: burnFrom caller is not owner, burner, nor approved",
            );
          });

          it('cannot burn tokens from wrong address', async () => {
            const { collectible } = this;
            await collectible.setApprovalForAll(bob, true, { from:alice });
            await collectible.setApprovalForAll(bob, true, { from:carol });
            await expectRevert(
              this.collectible.burnFrom(alice, 4, { from:bob }),
              "ERC721ValuableCollectibleToken: token not owned by from address",
            );

            await expectRevert(
              this.collectible.burnFrom(bob, 0, { from:bob }),
              "ERC721ValuableCollectibleToken: token not owned by from address",
            );

            await expectRevert(
              this.collectible.burnFrom(carol, 0, { from:bob }),
              "ERC721ValuableCollectibleToken: token not owned by from address",
            );
          });

          it('burn removes token from collection', async () => {
            const { collectible } = this;
            // alice: burn own tokens
            await collectible.burnFrom(alice, 0, { from:alice });
            await collectible.burnFrom(alice, 2, { from:alice });

            // bob: burned by dave, who has blanket approval
            await collectible.setApprovalForAll(dave, true, { from:bob });
            await collectible.burnFrom(bob, 5, { from:dave });
            await collectible.burnFrom(bob, 7, { from:dave });

            // carol: burned by various people with specific token approval
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(bob, 12, { from:carol });
            await collectible.burnFrom(carol, 9, { from:alice });
            await collectible.burnFrom(carol, 12, { from:bob });

            // removed values 0, 10, 0, 30, 0, 100

            // check results
            assert.equal(await collectible.totalValue(), '270');
            assert.equal(await collectible.totalSupply(), '9');
            assert.equal(await collectible.totalSupplyByType(0), '3');
            assert.equal(await collectible.totalSupplyByType(1), '1');
            assert.equal(await collectible.totalSupplyByType(2), '0');
            assert.equal(await collectible.totalSupplyByType(3), '1');
            assert.equal(await collectible.totalSupplyByType(4), '2');
            assert.equal(await collectible.totalSupplyByType(5), '2');
            assert.equal(await collectible.ownerTypes(alice), '2');
            assert.equal(await collectible.ownerTypeByIndex(alice, 0), '4');
            assert.equal(await collectible.ownerTypeByIndex(alice, 1), '3');
            assert.equal(await collectible.ownerValue(alice), '40');
            assert.equal(await collectible.balanceOf(alice), '2');
            assert.equal(await collectible.ownerTypes(bob), '3');
            assert.equal(await collectible.ownerTypeByIndex(bob, 0), '0');
            assert.equal(await collectible.ownerTypeByIndex(bob, 1), '1');
            assert.equal(await collectible.ownerTypeByIndex(bob, 2), '5');
            assert.equal(await collectible.ownerValue(bob), '100');
            assert.equal(await collectible.balanceOf(bob), '3');
            assert.equal(await collectible.ownerTypes(carol), '3');
            assert.equal(await collectible.ownerTypeByIndex(carol, 0), '0');
            assert.equal(await collectible.ownerTypeByIndex(carol, 1), '4');
            assert.equal(await collectible.ownerTypeByIndex(carol, 2), '5');
            assert.equal(await collectible.ownerValue(carol), '130');
            assert.equal(await collectible.balanceOf(carol), '4');

            assert.equal(await collectible.balanceOfOwnerByType(alice, 0), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 1), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 3), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 5), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 1), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 4), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 0), '2');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 1), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 5), '1');

            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 3, 0), '1');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 4, 0), '3');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 0, 0), '4');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 1, 0), '6');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 5, 0), '8');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 0), '13');  // the last '0' replaces the first upon removal
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 1), '10');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 4, 0), '11');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 5, 0), '14');
            // 0, 4, 9, 10, 13 => 13, 4, 9, 10 => 13, 4, 10
            assert.equal(await collectible.tokenByTypeAndIndex(0, 0), '13');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 1), '4');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 2), '10');
            assert.equal(await collectible.tokenByTypeAndIndex(1, 0), '6');
            assert.equal(await collectible.tokenByTypeAndIndex(3, 0), '1');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 0), '3');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 1), '11');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 0), '8');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 1), '14');

            assert.equal(await collectible.tokenType(1), '3');
            assert.equal(await collectible.tokenType(3), '4');
            assert.equal(await collectible.tokenType(4), '0');
            assert.equal(await collectible.tokenType(6), '1');
            assert.equal(await collectible.tokenType(8), '5');
            assert.equal(await collectible.tokenType(10), '0');
            assert.equal(await collectible.tokenType(11), '4');
            assert.equal(await collectible.tokenType(13), '0');
            assert.equal(await collectible.tokenType(14), '5');
          });

          it('burn rearranges ownerTypes', async () => {
            const { collectible } = this;
            // alice: burn own tokens
            // await collectible.burnFrom(alice, 0, { from:alice });
            // await collectible.burnFrom(alice, 2, { from:alice });

            // bob: burned by dave, who has blanket approval
            await collectible.setApprovalForAll(dave, true, { from:bob });
            await collectible.burnFrom(bob, 4, { from:dave });
            assert.equal(await collectible.ownerTypes(bob), '3');
            assert.equal(await collectible.ownerTypeByIndex(bob, 0), '5');
            assert.equal(await collectible.ownerTypeByIndex(bob, 1), '1');
            assert.equal(await collectible.ownerTypeByIndex(bob, 2), '4');

            await collectible.burnFrom(bob, 5, { from:dave });
            assert.equal(await collectible.ownerTypes(bob), '3');
            assert.equal(await collectible.ownerTypeByIndex(bob, 0), '5');
            assert.equal(await collectible.ownerTypeByIndex(bob, 1), '1');
            assert.equal(await collectible.ownerTypeByIndex(bob, 2), '4');

            await collectible.burnFrom(bob, 6, { from:dave });
            assert.equal(await collectible.ownerTypes(bob), '2');
            assert.equal(await collectible.ownerTypeByIndex(bob, 0), '5');
            assert.equal(await collectible.ownerTypeByIndex(bob, 1), '4');
          });

          it('burnFrom updates the listener', async () => {
            const { collectible } = this;
            const listener = await MockTokenCollectionListener.new();
            await collectible.setTokenCollectionListener(listener.address, { from:manager });

            // alice: burn own tokens
            let res = await collectible.burnFrom(alice, 0, { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'3', ownerValue:'50' });
            res = await collectible.burnFrom(alice, 2, { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'2', ownerValue:'40' });

            // bob: burned by dave, who has blanket approval
            await collectible.setApprovalForAll(dave, true, { from:bob });
            res = await collectible.burnFrom(bob, 5, { from:dave });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'4', ownerValue:'130' });
            res = await collectible.burnFrom(bob, 7, { from:dave });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'3', ownerValue:'100' });

            // carol: burned by various people with specific token approval
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(bob, 12, { from:carol });
            res = await collectible.burnFrom(carol, 9, { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'5', ownerValue:'230' });
            res = await collectible.burnFrom(carol, 12, { from:bob });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'4', ownerValue:'130' });
          });
        });

        context('massBurnFrom', () => {
          it('strangers cannot massBurn tokens', async () => {
            await expectRevert(
              this.collectible.massBurnFrom(alice, [0], { from:bob }),
              "ERC721ValuableCollectibleToken: massBurnFrom caller is not owner, burner, nor approved",
            );

            await expectRevert(
              this.collectible.massBurnFrom(alice, [1], { from:manager }),
              "ERC721ValuableCollectibleToken: massBurnFrom caller is not owner, burner, nor approved",
            );

            await this.collectible.approve(minter, 5, { from:bob });
            await this.collectible.approve(alice, 6, { from:bob });

            await expectRevert(
              this.collectible.massBurnFrom(bob, [5, 6], { from:alice }),
              "ERC721ValuableCollectibleToken: massBurnFrom caller is not owner, burner, nor approved",
            );

            await expectRevert(
              this.collectible.massBurnFrom(bob, [5, 6], { from:minter }),
              "ERC721ValuableCollectibleToken: massBurnFrom caller is not owner, burner, nor approved",
            );
          });

          it('cannot massBurnFrom tokens from wrong address', async () => {
            const { collectible } = this;
            await collectible.setApprovalForAll(bob, true, { from:alice });
            await collectible.setApprovalForAll(bob, true, { from:carol });
            await expectRevert(
              this.collectible.massBurnFrom(alice, [0, 4], { from:bob }),
              "ERC721ValuableCollectibleToken: token not owned by from address",
            );

            await expectRevert(
              this.collectible.massBurnFrom(bob, [0, 4], { from:bob }),
              "ERC721ValuableCollectibleToken: token not owned by from address",
            );

            await expectRevert(
              this.collectible.massBurnFrom(carol, [0, 4], { from:bob }),
              "ERC721ValuableCollectibleToken: token not owned by from address",
            );
          });

          it('massBurnFrom removes tokens from collection', async () => {
            const { collectible } = this;
            // alice: burn own tokens
            await collectible.massBurnFrom(alice, [0, 2], { from:alice });

            // bob: burned by dave, who has blanket approval
            await collectible.setApprovalForAll(dave, true, { from:bob });
            await collectible.massBurnFrom(bob, [5, 7], { from:dave });

            // carol: burned by various people with specific token approval
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(bob, 12, { from:carol });
            await collectible.massBurnFrom(carol, [9], { from:alice });
            await collectible.massBurnFrom(carol, [12], { from:bob });

            // removed values 0, 10, 0, 30, 0, 100

            // check results
            assert.equal(await collectible.totalValue(), '270');
            assert.equal(await collectible.totalSupply(), '9');
            assert.equal(await collectible.totalSupplyByType(0), '3');
            assert.equal(await collectible.totalSupplyByType(1), '1');
            assert.equal(await collectible.totalSupplyByType(2), '0');
            assert.equal(await collectible.totalSupplyByType(3), '1');
            assert.equal(await collectible.totalSupplyByType(4), '2');
            assert.equal(await collectible.totalSupplyByType(5), '2');
            assert.equal(await collectible.ownerTypes(alice), '2');
            assert.equal(await collectible.ownerValue(alice), '40');
            assert.equal(await collectible.balanceOf(alice), '2');
            assert.equal(await collectible.ownerTypes(bob), '3');
            assert.equal(await collectible.ownerValue(bob), '100');
            assert.equal(await collectible.balanceOf(bob), '3');
            assert.equal(await collectible.ownerTypes(carol), '3');
            assert.equal(await collectible.ownerValue(carol), '130');
            assert.equal(await collectible.balanceOf(carol), '4');

            assert.equal(await collectible.balanceOfOwnerByType(alice, 0), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 1), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 3), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 5), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 1), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 4), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 0), '2');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 1), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 5), '1');

            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 3, 0), '1');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 4, 0), '3');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 0, 0), '4');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 1, 0), '6');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 5, 0), '8');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 0), '13');  // the last '0' replaces the first upon removal
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 1), '10');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 4, 0), '11');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 5, 0), '14');
            // 0, 4, 9, 10, 13 => 13, 4, 9, 10 => 13, 4, 10
            assert.equal(await collectible.tokenByTypeAndIndex(0, 0), '13');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 1), '4');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 2), '10');
            assert.equal(await collectible.tokenByTypeAndIndex(1, 0), '6');
            assert.equal(await collectible.tokenByTypeAndIndex(3, 0), '1');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 0), '3');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 1), '11');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 0), '8');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 1), '14');

            assert.equal(await collectible.tokenType(1), '3');
            assert.equal(await collectible.tokenType(3), '4');
            assert.equal(await collectible.tokenType(4), '0');
            assert.equal(await collectible.tokenType(6), '1');
            assert.equal(await collectible.tokenType(8), '5');
            assert.equal(await collectible.tokenType(10), '0');
            assert.equal(await collectible.tokenType(11), '4');
            assert.equal(await collectible.tokenType(13), '0');
            assert.equal(await collectible.tokenType(14), '5');
          });

          it('massBurnFrom updates the listener', async () => {
            const { collectible } = this;
            const listener = await MockTokenCollectionListener.new();
            await collectible.setTokenCollectionListener(listener.address, { from:manager });

            // alice: burn own tokens
            let res = await collectible.massBurnFrom(alice, [0, 2], { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'2', ownerValue:'40' });

            // bob: burned by dave, who has blanket approval
            await collectible.setApprovalForAll(dave, true, { from:bob });
            res = await collectible.massBurnFrom(bob, [5, 7], { from:dave });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'3', ownerValue:'100' });

            // carol: burned by various people with specific token approval
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(bob, 12, { from:carol });
            res = await collectible.massBurnFrom(carol, [9], { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'5', ownerValue:'230' });
            res = await collectible.massBurnFrom(carol, [12], { from:bob });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'4', ownerValue:'130' });
          });
        });

        context('transferFrom', () => {
          it('strangers cannot transferFrom tokens', async () => {
            await expectRevert(
              this.collectible.transferFrom(alice, dave, 0, { from:bob }),
              "ERC721: transfer caller is not owner nor approved",
            );

            await expectRevert(
              this.collectible.transferFrom(alice, dave, 1, { from:manager }),
              "ERC721: transfer caller is not owner nor approved",
            );

            await this.collectible.approve(minter, 5, { from:bob });
            await this.collectible.approve(alice, 6, { from:bob });

            await expectRevert(
              this.collectible.transferFrom(bob, dave, 5, { from:alice }),
              "ERC721: transfer caller is not owner nor approved",
            );

            await expectRevert(
              this.collectible.transferFrom(bob, dave, 6, { from:minter }),
              "ERC721: transfer caller is not owner nor approved",
            );
          });

          it('cannot transferFrom tokens from wrong address', async () => {
            const { collectible } = this;
            await collectible.setApprovalForAll(bob, true, { from:alice });
            await collectible.setApprovalForAll(bob, true, { from:carol });
            await expectRevert(
              this.collectible.transferFrom(alice, dave, 4, { from:bob }),
              "ERC721: transfer of token that is not own",
            );

            await expectRevert(
              this.collectible.transferFrom(bob, dave, 0, { from:bob }),
              "ERC721: transfer of token that is not own",
            );

            await expectRevert(
              this.collectible.transferFrom(carol, dave, 4, { from:bob }),
              "ERC721: transfer of token that is not own",
            );
          });

          it('transferFrom transfers tokens from collection', async () => {
            const { collectible } = this;
            // alice: transfer own tokens to dave
            await collectible.transferFrom(alice, dave, 0, { from:alice });
            await collectible.transferFrom(alice, dave, 2, { from:alice });

            // bob: transferred by dave, who has blanket approval
            await collectible.setApprovalForAll(dave, true, { from:bob });
            await collectible.transferFrom(bob, dave, 5, { from:dave });
            await collectible.transferFrom(bob, dave, 7, { from:dave });

            // carol: transferred to alice by various people with specific token approval
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(bob, 12, { from:carol });
            await collectible.transferFrom(carol, alice, 9, { from:alice });
            await collectible.transferFrom(carol, alice, 12, { from:bob });

            // transferred types  0, 3, 1, 4, 0, 5
            // transferred values 0, 10, 0, 30, 0, 100

            // new token IDs
            // alice 1, 3, 9, 12
            // bob 4, 6, 8
            // carol 10, 11, 13, 14
            // dave 0, 2, 5, 7

            // new types
            // alice 3, 4, 0, 5
            // bob 0, 1, 5
            // carol 0, 4, 0, 5
            // dave 0, 3, 1, 4

            // check results
            assert.equal(await collectible.totalValue(), '410');
            assert.equal(await collectible.totalSupply(), '15');
            assert.equal(await collectible.totalSupplyByType(0), '5');
            assert.equal(await collectible.totalSupplyByType(1), '2');
            assert.equal(await collectible.totalSupplyByType(2), '0');
            assert.equal(await collectible.totalSupplyByType(3), '2');
            assert.equal(await collectible.totalSupplyByType(4), '3');
            assert.equal(await collectible.totalSupplyByType(5), '3');
            assert.equal(await collectible.ownerTypes(alice), '4');
            assert.equal(await collectible.ownerValue(alice), '140');
            assert.equal(await collectible.balanceOf(alice), '4');
            assert.equal(await collectible.ownerTypes(bob), '3');
            assert.equal(await collectible.ownerValue(bob), '100');
            assert.equal(await collectible.balanceOf(bob), '3');
            assert.equal(await collectible.ownerTypes(carol), '3');
            assert.equal(await collectible.ownerValue(carol), '130');
            assert.equal(await collectible.balanceOf(carol), '4');
            assert.equal(await collectible.ownerTypes(dave), '4');
            assert.equal(await collectible.ownerValue(dave), '40');
            assert.equal(await collectible.balanceOf(dave), '4');

            assert.equal(await collectible.balanceOfOwnerByType(alice, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 1), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 3), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 1), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 4), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 0), '2');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 1), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 1), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 3), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 5), '0');

            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 0, 0), '9');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 3, 0), '1');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 4, 0), '3');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 0, 0), '4');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 1, 0), '6');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 5, 0), '8');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 0), '13');  // the last '0' replaces the first upon removal
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 1), '10');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 4, 0), '11');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 5, 0), '14');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 0, 0), '0');  // the last '0' replaces the first upon removal
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 1, 0), '5');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 3, 0), '2');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 4, 0), '7');
            // no changes
            assert.equal(await collectible.tokenByTypeAndIndex(0, 0), '0');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 1), '4');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 2), '9');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 3), '10');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 4), '13');
            assert.equal(await collectible.tokenByTypeAndIndex(1, 0), '5');
            assert.equal(await collectible.tokenByTypeAndIndex(1, 1), '6');
            assert.equal(await collectible.tokenByTypeAndIndex(3, 0), '1');
            assert.equal(await collectible.tokenByTypeAndIndex(3, 1), '2');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 0), '3');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 1), '7');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 2), '11');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 0), '8');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 1), '12');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 2), '14');

            assert.equal(await collectible.tokenType(0), '0');
            assert.equal(await collectible.tokenType(1), '3');
            assert.equal(await collectible.tokenType(2), '3');
            assert.equal(await collectible.tokenType(3), '4');
            assert.equal(await collectible.tokenType(4), '0');
            assert.equal(await collectible.tokenType(5), '1');
            assert.equal(await collectible.tokenType(6), '1');
            assert.equal(await collectible.tokenType(7), '4');
            assert.equal(await collectible.tokenType(8), '5');
            assert.equal(await collectible.tokenType(9), '0');
            assert.equal(await collectible.tokenType(10), '0');
            assert.equal(await collectible.tokenType(11), '4');
            assert.equal(await collectible.tokenType(12), '5');
            assert.equal(await collectible.tokenType(13), '0');
            assert.equal(await collectible.tokenType(14), '5');
          });

          it('transferFrom updates the listener', async () => {
            const { collectible } = this;
            const listener = await MockTokenCollectionListener.new();
            await collectible.setTokenCollectionListener(listener.address, { from:manager });

            // alice: transfer own tokens to dave
            let res = await collectible.transferFrom(alice, dave, 0, { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'3', ownerValue:'50' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'1', ownerValue:'0' });
            res = await collectible.transferFrom(alice, dave, 2, { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'2', ownerValue:'40' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'2', ownerValue:'10' });

            // bob: transferred by dave, who has blanket approval
            await collectible.setApprovalForAll(dave, true, { from:bob });
            res = await collectible.transferFrom(bob, dave, 5, { from:dave });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'4', ownerValue:'130' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'3', ownerValue:'10' });
            res = await collectible.transferFrom(bob, dave, 7, { from:dave });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'3', ownerValue:'100' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'4', ownerValue:'40' });

            // carol: transferred to alice by various people with specific token approval
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(bob, 12, { from:carol });
            res = await collectible.transferFrom(carol, alice, 9, { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'5', ownerValue:'230' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'3', ownerValue:'40' });
            res = await collectible.transferFrom(carol, alice, 12, { from:bob });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'4', ownerValue:'130' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'4', ownerValue:'140' });
          });
        });

        context('safeTransferFrom', () => {
          const fun = 'safeTransferFrom(address,address,uint256)';

          it('strangers cannot safeTransferFrom tokens', async () => {
            await expectRevert(
              this.collectible.methods[fun](alice, dave, 0, { from:bob }),
              "ERC721: transfer caller is not owner nor approved",
            );

            await expectRevert(
              this.collectible.methods[fun](alice, dave, 1, { from:manager }),
              "ERC721: transfer caller is not owner nor approved",
            );

            await this.collectible.approve(minter, 5, { from:bob });
            await this.collectible.approve(alice, 6, { from:bob });

            await expectRevert(
              this.collectible.methods[fun](bob, dave, 5, { from:alice }),
              "ERC721: transfer caller is not owner nor approved",
            );

            await expectRevert(
              this.collectible.methods[fun](bob, dave, 6, { from:minter }),
              "ERC721: transfer caller is not owner nor approved",
            );
          });

          it('cannot safeTransferFrom tokens from wrong address', async () => {
            const { collectible } = this;
            await collectible.setApprovalForAll(bob, true, { from:alice });
            await collectible.setApprovalForAll(bob, true, { from:carol });
            await expectRevert(
              this.collectible.methods[fun](alice, dave, 4, { from:bob }),
              "ERC721: transfer of token that is not own",
            );

            await expectRevert(
              this.collectible.methods[fun](bob, dave, 0, { from:bob }),
              "ERC721: transfer of token that is not own",
            );

            await expectRevert(
              this.collectible.methods[fun](carol, dave, 4, { from:bob }),
              "ERC721: transfer of token that is not own",
            );
          });

          it('safeTransferFrom transfers tokens from collection', async () => {
            const { collectible } = this;
            // alice: transfer own tokens to dave
            await collectible.methods[fun](alice, dave, 0, { from:alice });
            await collectible.methods[fun](alice, dave, 2, { from:alice });

            // bob: transferred by dave, who has blanket approval
            await collectible.setApprovalForAll(dave, true, { from:bob });
            await collectible.methods[fun](bob, dave, 5, { from:dave });
            await collectible.methods[fun](bob, dave, 7, { from:dave });

            // carol: transferred to alice by various people with specific token approval
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(bob, 12, { from:carol });
            await collectible.methods[fun](carol, alice, 9, { from:alice });
            await collectible.methods[fun](carol, alice, 12, { from:bob });

            // transferred types  0, 3, 1, 4, 0, 5
            // transferred values 0, 10, 0, 30, 0, 100

            // new token IDs
            // alice 1, 3, 9, 12
            // bob 4, 6, 8
            // carol 10, 11, 13, 14
            // dave 0, 2, 5, 7

            // new types
            // alice 3, 4, 0, 5
            // bob 0, 1, 5
            // carol 0, 4, 0, 5
            // dave 0, 3, 1, 4

            // check results
            assert.equal(await collectible.totalValue(), '410');
            assert.equal(await collectible.totalSupply(), '15');
            assert.equal(await collectible.totalSupplyByType(0), '5');
            assert.equal(await collectible.totalSupplyByType(1), '2');
            assert.equal(await collectible.totalSupplyByType(2), '0');
            assert.equal(await collectible.totalSupplyByType(3), '2');
            assert.equal(await collectible.totalSupplyByType(4), '3');
            assert.equal(await collectible.totalSupplyByType(5), '3');
            assert.equal(await collectible.ownerTypes(alice), '4');
            assert.equal(await collectible.ownerValue(alice), '140');
            assert.equal(await collectible.balanceOf(alice), '4');
            assert.equal(await collectible.ownerTypes(bob), '3');
            assert.equal(await collectible.ownerValue(bob), '100');
            assert.equal(await collectible.balanceOf(bob), '3');
            assert.equal(await collectible.ownerTypes(carol), '3');
            assert.equal(await collectible.ownerValue(carol), '130');
            assert.equal(await collectible.balanceOf(carol), '4');
            assert.equal(await collectible.ownerTypes(dave), '4');
            assert.equal(await collectible.ownerValue(dave), '40');
            assert.equal(await collectible.balanceOf(dave), '4');

            assert.equal(await collectible.balanceOfOwnerByType(alice, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 1), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 3), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 1), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 4), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 0), '2');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 1), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 1), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 3), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 5), '0');

            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 0, 0), '9');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 3, 0), '1');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 4, 0), '3');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 0, 0), '4');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 1, 0), '6');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 5, 0), '8');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 0), '13');  // the last '0' replaces the first upon removal
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 1), '10');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 4, 0), '11');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 5, 0), '14');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 0, 0), '0');  // the last '0' replaces the first upon removal
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 1, 0), '5');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 3, 0), '2');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 4, 0), '7');
            // no changes
            assert.equal(await collectible.tokenByTypeAndIndex(0, 0), '0');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 1), '4');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 2), '9');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 3), '10');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 4), '13');
            assert.equal(await collectible.tokenByTypeAndIndex(1, 0), '5');
            assert.equal(await collectible.tokenByTypeAndIndex(1, 1), '6');
            assert.equal(await collectible.tokenByTypeAndIndex(3, 0), '1');
            assert.equal(await collectible.tokenByTypeAndIndex(3, 1), '2');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 0), '3');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 1), '7');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 2), '11');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 0), '8');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 1), '12');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 2), '14');

            assert.equal(await collectible.tokenType(0), '0');
            assert.equal(await collectible.tokenType(1), '3');
            assert.equal(await collectible.tokenType(2), '3');
            assert.equal(await collectible.tokenType(3), '4');
            assert.equal(await collectible.tokenType(4), '0');
            assert.equal(await collectible.tokenType(5), '1');
            assert.equal(await collectible.tokenType(6), '1');
            assert.equal(await collectible.tokenType(7), '4');
            assert.equal(await collectible.tokenType(8), '5');
            assert.equal(await collectible.tokenType(9), '0');
            assert.equal(await collectible.tokenType(10), '0');
            assert.equal(await collectible.tokenType(11), '4');
            assert.equal(await collectible.tokenType(12), '5');
            assert.equal(await collectible.tokenType(13), '0');
            assert.equal(await collectible.tokenType(14), '5');
          });

          it('safeTransferFrom updates the listener', async () => {
            const { collectible } = this;
            const listener = await MockTokenCollectionListener.new();
            await collectible.setTokenCollectionListener(listener.address, { from:manager });

            // alice: transfer own tokens to dave
            let res = await collectible.methods[fun](alice, dave, 0, { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'3', ownerValue:'50' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'1', ownerValue:'0' });
            res = await collectible.methods[fun](alice, dave, 2, { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'2', ownerValue:'40' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'2', ownerValue:'10' });

            // bob: transferred by dave, who has blanket approval
            await collectible.setApprovalForAll(dave, true, { from:bob });
            res = await collectible.methods[fun](bob, dave, 5, { from:dave });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'4', ownerValue:'130' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'3', ownerValue:'10' });
            res = await collectible.methods[fun](bob, dave, 7, { from:dave });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'3', ownerValue:'100' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'4', ownerValue:'40' });

            // carol: transferred to alice by various people with specific token approval
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(bob, 12, { from:carol });
            res = await collectible.methods[fun](carol, alice, 9, { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'5', ownerValue:'230' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'3', ownerValue:'40' });
            res = await collectible.methods[fun](carol, alice, 12, { from:bob });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'4', ownerValue:'130' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'4', ownerValue:'140' });
          });
        });

        context('safeTransferFrom with data', () => {
          const fun = 'safeTransferFrom(address,address,uint256,bytes)';

          it('strangers cannot safeTransferFrom tokens', async () => {
            await expectRevert(
              this.collectible.methods[fun](alice, dave, 0, "0x1234", { from:bob }),
              "ERC721: transfer caller is not owner nor approved",
            );

            await expectRevert(
              this.collectible.methods[fun](alice, dave, 1, "0x1234", { from:manager }),
              "ERC721: transfer caller is not owner nor approved",
            );

            await this.collectible.approve(minter, 5, { from:bob });
            await this.collectible.approve(alice, 6, { from:bob });

            await expectRevert(
              this.collectible.methods[fun](bob, dave, 5, "0x1234", { from:alice }),
              "ERC721: transfer caller is not owner nor approved",
            );

            await expectRevert(
              this.collectible.methods[fun](bob, dave, 6, "0x1234", { from:minter }),
              "ERC721: transfer caller is not owner nor approved",
            );
          });

          it('cannot safeTransferFrom tokens from wrong address', async () => {
            const { collectible } = this;
            await collectible.setApprovalForAll(bob, true, { from:alice });
            await collectible.setApprovalForAll(bob, true, { from:carol });
            await expectRevert(
              this.collectible.methods[fun](alice, dave, 4, "0x1234", { from:bob }),
              "ERC721: transfer of token that is not own",
            );

            await expectRevert(
              this.collectible.methods[fun](bob, dave, 0, "0x1234", { from:bob }),
              "ERC721: transfer of token that is not own",
            );

            await expectRevert(
              this.collectible.methods[fun](carol, dave, 4, "0x1234", { from:bob }),
              "ERC721: transfer of token that is not own",
            );
          });

          it('safeTransferFrom transfers tokens from collection', async () => {
            const { collectible } = this;
            // alice: transfer own tokens to dave
            await collectible.methods[fun](alice, dave, 0, "0x1234", { from:alice });
            await collectible.methods[fun](alice, dave, 2, "0x1234", { from:alice });

            // bob: transferred by dave, who has blanket approval
            await collectible.setApprovalForAll(dave, true, { from:bob });
            await collectible.methods[fun](bob, dave, 5, "0x1234", { from:dave });
            await collectible.methods[fun](bob, dave, 7, "0x1234", { from:dave });

            // carol: transferred to alice by various people with specific token approval
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(bob, 12, { from:carol });
            await collectible.methods[fun](carol, alice, 9, "0x1234", { from:alice });
            await collectible.methods[fun](carol, alice, 12, "0x1234", { from:bob });

            // transferred types  0, 3, 1, 4, 0, 5
            // transferred values 0, 10, 0, 30, 0, 100

            // new token IDs
            // alice 1, 3, 9, 12
            // bob 4, 6, 8
            // carol 10, 11, 13, 14
            // dave 0, 2, 5, 7

            // new types
            // alice 3, 4, 0, 5
            // bob 0, 1, 5
            // carol 0, 4, 0, 5
            // dave 0, 3, 1, 4

            // check results
            assert.equal(await collectible.totalValue(), '410');
            assert.equal(await collectible.totalSupply(), '15');
            assert.equal(await collectible.totalSupplyByType(0), '5');
            assert.equal(await collectible.totalSupplyByType(1), '2');
            assert.equal(await collectible.totalSupplyByType(2), '0');
            assert.equal(await collectible.totalSupplyByType(3), '2');
            assert.equal(await collectible.totalSupplyByType(4), '3');
            assert.equal(await collectible.totalSupplyByType(5), '3');
            assert.equal(await collectible.ownerTypes(alice), '4');
            assert.equal(await collectible.ownerValue(alice), '140');
            assert.equal(await collectible.balanceOf(alice), '4');
            assert.equal(await collectible.ownerTypes(bob), '3');
            assert.equal(await collectible.ownerValue(bob), '100');
            assert.equal(await collectible.balanceOf(bob), '3');
            assert.equal(await collectible.ownerTypes(carol), '3');
            assert.equal(await collectible.ownerValue(carol), '130');
            assert.equal(await collectible.balanceOf(carol), '4');
            assert.equal(await collectible.ownerTypes(dave), '4');
            assert.equal(await collectible.ownerValue(dave), '40');
            assert.equal(await collectible.balanceOf(dave), '4');

            assert.equal(await collectible.balanceOfOwnerByType(alice, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 1), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 3), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 1), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 4), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 0), '2');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 1), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 1), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 3), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 5), '0');

            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 0, 0), '9');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 3, 0), '1');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 4, 0), '3');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 0, 0), '4');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 1, 0), '6');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 5, 0), '8');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 0), '13');  // the last '0' replaces the first upon removal
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 1), '10');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 4, 0), '11');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 5, 0), '14');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 0, 0), '0');  // the last '0' replaces the first upon removal
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 1, 0), '5');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 3, 0), '2');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 4, 0), '7');
            // no changes
            assert.equal(await collectible.tokenByTypeAndIndex(0, 0), '0');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 1), '4');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 2), '9');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 3), '10');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 4), '13');
            assert.equal(await collectible.tokenByTypeAndIndex(1, 0), '5');
            assert.equal(await collectible.tokenByTypeAndIndex(1, 1), '6');
            assert.equal(await collectible.tokenByTypeAndIndex(3, 0), '1');
            assert.equal(await collectible.tokenByTypeAndIndex(3, 1), '2');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 0), '3');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 1), '7');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 2), '11');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 0), '8');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 1), '12');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 2), '14');

            assert.equal(await collectible.tokenType(0), '0');
            assert.equal(await collectible.tokenType(1), '3');
            assert.equal(await collectible.tokenType(2), '3');
            assert.equal(await collectible.tokenType(3), '4');
            assert.equal(await collectible.tokenType(4), '0');
            assert.equal(await collectible.tokenType(5), '1');
            assert.equal(await collectible.tokenType(6), '1');
            assert.equal(await collectible.tokenType(7), '4');
            assert.equal(await collectible.tokenType(8), '5');
            assert.equal(await collectible.tokenType(9), '0');
            assert.equal(await collectible.tokenType(10), '0');
            assert.equal(await collectible.tokenType(11), '4');
            assert.equal(await collectible.tokenType(12), '5');
            assert.equal(await collectible.tokenType(13), '0');
            assert.equal(await collectible.tokenType(14), '5');
          });

          it('safeTransferFrom updates the listener', async () => {
            const { collectible } = this;
            const listener = await MockTokenCollectionListener.new();
            await collectible.setTokenCollectionListener(listener.address, { from:manager });

            // alice: transfer own tokens to dave
            let res = await collectible.methods[fun](alice, dave, 0, "0x1234", { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'3', ownerValue:'50' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'1', ownerValue:'0' });
            res = await collectible.methods[fun](alice, dave, 2, "0x1234", { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'2', ownerValue:'40' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'2', ownerValue:'10' });

            // bob: transferred by dave, who has blanket approval
            await collectible.setApprovalForAll(dave, true, { from:bob });
            res = await collectible.methods[fun](bob, dave, 5, "0x1234", { from:dave });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'4', ownerValue:'130' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'3', ownerValue:'10' });
            res = await collectible.methods[fun](bob, dave, 7, "0x1234", { from:dave });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'3', ownerValue:'100' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'4', ownerValue:'40' });

            // carol: transferred to alice by various people with specific token approval
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(bob, 12, { from:carol });
            res = await collectible.methods[fun](carol, alice, 9, "0x1234", { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'5', ownerValue:'230' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'3', ownerValue:'40' });
            res = await collectible.methods[fun](carol, alice, 12, "0x1234", { from:bob });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'4', ownerValue:'130' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'4', ownerValue:'140' });
          });
        });

        context('massTransferFrom', () => {
          it('strangers cannot massTransferFrom tokens', async () => {
            await expectRevert(
              this.collectible.massTransferFrom(alice, dave, [0], { from:bob }),
              "ERC721ValuableCollectibleToken: massTransferFrom caller is not owner nor approved",
            );

            await expectRevert(
              this.collectible.massTransferFrom(alice, dave, [1], { from:manager }),
              "ERC721ValuableCollectibleToken: massTransferFrom caller is not owner nor approved",
            );

            await this.collectible.approve(minter, 5, { from:bob });
            await this.collectible.approve(alice, 6, { from:bob });

            await expectRevert(
              this.collectible.massTransferFrom(bob, dave, [5, 6], { from:alice }),
              "ERC721ValuableCollectibleToken: massTransferFrom caller is not owner nor approved",
            );

            await expectRevert(
              this.collectible.massTransferFrom(bob, dave, [5, 6], { from:minter }),
              "ERC721ValuableCollectibleToken: massTransferFrom caller is not owner nor approved",
            );
          });

          it('cannot massTransferFrom tokens from wrong address', async () => {
            const { collectible } = this;
            await collectible.setApprovalForAll(bob, true, { from:alice });
            await collectible.setApprovalForAll(bob, true, { from:carol });
            await expectRevert(
              this.collectible.massTransferFrom(alice, dave, [0, 4], { from:bob }),
              "ERC721ValuableCollectibleToken: token not owned by from address",
            );

            await expectRevert(
              this.collectible.massTransferFrom(bob, dave, [0, 4], { from:bob }),
              "ERC721ValuableCollectibleToken: token not owned by from address",
            );

            await expectRevert(
              this.collectible.massTransferFrom(carol, dave, [0, 4], { from:bob }),
              "ERC721ValuableCollectibleToken: token not owned by from address",
            );
          });

          it('massTransferFrom transfers tokens from collection', async () => {
            const { collectible } = this;
            // alice: transfer own tokens to dave
            await collectible.massTransferFrom(alice, dave, [0, 2], { from:alice });

            // bob: transferred by dave, who has blanket approval
            await collectible.setApprovalForAll(dave, true, { from:bob });
            await collectible.massTransferFrom(bob, dave, [5, 7], { from:dave });

            // carol: transferred to alice by various people with specific token approval
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(bob, 12, { from:carol });
            await collectible.massTransferFrom(carol, alice, [9], { from:alice });
            await collectible.massTransferFrom(carol, alice, [12], { from:bob });

            // transferred types  0, 3, 1, 4, 0, 5
            // transferred values 0, 10, 0, 30, 0, 100

            // new token IDs
            // alice 1, 3, 9, 12
            // bob 4, 6, 8
            // carol 10, 11, 13, 14
            // dave 0, 2, 5, 7

            // new types
            // alice 3, 4, 0, 5
            // bob 0, 1, 5
            // carol 0, 4, 0, 5
            // dave 0, 3, 1, 4

            // check results
            assert.equal(await collectible.totalValue(), '410');
            assert.equal(await collectible.totalSupply(), '15');
            assert.equal(await collectible.totalSupplyByType(0), '5');
            assert.equal(await collectible.totalSupplyByType(1), '2');
            assert.equal(await collectible.totalSupplyByType(2), '0');
            assert.equal(await collectible.totalSupplyByType(3), '2');
            assert.equal(await collectible.totalSupplyByType(4), '3');
            assert.equal(await collectible.totalSupplyByType(5), '3');
            assert.equal(await collectible.ownerTypes(alice), '4');
            assert.equal(await collectible.ownerValue(alice), '140');
            assert.equal(await collectible.balanceOf(alice), '4');
            assert.equal(await collectible.ownerTypes(bob), '3');
            assert.equal(await collectible.ownerValue(bob), '100');
            assert.equal(await collectible.balanceOf(bob), '3');
            assert.equal(await collectible.ownerTypes(carol), '3');
            assert.equal(await collectible.ownerValue(carol), '130');
            assert.equal(await collectible.balanceOf(carol), '4');
            assert.equal(await collectible.ownerTypes(dave), '4');
            assert.equal(await collectible.ownerValue(dave), '40');
            assert.equal(await collectible.balanceOf(dave), '4');

            assert.equal(await collectible.balanceOfOwnerByType(alice, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 1), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 3), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 1), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 4), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 0), '2');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 1), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 1), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 3), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 5), '0');

            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 0, 0), '9');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 3, 0), '1');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 4, 0), '3');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 0, 0), '4');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 1, 0), '6');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 5, 0), '8');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 0), '13');  // the last '0' replaces the first upon removal
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 1), '10');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 4, 0), '11');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 5, 0), '14');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 0, 0), '0');  // the last '0' replaces the first upon removal
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 1, 0), '5');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 3, 0), '2');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 4, 0), '7');
            // no changes
            assert.equal(await collectible.tokenByTypeAndIndex(0, 0), '0');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 1), '4');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 2), '9');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 3), '10');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 4), '13');
            assert.equal(await collectible.tokenByTypeAndIndex(1, 0), '5');
            assert.equal(await collectible.tokenByTypeAndIndex(1, 1), '6');
            assert.equal(await collectible.tokenByTypeAndIndex(3, 0), '1');
            assert.equal(await collectible.tokenByTypeAndIndex(3, 1), '2');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 0), '3');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 1), '7');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 2), '11');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 0), '8');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 1), '12');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 2), '14');

            assert.equal(await collectible.tokenType(0), '0');
            assert.equal(await collectible.tokenType(1), '3');
            assert.equal(await collectible.tokenType(2), '3');
            assert.equal(await collectible.tokenType(3), '4');
            assert.equal(await collectible.tokenType(4), '0');
            assert.equal(await collectible.tokenType(5), '1');
            assert.equal(await collectible.tokenType(6), '1');
            assert.equal(await collectible.tokenType(7), '4');
            assert.equal(await collectible.tokenType(8), '5');
            assert.equal(await collectible.tokenType(9), '0');
            assert.equal(await collectible.tokenType(10), '0');
            assert.equal(await collectible.tokenType(11), '4');
            assert.equal(await collectible.tokenType(12), '5');
            assert.equal(await collectible.tokenType(13), '0');
            assert.equal(await collectible.tokenType(14), '5');
          });

          it('massTransferFrom updates the listener', async () => {
            const { collectible } = this;
            const listener = await MockTokenCollectionListener.new();
            await collectible.setTokenCollectionListener(listener.address, { from:manager });

            // alice: transfer own tokens to dave
            let res = await collectible.massTransferFrom(alice, dave, [0, 2], { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'2', ownerValue:'40' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'2', ownerValue:'10' });

            // bob: transferred by dave, who has blanket approval
            await collectible.setApprovalForAll(dave, true, { from:bob });
            res = await collectible.massTransferFrom(bob, dave, [5, 7], { from:dave });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'3', ownerValue:'100' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'4', ownerValue:'40' });

            // carol: transferred to alice by various people with specific token approval
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(bob, 12, { from:carol });
            res = await collectible.massTransferFrom(carol, alice, [9], { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'5', ownerValue:'230' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'3', ownerValue:'40' });
            res = await collectible.massTransferFrom(carol, alice, [12], { from:bob });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'4', ownerValue:'130' });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'4', ownerValue:'140' });
          });
        });

        context('exchange', () => {
          it('stranger with minting rights cannot exchange tokens', async () => {
            await expectRevert(
              this.collectible.exchange(alice, [0], [0, 1, 2, 3, 4, 5], { from:minter }),
              "ERC721ValuableCollectibleToken: exchange caller is not owner, burner, nor approved",
            );

            await this.collectible.approve(minter, 5, { from:bob });
            await this.collectible.approve(alice, 6, { from:bob });

            await expectRevert(
              this.collectible.exchange(bob, [5, 6], [0], { from:alice }),
              "ERC721ValuableCollectibleToken: exchange caller is not owner, burner, nor approved",
            );

            await expectRevert(
              this.collectible.exchange(bob, [5, 6], [0], { from:minter }),
              "ERC721ValuableCollectibleToken: exchange caller is not owner, burner, nor approved",
            );
          });

          it('non-minters cannot exchange tokens', async () => {
            await this.collectible.setApprovalForAll(bob, true, { from:alice });
            await this.collectible.setApprovalForAll(carol, true, { from:alice });
            await this.collectible.setApprovalForAll(carol, true, { from:bob });
            await this.collectible.setApprovalForAll(dave, true, { from:bob });
            await expectRevert(
              this.collectible.exchange(alice, [0], [0, 1, 2, 3, 4, 5], { from:bob }),
              "ERC721ValuableCollectibleToken: must have minter role to exchange",
            );

            await expectRevert(
              this.collectible.exchange(alice, [1], [0, 1, 2, 3, 4, 5], { from:carol }),
              "ERC721ValuableCollectibleToken: must have minter role to exchange",
            );

            await this.collectible.approve(minter, 5, { from:bob });
            await this.collectible.approve(alice, 6, { from:bob });

            await expectRevert(
              this.collectible.exchange(bob, [5, 6], [0], { from:carol }),
              "ERC721ValuableCollectibleToken: must have minter role to exchange",
            );

            await expectRevert(
              this.collectible.exchange(bob, [5, 6], [0], { from:dave }),
              "ERC721ValuableCollectibleToken: must have minter role to exchange",
            );
          });

          it('cannot exchange tokens from wrong address', async () => {
            const { collectible } = this;
            await collectible.setApprovalForAll(minter, true, { from:alice });
            await collectible.setApprovalForAll(minter, true, { from:bob });
            await collectible.setApprovalForAll(minter, true, { from:carol });
            await expectRevert(
              this.collectible.exchange(alice, [0, 4], [0], { from:minter }),
              "ERC721ValuableCollectibleToken: token not owned by owner address",
            );

            await expectRevert(
              this.collectible.exchange(bob, [0, 4], [0], { from:minter }),
              "ERC721ValuableCollectibleToken: token not owned by owner address",
            );

            await expectRevert(
              this.collectible.exchange(carol, [0, 4], [0], { from:minter }),
              "ERC721ValuableCollectibleToken: token not owned by owner address",
            );
          });

          it('exchange removes tokens from collection', async () => {
            const { collectible } = this;
            // alice: burn own tokens
            await collectible.exchange(alice, [0, 2], [0, 1, 2], { from:alice });

            // bob: burned by minter, who has blanket approval
            await collectible.setApprovalForAll(minter, true, { from:bob });
            await collectible.exchange(bob, [5, 7], [5, 4, 3], { from:minter });

            // carol: burned by various people with specific token approval and minting
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(minter, 12, { from:carol });
            await collectible.exchange(carol, [9], [], { from:alice });
            await collectible.exchange(carol, [12], [0], { from:minter });
            await collectible.exchange(dave, [], [1, 1, 2]);

            // token types
            // alice 3, 4, 0, 1, 2
            // bob 0, 1, 5, 5, 4, 3
            // carol 0, 4, 0, 5, 0
            // dave 1, 1, 2

            // token IDs
            // alice 1, 3, 15, 16, 17
            // bob 4, 6, 8, 18, 19, 20
            // carol 10, 11, 13, 14, 21
            // dave, 22, 23, 24

            // check results
            assert.equal(await collectible.totalValue(), '410');
            assert.equal(await collectible.totalSupply(), '19');
            assert.equal(await collectible.totalSupplyByType(0), '5');
            assert.equal(await collectible.totalSupplyByType(1), '4');
            assert.equal(await collectible.totalSupplyByType(2), '2');
            assert.equal(await collectible.totalSupplyByType(3), '2');
            assert.equal(await collectible.totalSupplyByType(4), '3');
            assert.equal(await collectible.totalSupplyByType(5), '3');
            assert.equal(await collectible.ownerTypes(alice), '5');
            assert.equal(await collectible.ownerValue(alice), '40');
            assert.equal(await collectible.balanceOf(alice), '5');
            assert.equal(await collectible.ownerTypes(bob), '5');
            assert.equal(await collectible.ownerValue(bob), '240');
            assert.equal(await collectible.balanceOf(bob), '6');
            assert.equal(await collectible.ownerTypes(carol), '3');
            assert.equal(await collectible.ownerValue(carol), '130');
            assert.equal(await collectible.balanceOf(carol), '5');
            assert.equal(await collectible.ownerTypes(dave), '2');
            assert.equal(await collectible.ownerValue(dave), '0');
            assert.equal(await collectible.balanceOf(dave), '3');

            assert.equal(await collectible.balanceOfOwnerByType(alice, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 1), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 2), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 3), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(alice, 5), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 0), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 1), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 3), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(bob, 5), '2');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 0), '3');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 1), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 2), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 4), '1');
            assert.equal(await collectible.balanceOfOwnerByType(carol, 5), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 0), '0');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 1), '2');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 2), '1');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 3), '0');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 4), '0');
            assert.equal(await collectible.balanceOfOwnerByType(dave, 5), '0');

            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 0, 0), '15');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 1, 0), '16');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 2, 0), '17');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 3, 0), '1');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(alice, 4, 0), '3');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 0, 0), '4');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 1, 0), '6');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 3, 0), '20');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 4, 0), '19');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 5, 0), '8');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(bob, 5, 1), '18');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 0), '13');  // the last '0' replaces the first upon removal
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 1), '10');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 0, 2), '21');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 4, 0), '11');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(carol, 5, 0), '14');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 1, 0), '22');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 1, 1), '23');
            assert.equal(await collectible.tokenOfOwnerByTypeAndIndex(dave, 2, 0), '24');
            // 0, 4, 9, 10, 13 => 13, 4, 9, 10 => 13, 4, 9, 10, 15 => 13, 4, 15, 10, 21
            assert.equal(await collectible.tokenByTypeAndIndex(0, 0), '13');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 1), '4');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 2), '15');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 3), '10');
            assert.equal(await collectible.tokenByTypeAndIndex(0, 4), '21');
            // 5, 6 => 5, 6, 16 => 16, 6 => 16, 6, 22, 23
            assert.equal(await collectible.tokenByTypeAndIndex(1, 0), '16');
            assert.equal(await collectible.tokenByTypeAndIndex(1, 1), '6');
            assert.equal(await collectible.tokenByTypeAndIndex(1, 2), '22');
            assert.equal(await collectible.tokenByTypeAndIndex(1, 3), '23');
            // [] => 17, 24
            assert.equal(await collectible.tokenByTypeAndIndex(2, 0), '17');
            assert.equal(await collectible.tokenByTypeAndIndex(2, 1), '24');
            // 1, 2 => 1 => 1, 20
            assert.equal(await collectible.tokenByTypeAndIndex(3, 0), '1');
            assert.equal(await collectible.tokenByTypeAndIndex(3, 1), '20');
            // 3, 7, 11 => 3, 11 => 3, 11, 19
            assert.equal(await collectible.tokenByTypeAndIndex(4, 0), '3');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 1), '11');
            assert.equal(await collectible.tokenByTypeAndIndex(4, 2), '19');
            // 8, 12, 14 => 8, 12, 14, 18 => 8, 18, 14
            assert.equal(await collectible.tokenByTypeAndIndex(5, 0), '8');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 1), '18');
            assert.equal(await collectible.tokenByTypeAndIndex(5, 2), '14');

            assert.equal(await collectible.tokenType(1), '3');
            assert.equal(await collectible.tokenType(3), '4');
            assert.equal(await collectible.tokenType(4), '0');
            assert.equal(await collectible.tokenType(6), '1');
            assert.equal(await collectible.tokenType(8), '5');
            assert.equal(await collectible.tokenType(10), '0');
            assert.equal(await collectible.tokenType(11), '4');
            assert.equal(await collectible.tokenType(13), '0');
            assert.equal(await collectible.tokenType(14), '5');

            assert.equal(await collectible.tokenType(15), '0');
            assert.equal(await collectible.tokenType(16), '1');
            assert.equal(await collectible.tokenType(17), '2');
            assert.equal(await collectible.tokenType(18), '5');
            assert.equal(await collectible.tokenType(19), '4');
            assert.equal(await collectible.tokenType(20), '3');
            assert.equal(await collectible.tokenType(21), '0');
            assert.equal(await collectible.tokenType(22), '1');
            assert.equal(await collectible.tokenType(23), '1');
            assert.equal(await collectible.tokenType(24), '2');
          });

          it('exchange updates the listener', async () => {
            const { collectible } = this;
            const listener = await MockTokenCollectionListener.new();
            await collectible.setTokenCollectionListener(listener.address, { from:manager });

            // alice: burn own tokens
            let res = await collectible.exchange(alice, [0, 2], [0, 1, 2], { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:alice, ownerBalance:'5', ownerValue:'40' });

            // bob: burned by minter, who has blanket approval
            await collectible.setApprovalForAll(minter, true, { from:bob });
            res = await collectible.exchange(bob, [5, 7], [5, 4, 3], { from:minter });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:bob, ownerBalance:'6', ownerValue:'240' });

            // carol: burned by various people with specific token approval and minting
            await collectible.approve(alice, 9, { from:carol });
            await collectible.approve(minter, 12, { from:carol });
            res = await collectible.exchange(carol, [9], [], { from:alice });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'5', ownerValue:'230' });
            res = await collectible.exchange(carol, [12], [0], { from:minter });
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:carol, ownerBalance:'5', ownerValue:'130' });
            res = await collectible.exchange(dave, [], [1, 1, 2]);
            await expectEvent.inTransaction(res.tx, listener, 'CollectionChanged', { owner:dave, ownerBalance:'3', ownerValue:'0' });
          });
        });
      });
    });
  });
