# Uniswap V2 Area

Code from [SushiSwap](https://github.com/sushiswap/sushiswap/tree/f01b52e22cfc193c4653aee769606dd50fc07fc2) with the following modifications.

1. Change contract version to 0.8.0 and do the necessary patching.
2. Optionally mint 5% liquidity LP to a fee-collection address upon Add Liquidity
3. Optionally restrict factory creation of new swap pairs
4. Allow altered swap fees (1/10,000 increments) universally, or for specific users; e.g. to provide discounted fees for specific accounts.
