
const logSystem = 'workers/api'
const async = require('async');
const BlockModel  = require('../model/Blocks');
const utils  = require('../utils');

let lastBlockStats = null;
/**
 * Collect statistics data
 **/

 /**
 * Return pool public ports
 **/
 function getPublicPorts(ports){
 	return ports.filter(function(port) {
 		return !port.hidden;
 	});
 }

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
	
 let lastTotal = 0
 let getPoolConfigs = {}
 let minerStats = {}
 let poolStats = {}
 let minersHashrate = {} 
 
 const collectStats = () => {

 	const windowTime = (((Date.now() / 1000) - global.config.api.hashrateWindow) | 0).toString();
 	const timelapse = {
 		total : process.hrtime.bigint()
 	}

 	async.parallel({
 		config: function(callback){
 			let startTime = process.hrtime.bigint()
 			const getPoolConfigs = {
 				supportedPayments : global.config.payments.supported,
 				ports: getPublicPorts(config.poolServer.ports),
 				hashrateWindow: config.api.hashrateWindow,
 				fees : global.config.payments.poolFees,
 				donations:global.config.poolServer.donations,
 				devFee: global.config.blockUnlocker.devFee || 0,
 				networkFee: global.config.blockUnlocker.networkFee || 0,
 				coin: global.config.coin,
 				coinUnits: global.config.coinUnits,
 				coinDecimalPlaces: global.config.coinDecimalPlaces || 2, 
 				coinDifficultyTarget: global.config.coinDifficultyTarget,
 				symbol: global.config.symbol,
 				depth: global.config.blockUnlocker.depth,
 				version: global.config.version,
 				paymentsInterval: global.config.payments.interval,
 				minPaymentThreshold: global.config.payments.minPayment,
 				minPaymentExchangedAddressThreshold: global.config.payments.minPaymentExchangeAddress || global.config.payments.minPaymentIntegratedAddress || config.payments.minPayment,
 				minPaymentSubAddressThreshold: global.config.payments.minPaymentSubAddress || config.payments.minPayment,
 				maxPaymentThreshold: global.config.payments.maxPayment || config.payments.maxTransactionAmount,
 				transferFee: global.config.payments.dynamicTransferFee?0:config.payments.transferFee,
 				dynamicTransferFee:global.config.payments.dynamicTransferFee,
 				denominationUnit  :global.config.payments.denomination,
 				priceSource:global. config.prices ? global.config.prices.source : 'tradeorge',
 				priceCurrency: global.config.prices ? global.config.prices.currency : 'USD',
 				paymentIdSeparator: global.config.poolServer.paymentId,
 				fixedDiffEnabled: global.config.poolServer.fixedDiff.enabled,
 				fixedDiffSeparator: global.config.poolServer.fixedDiff.addressSeparator,
 				blocksChartEnabled: (global.config.charts.blocks && global.config.charts.blocks.enabled),
 				blocksChartDays: global.config.charts.blocks && global.config.charts.blocks.days ? global.config.charts.blocks.days : null,
 				unlockBlockReward: global.config.blockUnlocker.reward || 0
 			};
 			timelapse.config =  process.hrtime.bigint() - startTime
 			callback(null,getPoolConfigs);
 		},
 		system: function(callback){
 			// let os_load = os.loadavg();
 			// let num_cores = os.cpus().length;
 			callback(null, {
 				load:0,
 				number_cores:0
 				// load: os_load,
 				// number_cores: num_cores
 			});
 		},

 		pool: function(callback){
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
 			if (getPoolConfigs.donations && getPoolConfigs.donations.enabled && getPoolConfigs.donations.address) {
 				haveDonations = true;
		 		// redisCommands.push(['hmget', config.coin + ':workers:' + getPoolConfigs.donations.address, 'balance', 'paid']);
		 	}


		 	redisClient.multi(redisCommands).exec(function(error, replies){

		 		redisFinished = Date.now();
		 		var dateNowSeconds = Date.now() / 1000 | 0;

		 		if (error){
		 			log('error', logSystem, 'Error getting redis data %j', [error]);
		 			callback(true);
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
		 		lastBlockStats = Object.assign({}, stats);;
		 		if(stats && stats['blockTemplate']) {
		 			delete stats['blockTemplate']
		 		}

		 		let data = {
		 			stats: stats,
		 			blocks: blockStats,
		 			payments: replies[7],
		 			totalPayments: parseInt(replies[8])||0,
		 			totalDonations: lastBlockStats.totalDonations || 0,
		 			totalMinersPaid: replies[9] && replies[9].length > 0 ? replies[9].length - 1 : 0,
		 			miners: 0,
		 			workers: 0,
		 			hashrate: 0,
		 		};


		 		let hashrates = replies[1];
                
                for(let miner in minerStats) {
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

		 			if (!minerStats[miner]) { 
		 				minerStats[miner] = {}; 
		 			}

		 			minerStats[miner]['hashrate'] = minersHashrate[miner];
		 		}

		 		data.hashrate = Math.round(totalShares / global.config.api.hashrateWindow);

 				timelapse.pool =  process.hrtime.bigint() - startTime
 				callback(null, data);

 			});
		 },

		 lastblock: function(callback){

		 	callback(null, {
		 		difficulty: lastBlockStats ? lastBlockStats.lastblock_difficulty : 0,
		 		height: lastBlockStats  ? lastBlockStats.lastblock_height : 0,
		 		timestamp: lastBlockStats ? lastBlockStats.lastblock_timestamp : 0,
		 		reward: lastBlockStats ? lastBlockStats.lastblock_lastreward : 0,
		 		hash:  lastBlockStats ? lastBlockStats.lastblock_hash : 0
		 	});
		 },
		 network: function(callback){

		 	callback(null, {
		 		difficulty: lastBlockStats ? lastBlockStats.difficulty : 0,
		 		height: lastBlockStats ? lastBlockStats.height : 0
		 	});
		 },
		 charts: function (callback) {
            // Get enabled charts data
            let startTime = process.hrtime.bigint();


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
            	callback(null, {})
            	return
            }
            Cache.readMultiCallback(redisKeys, cacheCallback => {
            	redisClient.mget(redisKeys, function(error, data) {
	            	cacheCallback(data, 1)
	            })
            }, data => {
            	const stats = {}
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
            		callback(null, stats);
            		return;
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
            		callback(err, stats);
            	});
            })
        } 
    }, function(error, stats){

    	timelapse.total =  Number(process.hrtime.bigint() - timelapse.total)
    	if(timelapse.total > (lastTotal * 1.75 )|| timelapse.total < (lastTotal * 0.25)) {

	    	let msg = 'Stats Collected: \n'
	    	for(const [key,value] of Object.entries(timelapse)) {
	    		msg += `${key} : ${utils.readableSI(Number(value),"", "nsecs", true)} | ` 
	    	}
    		log('info', logSystem, msg);
    		lastTotal = timelapse.total
    	}



    	if (error){
    		log('error', logSystem, 'Error collecting all stats');
    	} else{
    		process.send({type:'collectStats', stats, minerStats})
    	}
    	poolStats = stats
    	setTimeout(collectStats, 1000);
    });
}
/**
 * Obtains worker stats and invokes the given callback with them.
 */
 function collectWorkerStats(address, statsCallback) {
 	async.waterfall([

        // Get all pending blocks (to find unconfirmed rewards)
        function(callback){
        	redisClient.zrevrange(config.coin + ':blocks:candidates', 0, -1, 'WITHSCORES', function(error, results){
        		if (error) {
        			statsCallback({error: 'Not found'});
        			return;
        		}
        		var blocks = [];

        		for (var i = 0; i < results.length; i += 2){
        			const block = new BlockModel(results[i]);
        			blocks.push(block);
        		}

        		callback(null, blocks);
        	});
        },

        function(blocks, callback) {
        	var redisCommands = []
        	for (let i = 0;i< blocks.length;i++) {
        		const height = blocks[i].height
        		redisCommands.push(['hget', config.coin + ':shares_actual:round' + height, address]);
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
                        	let block = blocks[i]
                        	var myScore = parseFloat(replies[i]);
                        	if (!myScore) {
                        		continue;
                        	}
                        	var totalScore = parseFloat(block.shares);

                        	var reward = Math.floor(block.reward * removeFees * myScore / totalScore);
                        	pending_scores.push({
                        		height: block.height,
                        		hash: block.hash,
                        		time: block.timestamp,
                        		difficulty: block.difficulty,
                        		totalShares: parseFloat(myScore),
                        		shares: parseFloat(replies[i]),
                        		totalScore: totalScore,
                        		reward: reward,
                        		blockReward: block.reward
                        	});
                        }

                        callback(null, pending_scores);
                    });

        },

        function(pending, callback) {
        	var redisCommands = [
        	['hgetall', config.coin + ':workers:' + address],
        	['zrevrange', config.coin + ':payments:' + address, 0, global.config.api.payments - 1, 'WITHSCORES'],
        	['keys', config.coin + ':unique_workers:' + address + '~*'],
        	['get', config.coin + ':charts:hashrate:' + address],
        	['zrevrange', config.coin + ':worker_unlocked:' + address, 0, -1, 'WITHSCORES']
        	];
        	redisClient.multi(redisCommands).exec(function(error, replies){
        		if (error || !replies || !replies[0]){
        			statsCallback({
        				error: 'Not found'
        			});
        			return;
        		}

        		const stats = replies[0]
                if(!minerStats[address]) {
                    minerStats[address] = {}
                }
                // minerStats[address] = {...minerStats[address], ...stats}
                // minerStats[address].donations = stats.donations || 0
                // minerStats[address].hashes = stats.hashes || 0
                // minerStats[address].lastShare = stats.lastShare || 0
                // minerStats[address].blocksFound = stats.blocksFound || 0

        		// stats.hashrate = minerStats[address] && minerStats[address]['hashrate'] ? minerStats[address]['hashrate'] : 0;
        		// stats.roundScore = minerStats[address] && minerStats[address]['roundScore'] ? minerStats[address]['roundScore'] : 0;
        		// stats.roundHashes = minerStats[address] && minerStats[address]['roundHashes'] ? minerStats[address]['roundHashes'] : 0;
        		// stats.poolRoundScore = currentStats.pool.roundScore;
        		// stats.poolRoundHashes = currentStats.pool.roundHashes;
        		// stats.networkHeight = currentStats.network.height;
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

                        if(!minerStats[miner]) {
                            minerStats[miner] = {}
                        }
                        minerStats[miner] = workersData
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

            	let redisCommands = [];
            	for (let i in workersData){
            		redisCommands.push(['hgetall', config.coin + ':unique_workers:' + address + '~' + workersData[i].name]);
            		redisCommands.push(['get', config.coin + ':charts:worker_hashrate:' + address + '~' + workersData[i].name]);
            	}
            	if (need_payments_to) {
            		redisCommands.push(['zrangebyscore', config.coin + ':payments:' + address, then_7d, need_payments_to, 'WITHSCORES']);
            	}

            	redisClient.multi(redisCommands).exec(function(error, replies){
            		for (var i in workersData) {
            			var wi = 2*i;
            			var hi = wi + 1
            			if (replies[wi]) {
            				workersData[i].lastShare = replies[wi]['lastShare'] ? parseInt(replies[wi]['lastShare']) : 0;
            				workersData[i].hashes = replies[wi]['hashes'] ? parseInt(replies[wi]['hashes']) : 0;
            				workersData[i].error_count = replies[wi]['error'] ? parseInt(replies[wi]['error']) : 0;
            				workersData[i].blocksFound = replies[wi]['blockFounds'] ? parseInt(replies[wi]['blockFounds']) : 0;
            				workersData[i].donations = replies[wi]['donations'] ? parseInt(replies[wi]['donations']) : 0;
            				workersData[i].poolType = replies[wi]['poolType'] ? replies[wi]['poolType'] : 'props';
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

            		var minLevel = config.payments.minPayment || 0;

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
                    minerStats[address] = {
                        stats: stats,
                        payments: paymentsData,
                        charts: chartsData,
                        workers: workersData,
                        unlocked: unlockedData,
                        unconfirmed: pending
                    }

            		statsCallback(minerStats[address]);
            	});
            });
		}
	]);
}
let lastWorkerTotal = 0
const collectWorkers = () => {
    let startTime = process.hrtime.bigint();

    const sts = `${global.config.coin}:workers:`
    redisClient.keys(`${sts}*`, (error, replies) => {
        if(error) {
            callback(null,{});
            return
        }

        const miners = []
        for(let i =0;i<replies.length;i++) {
            const miner = replies[i].substr(sts.length, replies[i].length)
            miners.push(miner)
        }
        async.each(miners,collectWorkerStats, (e,r) => {
            const timelapsetotal = Number(process.hrtime.bigint() - startTime)
            if(timelapsetotal > (lastWorkerTotal * 1.75 )|| timelapsetotal < (lastWorkerTotal * 0.25)) {

                let msg = `Workers(%d) Stats Collected:  ${utils.readableSI(Number(timelapsetotal),"", "nsecs", true)}`
                log('info', logSystem, msg, [Object.keys(minerStats).length])
                lastWorkerTotal = timelapsetotal
            }

            setTimeout(collectWorkers, 1000)
        })
    })
}

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
function storeCollectedValues(chartName, values, settings) {
    for(var i in values) {
        storeCollectedValue(chartName + ':' + i, values[i], settings);
    }
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
function storeCollectedValue(chartName, value, settings) {
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
        }
        else {
            preSaveFunctions[chartName]
                ? preSaveFunctions[chartName](lastSet, value)
                : statValueHandler.avgRound(lastSet, value);
            lastSet[2]++;
        }
        
        if(getStatsRedisKey(chartName).search(global.config.coin + ":charts:hashrate") >=0){
        	Cache.write(getStatsRedisKey(chartName),sets)
            redisClient.set(getStatsRedisKey(chartName), JSON.stringify(sets), 'EX', (86400 * 7));
        }
        else{
        	Cache.write(getStatsRedisKey(chartName),sets)
            redisClient.set(getStatsRedisKey(chartName), JSON.stringify(sets));
        }       
        
        // log('info', logSystem, chartName + ' chart collected value ' + value + '. Total sets count ' + sets.length);
    });
}



const collectInfo = () => {

    async.parallel({
            hashrate: (callback) => {
               callback(null, poolStats.stats && poolStats.stats.pool ? Math.round(poolStats.stats.pool.hashrate) : null)
            },
            miners: (callback) => {
               callback(null, poolStats.stats && poolStats.stats.pool ? Math.round(poolStats.stats.pool.miners) : null)
            },
            workers: (callback) => {
               callback(null, poolStats.stats && poolStats.stats.pool ? Math.round(poolStats.stats.pool.stats.workers) : null)
            },
            workers_solo: (callback) => {
               callback(null, poolStats.stats && poolStats.stats.pool ? Math.round(poolStats.stats.pool.stats.workers_solo) : null)
            },
            workers_props: (callback) => {
               callback(null, poolStats.stats && poolStats.stats.pool ? Math.round(poolStats.stats.pool.stats.workers_props) : null)
            },
            difficulty: (callback) => {
               callback(null, poolStats.stats && poolStats.stats.difficulty ? Math.round(poolStats.stats.pool.difficulty) : null)
            },
            price: (callback) => {
               callback(null, null)
            },
            profit: (callback) => {
               callback(null, null)
            }
        },
        function(eee, rrr) {
            for(let [k,v] in Object.entries(rrr)) {
                storeCollectedValue(k, v,  global.config.charts.pool[k])
            }

            let hashrate_workers = {}
            let hashrate_miners = {}
            for (let miner in minerStats){
                if (!!~miner.indexOf('~')) {
                    hashrate_workers[miner] = minersHashrate[miner]
                } else {
                    hashrate_miners[miner] = minersHashrate[miner]
                }
            }

            storeCollectedValues('hashrates', hashrate_miners,  global.config.charts.user.hashrates);
            storeCollectedValues('worker_hashrate', hashrate_workers, global.config.charts.user.worker_hashrate);

            Cache.logMemory()

            setTimeout(collectInfo, 60 * 1000)
    });
}

collectWorkers()
collectStats()
collectInfo()
