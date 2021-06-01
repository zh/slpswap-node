const SLPSwap = require('../lib');

const slpAddress = 'simpleledger:qp38l8kzm5gtd52478fsrgr08gt25v87dqmcnq0c7g';
const spiceTxID = '6b9231730684cecf2d66e3f17b9982b26443af0379fa635ee8ba25c57cdca6f0';
const spiceOutput = 1

async function bchrpcTests() {
  try {
    const slpSwap = new SLPSwap();
    const utxos = await slpSwap.bchrpc.getUtxosByAddress(slpAddress);
    console.log(`utxos: ${JSON.stringify(utxos, null, 2)}`);
    const slpUtxo = await slpSwap.bchrpc.getUtxo(spiceTxID, spiceOutput);
    console.log(`spice utxo: ${JSON.stringify(slpUtxo, null, 2)}`);
  } catch (error) {
    console.error('error in bchdTests: ', error);
  }
}

bchrpcTests();
