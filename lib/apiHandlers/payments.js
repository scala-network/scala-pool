const utils = require('../utils.js');


const logSystem = 'api/scoresheets';
require('../exceptionWriter.js')(logSystem);
const rpcDaemon = require("../rpc/daemon");


/**
 * Return payments history
 **/
module.exports=function(urlParts, sendData){
    var paymentKey = ':payments:all';
    var address = urlParts.query.address;

    if(!utils.validateMinerAddress(address)){
        sendData({status:'error',message: 'Invalid miner address'});
    }
    if (urlParts.query.address)
        paymentKey = ':payments:' + address;

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