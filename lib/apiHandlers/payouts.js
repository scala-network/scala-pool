const utils = require('../utils.js');


const logSystem = 'api/payouts';
require('../exceptionWriter.js')(logSystem);
/**
 * Miner settings: minimum payout level
 **/
 

 exports.getMinerPayoutLevel=function(urlParts, sendData) {

    // Check the minimal required parameters for this handle.
    if (!urlParts.query.address) {
        sendData({message: 'Parameters are incomplete',status:'error'});
        return;
    }
    
    var address = urlParts.query.address;

    const addressType = utils.validateMinerAddress(address)

    if(!addressType) {
        sendData({message: 'Invalid miner address',status:'error'});
        return;
    }

    // Return current miner payout level
    redisClient.hget(config.coin + ':workers:' + address, 'minPayoutLevel', function(error, value) {
        if (error){
            return sendData({status: 'Unable to get the current minimum payout level from database'});
        }
        var minLevel = (config.payments.minPayment / config.coinUnits) || 0
        let min =0
        switch(addressType){
            case 2:
            case 3:
            min = global.config.payments.minPaymentExchangeAddress || global.config.payments.minPaymentIntegratedAddress || config.payments.minPayment
            minLevel = (min / config.coinUnits) || (config.payments.minPayment / config.coinUnits) || 0;
            break
            case 4:
            min = global.config.payments.minPaymenSubAddress || config.payments.minPayment
            minLevel = (min / config.coinUnits) || (config.payments.minPayment / config.coinUnits) || 0;
            default:
            break;
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
exports.setMinerPayoutLevel= async function(urlParts, sendData){
    if (
    	!urlParts.query.address || 
    	!urlParts.query.ip || 
    	!urlParts.query.level
        ) {
            sendData({message: 'Parameters are incomplete',status:'error'});
        return;
    }

    var address = urlParts.query.address;
    var ip = urlParts.query.ip;

    // Do not allow wildcards in the queries.
    if (ip.indexOf('*') !== -1 || address.indexOf('*') !== -1) {
        sendData({status:'error',message:  'Remove the wildcard from your miner address'});
        return;
    }

    let minLevel = (global.config.payments.minPayment / global.config.coinUnits) || 0;
    let min = 0
    switch(addressType){
        case 2:
        case 3:
        min = global.config.payments.minPaymentExchangeAddress || global.config.payments.minPaymentIntegratedAddress || config.payments.minPayment
        minLevel = (min / config.coinUnits) || (config.payments.minPayment / global.config.coinUnits) || 0
        break
        case 4:
        min = global.config.payments.minPaymenSubAddress || config.payments.minPayment
        minLevel = (min / global.config.coinUnits) || (global.config.payments.minPayment / global.config.coinUnits) || 0;
        default:
        break;
    }

    let maxLevel = global.config.payments.maxPayment ? global.config.payments.maxPayment / global.config.coinUnits : 0;

    if(maxLevel === 0 || maxLevel > global.config.payments.maxTransactionAmount){
        maxLevel = global.config.payments.maxTransactionAmount / global.config.coinUnits;
    }

    const ipv4_regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    if(!ipv4_regex.test(ip)) {
        sendData({
            status:'error',
            message: "Invalid ipv4 address", 
            level: level, 
            min:minLevel,
            max:maxLevel
        });
        return;
    }
    
    const addressType = utils.validateMinerAddress(address)

    if(!addressType) {
        sendData({message: 'Invalid miner address',status:'error'});
        return;
    }
    
    var level = urlParts.query ? urlParts.query.level : 0;
    level = parseFloat(level);
    if (isNaN(level)) {
        sendData({status:'error',message:  'Your minimum payout level doesn\'t look like a number'});
        return;
    }
    
    if (level < minLevel) {
        sendData({status:'error',message: 'The minimum payout level is ' + minLevel,level: level,min:minLevel,max:maxLevel});
        return;
    }

    if (maxLevel && level > maxLevel) {
        sendData({status:'error',message: 'The maximum payout level is ' + maxLevel,level: level,min:minLevel,max:maxLevel});
        return;
    }



    const isSeen = new Promise((res,rej) => {
        redisClient.hget([global.config.coin + ':workers_ip:' + address, ip], function(error, result) {
            const found = result > 0 ? true : false;
            res(!error && found);
        });
    });

    if (await isSeen) {
         const payoutLevel = level * global.config.coinUnits;
        redisClient.hset(config.coin + ':workers:' + address, 'minPayoutLevel', payoutLevel, function(error, value){
            if (error){
                sendData({status:'error',message: 'An error occurred when updating the value in our database', level: level,min:minLevel,max:maxLevel});
                return;
            }

            log('info', logSystem, 'Updated minimum payout level for ' + address + ' to: ' + payoutLevel);
            sendData({status: 'success', level: level,min:minLevel,max:maxLevel});
        });
       
    } else {
        sendData({
            status:'error',
            message: 'We haven\'t seen that IP for your address', 
            level: level, 
            min:minLevel,
            max:maxLevel
        });
    }



}
