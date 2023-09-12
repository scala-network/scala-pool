/* Stellite Nodejs Pool
 * Copyright StelliteCoin	<https://github.com/stellitecoin/cryptonote-stellite-pool>
 * Copyright Ahmyi			<https://github.com/ahmyi/cryptonote-stellite-pool>
 * Copyright Dvandal    	<https://github.com/dvandal/cryptonote-nodejs-pool>
 * Copyright Fancoder   	<https://github.com/fancoder/cryptonote-universal-pool>
 * Copyright zone117x		<https://github.com/zone117x/node-cryptonote-pool>
 *
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
 
/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Market Exchanges
 **/

// Load required modules
const apiInterfaces = require('./apiInterfaces.js');

// Initialize log system
const logSystem = 'market';
require('./exceptionWriter.js')(logSystem);

/**
 * Get market prices
 **/
exports.get = function(exchange, tickers, callback) {
	if (!exchange) { 
		callback('No exchange specified', null);
		return;
	}
	exchange = exchange.toLowerCase();

	if (!tickers || tickers.length === 0) {
		callback('No tickers specified', null);
		return;
	}

	const marketPrices = [];
	const numTickers = tickers.length;
	const ticker_length = tickers.length;
	(async () =>{
		for (let i=0;i<ticker_length;i++) {
			const pairName = tickers[i];
			const pairParts = pairName.split('-');
			const base = pairParts[0] || null;
			const target = pairParts[1] || null;

			const price = await apiInterfaces.promises.getExchangePrice(exchange, base, target).catch(e => {
				log('error', logSystem, 'API request to %s has failed: %s', [exchange, e]);
			}) || 0;
			marketPrices[i] = { ticker: pairName, price: price, source: exchange };	
		}

		callback(marketPrices);
	})();
	
}

/**
 * Get Exchange Market Prices
 **/

const marketRequestsCache = {};

function getExchangeMarkets(exchange, callback) {
	callback = callback || function(){};
	if (!exchange) { 
		return callback('No exchange specified', null);
	}
	exchange = exchange.toLowerCase();

	// Return cache if available
	const cacheKey = exchange;
	const currentTimestamp = Date.now() / 1000;

	if (marketRequestsCache[cacheKey] && marketRequestsCache[cacheKey].ts > (currentTimestamp - 60)) {
		callback(null, marketRequestsCache[cacheKey].data);
		return ;
	}
	try{
		const marketExchanges = require('./markets/' + exchange);
		marketExchanges.getExchangeMarkets().then(data => {
			marketRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
			callback(null,data)
		});
	} catch (e) {
		log('error', logSystem, 'API request to %s has failed: %s', [exchange, e]);
		callback(e);
	}
}
const promises = {
	getExchangeMarkets: function(exchange) {
		return new Promise((resolve,reject) => {
			getExchangeMarkets(exchange, function(err,results){
				if(err) return reject(err);
				return resolve(results);
			});
		})
	},
	getExchangePrice: function(exchange,base, target) {
		return new Promise((resolve,reject) => {
			getExchangeMarkets(exchange,base, target, function(err,results){
				if(err) return reject(err);
				return resolve(results);
			});
		})
	}
}
exports.getExchangeMarkets = getExchangeMarkets;
exports.promises = promises;
/**
 * Get Exchange Market Price
 **/

const priceRequestsCache = {};

function getExchangePrice(exchange, base, target, callback) {
	callback = callback || function(){};

	if (!exchange) { 
		return callback('No exchange specified');
	}
	else if (!base) {
		return callback('No base specified');
	}
	else if (!target) {
		return callback('No target specified');
	}

	exchange = exchange.toLowerCase();
	base = base.toUpperCase();
	target = target.toUpperCase();

	// Return cache if available
	const cacheKey = exchange + '-' + base + '-' + target;
	const currentTimestamp = Date.now() / 1000;

	if (priceRequestsCache[cacheKey] && priceRequestsCache[cacheKey].ts > (currentTimestamp - 60)) {
		callback(null, priceRequestsCache[cacheKey].data);
		return;
	}
	try{
		const marketExchanges = require('./markets/' + exchange);
		marketExchanges.getExchangePrice(base, target).then(data => {
			priceRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
			callback(null,data)
		});
	} catch (e) {
		log('error', logSystem, 'API request to %s has failed: %s', [exchange, e]);
		callback(e);
	}
	
}

exports.getExchangePrice = getExchangePrice;
