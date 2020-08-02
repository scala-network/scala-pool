/* Stellite Nodejs Pool
 * Copyright StelliteCoin	<https://github.com/stellitecoin/cryptonote-stellite-pool>
 * Copyright Ahmyi			<https://github.com/ahmyi/cryptonote-stellite-pool>
 * Copyright Dvandal    	<https://github.com/dvandal/cryptonote-nodejs-pool>
 * Copyright Fancoder   	<https://github.com/fancoder/cryptonote-universal-pool>
 * Copyright zone117x		<https://github.com/zone117x/node-cryptonote-pool>
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
 
 var fs = require('fs');
 var async = require('async');

 var apiInterfaces = require('./apiInterfaces.js');

 var utils = require('./utils.js');

// Initialize log system
var logSystem = 'payments';
require('./exceptionWriter.js')(logSystem);

/**
 * Run payments processor
 **/
 
 log('info', logSystem, 'Started');

 if (!config.payments.priority) config.payments.priority = 0;

 const invalidPaymentAddress = [];
 let blockHeader = {}

let paymentStopped = false;

 function makePayment(transferCommand, mainCallback) {
    if(transferCommand.amount === 0) {
        mainCallback();
        return;
    }
    if(paymentStopped) {
        mainCallback();
        return;
    }
    async.waterfall([
        function(callback) {
            apiInterfaces.rpcWallet('get_balance', {'account_index':0}, function(error, result) {
                if('height' in result && result.height !== blockHeader.height) {
                    log('warn', logSystem, 'Our wallet does not have same pool height %d <> %d', [result.height, blockHeader.height]);
                    callback(true);
                    return;
                }
                if(result.unlocked_balance >= transferCommand.amount) {
                    log('info', logSystem, 'We have balance: %f (unlocked : %f) Transfering : %d', [result.balance, result.unlocked_balance, transferCommand.amount]);
                    callback(null);
                }else {
                    log('warn', logSystem, 'We have balance: %f (unlocked : %f) Unable to transfer : %d', [result.balance, result.unlocked_balance, transferCommand.amount]);
                    callback(true);
                }
            })
        }, function(callback) {
            executeTransfer(transferCommand, (error) => {
                // log('info', logSystem, 'Make transfer finished');
                callback(error);
            });
        }], function(e) {
            if(e) {
                if(paymentStopped) {
                    log('warn', logSystem, 'Payment set to halt');
                } else {
                    log('error', logSystem, 'Payment incomplete error refresh in ' + global.config.payments.interval + 'seconds');
                    setTimeout(() => makePayment(transferCommand, mainCallback),  global.config.payments.interval * 1000);
                }
                return;
            }
            // log('info', logSystem, 'Payment completed');
            mainCallback();
        })
}
function executeTransfer(transferCommand,callback){
    if(paymentStopped) {
        callback(true);
        return;
    }
    const rpcRequest = transferCommand.rpc;
    const rpcCommand = "transfer_split";
    apiInterfaces.rpcWallet(rpcCommand, rpcRequest, function(error, result){

        if (error){
            const errmsg = error.message.replace('WALLET_RPC_ERROR_CODE_WRONG_ADDRESS: ','');
            if(errmsg != error.message){
                invalidPaymentAddress.push(errmsg);

            }

            log('error', logSystem, 'Error with %s RPC request to wallet daemon %j', [rpcCommand, error]);
            log('error', logSystem, 'Payments failed to send via cmd %j', [transferCommand.rpc]);
            callback(true);
            return;
        }

        let transferFee = 0.0;

        result.fee_list.map(function(k){
            transferFee+=parseFloat(k);
        });


        // log('info', logSystem, 'Actual Blockchain Transfer Fee: %f', [transferFee]);

        if(transferCommand.rpc.do_not_relay) {

            if(global.config.payments.minerPayFee && global.config.payments.dynamicTransferFee){

                let newAmount = 0.0;
                const newDestinations = [];
                const payScores = {};
                const newTransferFee = {};
                const overallAmount = transferCommand.amount;
                const oldDestinations = transferCommand.rpc.destinations;

                for(let d in oldDestinations){
                    const destination = transferCommand.rpc.destinations[d];
                    const destWallet = destination.address;
                    var wallet = destWallet;

                    if (transferCommand.rpc.payment_id){
                        wallet += config.poolServer.paymentId.addressSeparator + transferCommand.rpc.payment_id;
                    }

                    const oldAmount = Math.ceil(destination.amount);
                    const scoreAmount = oldAmount / overallAmount;//10/100 = 0.1 is your score
                    let newFee = Math.ceil(transferFee * scoreAmount);//if fee is 10XTL you pay 1XTL only
                    if(config.payments.minMinerFee > 0 && newFee < global.config.payments.minMinerFee){
                        newFee = config.payments.minMinerFee;
                    }
                    let newDestAmount = oldAmount - newFee;//This is you new value at oldAmount - newFee

                    newDestinations.push({
                        amount:newDestAmount,
                        address:destWallet
                    });

                    newAmount+=newDestAmount;
                    
                    newTransferFee[wallet] = newFee;
                    
                    log('info', logSystem, 'New(old) destinations amount: %f(%f) score %f with fee at %d for %s', [
                        newDestAmount,
                        oldAmount,
                        scoreAmount,
                        newFee,
                        wallet
                        ]);
                }

                transferCommand.rpc.destinations=newDestinations;
                transferCommand.amount = newAmount;
                transferCommand.rpc.fee = transferFee;
                transferCommand.fee=newTransferFee;

            }

            transferCommand.rpc.do_not_relay = false;
            executeTransfer(transferCommand,callback);
            return 
        }

        if(global.config.payments.minerPayFee && !global.config.payments.dynamicTransferFee){
            transferFee=global.config.payments.transferFee * transferCommand.rpc.destinations.length;
        }

        const now = Date.now() / 1000 | 0;

        let txHash = result.tx_hash_list.join("|");

        transferCommand.redis.push(['zadd', config.coin + ':payments:all', now, [
            txHash,
            transferCommand.amount,
            transferFee,
            transferCommand.rpc.mixin,
            Object.keys(transferCommand.rpc.destinations).length,
            blockHeader.height
            ].join(':')]);

        const redisCmds = [];

        for (var i = 0; i < transferCommand.rpc.destinations.length; i++){
            var destination = transferCommand.rpc.destinations[i];
            var wallet = destination.address;

            if (transferCommand.rpc.payment_id){
                wallet += config.poolServer.paymentId.addressSeparator + transferCommand.rpc.payment_id;
            }

            const deductAmount = destination.amount - transferCommand.fee[wallet];

            transferCommand.redis.push(['hincrbyfloat', config.coin + ':workers:' + wallet, 'balance', -destination.amount]);
            transferCommand.redis.push(['hincrbyfloat', config.coin + ':workers:' + wallet, 'paid', deductAmount]);

            transferCommand.redis.push(['zadd', config.coin + ':payments:' + wallet, now, [
                txHash,
                destination.amount,
                transferCommand.fee[wallet],
                transferCommand.rpc.mixin,
                blockHeader.height
            ].join(':')]);

            log('info', logSystem, 'Transaction completed for payment of %s (fee: %s) to %s', [ utils.getReadableCoins(destination.amount),utils.getReadableCoins(transferCommand.fee[wallet]),wallet ]);
        }

        redisClient.multi(transferCommand.redis).exec(function(error, replies){
            if (error){
                log('error', logSystem, 'Super critical error! Payments sent yet failing to update balance in redis, double payouts likely to happen %j', [error]);
                log('error', logSystem, 'Double payments likely to be sent to %j', transferCommand.rpc.destinations);
                fs.writeFile(process.cwd() + '/logs/payments-'+Date.now()+'.json', JSON.stringify(transferCommand), 'utf8', () => {
                    callback(true);
                });
                paymentStopped = true;
                return;
            }
            // log('info', logSystem, "Payments sent via wallet daemon\n %j", [result || null]);
            callback(null);
        });
    });
}
let processingPayments = false;
function runInterval(){
    var minLevelDefault = config.payments.minPayment;
    var minLevelIntegrated = config.payments.minExchangeAddress;
    var maxLevel = config.payments.maxPayment || 0;
    if(maxLevel === 0 || maxLevel > config.payments.maxTransactionAmount){
        maxLevel = config.payments.maxTransactionAmount;
    }
    async.waterfall([
        // We continue on next block
        function(callback) {
            if (processingPayments) {
                log('info', logSystem, 'Payment queue is not empty so dropping all new payment creation');
                callback(true);
                return
            }

            if (paymentStopped) {
                log('info', logSystem, 'Critically stopped payment process');
                callback(true);
                return
            }

            log('info', logSystem, "Creating payment queues");
            callback(null);
        },
        function(callback) {

            redisClient.hmget(global.config.coin + ':stats', ['lastblock_height','lastblock_hash', 'height'], (e,r) => {
                if(e || !r[0] || !r[1] || (blockHeader.lastblock_height === r[0] && blockHeader.lastblock_hash === r[1])) {
                    callback(true);
                    return;
                }
                blockHeader.lastblock_height = r[0]
                blockHeader.lastblock_hash = r[1]
                blockHeader.height = r[1]
                callback(null);
            });
        },
        // Get worker keys
        function(callback){
            processingPayments = true;
            redisClient.keys(global.config.coin + ':workers:*', function(error, result) {
                if (error) {
                    log('error', logSystem, 'Error trying to get worker balances from redis %j', [error]);
                    callback(true);
                    return;
                }
                callback(null, result);
            });
        },

        // Get worker balances
        function(keys, callback){
            var redisCommands = keys.map(function(k){
                return ['hget', k, 'balance'];
            });
            redisClient.multi(redisCommands).exec(function(error, replies){
                if (error){
                    log('error', logSystem, 'Error with getting balances from redis %j', [error]);
                    callback(true);
                    return;
                }

                var balances = {};
                for (var i = 0; i < replies.length; i++){
                    var parts = keys[i].split(':');
                    var workerId = parts[parts.length - 1];
                    if(invalidPaymentAddress.indexOf(workerId) >= 0){
                      log('info', logSystem, 'Address invalid unable to make payment to :  %s', [workerId]);
                      continue;
                  }
                  const balance = parseInt(replies[i]) || 0;

                  balances[workerId] = balance;
              }
              callback(null, keys, balances);
          });
        },

        // Get worker minimum payout
        function(keys, balances, callback){
            var redisCommands = keys.map(function(k){
                return ['hget', k, 'minPayoutLevel'];
            });
            redisClient.multi(redisCommands).exec(function(error, replies){
                if (error){
                    log('error', logSystem, 'Error with getting minimum payout from redis %j', [error]);
                    callback(true);
                    return;
                }

                var minPayoutLevel = {};
                
                for (var i = 0; i < replies.length; i++){
                    var parts = keys[i].split(':');
                    var wallet = parts[parts.length - 1];

                    let defaultLevel = minLevelDefault;
                    let minLevel = defaultLevel;
                    if(utils.isIntegratedAddress(wallet)){
                        minLevel = minLevelIntegrated;
                        defaultLevel = minLevelIntegrated;
                    }else{
                        var addr = wallet.split(config.poolServer.paymentId.addressSeparator);
                        if(addr.length >= 2 && utils.hasValidPaymentId(addr[1])){
                            minLevel = minLevelIntegrated;
                            defaultLevel = minLevelIntegrated;
                        }    
                    }

                    var payoutLevel = parseInt(replies[i]) || minLevel;
                    if (payoutLevel < minLevel) {
                    	payoutLevel = minLevel;
                    }

                    if (payoutLevel > maxLevel) {
                    	payoutLevel = maxLevel;
                    }
                    minPayoutLevel[wallet] = payoutLevel;

                    // if (payoutLevel !== defaultLevel) {
                    //     log('info', logSystem, 'Using payout level of %s for %s (default: %s)', [ utils.getReadableCoins(minPayoutLevel[wallet]), wallet, utils.getReadableCoins(defaultLevel) ]);
                    // }
                }
                callback(null, balances, minPayoutLevel);
            });
        },

        // Filter workers under balance threshold for payment
        function(balances, minPayoutLevel, callback){
            var payments = {};

            for (var worker in balances){
                var balance = balances[worker];
                if (balance >= minPayoutLevel[worker]){
                    var remainder = balance % config.payments.denomination;
                    var payout = balance - remainder;

                    if(config.payments.minerPayFee){
                        if(!config.payments.dynamicTransferFee){
                            payout -= config.payments.transferFee;
                        }
                    }

                    if (payout < 0)  continue;

                    payments[worker] = payout;
                }
            }

            const totalOfPayments = Object.keys(payments).length;
            if (totalOfPayments === 0){
                callback(true);
                return;
            }

            log('info', logSystem, '%d workers\' balances reached the minimum payment threshold',[totalOfPayments]);

            var transferCommands = [];
            var transferCommandsIntegrated = [];
            var addresses = 0;
            var commandAmount = 0;
            var commandIndex = 0;

            const createIA = (address, amount) => {
                const tci = {
                        amount,
                        fee:{},
                        rpc: {
                        destinations: [{
                              amount, 
                              address
                        }],
                        mixin: global.config.payments.mixin,
                        priority: global.config.payments.priority,
                        unlock_time: 0
                    },
                    redis:[]
                };

              tci.fee[wallet] = 0;

              if(global.config.payments.minerPayFee){
                 if(global.config.payments.dynamicTransferFee){
                     tci.rpc.do_not_relay=true;
                 }else{
                     tci.rpc.fee = global.config.payments.transferFee;
                     tci.fee[wallet] = global.config.payments.transferFee;
                     tci.rpc.do_not_relay=false;
                 }
             }

             if(payment_id){
                 tci.rpc.payment_id = payment_id;
             }

             transferCommandsIntegrated.push(tci);

           }
           const maxTransactionAmount = global.config.payments.maxTransactionAmount || 3000000

            for (var wallet in payments){


                var amount = parseInt(payments[wallet]);
                var payment_id = null;
                var isIntegratedAddress = false;
                var address = wallet;    

                if (utils.isIntegratedAddress(address)){
                    isIntegratedAddress=true;
                }else{
                    var addr = address.split(config.poolServer.paymentId.addressSeparator);    
                    if (addr.length >= 2){
                        if(utils.hasValidPaymentId(addr[1])){
                           payment_id = addr[1];
                           isIntegratedAddress=true;
                       }else{
                           log('error', logSystem, 'Invalid payment id %',[worker]);
                           continue;	
                       }
                       address = addr[0];
                   }
               }

            if(isIntegratedAddress){

                if(amount > maxTransactionAmount) {

                     while(maxTransactionAmount < amount) {
                        const val = (maxTransactionAmount < amount) ? maxTransactionAmount : amount;
                        createIA(address, val);
                        amount-=val;
                     }
                     continue;
                } else {
                    createIA(address, amount);
                }
            }

            if(!transferCommands[commandIndex]) {
                transferCommands[commandIndex] = {
                    amount : 0,
                    fee:{},
                    rpc: {
                        destinations: [],
                        fee: 0,
                        mixin: config.payments.mixin,
                        priority: config.payments.priority,
                        unlock_time: 0
                    },
                    redis:[]
                };
                commandAmount = 0;
            }

            if((amount + commandAmount) <= maxTransactionAmount) {

                var destination = {amount: amount, address: address};
                transferCommands[commandIndex].rpc.destinations.push(destination);

                transferCommands[commandIndex].fee[address] = 0;

                if(config.payments.minerPayFee){
                    if(config.payments.dynamicTransferFee){
                        transferCommands[commandIndex].rpc.do_not_relay=true;
                    }else{
                        transferCommands[commandIndex].rpc.fee += config.payments.transferFee;
                        transferCommands[commandIndex].fee[address] += config.payments.transferFee;
                        transferCommands[commandIndex].rpc.do_not_relay=false;
                    }
                }

                transferCommands[commandIndex].amount += amount;

                addresses++;
                commandAmount += amount;

                if (addresses >= global.config.payments.maxAddresses || commandAmount >= config.payments.maxTransactionAmount) {
                    commandIndex++;
                    addresses = 0;
                    commandAmount = 0;
                }
                continue;
            }

            while(maxTransactionAmount < (amount + commandAmount)) {
                const val = (maxTransactionAmount < (amount + commandAmount)) ? maxTransactionAmount : (amount + commandAmount);
                var destination = {amount: val, address: address};
                transferCommands[commandIndex].rpc.destinations.push(destination);

                transferCommands[commandIndex].fee[address] = 0;

                if(config.payments.minerPayFee){
                    if(config.payments.dynamicTransferFee){
                        transferCommands[commandIndex].rpc.do_not_relay=true;
                    }else{
                        transferCommands[commandIndex].rpc.fee += config.payments.transferFee;
                        transferCommands[commandIndex].fee[address] += config.payments.transferFee;
                        transferCommands[commandIndex].rpc.do_not_relay=false;
                    }
                }

                transferCommands[commandIndex].amount += val;

                addresses++;
                commandAmount += val;

                if (addresses >= global.config.payments.maxAddresses || commandAmount >= maxTransactionAmount) {
                    commandIndex++;
                    addresses = 0;
                    commandAmount = 0;
                    transferCommands[commandIndex] = {
                        amount : 0,
                        fee:{},
                        rpc: {
                            destinations: [],
                            fee: 0,
                            mixin: config.payments.mixin,
                            priority: config.payments.priority,
                            unlock_time: 0
                        },
                        redis:[]
                    };
                }
                amount-=val;
            }
        }

        for(let i in transferCommandsIntegrated){
            const tci = transferCommandsIntegrated[i];
            transferCommands.push(tci);
        }



        log('info', logSystem, "Creating transactions of %d cmds",[transferCommands.length]);
        async.eachSeries(transferCommands,makePayment, callback);
    }], function(error, result){
      processingPayments = false;
      log('info', logSystem, "Completed creating queue payments");
      setTimeout(runInterval, global.config.payments.interval * 1000);
  });
}

runInterval();

