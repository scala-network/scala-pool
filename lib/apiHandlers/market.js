const market = require('../market.js');


/**
 * Get market exchange prices
 **/
module.exports = (urlParts, sendData) => {
    var tickers = urlParts.query["tickers[]"] || urlParts.query.tickers;
    
    if (!tickers || tickers === undefined) {
        return sendData(response,{error: 'No tickers specified.'});
    }

    var exchange = urlParts.query.exchange || config.prices.source;
    
    if (!exchange || exchange === undefined) {
        return sendData({error: 'No exchange specified.'});
    }

    // Get market prices
    market.get(exchange, tickers, function(data) {
        sendData(data);
    });
};