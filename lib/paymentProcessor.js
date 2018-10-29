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

function runInterval(){
    var minLevelDefault = config.payments.minPayment;
    var minLevelIntegrated = config.payments.minPaymentIntegratedAddress;
    var maxLevel = config.payments.maxPayment || 0;
    if(maxLevel === 0 || maxLevel > config.payments.maxTransactionAmount){
        maxLevel = config.payments.maxTransactionAmount;
    }
    async.waterfall([

        // Get worker keys
        function(callback){
            redisClient.keys(config.coin + ':workers:*', function(error, result) {
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

                    balances[workerId] = parseInt(replies[i]) || 0;
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

                    if (payout < 0) {
                    	continue;
                    }

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
            
            for (var worker in payments){
                var amount = parseInt(payments[worker]);
                
                var address = worker;
                
                var payment_id = null;
                var isIntegratedAddress = false;

                if (config.poolServer.fixedDiff && config.poolServer.fixedDiff.enabled) {
                    var addr = address.split(config.poolServer.fixedDiff.addressSeparator);
                    if (addr.length >= 2){
                         address = addr[0];
                     }
                }

                if (config.poolServer.donations && config.poolServer.donations.enabled) {
                    const escaped_delimiter = ((config.poolServer.donations.addressSeparator || '%') + '').replace(
                        /([.\\+*?\[\]^$()])/g, '\\$1');
                    address = address.replace(new RegExp(escaped_delimiter + "(\\d+(?:\\.\\d+)?|\\.\\d+)" + escaped_delimiter),"");
                }

                if (utils.isIntegratedAddress(address)){
                    isIntegratedAddress=true;
                }else{
                    var addr = address.split(config.poolServer.paymentId.addressSeparator);    
                    if (addr.length >= 2 && utils.hasValidPaymentId(addr[1])){
                        payment_id = addr[1];
                        isIntegratedAddress=true;
                    }
                }

                if(isIntegratedAddress){
                     const tci = {
                        amount : amount,
                        fee:{},
                        rpc: {
                            destinations: [{
                                amount: amount, 
                                address: address
                            }],
                            mixin: config.payments.mixin,
                            priority: config.payments.priority,
                            unlock_time: 0
                        }
                    };

                    
                    tci.fee[address] = 0;
                    var deductAmount = amount;

                    if(config.payments.minerPayFee){

                        if(config.payments.dynamicTransferFee){
                            tci.rpc.do_not_relay=true;
                        }else{
                            deductAmount+=config.payments.transferFee;
                            tci.rpc.fee = config.payments.transferFee;
                            tci.fee[address] = config.payments.transferFee;
                            tci.rpc.do_not_relay=false;
                        }
                    }


                
                    if(payment_id!==null){
                        tci.payment_id = payment_id;
                    }
                    
                    transferCommandsIntegrated.push(tci);
                    continue;
                }

                if(config.payments.maxTransactionAmount && amount + commandAmount > config.payments.maxTransactionAmount) {
                    amount = config.payments.maxTransactionAmount - commandAmount;
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
                        }
                    };
                }
                var destination = {amount: amount, address: address};
                transferCommands[commandIndex].rpc.destinations.push(destination);

                transferCommands[commandIndex].fee[address] = 0;

                if(config.payments.minerPayFee){
                    if(config.payments.dynamicTransferFee){
                        transferCommands[commandIndex].rpc.do_not_relay=true;
                    }else{
                        transferCommands[commandIndex].rpc.fee += config.payments.transferFee;
                        transferCommands[commandIndex].fee[address] = config.payments.transferFee;
                        transferCommands[commandIndex].rpc.do_not_relay=false;
                    }
                }

                transferCommands[commandIndex].amount += amount;

                addresses++;
                commandAmount += amount;

                if (addresses >= config.payments.maxAddresses || (config.payments.maxTransactionAmount && commandAmount >= config.payments.maxTransactionAmount)) {
                    commandIndex++;
                    addresses = 0;
                    commandAmount = 0;
                }
            }

            var timeOffset = 0;
            var notify_miners = [];
            for(let i in transferCommandsIntegrated){
                const tci = transferCommandsIntegrated[i];
                transferCommands.push(tci);
            }
            
            function executeTransfer(transferCommand,cback){
                const rpcRequest = transferCommand.rpc;
                const rpcCommand = "transfer_split";
                apiInterfaces.rpcWallet(rpcCommand, rpcRequest, function(error, result){
                    if (error){
                        log('error', logSystem, 'Error with %s RPC request to wallet daemon %j', [rpcCommand, error]);
                        log('error', logSystem, 'Payments failed to send via cmd %j', [transferCommand.rpc]);
                        cback(false);
                        return;
                    }

                   let transferFee = 0.0;
                   result.fee_list.map(function(k){
                        transferFee+=parseFloat(k);
                    });
                    log('info', logSystem, 'Actual Blockchain Transfer Fee: %f', [transferFee]);

                    if(transferCommand.rpc.do_not_relay){

                        if(config.payments.minerPayFee && config.payments.dynamicTransferFee){
                                
                                let newAmount = 0.0;
                                
                                const newDestinations = [];
                                const payScores = {};
                                const newTransferFee = {};
                                const overallAmount = transferCommand.amount;
                                const oldDestinations = transferCommand.rpc.destinations;
                                for(let d in oldDestinations){

                                    const destination = transferCommand.rpc.destinations[d];
                                    const destWallet = destination.address;
                                    const oldAmount = Math.ceil(destination.amount);
                                    const scoreAmount = oldAmount/overallAmount;//10/100 = 0.1 is your score
                                    let newFee = Math.ceil(transferFee * scoreAmount);//if fee is 10XTL you pay 1XTL only
                                    if(config.payments.minMinerFee > 0 && newFee > config.payments.minMinerFee){
                                        newFee = config.payments.minMinerFee;
                                    }
                                    let newDestAmount = oldAmount - newFee;//This is you new value at oldAmount - newFee

                                    newDestinations.push({
                                        amount:newDestAmount,
                                        address:destWallet
                                    });

                                    newAmount+=newDestAmount;
                                    newTransferFee[destWallet]=newFee;

                                    log('info', logSystem, 'New(old) destinations amount: %f(%f) score %f with fee at %d for %s', [
                                        newDestAmount,
                                        oldAmount,
                                        scoreAmount,
                                        newFee,
                                        destWallet
                                    ]);
                                }
                                
                                transferCommand.rpc.destinations=newDestinations;
                                transferCommand.amount=newAmount;
                                transferCommand.rpc.fee=transferFee;
                                transferCommand.fee=newTransferFee;

                        }
                        
                        transferCommand.rpc.do_not_relay = false;
                        
                        return executeTransfer(transferCommand,cback);
                    }else if(config.payments.minerPayFee && !config.payments.dynamicTransferFee){
                        transferFee=config.payments.transferFee* transferCommand.rpc.destinations.length;
                    }

                    const now = (timeOffset++) + Date.now() / 1000 | 0;
                    const txHash = result.tx_hash_list.join("|");

                    transferCommand.redis.push(['zadd', config.coin + ':payments:all', now, [
                        txHash,
                        transferCommand.amount,
                        transferFee,
                        transferCommand.rpc.mixin,
                        Object.keys(transferCommand.rpc.destinations).length
                    ].join(':')]);

                    const redisCmds = [];
                    for (var i = 0; i < transferCommand.rpc.destinations.length; i++){
                        var destination = transferCommand.rpc.destinations[i];
                        var wallet = destination.address;
                        if (transferCommand.rpc.payment_id){
                            wallet += config.poolServer.paymentId.addressSeparator + transferCommand.rpc.payment_id;
                        }
                        const deductAmount = destination.amount + transferCommand.fee[wallet];
                        
                        redisCmds.push(['hincrbyfloat', config.coin + ':workers:' + worker, 'balance', -deductAmount]);
                        redisCmds.push(['hincrbyfloat', config.coin + ':workers:' + worker, 'paid', deductAmount]);

                        redisCmds.push(['zadd', config.coin + ':payments:' + wallet, now, [
                            txHash,
                            destination.amount,
                            transferCommand.fee[wallet],
                            transferCommand.rpc.mixin
                        ].join(':')]);

                        log('info', logSystem, 'Transaction completed for payment of %s (fee: %s) to %s', [ utils.getReadableCoins(destination.amount),utils.getReadableCoins(transferCommand.fee[wallet]),wallet ]);
                    }

                    log('info', logSystem, 'Payments sent via wallet daemon %j', [result]);
                    redisClient.multi(redisCmds).exec(function(error, replies){
                        if (error){
                            log('error', logSystem, 'Super critical error! Payments sent yet failing to update balance in redis, double payouts likely to happen %j', [error]);
                            log('error', logSystem, 'Double payments likely to be sent to %j', transferCommand.rpc.destinations);
                            cback(false);
                            return;
                        }

                        

                        cback(true);
                    });
                });
            }
            async.filter(transferCommands, function(transferCmd, cback){
                executeTransfer(transferCmd,cback);
            }, function(succeeded){
                var failedAmount = transferCommands.length - succeeded.length;

                log('info', logSystem, 'Payments splintered and %d successfully sent, %d failed', [succeeded.length, failedAmount]);

                callback(null);
            });

        }

    ], function(error, result){
        setTimeout(runInterval, config.payments.interval * 1000);
    });
}

runInterval();
