
const logSystem = 'api/blocks';

require('../exceptionWriter.js')(logSystem);
const utils = require('../utils.js');
const Blocks = require('../model/Blocks');
function _getBlockCleanup(results){
    const block = new Blocks(results);
    block.miner = utils.truncateAddress(block.miner);    
    return block.toRedis();
}
/**
 * Return blocks data
 **/

module.exports = {
    getBlock:function(urlParts, sendData){
        var height = urlParts.query.height;
        
        if(!utils.isInteger(height)){
        	return sendData({message: 'Invalid height',status:'error'});
        }
        
        redisClient.zrange(config.coin + ':blocks:matured',height,height,function(err, results){
            return sendData((err) ? {message: 'Query failed',status:'error'} : _getBlockCleanup(results));
        });
    },
    getBlocks:function(urlParts, sendData){
        var height = urlParts.query.height;
        if(!utils.isInteger(height)){
        	return sendData({message: 'Invalid height',status:'error'});
        }
        redisClient.zrevrangebyscore(
                config.coin + ':blocks:matured',
                '(' + height,
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