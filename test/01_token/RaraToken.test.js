const { expectRevert } = require('@openzeppelin/test-helpers');
const RaraToken = artifacts.require('RaraToken');

contract('RaraToken', ([alice, bob, carol]) => {
    const MINTER_ROLE = web3.utils.soliditySha3('MINTER_ROLE');

    beforeEach(async () => {
        this.rara = await RaraToken.new({ from: alice });
    });

    it('should have correct name and symbol and decimal', async () => {
        const name = await this.rara.name();
        const symbol = await this.rara.symbol();
        const decimals = await this.rara.decimals();
        assert.equal(name.valueOf(), 'Rara Token');
        assert.equal(symbol.valueOf(), 'RARA');
        assert.equal(decimals.valueOf(), '18');
    });

    it('should only allow minter to mint token', async () => {
        await this.rara.mint(alice, '100', { from: alice });
        await this.rara.mint(bob, '1000', { from: alice });
        await expectRevert(
            this.rara.mint(carol, '1000', { from: bob }),
            "ERC20PresetMinterPauser: must have minter role to mint",
        );
        const totalSupply = await this.rara.totalSupply();
        const aliceBal = await this.rara.balanceOf(alice);
        const bobBal = await this.rara.balanceOf(bob);
        const carolBal = await this.rara.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '100');
        assert.equal(bobBal.valueOf(), '1000');
        assert.equal(carolBal.valueOf(), '0');
    });

    it('should supply token transfers properly', async () => {
        await this.rara.mint(alice, '100', { from: alice });
        await this.rara.mint(bob, '1000', { from: alice });
        await this.rara.transfer(carol, '10', { from: alice });
        await this.rara.transfer(carol, '100', { from: bob });
        const totalSupply = await this.rara.totalSupply();
        const aliceBal = await this.rara.balanceOf(alice);
        const bobBal = await this.rara.balanceOf(bob);
        const carolBal = await this.rara.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '90');
        assert.equal(bobBal.valueOf(), '900');
        assert.equal(carolBal.valueOf(), '110');
    });

    it('should fail if you try to do bad transfers', async () => {
        await this.rara.mint(alice, '100', { from: alice });
        await expectRevert(
            this.rara.transfer(carol, '110', { from: alice }),
            'ERC20: transfer amount exceeds balance',
        );
        await expectRevert(
            this.rara.transfer(carol, '1', { from: bob }),
            'ERC20: transfer amount exceeds balance',
        );
    });
  });
