const async = require('async');
const Blocks = require('../model/Blocks');
const BlockStats = require('../model/BlockStats');

const haveBlockUnlockerAward = global.config.blockUnlocker.reward && global.config.blockUnlocker.reward > 0;
const unlockerRewardPercent = (haveBlockUnlockerAward) ? ( global.config.blockUnlocker.reward / 100 ) : 0;
const networkFee = global.config.payments.networkFee || 0.00;
const poolFee = (global.config.payments.poolFees && global.config.payments.poolFees.solo) ? global.config.payments.poolFees.solo : 0;
const devFee = global.config.payments.devFee || 0.00;
const roundUpPercent = (percent) => {
  return parseFloat(parseFloat(percent).toFixed(5));
}
const logSystem = "unlocker/solo";


module.exports.afterSubmit = (replies, miner, job, shareDiff, blockCandidate, hashHex, shareType, blockTemplate)  => {
    if(!blockCandidate) {
      return []
    }
    const coin = global.config.coin
    const redCmd = []
    let totalShares = replies[replies.length -2][0]
    let donate = replies[replies.length -2][1]
    const login = miner.login

    redCmd.push(['hmset', coin + ':shares_actual:round' + job.height,[
            login,
            totalShares || 0,
            'donations',
            donate || 0,
            'total', 
            totalShares + donate
        ]
    ])


    const block = new Blocks({
      hash: hashHex,
      timestamp: Date.now() / 1000 | 0,
      difficulty: blockTemplate.difficulty,
      shares: totalShares,
      donations: donate,
      miner: login,
      poolType: 'solo',
      height: job.height
    })

    redCmd.push(['zadd',coin + ':blocks:candidates',job.height, block.toRedis()]);

    redisClient.multi(redCmd).exec(function(err, replies){
      if (err){
          log('error', logSystem, 'Failed inserting block candidate %s \n %j', [hashHex, err]);
      }

    });

}

module.exports.blockCandidate = (redisCommands, miner, job, shareDiff, hashHex, shareType, blockTemplate) => {
    const coin = global.config.coin
    const login = miner.login
    redisCommands.push(['hmget', coin + ':solo:shares_actual:roundCurrent', [login + '_shares',  login + '_donations']])
    redisCommands.push(['hmset', coin + ':solo:shares_actual:roundCurrent', [login + '_score',0,  login + '_donations',0]])
    return redisCommands;
}

module.exports.recordShare = (redisCommands, miner, job, shareDiff, hashHex, shareType, blockTemplate) => {
    const diff = job.difficulty;
    const donations = diff * (miner.donations || 0);
    const shares =  diff - donations;
    const login = miner.login
    const coin = global.config.coin

    redisCommands.push(['hincrby', coin + ':solo:shares_actual:roundCurrent', login + '_shares', shares])
    redisCommands.push(['hincrby', coin + ':solo:shares_actual:roundCurrent', login + '_donations', donations])

    return redisCommands;
}

module.exports.unlocker = (blocks, mainCallback) => {


  async.waterfall([
    /**
    * Get percent for each
    **/
    callback => {
      const blockStats = new BlockStats();

      const unlockedBlocksCommands = [];
      const payments = {};
      let totalBlocksUnlocked = 0;

      for(let i =0;i< blocks.length;i++) {

        const block = blocks[i];

        if (block.orphaned) {
          continue;
        }
        totalBlocksUnlocked++;
        blockStats.addBlock(block)

        // unlockedBlocksCommands.push(['del', config.coin + ':shares_actual:round' + block.height]);
        unlockedBlocksCommands.push(['zrem', config.coin + ':blocks:candidates', block.serialized]);
        unlockedBlocksCommands.push(['zadd', config.coin + ':blocks:matured', block.height, block.toRedis()]);

        let reward = block.reward;

        reward -= (reward * networkFee)

        let actTotalScore = parseFloat(block.shares);

        let poolFeeReward = 0
        if(poolFee > 0) {
           poolFeeReward = reward * poolFee;
          const worker = (global.config.addresses.pool) ? global.config.addresses.pool : false;
          if(worker !== false){
            payments[worker] = (payments[worker] || 0) + poolFeeReward;

          }
          reward -= poolFeeReward;
        }
	
        let devFeeReward = 0
        if(devFee > 0) {
          devFeeReward = reward * devFee;
          const worker = (global.config.addresses.dev) ? global.config.addresses.dev : false;
          if(worker !== false){
            payments[worker] = (payments[worker] || 0) + devFeeReward;

          }
          reward -= devFeeReward;
        }

        let percentDonate = 0
        if(block.donations > 0) {
          let donar = {};
          const worker = global.config.poolServer.donations.address ? global.config.poolServer.donations.address : global.config.poolServer.poolAddress;
          percentDonate = block.donations / block.totalShares;

        }


        log('info', logSystem, 'Unlocked block height %d with reward %d. Miners reward: %d. Dev Fee: %d. Pool Fee: %d', [
          block.height, block.reward, reward, devFeeReward, poolFeeReward
        ]);

        if (block.workerShares) {
            const worker = Object.keys(block.workerShares)[0];

	          const percent = (1 - percentDonate)
            const workerReward = roundUpPercent(reward * percent);
            payments[worker] = (payments[worker] || 0) + workerReward;
            blockStats.addInfo(block.height,worker,'shares',block.total);
            blockStats.addInfo(block.height,worker,'percent',percent);
            blockStats.addInfo(block.height,worker,'earn',workerReward);
            blockStats.addInfo(block.height, worker,'donations', block.donations);
            blockStats.addInfo(block.height, worker,'poolType', "solo");

            log('info', logSystem, '-- %s | %d%% | %s | 0.00', [worker, percent*100, parseFloat(workerReward/100).toFixed(2)]);    

        }
      }

      log('info', logSystem, 'Unlocked %d blocks', [totalBlocksUnlocked]);

      if (Object.keys(payments).length === 0){
        log('info', logSystem, 'No payments yet (%d pending)', [blocks.length]);
        callback(true);
        return;
      }

      log('info', logSystem, 'Payments avaliable to %d wallets', [Object.keys(payments).length]);


      for (let i=0;i< Object.keys(payments).length;i++) {
        const worker = Object.keys(payments)[i];
        let amount = parseInt(payments[worker]);
        log('info', logSystem, (i+1)+'. %s | %s ', [worker, parseFloat(amount / 100).toFixed(2)]);    
        unlockedBlocksCommands.push(['hincrbyfloat', global.config.coin + ':workers:' + worker, 'balance', amount]);
      }
      redisClient.multi(unlockedBlocksCommands).exec((e,r) => {
        if(e) {
          log('error', logSystem, 'Error with fetching blocks %j', [e]);
          callback(true);
          return;
        }
        log('info', logSystem, 'Unblocking successful for %d commands', [unlockedBlocksCommands.length]);

        callback(blockStats);
      });
    },
    /**
    * Get donation per height per worker and set statistic stuff only
    **/
     (blockStats, callback) => {
      if(!blockStats) {
        callback(null)
        return
      }

      const redisCmds = blockStats.toRedis();

      log('info', logSystem, 'Creating statistics with %d cmds', [redisCmds.length]);

      if(redisCmds.length === 0) {
        callback(null);
        return;
      }

      redisClient.multi(redisCmds).exec(function(error, replies){
        if (error){
          log('error', logSystem, 'Error with unlocking blocks %j', [error]);
        }

        callback(null);
      });
    }], mainCallback);
}
