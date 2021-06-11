const MockDeflatingERC20 = artifacts.require('MockDeflatingERC20');
const MockERC20 = artifacts.require('MockERC20');
const MockWETH = artifacts.require('MockWETH');
const UniswapV2Pair = artifacts.require('UniswapV2Pair');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router02 = artifacts.require('UniswapV2Router02');
const MockUniswapV2SwapValuator = artifacts.require('MockUniswapV2SwapValuator');

const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');

const { MAX_UINT256 } = require('@openzeppelin/test-helpers').constants;
const { bn, expandTo18Decimals, getApprovalDigest, MINIMUM_LIQUIDITY } = require('../shared/utilities');

chai.use(solidity)

contract('UniswapV2Router02 (UniswapV2Router02 interface)', ([alice, bob, carol, minter]) => {
  beforeEach(async () => {
    // deploy tokens
    const tokenA = await MockERC20.new('TOKEN_A', 'A', expandTo18Decimals(10000));
    const tokenB = await MockERC20.new('TOKEN_B', 'B', expandTo18Decimals(10000));
    this.WETH = await MockWETH.new();
    this.WETHPartner = await MockERC20.new('WETH_PARTNER', 'WP', expandTo18Decimals(10000));

    // deploy factory
    this.factory = await UniswapV2Factory.new(minter);

    // deploy router
    this.router = await UniswapV2Router02.new(this.factory.address, this.WETH.address);

    // deploy and configure swap valuator
    this.valuator = await MockUniswapV2SwapValuator.new();
    this.valuator.setSwapRateDimi(this.router.address, 10000);
    this.valuator.setSwapRateDimi(alice, 9985);
    this.valuator.setSwapRateDimi(bob, 9973);
    this.factory.setSwapValuator(this.valuator.address,  { from:minter });

    // initialize
    await this.factory.createPair(tokenA.address, tokenB.address);
    const pairAddress = await this.factory.getPair(tokenA.address, tokenB.address);
    this.pair = await UniswapV2Pair.at(pairAddress);

    // order tokens
    const token0Address = await this.pair.token0();
    this.token0 = tokenA.address == token0Address ? tokenA : tokenB;
    this.token1 = tokenA.address == token0Address ? tokenB : tokenA;

    // WETH pair
    await this.factory.createPair(this.WETH.address, this.WETHPartner.address);
    const WETHPairAddress = await this.factory.getPair(this.WETH.address, this.WETHPartner.address);
    this.WETHPair = await UniswapV2Pair.at(WETHPairAddress);
  });

  context('Library functions', () => {
    it('quote', async () => {
      const { router } = this;

      expect(bn(await router.quote(bn(1), bn(100), bn(200)))).to.eq(bn(2))
      expect(bn(await router.quote(bn(2), bn(200), bn(100)))).to.eq(bn(1))
      expect(bn(await router.quote(expandTo18Decimals(1), expandTo18Decimals(5), expandTo18Decimals(10)))).to.eq(expandTo18Decimals(2));
      expect(bn(await router.quote(expandTo18Decimals(1), expandTo18Decimals(5), expandTo18Decimals(10), {  from:bob }))).to.eq(expandTo18Decimals(2));
      expect(bn(await router.quote(expandTo18Decimals(1), expandTo18Decimals(5), expandTo18Decimals(10), { from:carol }))).to.eq(expandTo18Decimals(2));
      await expect(router.quote(bn(0), bn(100), bn(200))).to.be.revertedWith(
        'UniswapV2Library: INSUFFICIENT_AMOUNT'
      )
      await expect(router.quote(bn(1), bn(0), bn(200))).to.be.revertedWith(
        'UniswapV2Library: INSUFFICIENT_LIQUIDITY'
      )
      await expect(router.quote(bn(1), bn(100), bn(0))).to.be.revertedWith(
        'UniswapV2Library: INSUFFICIENT_LIQUIDITY'
      )
    })

    it('getAmountOut', async () => {
      const { router } = this;
      expect(bn(await router.getAmountOut(bn(2), bn(100), bn(100)))).to.eq(bn(1))
      expect(bn(await router.getAmountOut(expandTo18Decimals(1), expandTo18Decimals(5), expandTo18Decimals(10)))).to.eq(bn('1664582812369759106'));
      expect(bn(await router.getAmountOut(expandTo18Decimals(1), expandTo18Decimals(5), expandTo18Decimals(10), {  from:bob }))).to.eq(bn('1662914978406949794'));
      expect(bn(await router.getAmountOut(expandTo18Decimals(1), expandTo18Decimals(5), expandTo18Decimals(10), { from:carol }))).to.eq(bn('1662497915624478906'));
      await expect(router.getAmountOut(bn(0), bn(100), bn(100))).to.be.revertedWith(
        'UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT'
      )
      await expect(router.getAmountOut(bn(2), bn(0), bn(100))).to.be.revertedWith(
        'UniswapV2Library: INSUFFICIENT_LIQUIDITY'
      )
      await expect(router.getAmountOut(bn(2), bn(100), bn(0))).to.be.revertedWith(
        'UniswapV2Library: INSUFFICIENT_LIQUIDITY'
      )
    })

    it('getAmountIn', async () => {
      const { router } = this;
      expect(bn(await router.getAmountIn(bn(1), bn(100), bn(100)))).to.eq(bn(2))
      expect(bn(await router.getAmountIn(expandTo18Decimals(1), expandTo18Decimals(5), expandTo18Decimals(10)))).to.eq(bn('556390140766705614'));
      expect(bn(await router.getAmountIn(expandTo18Decimals(1), expandTo18Decimals(5), expandTo18Decimals(10), {  from:bob }))).to.eq(bn('557059616520159988'));
      expect(bn(await router.getAmountIn(expandTo18Decimals(1), expandTo18Decimals(5), expandTo18Decimals(10), { from:carol }))).to.eq(bn('557227237267357629'));
      await expect(router.getAmountIn(bn(0), bn(100), bn(100))).to.be.revertedWith(
        'UniswapV2Library: INSUFFICIENT_OUTPUT_AMOUNT'
      )
      await expect(router.getAmountIn(bn(1), bn(0), bn(100))).to.be.revertedWith(
        'UniswapV2Library: INSUFFICIENT_LIQUIDITY'
      )
      await expect(router.getAmountIn(bn(1), bn(100), bn(0))).to.be.revertedWith(
        'UniswapV2Library: INSUFFICIENT_LIQUIDITY'
      )
    })

    it('getAmountsOut', async () => {
      const { router, token0, token1 } = this;
      await token0.approve(router.address, MAX_UINT256)
      await token1.approve(router.address, MAX_UINT256)
      await router.addLiquidity(
        token0.address,
        token1.address,
        bn(10000),
        bn(10000),
        0,
        0,
        carol,
        MAX_UINT256
      )

      await expect(router.getAmountsOut(bn(2), [token0.address])).to.be.revertedWith(
        'UniswapV2Library: INVALID_PATH'
      )
      const path = [token0.address, token1.address]
      expect(bn(await router.getAmountsOut(bn(2), path))).to.deep.eq([bn(2), bn(1)])
    })

    it('getAmountsOut with fees', async () => {
      const { router, token0, token1 } = this;
      await token0.approve(router.address, MAX_UINT256)
      await token1.approve(router.address, MAX_UINT256)
      await router.addLiquidity(
        token0.address,
        token1.address,
        expandTo18Decimals(5),
        expandTo18Decimals(10),
        0,
        0,
        carol,
        MAX_UINT256
      )

      const path = [token0.address, token1.address]
      expect(bn(await router.getAmountsOut(expandTo18Decimals(1), path))).to.deep.eq([
        expandTo18Decimals(1),
        bn('1664582812369759106')
      ]);
      expect(bn(await router.getAmountsOut(expandTo18Decimals(1), path, { from:bob }))).to.deep.eq([
        expandTo18Decimals(1),
        bn('1662914978406949794')
      ]);
      expect(bn(await router.getAmountsOut(expandTo18Decimals(1), path, { from:carol }))).to.deep.eq([
        expandTo18Decimals(1),
        bn('1662497915624478906')
      ]);
    })

    it('getAmountsIn', async () => {
      const { router, token0, token1 } = this;
      await token0.approve(router.address, MAX_UINT256)
      await token1.approve(router.address, MAX_UINT256)
      await router.addLiquidity(
        token0.address,
        token1.address,
        bn(10000),
        bn(10000),
        0,
        0,
        carol,
        MAX_UINT256
      )

      await expect(router.getAmountsIn(bn(1), [token0.address])).to.be.revertedWith(
        'UniswapV2Library: INVALID_PATH'
      )
      const path = [token0.address, token1.address]
      expect(bn(await router.getAmountsIn(bn(1), path))).to.deep.eq([bn(2), bn(1)])
    })

    it('getAmountsIn with fees', async () => {
      const { router, token0, token1 } = this;
      await token0.approve(router.address, MAX_UINT256)
      await token1.approve(router.address, MAX_UINT256)
      await router.addLiquidity(
        token0.address,
        token1.address,
        expandTo18Decimals(5),
        expandTo18Decimals(10),
        0,
        0,
        carol,
        MAX_UINT256
      )

      const path = [token0.address, token1.address]
      expect(bn(await router.getAmountsIn(expandTo18Decimals(1), path))).to.deep.eq([
        bn('556390140766705614'),
        expandTo18Decimals(1)
      ]);
      expect(bn(await router.getAmountsIn(expandTo18Decimals(1), path, { from:bob }))).to.deep.eq([
        bn('557059616520159988'),
        expandTo18Decimals(1)
      ]);
      expect(bn(await router.getAmountsIn(expandTo18Decimals(1), path, { from:carol }))).to.deep.eq([
        bn('557227237267357629'),
        expandTo18Decimals(1)
      ]);
    })
  });

  context('Fee-on-transfer functions', () => {
    beforeEach(async () => {
        // create DTT
        this.DTT = await MockDeflatingERC20.new(expandTo18Decimals(10000));

        // make a DTT<>WETH pair
        await this.factory.createPair(this.DTT.address, this.WETH.address)
        const pairAddress = await this.factory.getPair(this.DTT.address, this.WETH.address)
        this.pair = await UniswapV2Pair.at(pairAddress);

        // create a wallet account
        this.wallet = await web3.eth.accounts.create();
    });

    afterEach(async () => {
        expect(bn(await web3.eth.getBalance(this.router.address))).to.eq(bn(0));
    });

    const addLiquidity = async (DTTAmount, WETHAmount) => {
      const { router, DTT, wallet } = this;
      await DTT.approve(router.address, MAX_UINT256)
      await router.addLiquidityETH(DTT.address, DTTAmount, DTTAmount, WETHAmount, alice, MAX_UINT256, {
        value: WETHAmount
      });
    };

    it('removeLiquidityETHSupportingFeeOnTransferTokens', async () => {
      const { DTT, WETH, pair, router, wallet } = this;
      const DTTAmount = expandTo18Decimals(1)
      const ETHAmount = expandTo18Decimals(4)
      await addLiquidity(DTTAmount, ETHAmount)

      const DTTInPair = bn(await DTT.balanceOf(pair.address))
      const WETHInPair = bn(await WETH.balanceOf(pair.address))
      const liquidity = bn(await pair.balanceOf(alice))
      const totalSupply = bn(await pair.totalSupply())
      const NaiveDTTExpected = DTTInPair.mul(liquidity).div(totalSupply)
      const WETHExpected = WETHInPair.mul(liquidity).div(totalSupply)

      await pair.approve(router.address, MAX_UINT256)
      await router.removeLiquidityETHSupportingFeeOnTransferTokens(
        DTT.address,
        liquidity,
        NaiveDTTExpected,
        WETHExpected,
        carol,
        MAX_UINT256
      )
    });

    /* TODO: add necessary libraries to allow permit signing.
    it('removeLiquidityETHWithPermitSupportingFeeOnTransferTokens', async () => {
      const { DTT, WETH, pair, router, wallet } = this;
      const DTTAmount = expandTo18Decimals(1)
        .mul(bn(100))
        .div(bn(99))
      const ETHAmount = expandTo18Decimals(4)
      await addLiquidity(DTTAmount, ETHAmount)

      const expectedLiquidity = expandTo18Decimals(2)

      const nonce = parseInt(await pair.nonces(wallet.address), 10);
      const digest = await getApprovalDigest(
        pair,
        { owner: wallet.address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
        nonce,
        MAX_UINT256
      )
      const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

      const DTTInPair = await DTT.balanceOf(pair.address)
      const WETHInPair = await WETH.balanceOf(pair.address)
      const liquidity = await pair.balanceOf(alice)
      const totalSupply = await pair.totalSupply()
      const NaiveDTTExpected = DTTInPair.mul(liquidity).div(totalSupply)
      const WETHExpected = WETHInPair.mul(liquidity).div(totalSupply)

      await pair.approve(router.address, MAX_UINT256)
      await router.removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
        DTT.address,
        liquidity,
        NaiveDTTExpected,
        WETHExpected,
        wallet.address,
        MAX_UINT256,
        false,
        v,
        r,
        s
      )
    })
    */

    context('swapExactTokensForTokensSupportingFeeOnTransferTokens', () => {
      const DTTAmount = expandTo18Decimals(5)
        .mul(bn(100))
        .div(bn(99))
      const ETHAmount = expandTo18Decimals(10)
      const amountIn = expandTo18Decimals(1)

      beforeEach(async () => {
        await addLiquidity(DTTAmount, ETHAmount)
      })

      it('DTT -> WETH', async () => {
        const { router, DTT, WETH } = this;
        await DTT.approve(router.address, MAX_UINT256)

        await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
          amountIn,
          0,
          [DTT.address, WETH.address],
          carol,
          MAX_UINT256
        )
      })

      // WETH -> DTT
      it('WETH -> DTT', async () => {
        const { router, DTT, WETH } = this;
        await WETH.deposit({ value: amountIn }) // mint WETH
        await WETH.approve(router.address, MAX_UINT256)

        await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
          amountIn,
          0,
          [WETH.address, DTT.address],
          carol,
          MAX_UINT256
        )
      })
    });

    // ETH -> DTT
    it('swapExactETHForTokensSupportingFeeOnTransferTokens', async () => {
      const { router, DTT, WETH } = this;
      const DTTAmount = expandTo18Decimals(10)
        .mul(bn(100))
        .div(bn(99))
      const ETHAmount = expandTo18Decimals(5)
      const swapAmount = expandTo18Decimals(1)
      await addLiquidity(DTTAmount, ETHAmount)

      await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        0,
        [WETH.address, DTT.address],
        carol,
        MAX_UINT256,
        {
          value: swapAmount
        }
      )
    })

    // DTT -> ETH
    it('swapExactTokensForETHSupportingFeeOnTransferTokens', async () => {
      const { router, DTT, WETH } = this;
      const DTTAmount = expandTo18Decimals(5)
        .mul(bn(100))
        .div(bn(99))
      const ETHAmount = expandTo18Decimals(10)
      const swapAmount = expandTo18Decimals(1)

      await addLiquidity(DTTAmount, ETHAmount)
      await DTT.approve(router.address, MAX_UINT256)

      await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
        swapAmount,
        0,
        [DTT.address, WETH.address],
        carol,
        MAX_UINT256
      )
    })
  })

  context('Fee-on-Transfer tokens: reloaded', () => {
    beforeEach(async () => {

      // create DTT
      this.DTT = await MockDeflatingERC20.new(expandTo18Decimals(10000));
      this.DTT2 = await MockDeflatingERC20.new(expandTo18Decimals(10000));

      // make a DTT<>DTT2 pair
      await this.factory.createPair(this.DTT.address, this.DTT2.address)
      const pairAddress = await this.factory.getPair(this.DTT.address, this.DTT2.address)
      this.pair = await UniswapV2Pair.at(pairAddress);
    })

    afterEach(async () => {
      expect(bn(await web3.eth.getBalance(this.router.address))).to.eq(bn(0));
    })

    const addLiquidity = async (DTTAmount, DTT2Amount) => {
      const { router, DTT, DTT2 } = this;
      await DTT.approve(router.address, MAX_UINT256)
      await DTT2.approve(router.address, MAX_UINT256)
      await router.addLiquidity(
        DTT.address,
        DTT2.address,
        DTTAmount,
        DTT2Amount,
        DTTAmount,
        DTT2Amount,
        alice,
        MAX_UINT256
      )
    }

    context('swapExactTokensForTokensSupportingFeeOnTransferTokens', () => {
      const DTTAmount = expandTo18Decimals(5)
        .mul(bn(100))
        .div(bn(99))
      const DTT2Amount = expandTo18Decimals(5)
      const amountIn = expandTo18Decimals(1)

      beforeEach(async () => {
        await addLiquidity(DTTAmount, DTT2Amount)
      });

      it('DTT -> DTT2', async () => {
        const { DTT, DTT2, router } = this;
        await DTT.approve(router.address, MAX_UINT256)

        await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
          amountIn,
          0,
          [DTT.address, DTT2.address],
          carol,
          MAX_UINT256
        )
      });
    })
  })
});
