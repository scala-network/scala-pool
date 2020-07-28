const async = require('async');

const haveBlockUnlockerAward = global.config.blockUnlocker.reward && global.config.blockUnlocker.reward > 0;
const unlockerRewardPercent = (haveBlockUnlockerAward) ? ( global.config.blockUnlocker.reward / 100 ) : 0;
const networkFee = global.config.payments.networkFee || 0.00;
const poolFee = (global.config.payments.poolFees && global.config.payments.poolFees.solo) ? global.config.payments.poolFees.solo : 0;
const devFee = global.config.payments.devFee || 0.00;
const roundUpPercent = (percent) => {
  return parseFloat(parseFloat(percent).toFixed(5));
}
const logSystem = "unlocker/solo";
module.exports = (blocks, mainCallback) => {

  const unblockStatsRedis = {};
  const addBlockStats = (height,wallet,key,value) => {
    if(!(height in unblockStatsRedis)){
      unblockStatsRedis[height] = {};
    }

    if(!(wallet in unblockStatsRedis[height])){
      unblockStatsRedis[height][wallet]={
        shares:0,
        earn:0, 
        percent:0.0,
        donations:0.0,
        unlockReward:0.0
      };  
    }
    if(!(key in unblockStatsRedis[height][wallet])){
      return;
    }
    unblockStatsRedis[height][wallet][key]=parseFloat(unblockStatsRedis[height][wallet][key])+parseFloat(value);
  }


  async.waterfall([
    /**
    * Get percent for each
    **/
    callback => {
      const unlockedBlocksCommands = [];
      const payments = {};
      let totalBlocksUnlocked = 0;

      for(let i =0;i< blocks.length;i++) {

        const block = blocks[i];

        if(!(block.height in unblockStatsRedis)) {
          unblockStatsRedis[block.height] = {};
          unblockStatsRedis[block.height]["Info"] = block.toRedis();
        }
        if (block.orphaned) {
          continue;
        }
        totalBlocksUnlocked++;

        unlockedBlocksCommands.push(['del', global.config.coin + ':shares_actual:round' + block.height]);
        unlockedBlocksCommands.push(['zrem', global.config.coin + ':blocks:candidates', block.serialized]);
        unlockedBlocksCommands.push(['zadd', global.config.coin + ':blocks:matured', block.height, block.toRedis()]);

        let reward = block.reward;

        reward -= (reward * networkFee)

        let unblockerAward = 0.0;

        if(haveBlockUnlockerAward){
          unblockerAward = roundUpPercent(block.reward * unlockerRewardPercent);
          reward -= unblockerAward;
        }

        log('info', logSystem, 'Unlocked block height %d with reward %d. Miners reward: %d Unlocker reward %f', [
          block.height, block.reward, reward,unblockerAward
          ]);

        let actTotalScore = parseFloat(block.shares);

        if(block.donations > 0 && global.config.addresses.donation) {
          let donar = {};
          const worker = global.config.addresses.donation ? global.config.addresses.donation : global.config.poolServer.poolAddress;
          donar[worker] = block.donations;
          block.workerShares.push(donar);
        }

        if(poolFee > 0) {
          const poolFeeReward = reward * poolFee;
          const worker = (global.config.addresses.pool) ? global.config.addresses.pool : false;
          if(worker !== false){
            payments[worker] = (payments[worker] || 0) + poolFeeReward;

          }
          reward -= poolFeeReward;
        }

        if(devFee > 0) {
          const devFeeReward = reward * devFee;
          const worker = (global.config.addresses.dev) ? global.config.addresses.dev : false;
          if(worker !== false){
            payments[worker] = (payments[worker] || 0) + devFeeReward;

          }
          reward -= devFeeReward;
        }

        if (block.workerShares) {
          const bPayments = {};
          const totalScore = reward / actTotalScore;
          for(let a=0;a<Object.keys(block.workerShares).length;a++) {
            const worker = Object.keys(block.workerShares)[a];
            let share =  block.workerShares[worker]
            let percent = block.workerShares[worker] / block.shares;

            const workerReward = roundUpPercent(reward * percent);
            bPayments[worker] = (bPayments[worker] || 0) + workerReward;
            if(haveBlockUnlockerAward && worker === block.miner){
              bPayments[worker] += unblockerAward;
              addBlockStats(block.height,worker,"unlockReward",unblockerAward);
              log('info', logSystem, '-- %s | %d%% | %s | %s', [
                worker, percent*100, parseFloat(bPayments[worker] /100).toFixed(2),parseFloat(unblockerAward/100).toFixed(2)
                ]);
            } else {
              log('info', logSystem, '-- %s | %d%% | %s | 0.00', [worker, percent*100, parseFloat(bPayments[worker]/100).toFixed(2)]);    
            }

            addBlockStats(block.height,worker,'shares',share);
            addBlockStats(block.height,worker,'percent',percent);
            addBlockStats(block.height,worker,'earn',workerReward);

            if(!~[
              global.config.addresses.donation,
              global.config.poolServer.poolAddress,
              global.config.addresses.pool,
              global.config.addresses.dev
              ].indexOf(worker)) {
              addBlockStats(block.height,worker,'donations',block.donations);
          }

          payments[worker] = (payments[worker] || 0) +  (bPayments[worker] || 0);
        }
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

      callback(null);
    });
  },
    /**
    * Get donation per height per worker and set statistic stuff only
    **/
    (callback) => {

      const cmdRedis = [];
      const blockStatsHeight = Object.keys(unblockStatsRedis);
      const finalCommandments = [];
      
      for(let x=0;x<blockStatsHeight.length;x++) {
        const height = blockStatsHeight[x];          
        
        const blockStatsWallets = unblockStatsRedis[height];

        if(blockStatsWallets) {
          const wallets = Object.keys(blockStatsWallets);  

          for(let w =0;w<wallets.length;w++){
           const wallet = wallets[w];
           const stats = blockStatsWallets[wallet];
           stats.height = height

           const shareKeys = JSON.stringify(stats);
           finalCommandments.push(["hmset",global.config.coin+":block_shares:"+height,wallet,shareKeys]);
           if(wallet !== "Info"){
            finalCommandments.push(["zadd", global.config.coin+":block_scoresheets:"+wallet,height,shareKeys]);
          }
        }
      }
    }

    log('info', logSystem, 'Creating statistics with %d cmds', [finalCommandments.length]);

    if(finalCommandments.length === 0) {
      callback(null);
      return;
    }

    redisClient.multi(finalCommandments).exec(function(error, replies){
      if (error){
        log('error', logSystem, 'Error with unlocking blocks %j', [error]);
      }

      callback(null);
    });

  }], mainCallback);
}
