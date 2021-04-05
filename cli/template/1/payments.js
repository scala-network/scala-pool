let config = {};

module.exports = cli => {
	const default = {
        "enabled": true,
        "interval": 300,
        "maxAddresses": 15,
        "mixin": 1,
        "priority": 0,
        "transferFee": 15,
        "dynamicTransferFee": true,
        "minerPayFee" : true,
        "minPayment": 10000,
        "networkFee":0,
        "minPaymentExchangeAddress":10000,
        "maxTransactionAmount": 1000000,
        "denomination": 100
    };

    config = default;
    return config;
}