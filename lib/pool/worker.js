let utils = require('../utils.js');
let async = require('async');
let rpcDaemon = require('../rpc/daemon.js');

let lastHash={}

let POOL_NONCE_SIZE = 16 + 1;
let EXTRA_NONCE_TEMPLATE = "02" + POOL_NONCE_SIZE.toString(16) + "00".repeat(POOL_NONCE_SIZE);
let POOL_NONCE_MM_SIZE = POOL_NONCE_SIZE + utils.cnUtil.get_merged_mining_nonce_size();
let EXTRA_NONCE_NO_CHILD_TEMPLATE = "02" + POOL_NONCE_MM_SIZE.toString(16) + "00".repeat(POOL_NONCE_MM_SIZE);


let logSystem = 'poolWorker'

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

						log('info', logSystem, '%s receive new hash %s at Heigh: %s', [global.config.coin, lastHash.lastblock_hash, lastHash.lastblock_height]);
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

					// log('info', logSystem, '%s process template for height : %s', [global.config.coin, lastHash.lastblock_height]);
					
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
						log('info', logSystem, 'Network data set at height %d', [reply.height]);

					});
					next(null);
	            });
				
			}
		],
		function (e,r) {
			if(e && e !== true) {

				if(!('code' in r) || (r.code !== 'ECONNRESET' && r.code !== 'ETIMEDOUT' )) log('error', logSystem, e, [r]);
			}
			setTimeout(jobRefresh, 500)
		})
}


const clearFields = [
	'workers',0,
	'workers_props',0,
	'workers_solo',0
]

for(let i=0;i<global.config.poolServer.ports.length;i++) {
	const port = global.config.poolServer.ports[i].port
	clearFields.push('port_' + port, 0);
	log('info', logSystem, 'Clear values for port %d in redis database.', [port]);
}

redisClient.hmset(global.config.coin + ':stats',clearFields, (e,r) => {
	jobRefresh()
});
/**
 * Handle multi-thread messages
 **/ 
 process.on('message', function(message) {
    switch (message.type) {
        case 'jobRefresh':
        case 'pingpong':
        jobRefresh()
        break;
    }
});
