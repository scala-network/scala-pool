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
 
var async = require('async');

var apiInterfaces = require('./apiInterfaces.js');

var utils = require('./utils.js');

var slushMiningEnabled = config.poolServer.slushMining && config.poolServer.slushMining.enabled;

// Initialize log system
var logSystem = 'unlocker';

require('./exceptionWriter.js')(logSystem);

/**
 * Run block unlocker
 **/


log('info', logSystem, 'Started');
function roundUpPercent(value){
    return  parseFloat(parseFloat(value).toFixed(5));
}

const haveBlockUnlockerAward = global.config.blockUnlocker.reward && global.config.blockUnlocker.reward > 0;
const unlockerRewardPercent = (haveBlockUnlockerAward) ? ( global.config.blockUnlocker.reward / 100 ) : 0.0;

function runInterval(){
    async.waterfall([

        // Get all block candidates in redis
        function(callback){
            redisClient.zrange(config.coin + ':blocks:candidates', 0, -1, 'WITHSCORES', function(error, results){
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
                log('info', logSystem, '%d block(s) candidates avaliable',[blockCount/2]);

                var blocks = [];

                for (var i = 0; i < results.length; i += 2){
                    var parts = results[i].split(':');
                    blocks.push({
                        serialized: results[i],
                        height: parseInt(results[i + 1]),
                        hash: parts[0],
                        time: parts[1],
                        difficulty: parts[2],
                        shares: parts[3],
                        score: parts.length >= 5 ? parts[4] : parts[3],
                        miner: parts.length >= 6 ? parts[5] : "xxxxxxx...xxxxxx",
                    });
                }

                callback(null, blocks);
            });
        },

        // Check if blocks are orphaned
        function(blocks, callback){
            async.filter(blocks, function(block, mapCback){
                var daemonType = "default";
                var blockHeight = block.height;
                apiInterfaces.rpcDaemon('getblockheaderbyheight', {height: blockHeight}, function(error, result){
                    if (error){
                        log('error', logSystem, 'Error with getblockheaderbyheight RPC request for block %s - %j', [block.serialized, error]);
                        block.unlocked = false;
                        mapCback();
                        return;
                    }
                    if (!result.block_header){
                        log('error', logSystem, 'Error with getblockheaderbyheight, no details returned for %s - %j', [block.serialized, result]);
                        block.unlocked = false;
                        mapCback();
                        return;
                    }
                    var blockHeader = result.block_header;
                    block.orphaned = blockHeader.hash === block.hash ? 0 : 1;
                    block.unlocked = blockHeader.depth >= config.blockUnlocker.depth;
                    block.reward = blockHeader.reward;
                    if (config.blockUnlocker.networkFee) {
                        var networkFeePercent = config.blockUnlocker.networkFee / 100;
                        block.reward = block.reward - (block.reward * networkFeePercent);
                    }
                    mapCback(block.unlocked);
                });
            }, function(unlockedBlocks){

                if (unlockedBlocks.length === 0){
                    callback(true);
                    return;
                }
                log('info', logSystem, 'Unlocking blocks (%d pending)', [unlockedBlocks.length]);
                callback(null, unlockedBlocks)
            })
        },

        // Get worker shares for each unlocked block
        function(blocks, callback){

            var redisCommands = blocks.map(function(block){
                return ['hgetall', config.coin + ':scores:round' + block.height];
            });


            redisClient.multi(redisCommands).exec(function(error, replies){
                if (error){
                    log('error', logSystem, 'Error with getting round shares from redis %j', [error]);
                    callback(true);
                    return;
                }
                for (var i = 0; i < replies.length; i++){
                    var workerScores = replies[i];
                    blocks[i].workerScores = workerScores;
                }
                callback(null, blocks);
            });
        },

        // Handle orphaned blocks
        function(blocks, callback){
            var orphanCommands = [];

            blocks.forEach(function(block){
                if (!block.orphaned) {
                    return;
                }

                orphanCommands.push(['del', config.coin + ':scores:round' + block.height]);
                orphanCommands.push(['del', config.coin + ':shares_actual:round' + block.height]);
                orphanCommands.push(['zrem', config.coin + ':blocks:candidates', block.serialized]);
                orphanCommands.push(['zadd', config.coin + ':blocks:matured', block.height, [
                    block.hash,
                    block.time,
                    block.difficulty,
                    block.shares,
                    block.orphaned,
                    block.miner
                ].join(':')]);

                if (block.workerScores && !slushMiningEnabled) {
                    var workerScores = block.workerScores;
                    Object.keys(workerScores).forEach(function (worker) {
                        orphanCommands.push(['hincrby', config.coin + ':scores:roundCurrent', worker, workerScores[worker]]);
                    });
                }

           
            });

            if (orphanCommands.length > 0){
                redisClient.multi(orphanCommands).exec(function(error, replies){
                    if (error){
                        log('error', logSystem, 'Error with cleaning up data in redis for orphan block(s) %j', [error]);
                        callback(true);
                        return;
                    }
                    callback(null, blocks);
                });
            }
            else{
                callback(null, blocks);
            }
        },

        // Handle unlocked blocks
        function(blocks, callback){

            var unlockedBlocksCommands = [];
            var payments = {};
            var totalBlocksUnlocked = 0;
            
            var feePercent = 0.00;

            if (Object.keys(global.config.contributions).length) {
                for(var wallet in global.config.contributions) {
                    if( global.config.contributions[wallet].enabled){
                       feePercent += global.config.contributions[wallet].percent / 100;
                    }
                }
            }
            const unblockStatsRedis = {};
            function addBlockStats(height,wallet,key,value){
                if(!unblockStatsRedis.hasOwnProperty(height)){
                    unblockStatsRedis[height] = {};
                }
                
                if(!unblockStatsRedis[height].hasOwnProperty(wallet)){
                    unblockStatsRedis[height][wallet]={
                        score:0,
                        earn:0, 
                        percent:0.0,
                        unlockReward:0.0
                    };  
                }
                if(!unblockStatsRedis[height][wallet].hasOwnProperty(key)){
                    return;
                }
                unblockStatsRedis[height][wallet][key]=parseFloat(unblockStatsRedis[height][wallet][key])+parseFloat(value);
            };
            
            blocks.forEach(function(block){
                if(!unblockStatsRedis.hasOwnProperty(block.height)){
                    unblockStatsRedis[block.height] = {};
                    unblockStatsRedis[block.height]["Info"] = [
                        block.hash,
                        block.time,
                        block.difficulty,
                        block.shares,
                        block.orphaned,
                        block.reward,
                        block.miner
                    ].join(':');
                }
                if (block.orphaned) return;
                totalBlocksUnlocked++;

                unlockedBlocksCommands.push(['del', config.coin + ':scores:round' + block.height]);
                unlockedBlocksCommands.push(['del', config.coin + ':shares_actual:round' + block.height]);
                unlockedBlocksCommands.push(['zrem', config.coin + ':blocks:candidates', block.serialized]);
                unlockedBlocksCommands.push(['zadd', config.coin + ':blocks:matured', block.height, [
                    block.hash,
                    block.time,
                    block.difficulty,
                    block.shares,
                    block.orphaned,
                    block.reward,
                    block.miner
                ].join(':')]);
        
                let reward = block.reward;
                let contributionPercent = 0.00;
            
                if (Object.keys(global.config.contributions).length) {
                    for(var wallet in global.config.contributions) {
                        const percent = global.config.contributions[wallet].percent / 100;
                        const pay = roundUpPercent(block.reward * percent);
                        payments[wallet] = pay;
                        addBlockStats(block.height,wallet,'earn',pay);
                        addBlockStats(block.height,wallet,'percent',percent);
                        reward -=pay;
                        contributionPercent+=percent;
                        log('info', logSystem, 'Block %d %s to %s as %d percent of reward: %d', [
                            block.height,
                            global.config.contributions[wallet].desc || 'contributions', 
                            wallet, percent, 
                            payments[wallet]
                        ]);
                    }
                }
                

                
                let contributionFee =  block.reward - reward;
                /* Additional block reward to those who unlocks a block*/
                let unblockerAward = 0.0;
                
                if(haveBlockUnlockerAward){
                    unblockerAward = roundUpPercent(block.reward * unlockerRewardPercent);
                    reward -= unblockerAward;
                }
                
                log('info', logSystem, 'Unlocked %d block with reward %d and contributions %d %f. Miners reward: %d Unlocker reward %f', [
                    block.height, block.reward, contributionPercent,contributionFee, reward,unblockerAward
                ]);
                
                if (block.workerScores) {
                    const actTotalScore = parseFloat(block.score);
                    const totalScore = ( 1 + ( unlockerRewardPercent +  contributionPercent ) ) * actTotalScore;
                    Object.keys(block.workerScores).forEach(function (worker) {
                        let percent = block.workerScores[worker] / totalScore;
                        
                        if(haveBlockUnlockerAward && worker === block.miner){
                        	percent+=unlockerRewardPercent;	
                        }
                        
                        const totalPercent = reward * percent;
                        const workerReward = roundUpPercent(totalPercent);
						payments[worker] = (payments[worker] || 0) + workerReward;
						
                        if(haveBlockUnlockerAward && worker === block.miner){
                            payments[worker] += unblockerAward;
                            addBlockStats(block.height,worker,"unlockReward",unblockerAward);
                            log('info', logSystem, 'Block %d payment to %s for %d%% of total block score: %d with unlock reward %d', [
                                block.height, worker, percent*100, payments[worker],unblockerAward
                            ]);
                        } else {
                            log('info', logSystem, 'Block %d payment to %s for %d%% of total block score: %d', [block.height, worker, percent*100, payments[worker]]);    
                        }
                        
                        addBlockStats(block.height,worker,'score',block.workerScores[worker]);
                        addBlockStats(block.height,worker,'percent',percent);
                        addBlockStats(block.height,worker,'earn',workerReward);
                        
                    });
                }
            });

            var getDonationCommands = [];
            var donationWorkers = [];
            var donateLevelWallet ={};
            if (config.poolServer.donations && config.poolServer.donations.enabled) {
                if (!config.poolServer.donations.address) {
                    log('error', logSystem, 'Cannot unlock block: no donation address specified in configuration file');
                    callback(true);
                    return;
                }
                
                var donationAddress = config.poolServer.donations.address;
                for (var worker in payments) {
                    var amount = parseFloat(payments[worker]);
                    if (amount <= 0){
                        delete payments[worker];
                        continue;
                    }

                    getDonationCommands.push(['hget', config.coin + ':workers:' + worker, 'donation_level']);
                    donationWorkers.push(worker);
                }

                redisClient.multi(getDonationCommands).exec(function(error, replies) {
                    if (error) {
                        log('error', logSystem, 'Error retrieving worker donation levels: %j', [error]);
                        callback(true);
                        return;
                    }
                    
                    let fallback = 0;
                    const donate = {};
                    for (var i in replies) {
                        var worker = donationWorkers[i];
                        var level = parseFloat(replies[i]);
                        if (isNaN(level) || level < 0 || level > 100) {
                            level = fallback;
                        }
                       
                        // The donation level is expressed as a pre-pool-fee percentage, but we've
                        // already removed the pool fee, so adjust (e.g. if the pool fee is 0.5% and
                        // donation level is 9.5% we want the overall reward reduced by exactly 10%
                        // not .095*.995+.005 = slightly less than 10%.
                        if (feePercent > 0)
                            level /= (1 - feePercent);
                        if (level > 100) {
                            level = 100;
                        } else if (level < 0) {
                            level = 0;
                        }

                        var donation = roundUpPercent(payments[worker] * (level / 100.));
                        donateLevelWallet[worker] = level;
                        
                        if(donation > 0) {
                            payments[worker] -= donation;
                            if (donationAddress in payments){
                                payments[donationAddress] += donation;
                            } else{
                                payments[donationAddress] = donation;
                            }
                            
                            log('info', logSystem, '%s is donating %d to %s', [worker, donation, donationAddress]);
                        }
                        donate[worker] = donation;
                    }

                    
                    for (var worker in payments) {
                        var amount = roundUpPercent(payments[worker]);
                        unlockedBlocksCommands.push(['hincrbyfloat', config.coin + ':workers:' + worker, 'balance', amount]);
                        if (worker in donate && donate[worker] > 0){
                            unlockedBlocksCommands.push(['hincrbyfloat', config.coin + ':workers:' + worker, 'donations', donate[worker]]);
                        }
                    }

                    if (unlockedBlocksCommands.length === 0){
                        log('info', logSystem, 'No unlocked blocks yet (%d pending)', [blocks.length]);
                        callback(true);
                        return;
                    }
                    const blockStatisticHeight = Object.keys(unblockStatsRedis);
                    for(let i = 0,il=blockStatisticHeight.length;i<il;i++){
                        const height = blockStatisticHeight[i];

                        const blockStatisticWallets = unblockStatsRedis[height];
                        const wallets = Object.keys(blockStatisticWallets);
                        
                        for(let w =0,wl=wallets.length;w<wl;w++){
                            const wallet = wallets[w];
                            if(wallet === "Info"){
                                unlockedBlocksCommands.push(["hmset",config.coin+":block_shares:"+height,wallet,unblockStatsRedis[height][wallet]]);
                                continue;
                            }
                            const stats = blockStatisticWallets[wallet];
                            let donation = 0;
                            if(donateLevelWallet.hasOwnProperty(wallet)){
                                donation= roundUpPercent(stats.earn * (donateLevelWallet[wallet] / 100.));
                            }

                            const shareKeys = JSON.stringify({
                                score:stats.score,
                                percent:stats.percent,
                                earn:stats.earn,
                                donate:donation,
                                bonus:stats.unlockReward
                            });

                            unlockedBlocksCommands.push(["hmset",config.coin+":block_shares:"+height,wallet,shareKeys]);
                            unlockedBlocksCommands.push(["zadd",config.coin+":block_scoresheets:"+wallet,height,shareKeys]);
                        }
                    }

                    redisClient.multi(unlockedBlocksCommands).exec(function(error, replies){
                        if (error){
                            log('error', logSystem, 'Error with unlocking blocks %j', [error]);
                            callback(true);
                            return;
                        }
                        
                        log('info', logSystem, 'Unlocked %d blocks and update balances for %d workers', [totalBlocksUnlocked, Object.keys(payments).length]);
                        callback(null);
                        
                    });
                });
            } else {

                for (var worker in payments) {
                    var amount = parseInt(payments[worker]);
                    unlockedBlocksCommands.push(['hincrbyfloat', config.coin + ':workers:' + worker, 'balance', amount]);
                }

                if (unlockedBlocksCommands.length === 0){
                    log('info', logSystem, 'No unlocked blocks yet (%d pending)', [blocks.length]);
                    return;
                }
                const blockStatisticHeight = Object.keys(unblockStatsRedis);
                for(let i = 0,il=blockStatisticHeight.length;i<il;i++){

                    const height = blockStatisticHeight[i];

                    const blockStatisticWallets = unblockStatsRedis[height];
                    const wallets = Object.keys(blockStatisticWallets);

                    for(let w =0,wl=wallets.length;w<wl;w++){
                        const wallet = wallets[w];

                        if(wallet === "Info"){
                            unlockedBlocksCommands.push(["hmset",config.coin+":block_shares:"+height,wallet,unblockStatsRedis[height][wallet]]);
                            continue;
                        }
                        
                        const stats = blockStatisticWallets[wallet];
                        const shareKeys = JSON.stringify({
                            score:stats.score,
                            percent:stats.percent,
                            earn:stats.earn,
                            donate:0,
                            bonus:stats.unlockReward
                        });
                        unlockedBlocksCommands.push(["hmset",config.coin+":block_shares:"+height,wallet,shareKeys]);
                        unlockedBlocksCommands.push(["zadd",config.coin+":block_scoresheets:"+wallet,height,shareKeys]);
                    }
                }
                redisClient.multi(unlockedBlocksCommands).exec(function(error, replies){
                    if (error){
                        log('error', logSystem, 'Error with unlocking blocks %j', [error]);
                        callback(true);
                        return;
                    }

                    log('info', logSystem, 'Unlocked %d blocks and update balances for %d workers', [totalBlocksUnlocked, Object.keys(payments).length]);
                    callback(null);
                });
            }
        }
    ], function(error, result){
        setTimeout(runInterval, config.blockUnlocker.interval * 1000);
    })
}

runInterval();