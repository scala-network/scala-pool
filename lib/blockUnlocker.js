/* Stellite Nodejs Pool
 * Copyright StelliteCoin   <https://github.com/stellitecoin/cryptonote-stellite-pool>
 * Copyright Ahmyi          <https://github.com/ahmyi/cryptonote-stellite-pool>
 * Copyright Dvandal        <https://github.com/dvandal/cryptonote-nodejs-pool>
 * Copyright Fancoder       <https://github.com/fancoder/cryptonote-universal-pool>
 * Copyright zone117x       <https://github.com/zone117x/node-cryptonote-pool>
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
 
 const async = require('async');

 const rpcDaemon = require('./rpc/daemon.js');

 const utils = require('./utils.js');

 const slushMiningEnabled = config.poolServer.slushMining && config.poolServer.slushMining.enabled;

// Initialize log system
const logSystem = 'unlocker';

require('./exceptionWriter.js')(logSystem);

const Blocks = require('./model/Blocks')
const PaymentSystem = require('./payments/payment_system')
/**
 * Run block unlocker
 **/

 log('info', logSystem, 'Started');
 function roundUpPercent(value){
    return  parseFloat(parseFloat(value).toFixed(5));
}

const limitPerTransaction = global.config.blockUnlocker.maxBlocks || 0
const blockHeader = {}
function runInterval(){
    const start = process.hrtime.bigint();
    
    async.waterfall([
        function(callback) {
            redisClient.hmget(global.config.coin + ':stats', ['lastblock_height','lastblock_hash'], (e,r) => {
                if(e || !r[0] || !r[1] || (blockHeader.height === r[0] && blockHeader.hash === r[1])) {
                    callback(true);
                    return;
                }
                blockHeader.height = r[0]
                blockHeader.hash = r[1]
                callback(null);
            });
        },
        // Get all unserialized block candidates in redis
        function(callback){
            redisClient.zrange(config.coin + ':blocks:candidates', 0, -1,  function(error, results){
                if (error){
                    log('error', logSystem, 'Error trying to get pending blocks from redis %j', [error]);
                    callback(true);
                    return;
                }
                const blockCount = results.length;
                if (blockCount === 0){
                    callback(true);
                    return;
                }

                log('info', logSystem, '%d block(s) candidates avaliable',[blockCount]);

                var blocks = [];
		let resultsLength =results.length;
     	    	if(results.length > 10){
			resultsLength = 10;
		}
                for (var i = 0; i < resultsLength; i++){
                    const block = new Blocks(results[i]);
                    block.serialized = results[i];
                    blocks.push(block)
                }

                callback(null, blocks);
            });
        },

        // Check if blocks are orphaned
        function(blocks, callback){
            const cmd = [];
            const unlockedBlocks = [];
            async.eachSeries(blocks, function(block, next){
                var daemonType = "default";
                var blockHeight = block.height;
                /* Limit blocking quatities */
                if(limitPerTransaction > 0 && limitPerTransaction <= unlockedBlocks.length) {
                    next(null);
                    return;
                }
                rpcDaemon.getBlockHeaderByHeight({height: blockHeight}, function(error, result){
                    if (error){
                        log('error', logSystem, 'Error with getblockheaderbyheight RPC request for block %s - %j', [block.serialized, error]);
                        block.unlocked = false;
                        next(null);
                        return;
                    }
                    if (!result.block_header){
                        log('error', logSystem, 'Error with getblockheaderbyheight, no details returned for %s - %j', [block.serialized, result]);
                        block.unlocked = false;
                        next(null);
                        return;
                    }
                    
                    block.setBlockHeader(result.block_header);

                    if(block.isDirty()) {
                        cmd.push(['zrem', global.config.coin + ':blocks:candidates', block.serialized]);
                        cmd.push(['zadd', global.config.coin + ':blocks:candidates', block.height, block.toRedis()]);

                        block.serialized = block.toRedis();
                    }

                    if(block.unlocked) {
                        unlockedBlocks.push(block);
                    }
                    //We give daemon a bit of a rest
                    setTimeout(() => next(null), 100);
                    
                });
            }, function(error){
              const endProcess = () => {
                if(unlockedBlocks.length === 0) {
                    callback(true);
                    return;
                }
                callback(null, unlockedBlocks)
            }

            if(cmd.length > 0) {
                log('info', logSystem, 'Unlocking blocks (%d pending | %d total | %d dirty)', [unlockedBlocks.length, blocks.length,cmd.length/2]);
                redisClient.multi(cmd).exec(endProcess)
            } else if(unlockedBlocks.length > 0){
                log('info', logSystem, 'Unlocking blocks (%d pending | %d total)', [unlockedBlocks.length, blocks.length]);
                endProcess();
            } else {
                log('info', logSystem, 'Unlocking blocks (%d total)', [blocks.length]);
                callback(true);
            }
        })
        },

        // Get worker shares for each unlocked block
        function(blocks, callback){

            const redisCommands = [];
            for(let i =0;i< blocks.length;i++) {
                const block = blocks[i];
                redisCommands.push(['hgetall', global.config.coin + ':shares_actual:round' + block.height]);
            }
	    console.log("Get shares for each unlocked block");
            redisClient.multi(redisCommands).exec(function(error, replies){
                if (error){
                    log('error', logSystem, 'Error with getting round shares from redis %j', [error]);
                    callback(true);
                    return;
                }
                const cleanupcmd = [];
                for (let i = 0; i < replies.length; i++){
                    const workerScores = replies[i];
		    if(!workerScores) {
			continue;
		    }
                    if('total' in workerScores) {
                        const total = parseInt(workerScores.total)
                        if(total !== blocks[i].shares) {
                         blocks[i].shares = total;
                     }
                     delete workerScores['total']
                 }
                 if('donations' in workerScores) {
                    const total = parseInt(workerScores.donations)
                    if(total !== blocks[i].donations) {
                     blocks[i].donations = donations;
                 }
                 delete workerScores['donations']
             }
             if(blocks[i].isDirty()) {
                cleanupcmd.push(['zrem', global.config.coin + ':blocks:candidates', blocks[i].serialized]);
                cleanupcmd.push(['zadd', global.config.coin + ':blocks:candidates', blocks[i].height, blocks[i].toRedis()]);			  
                blocks[i].serialized = blocks[i].toRedis();

            }

            blocks[i].workerShares = workerScores;
        }

        callback(null, cleanupcmd, blocks);
    });
        },
        function(cleanup, blocks, callback) {

            if(cleanup.length) {
                redisClient.multi(cleanup).exec((e,r) => {
                    log('info', logSystem, 'Cleaning up block %d candidates', [cleanup.length / 2]);
                    callback(null,blocks);
                })
            } else {
                log('info', logSystem, 'No cleaning up block candidates');
                callback(null, blocks);
            }
        },

        // Handle orphaned blocks
        function(blocks, callback){
            var orphanCommands = [];
            const nonorphan = [];
            for (let i =0;i<blocks.length;i++) {
                const block = blocks[i];

                if (!block.orphaned) {
                    nonorphan.push(block);
                    continue;
                }



                // orphanCommands.push(['del', config.coin + ':shares_actual:round' + block.height])
                orphanCommands.push(['zrem', global.config.coin + ':blocks:candidates', block.serialized])
                orphanCommands.push(['zadd', global.config.coin + ':blocks:matured', block.height, block.toString()])

                const workerShares = block.workerShares

                for(let a = 0;a<Object.keys(workerShares).length;a++) {
                    const worker = Object.keys(workerShares)[a]
                    orphanCommands.push(['hincrby', global.config.coin + ":" + block.poolType + ':shares_actual:roundCurrent', worker, workerShares[worker]])
                }

                orphanCommands.push(['hincrby', global.config.coin + ":" + block.poolType + ':shares_actual:roundCurrent', 'total', block.shares]);
                orphanCommands.push(['hincrby', global.config.coin + ":" + block.poolType + ':shares_actual:roundCurrent', 'donations', block.donations]);
            }

            log('info', logSystem, 'Cleaning up orphaned %d blocks', [blocks.length - nonorphan.length])
            if (orphanCommands.length > 0){
                redisClient.multi(orphanCommands).exec(function(error, replies){
                    if (error){
                        log('error', logSystem, 'Error with cleaning up data in redis for orphan block(s) %j', [error]);
                        callback(true);
                        return;
                    }
                    callback(null, nonorphan);
                });
            } else {
                callback(null, nonorphan)
            }
        },
        // Handle unlocked blocks
        function(blocks, callback){
            const sorted = {}
            for(let i=0;i<blocks.length;i++) {
                const block = blocks[i]
                if(!sorted[block.poolType]){ 
                    sorted[block.poolType] = []
                }

                sorted[block.poolType].push(block)
            }

            async.eachSeries(global.config.payments.supported,(poolType,next) => {
                const bs =sorted[poolType];
                if(!bs) {
                    next(null);
                    return;
                }
                log('info', logSystem, 'Handling payment %d distributions for %s', [bs.length, poolType]);
                PaymentSystem(poolType).unlocker(bs,next);
            },(e,r) => {
                callback(null);
            })
        }
        ], function(error, result){
            if(!error) {
                const end = process.hrtime.bigint();
                log('info', logSystem, 'Unlock blocks taken %s', [utils.readableSI(Number(end - start)," ", "nsecs", true)]);
            }
            setTimeout(runInterval, global.config.blockUnlocker.interval * 1000);
        })
}

runInterval();
