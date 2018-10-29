
const logSystem = 'api/blocks';

require('../exceptionWriter.js')(logSystem);
const utils = require('../utils.js');

function _getBlockCleanup(results){
    const data = results;
    for(let i=0,rl = results.length;i<rl;i+=2){
        const result = results[i].split(':');
        const miner = result[result.length -1];

        if(utils.validateMinerAddress(miner)){
            result[result.length -1] = utils.truncateAddress(miner);    
        }
        data[i] = result.join(':');
    }
    return data;
}
/**
 * Return blocks data
 **/

module.exports = {
    getBlock:function(urlParts, sendData){
        var height = urlParts.query.height;
        redisClient.zrange(config.coin + ':blocks:matured',height,height,function(err, results){
            sendData((err) ? {message: 'Query failed',status:'error'} : _getBlockCleanup(results));
        });
    },
    getBlocks:function(urlParts, sendData){
        
        redisClient.zrevrangebyscore(
                config.coin + ':blocks:matured',
                '(' + urlParts.query.height,
                '-inf',
                'WITHSCORES',
                'LIMIT',
                0,
                config.api.blocks,
            function(err, results){
                sendData((err) ? {message: 'Query failed',status:'error'} : _getBlockCleanup(results));
        });
    }
}