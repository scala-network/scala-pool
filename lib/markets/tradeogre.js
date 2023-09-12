const apiInterfaces = require('./apiInterfaces.js');
var logSystem = 'markets/altex';
require('./exceptionWriter.js')(logSystem);


exports.getExchangeMarkets = async function(){
	const response = await apiInterfaces.promise.jsonHttpRequest('tradeogre.com', 443, '','/api/v1/markets');

    if (!response ) return Promise.reject('No market informations');

    var data = {};
    const rl = response.length;
    for (let i = 0;i<rl;i++){
        const market = response[i];
        const o = Object.entries(market);
        const ticker = o[0][0];
        const tickerParts = ticker.split('-');
        var target = tickerParts[1];
        var symbol = tickerParts[0];

        data[symbol][target] = price;
    } 
    

    return Promise.resolve(data);
}
https://tradeogre.com
exports.getExchangePrice = async function(base, target){
    const response = await apiInterfaces.promise.jsonHttpRequest('tradeogre.com', 443, '','/api/v1/ticker/'+base +'-' + target);///XLA-LTC);

    if (!response || !response.success) return Promise.reject('No market informations');

    return Promise.resolve(response.price);
}