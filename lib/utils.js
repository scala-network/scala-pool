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

 var cnUtil = require('cryptoforknote-util');
 exports.cnUtil = cnUtil;

 const validAddress = {
    main: new RegExp('^S+([1-9A-HJ-NP-Za-km-z]{96})$'),
    withPaymentId: new RegExp('^S+([1-9A-HJ-NP-Za-km-z]{96})+.+([0-9a-fA-F]{16}|[0-9a-fA-F]{64})$'),
    integratedAddress: new RegExp('^SE+([1-9A-HJ-NP-Za-km-z]{107})$'),
    paymentId: new RegExp('^([0-9a-fA-F]{16}|[0-9a-fA-F]{64})$'),
    subAddress: new RegExp('^Ss+([1-9A-HJ-NP-Za-km-z]{107})$')
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
 const CRYPTONOTE_PUBLIC_ADDRESS_BASE58_PREFIX = 155;
 const CRYPTONOTE_PUBLIC_INTEGRATED_ADDRESS_BASE58_PREFIX = 26009;
 const CRYPTONOTE_PUBLIC_SUBADDRESS_BASE58_PREFIX = 23578;

// Get address prefix
function getAddressPrefix(address) {
    const addressBuffer = Buffer.from(address);

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
    	let addressPrefix = getAddressPrefix(address);
    	if (addressPrefix === CRYPTONOTE_PUBLIC_ADDRESS_BASE58_PREFIX) return true;
    	else if (addressPrefix === CRYPTONOTE_PUBLIC_INTEGRATED_ADDRESS_BASE58_PREFIX) return true;
    	else if (addressPrefix === CRYPTONOTE_PUBLIC_SUBADDRESS_BASE58_PREFIX) return true;
	return false;
}
exports.truncateAddress = function(address , limit){
  limit = limit || 7;
  return address.substring(0,limit)+'...'+address.substring(address.length-limit);
}

const isIntegratedAddress = function(address) {
	const integrated_address = cleanupSpecialChars(address);
        let addressPrefix = getAddressPrefix(address);
    return addressPrefix === CRYPTONOTE_PUBLIC_INTEGRATED_ADDRESS_BASE58_PREFIX;
}

exports.isIntegratedAddress = isIntegratedAddress

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
    str ="" + str
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
const readableSI = (value, prefix, startUnit, isTime) => { // 1000.00

	let i = 0

    if(isTime) {

		const timeUnits =  ["nsecs","µsecs","msecs",'secs'];

		if(!startUnit) {
			i = 3
		} else if(startUnit === 'usecs') {
			i = 1
		} else {
			let ix = timeUnits.indexOf(startUnit);

			if(ix === false || ix < 0) {
				i = 3
			} else {
				i = ix
			}
		}


		while(value > 1000) {
		 	if(i === 3) break;
			value /= 1000
			i++
	    }
	        return parseFloat(value).toFixed(2) + ' ' + timeUnits[i]

	}

	const byteUnits =  ["n","µ","m",'','K', 'M', 'G', 'T', 'P'];

	if(!startUnit) {
		i = 3
	} else if(startUnit === 'u') {
		i = 1
	} else {
		let ix = byteUnits.indexOf(startUnit);

		if(ix === false || ix < 0) {
			i = 3
		} else {
			i = ix
		}
	}
	while(value > 1000) {
		value /= 1000
		i++
	}

	if(!prefix) {
		prefix = ' '
	}

	return parseFloat(value).toFixed(2) + prefix +  byteUnits[i];

}
/**
 * Get readable hashrate
 **/
 exports.getReadableHashRate = function(hashrate){
    return readableSI(hashrate,' ') + '/sec';
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



exports.readableSI = readableSI 
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
