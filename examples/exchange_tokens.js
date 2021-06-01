const yargs = require('yargs');

const SLPSwap = require('../lib');

const spiceTokenId =
  '4de69e374a8ed21cbddd47f2338cc0f479dc58daa2bbe11cd604ca488eca0ddf'; // SPICE
const honkTokenId =
  '7f8889682d57369ed0e32336f8b7e0ffec625a35cca183f4e81fde4e71a538a1'; // HONK

const argv = yargs
  .option('to', {
    alias: 't',
    description: 'send token to that address',
    type: 'string',
  })
  .option('wif', {
    alias: 'w',
    description: 'token sender private key',
    type: 'string',
  })
  .option('send', {
    alias: 's',
    description: 'Send tokens',
    type: 'string',
  })
  .option('receive', {
    alias: 'r',
    description: 'Receive tokens',
    type: 'string',
  })
  .option('amount', {
    alias: 'a',
    description: 'Amount of tokens to send',
    type: 'string',
  })
  .option('postage', {
    alias: 'p',
    description: 'Use postage protocol (pay with tokens)',
    type: 'boolean',
    default: false,
  })
  .help()
  .alias('help', 'h').argv;

if (!argv.to) {
  console.error('[Error] Please provide tokens receiver address');
  process.exit(99);
}

if (!argv.wif) {
  console.error('[Error] Please provide tokens sender private key (WIF)');
  process.exit(99);
}

if (!argv.amount) {
  console.error('[Error] Please provide tokens amount to send');
  process.exit(99);
}

const sendTokenId = argv.send ? argv.send : spiceTokenId;
const receiveTokenId = argv.receive ? argv.receive : honkTokenId;

async function exchangeTokens() {
  try {
    const swapConfig = {
      to: argv.to,
      wif: argv.wif,
      amount: argv.amount,
      send: sendTokenId,
      receive: receiveTokenId,
      postage: argv.postage,
    };
    const slpSwap = new SLPSwap();
    const result = await slpSwap.exchange(swapConfig);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('error in exchangeTokens: ', error);
  }
}

exchangeTokens();
