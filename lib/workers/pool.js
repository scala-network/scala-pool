let utils = require('../utils.js');
let async = require('async');
let rpcDaemon = require('../rpc/daemon.js');

let lastHash={}

let POOL_NONCE_SIZE = 16 + 1;
let EXTRA_NONCE_TEMPLATE = "02" + POOL_NONCE_SIZE.toString(16) + "00".repeat(POOL_NONCE_SIZE);
let POOL_NONCE_MM_SIZE = POOL_NONCE_SIZE + utils.cnUtil.get_merged_mining_nonce_size();
let EXTRA_NONCE_NO_CHILD_TEMPLATE = "02" + POOL_NONCE_MM_SIZE.toString(16) + "00".repeat(POOL_NONCE_MM_SIZE);


let logSystem = 'workers/pool'

require('../exceptionWriter.js')(logSystem);



let timeoutInterval = null
function jobRefresh () {
	if(timeoutInterval) {
		timeoutInterval = null;
		clearTimeout(timeoutInterval)
	}

	async.series([
			next => {
				rpcDaemon.getLastBlockData((err, res) => {

					if (err) {
						next('Error from getlastblockheader',err);
						return;
					}
					if(!res) {
						next('No reponse from getinfo', null);
						return;
					}
					if (res.status !== "OK" || !('block_header' in res) || !('height' in res.block_header) || !('hash' in res.block_header)) {
						next('bad reponse from getinfo', res);
						return;
					}

					const blockHeader = res.block_header

					if(blockHeader.height !== lastHash.lastblock_height || blockHeader.hash !== lastHash.lastblock_hash) {
						lastHash = {
							lastblock_height: blockHeader.height,
							lastblock_difficulty: blockHeader.difficulty,
							lastblock_timestamp: blockHeader.timestamp,
							lastblock_lastReward: blockHeader.reward,
							lastblock_lastMinerReward: blockHeader.miner_reward || blockHeader.reward,
							lastblock_hash: blockHeader.hash
						}

						log('info', logSystem, '%s received new hash %s at Heigh: %s', [global.config.coin, lastHash.lastblock_hash, lastHash.lastblock_height]);
						next(null);
						return
					}
					next(true)
				});
			},
			next => {
				rpcDaemon.getBlockTemplate({
					reserve_size: POOL_NONCE_SIZE,
					wallet_address: global.config.poolServer.poolAddress
				}, (err, res) => {
					if (err) {
						next('Error polling getblocktemplate', err)
						return
					}

					if (res.error) {
						next('Error polling getblocktemplate', res.error)
						return
					}

					// log('info', logSystem, '%s sending template for height : %s', [global.config.coin, lastHash.lastblock_height]);
					
					process.send({
						type: 'blockTemplate',
						block: res
					})
					lastHash.blockTemplate = res
					next(null)
				})
			},
			next => {
				rpcDaemon.getNetworkData(function(error, reply) {
	                if (error) {
	                    next("Error getting network data", error)
	                    return;
	                } 

					// log('info', logSystem, 'Received network data at height %d', [reply.height]);

	                redisClient.hmset(global.config.coin + ':stats', [
						'blockTemplate', JSON.stringify(lastHash.blockTemplate),
						'lastblock_height', lastHash.lastblock_height,
						'lastblock_difficulty', lastHash.lastblock_difficulty,
						'lastblock_timestamp', lastHash.lastblock_timestamp,
						'lastblock_lastReward', lastHash.lastblock_lastReward,
						'lastblock_lastMinerReward', lastHash.lastblock_lastMinerReward,
						'lastblock_hash', lastHash.lastblock_hash, 
						'timestamp', Date.now(),
						'difficulty', reply.difficulty,
				         'height', reply.height],
					(e,r) => {

					});
					next(null)
	            });
				
			}
		],
		function (e,r) {
			if(e && e !== true) {
				log('error', logSystem, e, [r]);
			}
			setTimeout(jobRefresh, 1000)
		})
}


// Every 30 seconds clear out timed-out miners and old bans
let bannedIPs = []
let st = ""
let connectedMiners = {}
	const banningEnabled = global.config.poolServer.banning && global.config.poolServer.banning.enabled

	const interval = () => {
		async.waterfall([
			callback => {
				const redisCmds = []

				const now = Date.now();
				if(!banningEnabled || bannedIPs.length <= 0 ) return callback()

				for(let i = 0;i<bannedIPs.length;i++)  redisCmds.push(['hget', global.config.coin + ":ipBan", bannedIPs[i]])

		        redisClient.multi(redisCmds).exec((e,r) => {
		        	if(e) return
		        	let newBannedIps = []
		        	let remBannedIps = []
		        	const rc = []
		        	for(let i = 0;i<bannedIPs.length;i++) {
						const ip = bannedIPs[i]
			            const banTime = r[i]

			            if (now - banTime > global.config.poolServer.banning.time * 1000) {
			                log('info', logSystem, 'Ban dropped for %s', [ip]);
			                remBannedIps.push(ip)
			    			rc.push(['hdel', global.config.coin + ":ipBan", ip])
			            } else {
			            	newBannedIps.push(ip)
			            }
			        }

			    	bannedIPs = newBannedIps
			    	if(remBannedIps.length) {
			    		redisClient.multi(rc).exec((ee, rr) => {
			    			process.send({type:'unbanIps',ips:remBannedIps})
			    			callback()
			    		})
			    	} else {
			    		callback()
			    	}
		        })
			},
			callback => {
				const minerIds = Object.keys(connectedMiners)
				if(minerIds.length <= 0) {
					return callback()
				}
				const stats = {}

				for(let i = 0;i<minerIds.length;i++) {
					const minerId = minerIds[i]
					const miner = connectedMiners[minerId]
					const poolType = miner.poolType
					const port = miner.port

					if(!stats[poolType]) {
						stats[poolType] = 0
					}

					stats[poolType]++


					if(!stats[""+port]) {
						stats[""+port] = 0
					}
					
					stats[""+port]++
		        }

		        const redisCmds = []
		        for(let i =0;i<Object.keys(stats).length;i++) {
		        	const key = Object.keys(stats)[i]
		        	const value = stats[key]
		        	redisCmds.push(['hset', 'workers_' + key, value])
		        }

		        redisClient.multi(redisCmds).exec((e,r) => {
					callback()
				})
			},
			(e) => {
				if(st !== (bannedIPs.length +"_"+ Object.keys(connectedMiners).length)){
					log('info', logSystem, 'Banning (%d) and connectedMiners (%d) checking done.',[bannedIPs.length,Object.keys(connectedMiners).length])
					st = bannedIPs.length +"_"+ Object.keys(connectedMiners).length
				}

				setTimeout(interval, 30000)
			}
		])
	}


	const clearFields = ['workers',0]
	const type = []
	for(let i=0;i<global.config.poolServer.ports.length;i++) {
		clearFields.push('workers_' + global.config.poolServer.ports[i].port, 0);
		log('info', logSystem, 'Clear values for port %d in redis database.', [global.config.poolServer.ports[i].port])

		if(!!~type.indexOf(global.config.poolServer.ports[i].poolType))  continue

		log('info', logSystem, 'Clear values for poolType %s in redis database.', [global.config.poolServer.ports[i].poolType])
		clearFields.push('workers_' + global.config.poolServer.ports[i].poolType, 0)
	}

	const redisCmds = []

	redisCmds.push(['hmset', global.config.coin + ':stats',clearFields])
	redisCmds.push(['del', global.config.coin + ':ipBan'])

	redisClient.multi(redisCmds).exec((e,r) => {
		jobRefresh()
		interval()
	})



/**
 * Handle multi-thread messages
 **/ 
 process.on('message', function(message) {
    switch (message.type) {
        case 'jobRefresh':
        case 'pingpong':
        jobRefresh()
        break
        case 'connectedMiners':
        connectedMiners[message.data.id] = message.data
        break
        case 'disconnectedMiners':
        if(message.data.reason === 'banned') {
        	if(!~bannedIPs.indexOf(message.data.ip)) {
        		bannedIPs.push(message.data.ip)
        		redisClient.hset(global.config.coin + ":ipBan", message.data.ip, Date.now());
        	}
        }
        delete connectedMiners[message.data.id]
        break
    }
});
