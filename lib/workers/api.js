
const logSystem = 'workers/api'
const async = require('async');
const BlockModel  = require('../model/Blocks');
const utils  = require('../utils');

const apiStats = {
    poolStats: {
        pool: {},
        network: {},
        lastBlock: {},
        charts: {}
    },
    minerStats: {}
}
let minersHashrate = {}
let lastTotal = 0
let lastHeight = 0
let currentBlocks = []
/**
 * Return list of pool logs file
 **/
 function getLogFiles(callback) {
 	var dir = config.logging.files.directory;
 	fs.readdir(dir, function(error, files) {
 		var logs = {};
 		for(var i in files) {
 			var file = files[i];
 			var stats = fs.statSync(dir + '/' + file);
 			logs[file] = {
 				size: stats.size,
 				changed: Date.parse(stats.mtime) / 1000 | 0
 			}
 		}
 		callback(error, logs);
 	});
 }
/**
 * Return redis key for chart data
 **/
 function getStatsRedisKey(chartName) {
 	return global.config.coin +':charts:' + chartName;
 }



/**
 * Obtains worker stats and invokes the given callback with them.
 */
 let lastCollectWorkerStats = 0

 function collectWorkerStats(address, statsCallback) {
    if(apiStats.poolStats && apiStats.poolStats.pool && apiStats.poolStats.pool.stats) {
        let yesterday = lastCollectWorkerStats - 86400
        while(apiStats.poolStats.pool.stats.lastBlockFound > yesterday) {
            yesterday-= 86400
        }
        if(apiStats.minerStats[address] && 
            apiStats.minerStats[address]['stats'] && 
            apiStats.minerStats[address]['stats']['lastShare'] && 
            (parseInt(apiStats.minerStats[address]['stats']['lastShare']) < yesterday))
        {
            statsCallback()
            return
        } 
    }


    async.waterfall([

        function(callback) {
        	const redisCommands = []
        	for (let i = 0;i< currentBlocks.length;i++) {
        		const height = currentBlocks[i].height
        		redisCommands.push(['hget', global.config.coin + ':shares_actual:round' + height, address]);
        	}

        	redisClient.multi(redisCommands).exec(function(error, replies) {
        		if (error) {
        			log('error', logSystem, 'Error retrieving worker shares/score: %j', [error]);
                            callback(null, null); // Ignore the error and carry on
                            return;
                        }
                        var feePercent = 0.0;
                        var removeFees = 1 - feePercent;

                        var pending_scores = [];
                        for (var i = 0; i < replies.length; i++) {
                        	let block = currentBlocks[i]

                        	var myScore = parseInt(replies[i]);
                        	if (!myScore) {
                        		continue
                        	}
                        	var totalScore = parseInt(block.shares)

                        	var reward = Math.floor(block.reward * removeFees * myScore / totalScore)
                            var blockReward = block.reward
                            pending_scores.push({
                              height: block.height,
                              hash: block.hash,
                              time: block.timestamp,
                              difficulty: block.difficulty,
                              totalShares: totalScore,
                              shares: myScore,
                              reward: reward,
                              blockReward: blockReward,
                              blockReward: block.reward,
                              poolType:block.poolType
                          });
                        }

                        callback(null, pending_scores);
                    });

        },

        function(pending, callback) {
        	const redisCommands = [
        	['hgetall', config.coin + ':workers:' + address],
        	['zrevrange', config.coin + ':payments:' + address, 0, global.config.api.payments - 1, 'WITHSCORES'],
        	['keys', config.coin + ':unique_workers:' + address + '~*'],
        	['get', config.coin + ':charts:hashrate:' + address],
        	['zrevrange', config.coin + ':worker_unlocked:' + address, 0, -1, 'WITHSCORES']
        	];
        	redisClient.multi(redisCommands).exec(function(error, replies){
        		if (error || !replies || !replies[0]){
        			statsCallback();
        			return;
        		}

        		const stats = replies[0]
                if(!apiStats.minerStats[address]) {
                    apiStats.minerStats[address] = {}
                }

                if (replies[3]) {
                 var hr_avg = utils.extractAverageHashrates(replies[3]);
                 stats.hashrate_1h  = hr_avg[0];
                 stats.hashrate_6h  = hr_avg[1];
                 stats.hashrate_24h = hr_avg[2];
             }

             const paymentsData = replies[1];

             let payments_24h = 0, payments_7d = 0;
             var now = Math.floor(Date.now() / 1000);
             var then_24h = now - 86400, then_7d = now - 7*86400;
             var need_payments_to;
             for (var p=0; p<paymentsData.length; p += 2) {
                 if (paymentsData[p + 1] < then_7d) {
                    need_payments_to = null;
                    break;
                }
                var paid = parseInt(paymentsData[p].split(':')[1]);
                if (paymentsData[p + 1] >= then_24h){
                    payments_24h += paid;
                }
                payments_7d += paid;
            }
            if (need_payments_to === undefined && paymentsData.length == 2*config.api.payments) {
                    // Ran off the end before getting to a week; we need to fetch more payment info
                    need_payments_to = paymentsData[paymentsData.length-1] - 1;
                }

                let unlockedData = replies[4];

                var workersData = [];
                for (var j=0; j<replies[2].length; j++) {
                	let key = replies[2][j];
                	let keyParts = key.split(':');
                	let miner = keyParts[keyParts.length -1];
                	if (!!~miner.indexOf('~')) {
                		const workerName = miner.substr(miner.indexOf('~')+1, miner.length)
                		let workerData = {
                			name: workerName,
                			hashrate: minersHashrate[miner]  ? minersHashrate[miner] : 0
                		}

                        if(!apiStats.minerStats[miner]) {
                            apiStats.minerStats[miner] = {}
                        }
                        apiStats.minerStats[miner] = workersData
                        workersData.push(workerData);
                    }
                }

                const chartsData = {
                    payments:[],
                    hashrates:JSON.parse(replies[3])
                }

                if(paymentsData && paymentsData.length) {
                    for(var i = 0; paymentsData[i]; i += 2) {
                        chartsData.payments.unshift([+paymentsData[i + 1], paymentsData[i].split(':')[1]])
                    }
                }

                let rc = [];
                for (let i in workersData){
                  rc.push(['hgetall', config.coin + ':unique_workers:' + address + '~' + workersData[i].name])
                  rc.push(['get', global.config.coin + ':charts:worker_hashrate:' + address + '~' + workersData[i].name])
              }

              if (need_payments_to) {
                  rc.push(['zrangebyscore', global.config.coin + ':payments:' + address, then_7d, need_payments_to, 'WITHSCORES']);
              }


              redisClient.multi(rc).exec(function(error, replies){
                  for (var i in workersData) {
                     var wi = 2*i;
                     var hi = wi + 1
                     if (replies[wi]) {
                        workersData[i].lastShare = replies[wi]['lastShare'] ? parseInt(replies[wi]['lastShare']) : 0
                        workersData[i].hashes = replies[wi]['hashes'] ? parseInt(replies[wi]['hashes']) : 0
                        workersData[i].error_count = replies[wi]['error'] ? parseInt(replies[wi]['error']) : 0
                        workersData[i].blocksFound = replies[wi]['blockFounds'] ? parseInt(replies[wi]['blockFounds']) : 0
                        workersData[i].donations = replies[wi]['donations'] ? parseInt(replies[wi]['donations']) : 0
                        workersData[i].poolType = replies[wi]['poolType'] ? replies[wi]['poolType'] : 'props'
                    }

                    if (replies[hi]) {
                        var avgs = utils.extractAverageHashrates(replies[hi]);
                        workersData[i]['hashrate_1h']  = avgs[0];
                        workersData[i]['hashrate_6h']  = avgs[1];
                        workersData[i]['hashrate_24h']  = avgs[2];
                    }
                }

                if (need_payments_to) {
                 let extra_payments = replies[replies.length-1];
                 for (var p=0; p<extra_payments.length; p += 2) {
                    var paid = parseInt(extra_payments[p].split(':')[1]);
                    if (extra_payments[p + 1] >= then_24h) {
                       payments_24h += paid
                   }
                   payments_7d += paid
               }
           }

           stats['payments_24h'] = payments_24h;
           stats['payments_7d'] = payments_7d;


           let minPayoutLevel = stats.minPayoutLevel || 0;

           let minLevel = config.payments.minPayment || 0;

           switch(utils.validateMinerAddress(address)) {
            case 2:
            case 3:
            minLevel = global.config.payments.minPaymentExchangeAddress || global.config.payments.minPaymentIntegratedAddress || global.config.payments.minPayment || 0
            break
            case 4:
            minLevel = global.config.payments.minPaymentSubAddress || global.config.payments.minPaymentExchangeAddress || global.config.payments.minPayment || 0
            default:
            break
        }

        if(minLevel > minPayoutLevel){
         minPayoutLevel = minLevel;
     }

     stats.minPayoutLevel = minPayoutLevel;
     stats.hashrate = minersHashrate[address] || 0;
     apiStats.minerStats[address] = {
        stats: stats,
        payments: paymentsData,
        charts: chartsData,
        workers: workersData,
        unlocked: unlockedData,
        unconfirmed: pending
    }

    statsCallback()
});
          });
}
]);
}
let lastWorkerTotal = 0


// Statistic value handler
const statValueHandler = {
    avg: function(set, value) {
        set[1] = (set[1] * set[2] + value) / (set[2] + 1);
    },
    avgRound: function(set, value) {
        statValueHandler.avg(set, value);
        set[1] = Math.round(set[1]);
    },
    max: function(set, value) {
        if(value > set[1]) {
            set[1] = value;
        }
    }
};

// Presave functions
const preSaveFunctions = {
    hashrate: statValueHandler.avgRound,
    workers: statValueHandler.max,
    difficulty: statValueHandler.avgRound,
    price: statValueHandler.avg,
    profit: statValueHandler.avg
};


// Store collected values in redis database
function storeCollectedValues(chartName, values, settings, cb) {
    const aa = []
    for(let [k,v] of Object.entries(values)) {
        aa.push(next => storeCollectedValue(chartName + ':' + k, v, settings, next))
    }

    async.series(aa, cb)
}

/**
 * Get chart data from redis database
 **/
 function getChartDataFromRedis(chartName, callback) {
    redisClient.get(getStatsRedisKey(chartName), function(error, data) {
        callback(data ? JSON.parse(data) : []);
    });
}

// Store collected value in redis database
function storeCollectedValue(chartName, value, settings, cb) {
    const now = new Date() / 1000 | 0
    getChartDataFromRedis(chartName, function(sets) {
        let lastSet = sets[sets.length - 1] // [time, avgValue, updatesCount]
        const stepInterval = settings ? settings.stepInterval : 60
        if(!lastSet || now - lastSet[0] > stepInterval) {
            lastSet = [now, value, 1];
            sets.push(lastSet);
            const maximumPeriod = settings ? settings.maximumPeriod : 86400
            while(now - sets[0][0] > maximumPeriod) { // clear old sets
                sets.shift();
            }
        } else {
            preSaveFunctions[chartName]
            ? preSaveFunctions[chartName](lastSet, value)
            : statValueHandler.avgRound(lastSet, value);
            lastSet[2]++;
        }
        
        if(getStatsRedisKey(chartName).search(global.config.coin + ":charts:hashrate") >=0){
            redisClient.set(getStatsRedisKey(chartName), JSON.stringify(sets), 'EX', (86400 * 7), (e,r) => {
                cb()
                // log('info', logSystem, chartName + ' chart collected value ' + value + '. Total sets count ' + sets.length);
            });
        }
        else{
            redisClient.set(getStatsRedisKey(chartName), JSON.stringify(sets), (e,r) => {
                cb()
                // log('info', logSystem, chartName + ' chart collected value ' + value + '. Total sets count ' + sets.length);
            });
        }       
        
    });
}

let st = null;

function collectStats(){


    if(st) clearTimeout(st)
        const windowTime = (((Date.now() / 1000) - global.config.api.hashrateWindow) | 0).toString();
    const timelapse = {
        total : process.hrtime.bigint()
    }

    async.series([

        function(callback){
            let startTime = process.hrtime.bigint();

            const redisCommands = [
                ['zremrangebyscore', global.config.coin + ':hashrate', '-inf', '(' + windowTime],//0
                ['zrange', global.config.coin + ':hashrate', 0, -1],//1
                ['hgetall', global.config.coin + ':stats'],//2
                ['zrange', global.config.coin + ':blocks:candidates', 0, -1],
                ['zrevrange', global.config.coin + ':blocks:matured', 0, global.config.api.blocks - 1],//4
                ['hgetall', global.config.coin + ':scores:roundCurrent'],
                ['zcard', global.config.coin + ':blocks:matured'],//6
                ['zrevrange', global.config.coin + ':payments:all', 0, global.config.api.payments - 1, 'WITHSCORES'],
                ['zcard', global.config.coin + ':payments:all'],//8
                ['keys', global.config.coin + ':payments:*']

                ];

                let haveDonations = false;


                redisClient.multi(redisCommands).exec(function(error, replies){

                    redisFinished = Date.now();
                    var dateNowSeconds = Date.now() / 1000 | 0;

                    if (error){
                        log('error', logSystem, 'Error getting redis data %j', [error]);
                        callback();
                        return;
                    }

                    const blockStats = [];

                    for(let ubs in replies[3].reverse()){
                        const unblockStat = replies[3][ubs];
                        const block = new BlockModel(unblockStat);
                        block.miner = utils.truncateAddress(block.miner);
                        blockStats.push(block.toRedis());
                    }

                    for(let bsi in replies[4]){
                        const blockStat = replies[4][bsi];
                        const block = new BlockModel(blockStat);
                        block.miner = utils.truncateAddress(block.miner);
                        blockStats.push(block.toRedis());

                    }

                    let stats = replies[2];
                // lastBlockStats = Object.assign({}, stats);;
                if(stats && stats['blockTemplate']) {
                    delete stats['blockTemplate']
                }

                let data = {
                    stats: stats,
                    blocks: blockStats,
                    payments: replies[7],
                    totalPayments: parseInt(replies[8])||0,
                    totalDonations: stats.totalDonations || 0,
                    totalMinersPaid: replies[9] && replies[9].length > 0 ? replies[9].length - 1 : 0,
                    miners: 0,
                    workers: 0,
                    hashrate: 0,
                };


                let hashrates = replies[1];
                
                for(let miner in apiStats.minerStats) {
                    minersHashrate[miner] = 0
                }

                for (var i = 0; i < hashrates.length; i++){
                    let hashParts = hashrates[i].split(':');
                    
                    minersHashrate[hashParts[1]] = (minersHashrate[hashParts[1]] || 0) + parseInt(hashParts[0]);
                }

                let totalShares = 0;

                for (let miner in minersHashrate){
                    if (!!~miner.indexOf('~')) {
                        data.workers ++;
                    } else {
                        totalShares += minersHashrate[miner];
                        data.miners ++;
                    }

                    minersHashrate[miner] = Math.round(minersHashrate[miner] / config.api.hashrateWindow);

                    if (!apiStats.minerStats[miner]) { 
                        apiStats.minerStats[miner] = {}; 
                    }

                    apiStats.minerStats[miner]['hashrate'] = minersHashrate[miner];
                }

                data.hashrate = Math.round(totalShares / global.config.api.hashrateWindow);

                timelapse.pool =  process.hrtime.bigint() - startTime

                apiStats.poolStats.pool = data
                apiStats.poolStats.lastblock = {
                    difficulty: stats ? stats.lastblock_difficulty : 0,
                    height: stats  ? stats.lastblock_height : 0,
                    timestamp: stats ? stats.lastblock_timestamp : 0,
                    reward: stats ? stats.lastblock_lastreward : 0,
                    hash:  stats ? stats.lastblock_hash : 0
                }
                apiStats.poolStats.network = {
                    difficulty: stats ? stats.difficulty : 0,
                    height: stats ? stats.height : 0
                }
                callback();

            });
            },
            function (callback) {

                let startTime = process.hrtime.bigint();
                const stats = {}

                let chartsNames = [];
                let redisKeys = [];
                for(let chartName in global.config.charts.pool) {
                    if(global.config.charts.pool[chartName].enabled) {
                        chartsNames.push(chartName)
                        redisKeys.push(getStatsRedisKey(chartName))
                    }
                }

                if(!redisKeys.length) {
                    timelapse.charts =  process.hrtime.bigint() - startTime
                    apiStats.poolStats.charts = stats
                    callback();
                    return 
                }

                    log('info', logSystem, "Collecting Stats %d", [redisKeys.length])

                redisClient.mget(redisKeys, function(error, data) {
                    if(data) {
                        for(let i in data) {
                            if(data[i]) {
                                try{
                                    stats[chartsNames[i]] = JSON.parse(data[i]);
                                } catch(e) {
                                    stats[chartsNames[i]] = data[i];
                                }
                            }
                        }
                    }

                    if (!global.config.charts.blocks || !global.config.charts.blocks.enabled || !global.config.charts.blocks.days) {
                    timelapse.charts =  process.hrtime.bigint() - startTime
                    apiStats.poolStats.charts = stats
                    log('info', logSystem, "Collecting Stats 2")
                    callback();
                        return
                    }

                    let chartDays = global.config.charts.blocks.days;

                    let beginAtTimestamp = (Date.now() / 1000) - (chartDays * 86400);
                    let beginAtDate = new Date(beginAtTimestamp * 1000);
                    if (chartDays > 1) {
                        beginAtDate = new Date(beginAtDate.getFullYear(), beginAtDate.getMonth(), beginAtDate.getDate(), 0, 0, 0, 0);
                        beginAtTimestamp = beginAtDate / 1000 | 0;
                    }

                    let blocksCount = {};
                    if (chartDays === 1) {
                        for (var h = 0; h <= 24; h++) {
                            var date = utils.dateFormat(new Date((beginAtTimestamp + (h * 60 * 60)) * 1000), 'yyyy-mm-dd HH:00');
                            blocksCount[date] = 0;
                        }
                    } else {
                        for (var d = 0; d <= chartDays; d++) {
                            var date = utils.dateFormat(new Date((beginAtTimestamp + (d * 86400)) * 1000), 'yyyy-mm-dd');
                            blocksCount[date] = 0;
                        }
                    }

                    redisClient.zrevrange(config.coin + ':blocks:matured', 0, -1, function(err, result) {
                        for (let i = 0; i < result.length; i++){
                            const block = new BlockModel(result[i]);
                            var blockTimestamp = block.timestamp;
                            if (blockTimestamp < beginAtTimestamp) {
                                continue;
                            }
                            var date = utils.dateFormat(new Date(blockTimestamp * 1000), 'yyyy-mm-dd');
                            if (chartDays === 1) utils.dateFormat(new Date(blockTimestamp * 1000), 'yyyy-mm-dd HH:00');
                            if (!blocksCount[date]) blocksCount[date] = 0;
                            blocksCount[date] ++;
                        }
                        stats.blocks = blocksCount;
                        timelapse.charts =  process.hrtime.bigint() - startTime
                        apiStats.poolStats.charts = stats
                        log('info', logSystem, "Collecting Stats 2")
                        callback();
                    });
                })
            },

            function (callback) {
                log('info', logSystem, "Collecting Stats 3")

                let startTime = process.hrtime.bigint();

                const limit = 10
                const data = []
                for(let address in apiStats.minerStats) {
                    if(!apiStats.minerStats[address]['stats']) {
                        continue
                    }
                    const stat = apiStats.minerStats[address]['stats'];
                    stat.miner = utils.truncateAddress(address)
                    data.push(stat);
                }

                const topMiners = {
                    limit,
                    current_hashrate:data.length > 0 ? utils.compareTopMiners(data.slice(), limit) : [],
                    donate:data.length > 0 ? utils.compareTopDonators(data.slice(), limit) : [],
                    unblocker:data.length > 0 ? utils.compareTopUnblockers(data.slice(), limit) : [],
                    hashes:data.length > 0 ? utils.compareTopHashes(data.slice(), limit) : []
                }
                timelapse.topMiners =  process.hrtime.bigint() - startTime
                apiStats.poolStats.topMiners = topMiners
                callback()
            },
            function(callback) {
                log('info', logSystem, "Collecting Stats 4")

                redisClient.zrevrange(config.coin + ':blocks:candidates', 0, -1, 'WITHSCORES', function(error, results){
                    if (!error) {

                        var blocks = [];

                        for (var i = 0; i < results.length; i += 2){
                            const block = new BlockModel(results[i]);
                            blocks.push(block);
                        }

                        currentBlocks = blocks


                    }

                    callback()

                });
            },
            function(callback) {
                log('info', logSystem, "Collecting Stats 5")

                const k = 'hashrate'
                const v = (apiStats.poolStats && apiStats.poolStats.pool) ? Math.round(apiStats.poolStats.pool[k]) : 0
                storeCollectedValue(k, v,  global.config.charts.pool[k], callback)
            },
            function(callback) {
                log('info', logSystem, "Collecting Stats 6")
                const k = 'miners'
                const v = apiStats.poolStats && apiStats.poolStats.pool ? Math.round(apiStats.poolStats.pool[k]) : 0
                storeCollectedValue(k, v,  global.config.charts.pool[k], callback)
            },
            function(callback) {
                log('info', logSystem, "Collecting Stats 7")
                const k = 'workers'
                const v = apiStats.poolStats && apiStats.poolStats.pool ? Math.round(apiStats.poolStats.pool[k]) : 0
                storeCollectedValue(k, v,  global.config.charts.pool[k], callback)
            },
            function(callback) {
                log('info', logSystem, "Collecting Stats 8")
                const k = 'workers_solo'
                const v = (apiStats.poolStats && apiStats.poolStats.pool && apiStats.poolStats.pool.stats) ? Math.round(apiStats.poolStats.pool.stats[k]) : 0
                storeCollectedValue(k, v,  global.config.charts.pool[k], callback)
            },
            function(callback) {
                log('info', logSystem, "Collecting Stats 9")
                const k = 'workers_props'
                const v = (apiStats.poolStats && apiStats.poolStats.pool && apiStats.poolStats.pool.stats) ? Math.round(apiStats.poolStats.pool.stats[k]) : 0
                storeCollectedValue(k, v,  global.config.charts.pool[k], callback)
            },
            function(callback) {
                log('info', logSystem, "Collecting Stats 10")
                const k = 'difficulty'
                const v = (apiStats.poolStats && apiStats.poolStats.pool && apiStats.poolStats.pool.stats) ? Math.round(apiStats.poolStats.pool.stats[k]) : 0
                storeCollectedValue(k, v,  global.config.charts.pool[k], callback)
            },
            function(callback) {
                log('info', logSystem, "Collecting Stats 11")

                let hashrate_miners = {}
                for (let miner in apiStats.minerStats){
                    if (!~miner.indexOf('~')) {
                        hashrate_miners[miner] = minersHashrate[miner]
                    }
                }
                storeCollectedValues('hashrates', hashrate_miners,  global.config.charts.user.hashrates, callback);

            },
            function(callback) {
                log('info', logSystem, "Collecting Stats 12")

                let hashrate_workers = {}
                for (let miner in apiStats.minerStats){
                    if (!!~miner.indexOf('~')) {
                        hashrate_workers[miner] = minersHashrate[miner]
                    }
                }

                storeCollectedValues('worker_hashrate', hashrate_workers, global.config.charts.user.worker_hashrate, callback);
            },
            function(callback) {
                log('info', logSystem, "Collecting Stats 13")
                apiStats.poolStats.updated = Date.now()
                timelapse.total =  Number(process.hrtime.bigint() - timelapse.total)
                if(timelapse.total > (lastTotal * 1.75 )|| timelapse.total < (lastTotal * 0.25)) {

                    let msg = 'Stats Collected: \n'
                    for(const [key,value] of Object.entries(timelapse)) {
                        msg += `${key} : ${utils.readableSI(Number(value),"", "nsecs", true)} | ` 
                    }
                    log('info', logSystem, msg);
                    lastTotal = timelapse.total
                }
                callback()
            },
            function(callback) {
                log('info', logSystem, "Collecting Stats 14")
                process.send({type:'apiStats', data: apiStats},null, () => {
                    callback()
                })
            },
            ], function(error){
                log('info', logSystem, "Collecting Stats 15")

                if (error){
                    log('error', logSystem, 'Error collecting all stats');
                }

            // collectStats()
            st = setTimeout(collectStats,1000)
        })
};

collectStats()

 process.on('message', function(msg) {
    switch(msg.type) {
        case 'apiStatsRefresh':
            console.log("REFRESH!!!")
            collectStats()
        break
    }
});

// const zmq = require('zeromq')
// const publisher = zmq.socket('pub');

// publisher.bindSync('inproc://worker_pool');

// setInterval(() => {
//     process.send({type:'apiStats', data: apiStats})
//     // publisher.send(['apiStats', JSON.stringify(apiStats)])

// },1000)

async.forever(
    next => {
        lastCollectWorkerStats = Date.now()
        let startTime = process.hrtime.bigint()

        const sts = `${global.config.coin}:workers:`
        redisClient.keys(`${sts}*`, (error, replies) => {
            if(error) {
                callback(null,{})
                return
            }

            const miners = []
            for(let i =0;i<replies.length;i++) {
                const miner = replies[i].substr(sts.length, replies[i].length)
                miners.push(miner)
            }

            async.eachSeries(miners,collectWorkerStats, (e,r) => {
                const timelapsetotal = Number(process.hrtime.bigint() - startTime)
                if(timelapsetotal > (lastWorkerTotal * 1.9 )|| timelapsetotal < (lastWorkerTotal * 0.1)) {

                    let msg = `Miners (%d) Stats Collected:  ${utils.readableSI(Number(timelapsetotal),"", "nsecs", true)}`
                    log('info', logSystem, msg, [miners.length])
                    lastWorkerTotal = timelapsetotal
                }

                setTimeout(next, 1000)
            })
        })
    }
    )