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

  // standardize network name
  if (network === 'bsc_test-fork') network = 'bsc_test';
  if (network === 'bsc-fork') network = 'bsc';

  const decimals = network == 'bsc_test' ? 8 : 18;
  const five = expandToDecimals(5, decimals).toString();
  const thirty = expandToDecimals(30, decimals).toString();

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

  // add Rara Card tokens
  let collection = { name:"Rara Card Collection", tokenTypes:[] };
  [
    { name:"Rara Card (Blue)", symbol:"RARA_CARD_0" },
    { name:"Rara Card (Bronze)", symbol:"RARA_CARD_1" },
    { name:"Rara Card (Silver)", symbol:"RARA_CARD_2" },
    { name:"Rara Card (Gold)", symbol:"RARA_CARD_3" },
    { name:"Rara Card (Diamond)", symbol:"RARA_CARD_4" },
  ].map(a => { return { ...a, value:five }; }).forEach(a => {
    collection.tokenTypes.push(tokens.length);
    tokens.push(a);
  });
  collections.push(collection);

  // add the Jamie Chua themed day items
  collection = { name:"Jamie Chua Doll House Living Room 1", tokenTypes:[] };
  [
    { symbol:"JC_0_0_0", name:"JC's Bespoke Zebra Stripes Rug" },
    { symbol:"JC_0_0_1", name:"Hermes Pillows" },
    { symbol:"JC_0_0_2", name:"Dior Ltd Edition BMX Bike" }
  ].map(a => { return { ...a, value:thirty }; }).forEach(a => {
    collection.tokenTypes.push(tokens.length);
    tokens.push(a);
  });
  collections.push(collection);

  collection = { name:"Jamie Chua Doll House Living Room 2", tokenTypes:[] };
  [
    { symbol:"JC_0_1_0", name:"JC Solid Timber Wood Table with Italian Visionnaire Chairs" },
    { symbol:"JC_0_1_1", name:"JC‘s Portrait" },
    { symbol:"JC_0_1_2", name:"JC's Table Flower Arrangement" }
  ].map(a => { return { ...a, value:thirty }; }).forEach(a => {
    collection.tokenTypes.push(tokens.length);
    tokens.push(a);
  });
  collections.push(collection);

  collection = { name:"Jamie Chua Doll House Garden", tokenTypes:[] };
  [
    { symbol:"JC_0_2_0", name:"JC's Pool Clam Shell Float" },
    { symbol:"JC_0_2_1", name:"JC's Organic Potted Plants" },
    { symbol:"JC_0_2_2", name:"JC's Garden Peacock Chair" }
  ].map(a => { return { ...a, value:thirty }; }).forEach(a => {
    collection.tokenTypes.push(tokens.length);
    tokens.push(a);
  });
  collections.push(collection);

  collection = { name:"Jamie Chua Doll House Kitchen", tokenTypes:[] };
  [
    { symbol:"JC_0_3_0", name:"JC's Lemon Tart" },
    { symbol:"JC_0_3_1", name:"JC's Homemaker Kitchen Appliances" }
  ].map(a => { return { ...a, value:thirty }; }).forEach(a => {
    collection.tokenTypes.push(tokens.length);
    tokens.push(a);
  });
  collections.push(collection);

  collection = { name:"Jamie Chua Doll House Bedroom", tokenTypes:[] };
  [
    { symbol:"JC_0_4_0", name:"JC's Silk Pillows" },
    { symbol:"JC_0_4_1", name:"JC's Glitter Vanity Table Mirror" },
    { symbol:"JC_0_4_2", name:"JC's Italian Visionnaire Table Lamp" }
  ].map(a => { return { ...a, value:thirty }; }).forEach(a => {
    collection.tokenTypes.push(tokens.length);
    tokens.push(a);
  });
  collections.push(collection);

  collection = { name:"Jamie Chua Doll House Wardrobe", tokenTypes:[] };
  [
    { symbol:"JC_0_5_0", name:"JC's Cartier Jewelry Collection" },
    { symbol:"JC_0_5_1", name:"JC's Manolo Blahnik High Heels" },
    { symbol:"JC_0_5_2", name:"Hermes Himalayan Diamond Kelly Bag" }
  ].map(a => { return { ...a, value:thirty }; }).forEach(a => {
    collection.tokenTypes.push(tokens.length);
    tokens.push(a);
  });
  collections.push(collection);

  // add the Jamie Chua doll house rooms
  collection = { name:"Jamie Chua Doll House Rooms", tokenTypes:[] };
  [
    { name:"Jamie's Doll House Living Room 1", symbol:"JC_0_0" },
    { name:"Jamie's Doll House Living Room 2", symbol:"JC_0_1" },
    { name:"Jamie's Doll House Garden", symbol:"JC_0_2" },
    { name:"Jamie's Doll House Kitchen", symbol:"JC_0_3" },
    { name:"Jamie's Doll House Bedroom", symbol:"JC_0_4" },
    { name:"Jamie's Doll House Wardrobe", symbol:"JC_0_5" },
  ].map(a => { return { ...a, value:thirty }; }).forEach(a => {
    collection.tokenTypes.push(tokens.length);
    tokens.push(a);
  });
  collections.push(collection);

  // add Jamie Chua Doll House
  tokens.push({ symbol:"JC_0", name:"Jamie's Doll House", value:0 });

  values['tokens'] = values['token'] = tokens.map((e, tokenType) => { return { tokenType, ...e } });
  values['collections'] = values['collection'] = collections;

  let jcStartTime = {
    bsc: 1627416000 + ONE_DAY_SECONDS * 2,   // approx 11 AM PDT 7/29
    bsc_test: 1627416000,  //  approx 11 AM PDD 7/27
    test: 1627416000
  }[network];

  const blindBoxes = [];
  function pushJamieChuaBlindBox(collectionName, supply) {
    const raraCardPrizes = findCollection("Rara Card").tokenTypes.map(tokenType => {
      return { tokenType, supply:1800 };
    });
    const jcCollection = findCollection(collectionName);
    const jamieChuaPrizes = jcCollection.tokenTypes.map(tokenType => {
      return { tokenType, supply };
    });
    blindBoxes.push({
      name: jcCollection.name,
      startTime: jcStartTime - MIN_15,
      endTime: (jcStartTime += ONE_DAY_SECONDS) + MIN_15,
      drawPrice: five,
      prizes: [
        ...jamieChuaPrizes,
        ...raraCardPrizes
      ].map((p, prizeId) => { return { ...p, prizeId }; })
    });
  }

  pushJamieChuaBlindBox("Living Room 1", 3000);
  pushJamieChuaBlindBox("Living Room 2", 3000);
  pushJamieChuaBlindBox("Garden", 2000);
  pushJamieChuaBlindBox("Kitchen", 3000);
  pushJamieChuaBlindBox("Bedroom", 1000);
  pushJamieChuaBlindBox("Wardrobe", 100);

  values['blindBoxes'] = values['blindBox'] = blindBoxes.map((b, saleId) => { return { ...b, saleId }; });

  const conversions = [];
  function pushJamieChuaConversion(name, tokenName) {
    if (!tokenName) tokenName = name;
    const collection = findCollection(name);
    const token = findToken(tokenName);
    conversions.push({
      name: collection.name,
      tokenTypesIn: collection.tokenTypes,
      tokenTypesOut: [token.tokenType]
    })
  }

  pushJamieChuaConversion("Doll House Living Room 1");
  pushJamieChuaConversion("Doll House Living Room 2");
  pushJamieChuaConversion("Doll House Garden");
  pushJamieChuaConversion("Doll House Kitchen");
  pushJamieChuaConversion("Doll House Bedroom");
  pushJamieChuaConversion("Doll House Wardrobe");
  pushJamieChuaConversion("Doll House Rooms", "JC_0");

  values['conversions'] = values['conversion'] = conversions.map((c, recipeId) => { return { ...c, recipeId } });

  return values;
}
