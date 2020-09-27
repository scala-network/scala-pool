'use strict'

const logSystem = "payments/payee"
const utils = require('../utils')
class Payee {
	static Config = false;
	constructor() {
		if(!Payee.Config) {
			Payee.Config = {
				paymentIdAddressSeparator: global.config.poolServer.paymentId.addressSeparator,
				transferFee: global.config.payments.transferFee,
				minerPayFee : global.config.payments.minerPayFee,
				dynamicTransferFee: global.config.payments.dynamicTransferFee,
        		maxTransactionAmount : global.config.payments.maxTransactionAmount || 3000000,
        		maxAddresses : global.config.payments.maxAddresses || 15

			}
		}
	}
	static isIntegrated(wallet) {
		if (utils.isIntegratedAddress(wallet)){
		   return true
		}

  		let address = wallet

	    let addr = address.split(Payee.Config.paymentIdAddressSeparator);    
	    if (addr.length >= 2) {
	        if(utils.hasValidPaymentId(addr[1])){
				return true
	       }
           log('error', logSystem, 'Invalid payment id %s',[wallet]);
	   }


	   return false
	}
	get isLocked() {
		return this.#_locked
	}
	#_locked = false
	destinations = []
	payment_id = null
	amount = 0
	fees = {}
	fee = 0


	addDestination(wallet, amount) {
		if(this.#_locked) {
			return false
		}
		let isIntegratedAddress = false;
  		let address = wallet
		
		if (Payee.isIntegrated(wallet)){
		    isIntegratedAddress = true
		    let addr = address.split(Payee.Config.paymentIdAddressSeparator)    
		    if (addr.length >= 2) {
		        this.payment_id = addr[1]
		      	address = addr[0]
		   }
		}

		this.destinations.push({ amount, address })
		if(isIntegratedAddress) {
			this.amount = amount
			this.#_locked = true
		} else {
			this.amount += amount
		}
		if(Payee.Config.transferFee <= 0) {
			return true
		}

		if(!(address in this.fees)) {
			this.fees[address] = 0
		}

        this.fees[address] += Payee.Config.transferFee;
        this.fee +=  Payee.Config.transferFee;
	    
	    if(this.amount >= Payee.Config.maxTransactionAmount) {
        	this.#_locked = true
        }

        if(this.destinations.length >= Payee.Config.maxAddresses) {
			this.#_locked = true
        }

		return true
	}

	toMaker() {
		const output = {
			    amount: this.amount,
			    fee:{},
			    rpc: {
			    destinations: this.destinations,
			    mixin: global.config.payments.mixin,
			    priority: global.config.payments.priority,
			    unlock_time: 0
			},
			redis:[]
		}
		if(this.payment_id) {
                	output.rpc.payment_id = this.payment_id;
                }
		if(Payee.Config.minerPayFee){
            if(Payee.Config.dynamicTransferFee){
                output.rpc.do_not_relay=true
            }else{
                output.fee = this.fees
                output.rpc.fee = this.fee
                output.rpc.do_not_relay=false
            }
        }

		return output
	}
}

module.exports = Payee;
