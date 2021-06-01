DEFAULT_RPC_ENDPOINT = 'bchd.fountainhead.cash:443';
DEFAULT_RATES_ENDPOINT = 'https://api.slpswap.com/rates';
DEFAULT_POSTAGE_ENDPOINT = 'https://api.slpswap.com/postage';

const BCHRPC = require('./bchrpc');
const PayPro = require('./paypro');
const Utils = require('./utils');

const BN = require('bignumber.js');
const bchaddr = require('bchaddrjs-slp');
const Bitcore = require('bitcore-lib-cash');
const PrivateKey = Bitcore.PrivateKey;
const Transaction = Bitcore.Transaction;
const UnspentOutput = Transaction.UnspentOutput;
const Signature = Bitcore.crypto.Signature;
const Script = Bitcore.Script;

function BNToInt64BE(bn) {
  if (!bn.isInteger()) throw new Error('bn not an integer');

  if (!bn.isPositive()) throw new Error('bn not positive integer');

  const h = bn.toString(16);
  if (h.length > 16) throw new Error('bn outside of range');

  return Buffer.from(h.padStart(16, '0'), 'hex');
}

class SLPSwap {
  constructor(config) {
    // endpoint via config or environment
    // Try to retrieve the REST API URL from different sources.
    // 1. RPC
    if (config && config.rpcEndpoint && config.rpcEndpoint !== '')
      this.rpcEndpoint = config.rpcEndpoint;
    else if (process.env.RPC_ENDPOINT && process.env.RPC_ENDPOINT !== '')
      this.rpcEndpoint = process.env.RPC_ENDPOINT;
    else this.rpcEndpoint = DEFAULT_RPC_ENDPOINT;
    // 2. Rates
    if (config && config.ratesEndpoint && config.ratesEndpoint !== '')
      this.ratesEndpoint = config.ratesEndpoint;
    else if (process.env.RATES_ENDPOINT && process.env.RATES_ENDPOINT !== '')
      this.ratesEndpoint = process.env.RATES_ENDPOINT;
    else this.ratesEndpoint = DEFAULT_RATES_ENDPOINT;
    // 3. Postage Protocol
    if (config && config.postageEndpoint && config.postageEndpoint !== '')
      this.postageEndpoint = config.postageEndpoint;
    else if (
      process.env.POSTAGE_ENDPOINT &&
      process.env.POSTAGE_ENDPOINT !== ''
    )
      this.postageEndpoint = process.env.POSTAGE_ENDPOINT;
    else this.postageEndpoint = DEFAULT_POSTAGE_ENDPOINT;

    if (config && config.postage === true) this.usePostage = true;
    else if (process.env.USE_POSTAGE && process.env.USE_ENDPOINT === 'yes')
      this.usePostage = true;
    else this.usePostage = false;

    this.bchrpc = new BCHRPC(this.rpcEndpoint);
    this.paypro = new PayPro(this.postageEndpoint);
    this.utils = new Utils(this.ratesEndpoint, this.postageEndpoint);
  }

  // return JSON exchange request file:
  /* exchangeConfig = {
      "postage": 'use Post Protocol: true/false',
      "sendAmount": 'fixed with decimals amount: 500000000',
      "paid": 'send tokens buy rate: 0.00000203',
      "swap": 'receive tokens sell rate: 1.5e-9',
      "bch": 'BCH to pay (paid*amount): 0.00001015',
      "receiveAmount": 'Tokens to receive (bch/swap fixed with decimals): 6767'
    }
  */
  async exchangeRequest(swapConfig, allRates = null) {
    try {
      this.usePostage = swapConfig.postage;
      const ratesObj = allRates
        ? allRates
        : await this.utils.getAllRates(this.usePostage);

      // send tokens rate
      const sendRateObj = await this.utils.ratesPerToken(
        swapConfig.send,
        this.usePostage,
        ratesObj
      );
      if (!sendRateObj)
        throw new Error(`Sending invalid token '${swapConfig.send}'`);

      // receive tokens rate
      const receiveRateObj = this.usePostage
        ? undefined
        : await this.utils.ratesPerToken(
            swapConfig.receive,
            this.usePostage,
            ratesObj
          );
      if (!this.usePostage && !receiveRateObj) {
        throw new Error(
          `Token '${swapConfig.receive}' is not offered by this SLP swap provider`
        );
      }

      // token amounts to send and receive
      // Convert amount to base units
      const exchange = {
        postage: this.usePostage,
        sendAmount: swapConfig.amount * 10 ** sendRateObj.decimals,
        sendToken: sendRateObj,
        receiveToken: receiveRateObj,
      };
      if (!this.usePostage) {
        exchange.paid = Number(sendRateObj.buy);
        exchange.swap = Number(receiveRateObj.sell);
        exchange.bch = swapConfig.amount * exchange.paid;
        exchange.receiveAmount = (exchange.bch / exchange.swap).toFixed(
          receiveRateObj.decimals
        );
        if (
          !this.usePostage &&
          exchange.receiveAmount > receiveRateObj.available
        ) {
          throw new Error(
            `Not enough liquidity for ${sendRateObj.symbol} to ${receiveRateObj.symbol} swap`
          );
        }
      }
      // console.log(`exchange info: ${JSON.stringify(exchange, null, 2)}`);
      return exchange;
    } catch (error) {
      console.error('Error in exchangeRequest(): ', error);
      throw error;
    }
  }

  /*
    swapConfig = {
      to: 'receiver address: simpleledger:...',
      wif: 'private key: Lz.....',
      amount: 'token amount to send: 10, 20 etc.',
      send: 'send token ID: 4de69e...',
      receive: 'receive token ID: 4de69e...',
      postage: 'use Post Protocol: true/false',
    };
  */
  async exchange(swapConfig, allRates = null) {
    try {
      this.usePostage = swapConfig.postage;
      const priv = PrivateKey.fromString(swapConfig.wif);
      const addr = priv.toAddress();
      const cashAddress = addr.toString();
      const ratesObj = allRates
        ? allRates
        : await this.utils.getAllRates(this.usePostage);
      // console.log('rates: ', JSON.stringify(ratesObj, null, 2));
      const exchangeAddr = bchaddr.toCashAddress(ratesObj.address);

      const exchange = await this.exchangeRequest(swapConfig, allRates);
      // console.log(`exchange info: ${JSON.stringify(exchange, null, 2)}`);

      // Get send token UTXOs
      const tokenUtxos = await this.bchrpc.getTokenUtxosByAddress(
        swapConfig.send,
        cashAddress
      );
      const utxos = tokenUtxos.utxos;
      exchange.sendTotal = tokenUtxos.total;
      // console.log(`utxos: ${JSON.stringify(utxos, null, 2)}`);

      if (exchange.sendAmount > exchange.sendTotal) {
        throw new Error(
          `Insufficient send tokens amount. Only ${
            exchange.sendTotal * 10 ** (-1 * exchange.sendToken.decimals)
          } ${exchange.sendToken.symbol} available`
        );
      }

      // Construct payment transaction
      if (!this.usePostage) {
        console.log(
          `Swapping ${swapConfig.amount} ${exchange.sendToken.symbol} for ${exchange.receiveAmount} (minus any postage cost) ${exchange.receiveToken.symbol}...`
        );
      }
      const bnAmount = new BN(exchange.sendAmount); // Amount to send
      let tokenChange = new BN(exchange.sendTotal - exchange.sendAmount);
      const sendOpReturnArray = [
        'OP_RETURN',
        '534c5000',
        '01',
        '53454e44',
        swapConfig.send,
        BNToInt64BE(bnAmount).toString('hex'), // Amount to exchange
      ];
      // Add change output to OP_RETURN
      if (tokenChange.gt(0))
        sendOpReturnArray.push(BNToInt64BE(tokenChange).toString('hex'));
      if (this.usePostage) {
        // Add placeholder
        const placeHolder = new BN(1);
        sendOpReturnArray.push(BNToInt64BE(placeHolder).toString('hex'));
      }
      const sendOpReturnASM = sendOpReturnArray.join(' ');
      const opReturnScript = Script.fromASM(sendOpReturnASM);

      const sighash =
        Signature.SIGHASH_ALL |
        Signature.SIGHASH_FORKID |
        Signature.SIGHASH_ANYONECANPAY;

      const tx = new Transaction()
        .from(utxos)
        .addOutput(
          new Transaction.Output({
            script: opReturnScript,
            satoshis: 0,
          })
        )
        .to(
          this.usePostage ? bchaddr.toCashAddress(swapConfig.to) : exchangeAddr,
          546
        );
      // Add change output
      if (tokenChange.gt(0)) tx.to(addr, 546);
      // Add chain dust output and sign
      tx.to(exchangeAddr, 546);
      if (!this.usePostage) tx.sign([priv], sighash);
      let hex = tx.toString();

      if (this.usePostage) {
        // get tx size with signatures
        const byteCount = tx.toBuffer().length + 110 * tx.inputs.length;
        // Calculate number of Stamps Needed
        const outputSum = tx.outputs.reduce(function (accumulator, output) {
          return accumulator + output.satoshis;
        }, 0);
        // console.log('utxos', utxos)
        const inputSum = utxos.reduce(
          (total, input) => total + input.satoshis,
          0
        );
        const stampsNeeded = Math.ceil(
          (outputSum + byteCount - inputSum) / ratesObj.weight
        );
        console.log(`Paying for ${stampsNeeded} stamps`);
        const stampsBnAmount = new BN(stampsNeeded * exchange.sendToken.rate);
        tokenChange = tokenChange.minus(stampsBnAmount);
        console.log(
          `stamps amount: ${stampsBnAmount}, token change: ${tokenChange}`
        );
        if (tokenChange.lt(0))
          throw new Error('Not enough funds available to cover postage');

        const newSendOpReturnArray = sendOpReturnArray.slice(0, 6);
        newSendOpReturnArray.push(BNToInt64BE(tokenChange).toString('hex'));
        newSendOpReturnArray.push(BNToInt64BE(stampsBnAmount).toString('hex'));
        const newSendOpReturnASM = newSendOpReturnArray.join(' ');
        const newOpReturnScript = Script.fromASM(newSendOpReturnASM);
        tx.outputs[0] = new Transaction.Output({
          script: newOpReturnScript,
          satoshis: 0,
        });
        // sign
        tx.sign([priv], sighash);
        hex = tx.toString();
      }

      // Broadcast tx
      console.log('Sending to SLP Swap API:', hex);
      const txIds = await this.paypro.broadcastPostOfficeTx(
        hex,
        cashAddress,
        this.usePostage ? {} : { slpSwap: swapConfig.receive }
      );
      console.log(
        `Success! ${this.usePostage ? 'Postage' : 'Swap'} transaction IDs`,
        txIds
      );
      return txIds;
    } catch (error) {
      if (error.isAxiosError) {
        console.log('API Error: ', {
          status: error.response.status,
          message: error.response.data.toString('utf-8'),
        });
      } else {
        console.error(error);
      }
    }
  }
}

module.exports = SLPSwap;
