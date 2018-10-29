const utils = require('../utils.js');


const logSystem = 'api/payouts';
require('../exceptionWriter.js')(logSystem);
/**
 * Miner settings: minimum payout level
 **/
 

exports.getMinerPayoutLevel=function(urlParts, sendData){

    var address = urlParts.query.address;

    // Check the minimal required parameters for this handle.
    if (address === undefined) {
        sendData({message: 'Parameters are incomplete',status:'error'});
        return;
    }

    if(!utils.validateMinerAddress(address)){
        sendData({message: 'Invalid miner address',status:'error'});
        return;
    }

    // Return current miner payout level
    redisClient.hget(config.coin + ':workers:' + address, 'minPayoutLevel', function(error, value){
        if (error){
            return sendData({status: 'Unable to get the current minimum payout level from database'});
        }
        var minLevel = (config.payments.minPayment / config.coinUnits) || 0;

		if(utils.isIntegratedAddress(address)){
			minLevel = (config.payments.minPaymentIntegratedAddress / config.coinUnits) || (config.payments.minPayment / config.coinUnits) || 0;
		}else{
            const addr = address.split(config.poolServer.paymentId.addressSeparator);
            if(config.poolServer.paymentId.enabled && addr.length >= 2 && utils.hasValidPaymentId(addr[1])){
                minLevel = (config.payments.minPaymentIntegratedAddress / config.coinUnits) || (config.payments.minPayment / config.coinUnits) || 0;
            }
		}

        var maxLevel = config.payments.maxPayment ? config.payments.maxPayment / config.coinUnits : 0;

        if(maxLevel === 0 || maxLevel > config.payments.maxTransactionAmount){
            maxLevel = config.payments.maxTransactionAmount / config.coinUnits;
        }

        var currentLevel = value / config.coinUnits;
        if (currentLevel < minLevel) {
        	currentLevel = minLevel;
        }
        if (maxLevel && currentLevel > maxLevel){
        	 currentLevel = maxLevel;	
        }

        sendData({status: 'success', level: currentLevel,min:minLevel,max:maxLevel});
    });
}

// Set minimum payout level
exports.setMinerPayoutLevel=function(urlParts, sendData){
    
    var address = urlParts.query.address;
    var ip = urlParts.query.ip;
    var level = urlParts.query.level;

    // Check the minimal required parameters for this handle.
    if (ip === undefined || address === undefined || level === undefined) {
		sendData({status:'error',message:  'Parameters are incomplete'});
        return;
    }

    // Do not allow wildcards in the queries.
    if (ip.indexOf('*') !== -1 || address.indexOf('*') !== -1) {
        ssendData({status:'error',message:  'Remove the wildcard from your miner address'});
        return;
    }

    if(!utils.validateMinerAddress(address)){
       sendData({status:'error',message: 'Invalid miner address'});
        return;
    }

    level = parseFloat(level);
    if (isNaN(level)) {
        sendData({status:'error',message:  'Your minimum payout level doesn\'t look like a number'});
        return;
    }

    var minLevel = (config.payments.minPayment / config.coinUnits) || 0;
    
    if(utils.isIntegratedAddress(address)){
    	minLevel = (config.payments.minPaymentIntegratedAddress / config.coinUnits) || (config.payments.minPayment / config.coinUnits) || 0;
    }else if(config.poolServer.paymentId.enabled){
        var addr = address.split(config.poolServer.paymentId.addressSeparator);
        if(addr.length >= 2 && utils.hasValidPaymentId(addr[1])){
            minLevel = (config.payments.minPaymentIntegratedAddress / config.coinUnits) || (config.payments.minPayment / config.coinUnits) || 0;
        }
    }

    var maxLevel = config.payments.maxPayment ? config.payments.maxPayment / config.coinUnits : 0;

    if(maxLevel === 0 || maxLevel > config.payments.maxTransactionAmount){
        maxLevel = config.payments.maxTransactionAmount / config.coinUnits;
    }
    
    if (level < minLevel) {
        sendData({status:'error',message: 'The minimum payout level is ' + minLevel,level: level,min:minLevel,max:maxLevel});
        return;
    }

    if (maxLevel && level > maxLevel) {
        sendData({status:'error',message: 'The maximum payout level is ' + maxLevel,level: level,min:minLevel,max:maxLevel});
        return;
    }

    // Only do a modification if we have seen the IP address in combination with the wallet address.
    utils.minerSeenWithIPForAddress(address, ip, function (error, found) {
        if (!found || error) {
          ssendData({status:'error',message: 'We haven\'t seen that IP for your address', level: level,min:minLevel,max:maxLevel});
          return;
        }

        var payoutLevel = level * config.coinUnits;
        redisClient.hset(config.coin + ':workers:' + address, 'minPayoutLevel', payoutLevel, function(error, value){
            if (error){
                sendData({status:'error',message: 'An error occurred when updating the value in our database', level: level,min:minLevel,max:maxLevel});
                return;
            }

            log('info', logSystem, 'Updated minimum payout level for ' + address + ' to: ' + payoutLevel);
            sendData({status: 'success', level: level,min:minLevel,max:maxLevel});
        });
    });
}