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

const Payee = require('./model/Payee.js')
const executeTransfer = require('./rpc/transfer_split')


/**
 * Run payments processor
 **/
 
 log('info', logSystem, 'Started');

 if (!config.payments.priority) config.payments.priority = 0;

 const invalidPaymentAddress = [];

 let blockHeader = {}

 let processingPayments = false;
 const minLevelDefault = global.config.payments.minPayment;
 const minLevelIntegrated = global.config.payments.minPaymentExchangeAddress || minLevelDefault;
 const minLevelSub = global.config.payments.minPaymentSubAddress || minLevelIntegrated;
 let maxLevel = global.config.payments.maxPayment || 0;
 if(maxLevel === 0 || maxLevel > global.config.payments.maxTransactionAmount){
    maxLevel = global.config.payments.maxTransactionAmount;
}

const maxTransactionAmount = global.config.payments.maxTransactionAmount || 3000000
let paymentStopped = false;
let paymentProcessing = false;
let st = null
const makePayment = (payee, mainCallback) => {

    if(payee.amount === 0) {
        log('warn', logSystem, 'Our payee have an empty amount');
        mainCallback(null);
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

                if(result.unlocked_balance >= payee.amount) {
                    log('info', logSystem, 'We have balance: %f (unlocked : %f) Transfering : %d', [result.balance, result.unlocked_balance, payee.amount]);
                    callback(null);
                }else {
                    log('warn', logSystem, 'We have balance: %f (unlocked : %f) Unable to transfer : %d', [result.balance, result.unlocked_balance, payee.amount]);
                    callback(true);
                }
            })
        }, function(callback) {
            executeTransfer(payee, (error) => {
                if(utils.validateMinerAddress(error)) {
                    invalidPaymentAddress.push(error)
                }
                callback(error);
            });
        }], function(e) {
            if(e) {
                if(e === "STOP PAYMENT") {
                    log('warn', logSystem, 'Payment set to halt');
                    paymentStopped = true
                } else {
                    log('error', logSystem, 'Payment incomplete error refresh in ' + global.config.payments.interval + ' seconds');
                    setTimeout(() => makePayment(payee, mainCallback),  global.config.payments.interval * 1000);
                }
                return;
            }
            // log('info', logSystem, 'Payment completed');
            mainCallback();
        })
}



function runInterval(){


    async.waterfall([
        /**
        * Check Queue Process
        */
        function(callback) {
            if (paymentProcessing) {
                log('info', logSystem, 'Payment queue is not empty so dropping all new payment creation');
                callback(true);
                return
            }

            if (paymentStopped) {
                log('warn', logSystem, 'Critically stopped payment process');
                callback(true);
                return
            }

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
            paymentProcessing = true
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
                return ['hmget', k, ['balance', 'minPayoutLevel']];
            });
            redisClient.multi(redisCommands).exec(function(error, replies){
                if (error){
                    log('error', logSystem, 'Error with getting balances from redis %j', [error]);
                    callback(true);
                    return;
                }

                let payments = {}
                for (var i = 0; i < replies.length; i++){
                    const parts = keys[i].split(':');
                    const workerId = parts[parts.length - 1];

                    if(!workerId || !!~invalidPaymentAddress.indexOf(workerId)){
                        log('info', logSystem, 'Address is invalid unable to make payment to :  %s', [workerId]);
                        continue;
                    }

                    const addrType = utils.validateMinerAddress(workerId)
                    if(!addrType) {
                        invalidPaymentAddress.push(workerId)
                        continue;
                    }

                    const balance = parseInt(replies[i][0]) || 0;
                    // balances[workerId] = balance;

                    let defaultLevel = minLevelDefault;
                    let minLevel = defaultLevel;

                    if(!!~[2,3].indexOf(addrType)) {

                        if(utils.isIntegratedAddress(workerId)){
                            minLevel = minLevelIntegrated;
                            defaultLevel = minLevelIntegrated;
                        }else{
                            let addr = workerId.split(config.poolServer.paymentId.addressSeparator);
                            if(addr.length >= 2 && utils.hasValidPaymentId(addr[1])){
                                minLevel = minLevelIntegrated;
                                defaultLevel = minLevelIntegrated;
                            }    
                        }
                    }

                    let payoutLevel = parseInt(replies[i][1]) || minLevel;
                    if (payoutLevel < minLevel) {
                        payoutLevel = minLevel;
                    }

                    if (payoutLevel > maxLevel) {
                        payoutLevel = maxLevel;
                    }

                    if (balance <= payoutLevel) continue; 

                    let remainder = balance % global.config.payments.denomination;
                    let payout = balance - remainder;

                    if(config.payments.minerPayFee){
                        if(!config.payments.dynamicTransferFee){
                            payout -= config.payments.transferFee;
                        }
                        if (payout < payoutLevel || payout <= 0)  {
                            continue
                        }

                        payments[workerId] = payout;

                    }
                }
                callback(null, payments);
            });
        },

        // Filter workers under balance threshold for payment
        function(payments, callback){
            const queue = []
            const wallets = Object.keys(payments);
            const totalOfPayments = wallets.length;
            if (totalOfPayments === 0){
                callback(true);
                return;
            }

            log('info', logSystem, '%d workers\' balances reached the minimum payment threshold',[totalOfPayments]);

            let payee = new Payee()
            for (let i=0;i<wallets.length;i++){
                const wallet = wallets[i]
                const addType = utils.validateMinerAddress(wallet);
                const payment = parseInt(payments[wallet])
                if(!!~[2,3].indexOf(addType)) {
                    const single = (payment <= maxTransactionAmount)

                    if(single) {
                        let pia = new Payee()
                        pia.addDestination(wallet, payment)
                        queue.push(pia)
                    } else {
                        let paymentBalance = payment

                        while(paymentBalance > maxTransactionAmount) {
                            //We see how much we can stuff in

                            let pia = new Payee()
                            pia.addDestination(wallet, maxTransactionAmount)
                            queue.push(pia)
                            paymentBalance-=maxTransactionAmount
                        }
                        if(paymentBalance > 0) {
                            let pia = new Payee()
                            pia.addDestination(wallet, paymentBalance)
                            queue.push(pia)
                        }
                    }
                    continue
                }   

                if(payee.isLocked) {
                    queue.push(payee)
                    payee = new Payee()
                }

                let forecast = payment + payee.amount
                const single = (forecast <= maxTransactionAmount)
                if(single) {
                    payee.addDestination(wallet, payment)
                } else {
                    let paymentBalance = payment
                    while(forecast > maxTransactionAmount) {
                        const stuff = maxTransactionAmount - payee.amount
                        payee.addDestination(wallet, stuff)
                        paymentBalance -= stuff
                        forecast=paymentBalance
                        if(payee.isLocked) {
                            queue.push(payee)
                            payee = new Payee()
                        }
                    }
                    if(paymentBalance > 0) {
                        payee.addDestination(wallet, paymentBalance)
                    }
                }
            }

            if(payee.amount > 0) {
                queue.push(payee)
            }
            async.eachSeries(queue, (payee, next) => {
                makePayment(payee.toMaker(),next);
            }, callback)
        }], function(error, result){
            paymentProcessing = false

          // log('info', logSystem, "Completed creating queue payments");
          if(!st) {
            st = setTimeout(runInterval, global.config.payments.interval * 1000)
        } else {
            st.refresh()
        }
    });
}

// module.exports = runInterval;
runInterval();

