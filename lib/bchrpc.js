/* based on Vin Armani's https://github.com/vinarmani/slpswap-client  sources */

const { GrpcClient } = require('grpc-bchrpc-node');
const reverse = require('buffer-reverse');
const Bitcore = require('bitcore-lib-cash');
const Transaction = Bitcore.Transaction;
const UnspentOutput = Transaction.UnspentOutput;
const Script = Bitcore.Script;

class BCHRPC {
  constructor(rpcEndpoint) {
    this.rpcEndpoint = rpcEndpoint;
    this.grpc = new GrpcClient({ url: this.rpcEndpoint });
  }

  async getUtxosByAddress(address) {
    const utxos = await this.grpc.getAddressUtxos({
      address: address,
      includeMempool: true,
      includeTokenMetadata: true,
    });
    const outs = utxos.toObject().outputsList.map((out) => {
      const outHashBuffer = Buffer.from(out.outpoint.hash, 'base64');
      out.outpoint.hash = reverse(outHashBuffer).toString('hex');
      const pubKeyScriptBuf = Buffer.from(out.pubkeyScript, 'base64');
      out.pubkeyScript = pubKeyScriptBuf.toString('hex');
      return out;
    });
    return outs;
  }

  async getTokenUtxosByAddress(tokenId, address) {
    const rawUtxos = await this.getUtxosByAddress(address);
    const response = {
      total: 0, // total amount of tokens
      utxos: [],
    };
    for (let i = 0; i < rawUtxos.length; i++) {
      const outpoint = rawUtxos[i].outpoint;
      const fullUtxo = await this.getUtxo(outpoint.hash, outpoint.index);
      if (fullUtxo.slpToken && fullUtxo.slpToken.tokenId === tokenId) {
        const scriptPubKey = Script.fromHex(fullUtxo.pubkeyScript);
        const utxo = new UnspentOutput({
          txid: fullUtxo.outpoint.hash,
          vout: fullUtxo.outpoint.index,
          address: scriptPubKey.toAddress(),
          scriptPubKey: scriptPubKey,
          satoshis: fullUtxo.value,
        });
        response.utxos.push(utxo);
        response.total += parseInt(fullUtxo.slpToken.amount);
      }
    }
    return response;
  }

  async getUtxo(txhash, vout, includeTokenMetadata = true) {
    const utxoBuf = await this.grpc.getUnspentOutput({
      hash: txhash,
      vout: vout,
      reversedHashOrder: true,
      includeMempool: true,
      includeTokenMetadata: includeTokenMetadata,
    });
    const utxo = utxoBuf.toObject();
    if (utxo.outpoint) {
      const outHashBuffer = Buffer.from(utxo.outpoint.hash, 'base64');
      utxo.outpoint.hash = reverse(outHashBuffer).toString('hex');
      const pubKeyScriptBuf = Buffer.from(utxo.pubkeyScript, 'base64');
      utxo.pubkeyScript = pubKeyScriptBuf.toString('hex');
      const tx = await this.getTransaction(utxo.outpoint.hash);

      // Get SLP Info
      const slpToken = tx.transaction.outputsList[utxo.outpoint.index].slpToken;
      if (slpToken) {
        utxo.tokenMetadata = tx.tokenMetadata;
        const tokenIdBuf = Buffer.from(slpToken.tokenId, 'base64');
        slpToken.tokenId = tokenIdBuf.toString('hex');
        // Set tokenMetadata
        const tokenTxType = `type${slpToken.tokenType}`;
        utxo.tokenMetadata = {
          ...utxo.tokenMetadata,
          ...utxo.tokenMetadata[tokenTxType],
        };
        utxo.tokenMetadata.tokenId = slpToken.tokenId;
        utxo.tokenMetadata.tokenTicker =
          utxo.tokenMetadata.v1Fungible.tokenTicker;
        utxo.tokenMetadata.tokenName = utxo.tokenMetadata.v1Fungible.tokenName;
        utxo.tokenMetadata.tokenDocumentUrl =
          utxo.tokenMetadata.v1Fungible.tokenDocumentUrl;
        utxo.tokenMetadata.tokenDocumentHash =
          utxo.tokenMetadata.v1Fungible.tokenDocumentHash;
        utxo.slpToken = slpToken;
        delete utxo.tokenMetadata[tokenTxType];
        delete utxo.tokenMetadata.tokenType;
        delete utxo.tokenMetadata.v1Fungible;
        delete utxo.tokenMetadata.v1Nft1Group;
        delete utxo.tokenMetadata.v1Nft1Child;
      }
    }
    return utxo;
  }

  async getTransaction(txhash) {
    const txBuf = await this.grpc.getTransaction({
      hash: txhash,
      reversedHashOrder: true,
      includeTokenMetadata: true,
    });
    return txBuf.toObject();
  }

  async checkSlpTransaction(txhash) {
    const slpCheckBuf = await this.grpc.checkSlpTransaction({
      txnHex: txhash,
    });
    return slpCheckBuf.toObject();
  }

  async parseSlpOpReturn(scriptBuf) {
    const parsedOpReturnBuf = await this.grpc.getParsedSlpScript(scriptBuf);
    const res = parsedOpReturnBuf.toObject();
    if (res.tokenId) {
      const tokenIdBuf = Buffer.from(res.tokenId, 'base64');
      res.tokenId = tokenIdBuf.toString('hex');
      if (res.slpAction === 6) res.sendOutputs = res.v1Send.amountsList;
      else if (res.slpAction === 5) res.sendOutputs = res.v1Mint.amountsList;
    }
    return res;
  }

  async broadcastTransaction(rawTxHex, checkValidSlp = true) {
    const res = await this.grpc.submitTransaction({
      txnHex: rawTxHex,
      skipSlpValidityChecks: !checkValidSlp,
    });
    const resObj = res.toObject();
    if (resObj.hash) {
      const outHashBuf = Buffer.from(resObj.hash, 'base64');
      resObj.hash = reverse(outHashBuf).toString('hex');
    }
    return resObj;
  }
}

module.exports = BCHRPC;
