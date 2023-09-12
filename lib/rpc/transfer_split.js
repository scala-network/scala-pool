'use strict'
const rpcCommand = "transfer_split";
const logSystem = 'payments/transfer_split';
const apiInterfaces = require('../apiInterfaces.js')
const utils = require("../utils")
const executeTransfer = (transferCommand, callback) => {

    transferCommand.rpc.mixin = 11;
    const rpcRequest = transferCommand.rpc;
    apiInterfaces.rpcWallet(rpcCommand, rpcRequest, function(error, result){

        if (error){
            const errmsg = error.message.replace('WALLET_RPC_ERROR_CODE_WRONG_ADDRESS: ','');
            if(errmsg != error.message){
                // invalidPaymentAddress.push(errmsg);
            	log('error', logSystem, 'Error with %s RPC request to wallet daemon %j', [rpcCommand, errmsg]);
                callback(errmsg);
		return;
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
		if(newAmount<= 0) {

                  log('error', logSystem, 'Critical error! Payments new amount %s goes negative %j', [newAmount, newDestinations]);
                  callback("STOP PAYMENT");
		  return;
		}
                transferCommand.rpc.destinations=newDestinations;
                transferCommand.amount = newAmount;
                transferCommand.rpc.fee = transferFee;
                transferCommand.fee=newTransferFee;

            }
            
            transferCommand.rpc.do_not_relay = false;
            executeTransfer(transferCommand, callback);
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
            Object.keys(transferCommand.rpc.destinations).length
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
                transferCommand.rpc.mixin
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

                callback("STOP PAYMENT");
                return;
            }
            // log('info', logSystem, "Payments sent via wallet daemon\n %j", [result || null]);
            callback(null);
        });
    });
}

module.exports = executeTransfer;
