# Simple SLP Swap

The project started as a repackaging of Vin Armani's [slpswap-client](https://github.com/vinarmani/slpswap-client) project.

This is the CLI version of the project. It depends from the non-broswer version of [BCH gRPC library](https://github.com/simpleledgerinc/grpc-bchrpc-node/).

Changes from the original:

- Original monolithic exchange code split
- Some common functions moved to separate module (Utils etc.)
- Command line arguments removed from the main code

## Usage

* Installation

```sh
git clone https://github.com/zh/slpswap-node
cd slpswap-node
npm install
npm link slpswap-node
```

[npm package](https://www.npmjs.com/package/slpswap-node) for easy include is also available.

* Using in projects

```js
const SLPSwap = require('slpswap-node');

const swapConfig = {
  to: 'tokens receiver SLP address',
  wif: 'tokens sender private key',
  amount: 'send tokens amount',
  send: 'send tokens token ID',
  receive: 'receive tokens token ID',
  postage: 'use PostOffice protocol (true/false)',
};

const slpSwap = new SLPSwap();
const result = await slpSwap.exchange(swapConfig);

```

* CLI SLP swap exchange

result should be same as the original project

```sh
git clone https://github.com/zh/slpswap-node
cd slpswap-node
npm install

node ./examples/exchange_tokens.js -h
Options:
      --version  Show version number                                   [boolean]
  -t, --to       send token to that address                             [string]
  -w, --wif      token sender private key                               [string]
  -s, --send     Send tokens                                            [string]
  -r, --receive  Receive tokens                                         [string]
  -a, --amount   Amount of tokens to send                               [string]
  -p, --postage  Use postage protocol (pay with tokens)
                                                      [boolean] [default: false]
  -h, --help     Show help                                             [boolean]

node ./examples/exchange_tokens.js ...some params...
```
See [examples directory](./example/) for more code usage examples.

## Disclaimer

THIS WALLET IS CONSIDERED [ALPHA SOFTWARE](https://en.wikipedia.org/wiki/Software_release_life_cycle#Alpha). USE AT YOUR OWN RISK! WE ASSUME NO RESPONSIBILITY NOR LIABILITY IF THERE IS A BUG IN THIS IMPLEMENTATION.
