const axios = require('axios');

class Utils {
  constructor(ratesEndpoint, postageEndpoint) {
    this.postageEndpoint = postageEndpoint;
    this.ratesEndpoint = ratesEndpoint;
  }

  async getAllRates(postage = true) {
    try {
      const rateEndpoint = postage ? this.postageEndpoint : this.ratesEndpoint;
      const result = await axios.get(rateEndpoint);
      return result.data ? result.data : {};
    } catch (error) {
      console.error('Error in utils.getAllRates():', error);
      throw new Error('Rates not available');
    }
  }

  async ratesPerToken(tokenId, postage = true, allRates = null) {
    try {
      const ratesObj = allRates ? allRates : await this.getAllRates(postage);
      const tokenObj = postage ? ratesObj.stamps : ratesObj.tokens;
      const useTokenRateObj = tokenObj.find((t) => t.tokenId === tokenId);
      if (!useTokenRateObj)
        throw new Error(`Token ${tokenId} rates not available`);
      return useTokenRateObj;
    } catch (error) {
      console.error('Error in utils.ratesPerToken():', error);
      return undefined;
    }
  }
}

module.exports = Utils;
