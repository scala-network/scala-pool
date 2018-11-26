const utils = require('../utils.js');


const logSystem = 'api/scoresheets';
require('../exceptionWriter.js')(logSystem);
const rpcDaemon = require("../rpc/daemon");


/**
 * Return payments history
 **/
module.exports = function (urlParts, sendData) {
    var paymentKey = ':payments:all';
    var address = urlParts.query.address || null;

    if(address) {
        if(!utils.validateMinerAddress(address)){
            return sendData({status:'error',message: 'Invalid miner address'});
        }
        
        paymentKey = ':payments:' + address;
    }
    
    if(!utils.isInteger(urlParts.query.time)){
         return sendData({status:'error',message: 'Invalid time'});
    }
    
    redisClient.zrevrangebyscore(
            config.coin + paymentKey,
            '(' + urlParts.query.time,
            '-inf',
            'WITHSCORES',
            'LIMIT',
            0,
            config.api.payments,
        function(err, result){
            sendData((err) ? {error: 'Query failed'} : result);
        }
    )
}