const SLPSwap = require('../lib');

const spiceTokenId =
  '4de69e374a8ed21cbddd47f2338cc0f479dc58daa2bbe11cd604ca488eca0ddf';

async function listRates() {
  try {
    const slpSwap = new SLPSwap();
    const postageRates = await slpSwap.utils.getAllRates();
    console.log(`postage rates: ${JSON.stringify(postageRates)}`);
    const swapRates = await slpSwap.utils.getAllRates(false);
    console.log(`swap rates: ${JSON.stringify(swapRates)}`);
    const spicePostageRates = await slpSwap.utils.ratesPerToken(
      spiceTokenId,
      true,
      postageRates
    );
    console.log(
      `postage rates for SPICE: ${JSON.stringify(spicePostageRates)}`
    );
    const spiceSwapRates = await slpSwap.utils.ratesPerToken(
      spiceTokenId,
      false,
      swapRates
    );
    console.log(`swap rates for SPICE: ${JSON.stringify(spiceSwapRates)}`);
  } catch (error) {
    console.error('error in listRates: ', error);
  }
}

listRates();
