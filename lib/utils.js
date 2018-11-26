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
 
var crypto = require('crypto');

var dateFormat = require('dateformat');
exports.dateFormat = dateFormat;

var cnUtil = require('cryptonote-util');
exports.cnUtil = cnUtil;

const validAddress = {
	main:new RegExp("^Se+([1-9A-HJ-NP-Za-km-z]{95})$"),
	withPaymentId: new RegExp("^Se+([1-9A-HJ-NP-Za-km-z]{95})+\.+([0-9a-fA-F]{16}|[0-9a-fA-F]{64})$"),
	integratedAddress: new RegExp("^SE+([1-9A-HJ-NP-Za-km-z]{107})$"),
	paymentId: new RegExp("^([0-9a-fA-F]{16}|[0-9a-fA-F]{64})$"),
}
/**
 * Generate random instance id
 **/
exports.instanceId = function() {
    return crypto.randomBytes(4);
}

/**
 * Validate miner address
 **/
var addressBase58Prefix = parseInt(cnUtil.address_decode(new Buffer(config.poolServer.poolAddress)).toString());
var integratedAddressBase58Prefix = 28822;

// Get address prefix
function getAddressPrefix(address) {
    var addressBuffer = new Buffer(address);

    var addressPrefix = cnUtil.address_decode(addressBuffer);
    
    if (addressPrefix) {
    	addressPrefix = parseInt(addressPrefix.toString());
    }

    if (!addressPrefix) {
        addressPrefix = cnUtil.address_decode_integrated(addressBuffer);
        if (addressPrefix) addressPrefix = parseInt(addressPrefix.toString());
    }

    return addressPrefix || null;
}
exports.getAddressPrefix = getAddressPrefix;

// Validate miner address
exports.validateMinerAddress = function(address) {
    
   return (
   	validAddress.main.test(address) || 
   	validAddress.withPaymentId.test(address) ||
   	validAddress.integratedAddress.test(address) 
   );
   
}
exports.truncateAddress = function(address , limit){
  limit = limit || 7;
  return address.substring(0,limit)+'...'+address.substring(address.length-limit);
}

exports.isIntegratedAddress = function(address) {
	const integrated_address = cleanupSpecialChars(address);
    return validAddress.integratedAddress.test(integrated_address);
}

const hasValidPaymentId = function(address) {
    const payment_id = cleanupSpecialChars(address);
    return validAddress.paymentId.test(payment_id);
}



exports.hasValidPaymentId=hasValidPaymentId;

exports.isInteger = function(value){
	return /^(-?[1-9]+\d*)$|^0$/.test(value);
}

/**
 * Cleanup special characters (fix for non latin characters)
 **/
function cleanupSpecialChars(str) {
    str = str.replace(/[ÀÁÂÃÄÅ]/g,"A");
    str = str.replace(/[àáâãäå]/g,"a");
    str = str.replace(/[ÈÉÊË]/g,"E");
    str = str.replace(/[èéêë]/g,"e");
    str = str.replace(/[ÌÎÏ]/g,"I");
    str = str.replace(/[ìîï]/g,"i");
    str = str.replace(/[ÒÔÖ]/g,"O");
    str = str.replace(/[òôö]/g,"o");
    str = str.replace(/[ÙÛÜ]/g,"U");
    str = str.replace(/[ùûü]/g,"u");
    return str.replace(/[^A-Za-z0-9\-\_]/gi,'');
}
exports.cleanupSpecialChars = cleanupSpecialChars;

/**
 * Get readable hashrate
 **/
exports.getReadableHashRate = function(hashrate){
    var i = 0;
    var byteUnits = [' H', ' KH', ' MH', ' GH', ' TH', ' PH' ];
    while (hashrate > 1000){
        hashrate = hashrate / 1000;
        i++;
    }
    return hashrate.toFixed(2) + byteUnits[i] + '/sec';
}
 
 /**
 * Returns an appropriate unicode smiley for a donation level
 **/
exports.getDonationSmiley = function(level) {
    return (
        level <= 0 ? '😢' :
        level <= 5 ? '😎' :
        level <= 10 ? '😄' :
        '😂');
}
 
/**
 * Get readable coins
 **/
exports.getReadableCoins = function(coins, digits, withoutSymbol){
    var coinDecimalPlaces = config.coinDecimalPlaces || config.coinUnits.toString().length - 1;
    var amount = (parseInt(coins || 0) / config.coinUnits).toFixed(digits || coinDecimalPlaces);
    return amount + (withoutSymbol ? '' : (' ' + config.symbol));
}

/**
 * Generate unique id
 **/
exports.uid = function(){
    var min = 100000000000000;
    var max = 999999999999999;
    var id = Math.floor(Math.random() * (max - min + 1)) + min;
    return id.toString();
};

/**
 * Ring buffer
 **/
exports.ringBuffer = function(maxSize){
    var data = [];
    var cursor = 0;
    var isFull = false;

    return {
        append: function(x){
            if (isFull){
                data[cursor] = x;
                cursor = (cursor + 1) % maxSize;
            }
            else{
                data.push(x);
                cursor++;
                if (data.length === maxSize){
                    cursor = 0;
                    isFull = true;
                }
            }
        },
        avg: function(plusOne){
            var sum = data.reduce(function(a, b){ return a + b }, plusOne || 0);
            return sum / ((isFull ? maxSize : cursor) + (plusOne ? 1 : 0));
        },
        size: function(){
            return isFull ? maxSize : cursor;
        },
        clear: function(){
            data = [];
            cursor = 0;
            isFull = false;
        }
    };
};

/**
 * Check if a miner has been seen with specified IP address
 **/
exports.minerSeenWithIPForAddress=function(address, ip, callback) {
    var ipv4_regex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
    if (ipv4_regex.test(ip)) {
        ip = '::ffff:' + ip;
    }
    redisClient.sismember([config.coin + ':workers_ip:' + address, ip], function(error, result) {
        var found = result > 0 ? true : false;
        callback(error, found);
    });
}
