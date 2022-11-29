const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

module.exports = exports = ({ network, web3 }) => {
  function bn(val) {
      if (typeof val === 'object' && val !== null && 'valueOf' in val) {
          return bn(val.valueOf().toString());
      }
      if (typeof val === 'string' && val.includes(',')) {
          vals = val.split(',');
          arr = [];
          for (const v of vals) {
            arr.push(bn(v));
          }
          return arr;
      }
      return web3.utils.toBN(val);
  }

  function expandToDecimals(n, d) {
    return bn(n).mul(bn(10).pow(bn(d)));
  }

  const MIN_15 = 60 * 15; // 15 minutes
  const ONE_DAY_SECONDS = 86400;  // 60 * 60 * 24
  const ONE_WEEK_SECONDS = ONE_DAY_SECONDS * 7;

  const values = {};

  // remove extra name text
  network = network.replace('-fork', '');
  network = network.replace('_moralis', '').replace('moralis_', '');

  // standardize network name
  if (network === 'bsc_test-fork') network = 'bsc_test';
  if (network === 'bsc-fork') network = 'bsc';
  if (network === 'test-fork' || network === 'ganache-fork') network = 'test';

  const decimals = network == 'bsc_test' ? 8 : 18;
  const five = expandToDecimals(5, decimals).toString();
  const thirty = expandToDecimals(30, decimals).toString();
  const hundred = expandToDecimals(100, decimals).toString();
  const twentyFive = expandToDecimals(25, decimals).toString();
  const twoFifty = expandToDecimals(250, decimals).toString();

  const tokens = [];
  const collections = values['collections'] = values['collection'] = [];

  function findToken(str) {
    str = str.toLowerCase();
    let tokenType = tokens.findIndex(a => a.name.toLowerCase() == str)
    if (tokenType < 0) tokenType = tokens.findIndex(a => a.symbol.toLowerCase() == str);
    if (tokenType < 0) tokenType = tokens.findIndex(a => a.name.toLowerCase().includes(str));
    if (tokenType < 0) {
      throw new Error(`Couldn't find token ${str}`);
    }
    return { tokenType, ...tokens[tokenType] };
  }

  function findCollection(str) {
    str = str.toLowerCase();
    let collection = collections.find(a => a.name.toLowerCase() == str)
    if (!collection) collection = collections.find(a => a.name.toLowerCase().includes(str));
    if (!collection) {
      throw new Error(`Couldn't find collection ${str} in ${JSON.stringify(collections, null, 2)}`);
    }
    return collection;
  }

  // add initial set of animals and food
  // use 30-decimals for value to allow free inflation and deflation.
  let collection = { name:"Animals 1", tokenTypes:[] };
  [
    { name:"Raccoon Food", symbol:"AN_F_001_RACCOON", value:0 },
    { name:"Shiba Rice", symbol:"AN_F_002_SHIBA", value:0 },
    { name:"Zebra Flower", symbol:"AN_F_003_ZEBRA", value:0 },
    { name:"Raccoon", symbol:"AN_001_RACCOON", value:expandToDecimals(10, 30).toString() },
    { name:"Shiba", symbol:"AN_002_SHIBA", value:expandToDecimals(30, 30).toString() },
    { name:"Zebra", symbol:"AN_003_ZEBRA", value:expandToDecimals(100, 30).toString() },
  ].map(a => { return { ...a, value:five }; }).forEach(a => {
    collection.tokenTypes.push(tokens.length);
    tokens.push(a);
  });
  collections.push(collection);

  values['tokens'] = values['token'] = tokens.map((e, tokenType) => { return { tokenType, ...e } });
  values['collections'] = values['collection'] = collections;

  let gachaStartBlock = {
    bsc: 10000000,   // TODO: fill in
    bsc_test: 11396253,  //  approx 3:57 PM CDT Wednesday 8/11
    test: 11396253
  }[network];

  const games = [];
  // the main game. There are 5000 draws "per day", of which 1540 are internal.
  // That's
  games.push({
    name: "Public Animal Gacha Game 1",
    drawPrice: twoFifty,
    revealBlocks: 4,              // ~12 seconds
    prizeSupply: 3460,
    prizePeriodDuration: 86400,   // one day
    prizePeriodAnchorTime: 1643731200,   // approx 11 AM EDT 2/1/2022
    saleOpenTime: 0,              // TODO: open time
    saleCloseTime: 0,
    prizes: [
      { token: findToken("AN_F_001_RACCOON"), weight:61750 },
      { token: findToken("AN_F_002_SHIBA"), weight:7200 },
      { token: findToken("AN_F_003_ZEBRA"), weight:500 },
      { token: findToken("AN_001_RACCOON"), weight:6 },
      { token: findToken("AN_002_SHIBA"), weight:4 },
      { token: findToken("AN_003_ZEBRA"), weight:1 }
    ].map((a, prizeId) => {
      return {
        prizeId,
        name: a.token.name,
        tokenType: a.token.tokenType,
        weight: a.weight
      }
    })
  });

  games.push({
    name: "Internal Animal Gacha Game 1",
    drawPrice: twoFifty,
    revealBlocks: 4,              // ~12 seconds
    prizeSupply: 1540,
    prizePeriodDuration: 86400,   // one day
    prizePeriodAnchorTime: 1643731200,   // approx 11 AM EDT 2/1/2022
    saleOpenTime: 0,              // TODO: open time
    saleCloseTime: 0,
    prizes: [
      { token: findToken("AN_F_001_RACCOON"), weight:3250 },
      { token: findToken("AN_F_002_SHIBA"), weight:16800 },
      { token: findToken("AN_F_003_ZEBRA"), weight:9500 },
      { token: findToken("AN_001_RACCOON"), weight:545 },
      { token: findToken("AN_002_SHIBA"), weight:347 },
      { token: findToken("AN_003_ZEBRA"), weight:99 }
    ].map((a, prizeId) => {
      return {
        prizeId,
        name: a.token.name,
        tokenType: a.token.tokenType,
        weight: a.weight
      }
    })
  });

  values['games'] = values['game'] = games.map((b, gameId) => { return { ...b, gameId }; });

  const conversions = [];
  function pushFoodConversion(amount, foodTokenName, animalTokenName) {
    conversions.push({
      name: `${animalTokenName} Food Conversion`,
      tokenTypesIn: Array(amount).fill(findToken(foodTokenName).tokenType),
      tokenTypesOut: [findToken(animalTokenName).tokenType]
    })
  }

  pushFoodConversion(10, "AN_F_001_RACCOON", "AN_001_RACCOON");
  pushFoodConversion(10, "AN_F_002_SHIBA", "AN_002_SHIBA");
  pushFoodConversion(15, "AN_F_003_ZEBRA", "AN_003_ZEBRA");

  values['conversions'] = values['conversion'] = conversions.map((c, recipeId) => { return { ...c, recipeId } });

  const sales = [];
  const saleAnchorTime = 1643731200;   // TODO approx 11 AM EDT 2/1/2022;
  const saleOpenTime = 1629892800;   // TODO approx 8 AM EDT 8/25
  function pushResupplySale(token, supply, price, scale, scalar, exp) {
    const t = findToken(token)
    sales.push({
      name: `${t.name} snap-up`,
      tokenType: t.tokenType,
      supply: [supply, 86400, saleAnchorTime],
      openClose: [saleAnchorTime, 0],
      price,
      scale,
      scalar,
      exp,
      saleId: sales.length
    });
  }

  function pushOneTimeSale(token, supply, price, scale) {
    const t = findToken(token);
    sales.push({
      name: `${t.name} one-time`,
      tokenType: t.tokenType,
      supply: [supply, 0, 0],
      openClose: [saleOpenTime, 0],
      price,
      scale,
      scalar: [0, 1],
      exp: [0, 1],
      saleId: sales.length
    });
  }

  pushResupplySale("AN_F_001_RACCOON", 1850, 16, decimals, [1, 4], [1, 2]);
  pushResupplySale("AN_F_002_SHIBA", 420, 45, decimals, [10, 1], [1, 2]);
  pushResupplySale("AN_F_003_ZEBRA", 260, 100, decimals, [100, 1], [1, 2]);
  // pushOneTimeSale("AN_001_RACCOON", 2215, 100, decimals);  // TODO actual price
  // pushOneTimeSale("AN_002_SHIBA", 825, 200, decimals);  // TODO actual price
  // pushOneTimeSale("AN_003_ZEBRA", 230, 500, decimals);  // TODO actual price

  values['sales'] = values['sale'] = sales;

  return values;
}
