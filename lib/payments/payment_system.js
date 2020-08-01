'use strict'

const collector = {}
for(let i = 0;i < global.config.payments.supported.length;i++) {
	const paymentType = global.config.payments.supported[i]
	collector[paymentType] = require('./' + paymentType);
}

module.exports = (payType) => {
	return (payType in collector) ? collector[payType] : {
		unlocker : (blocks, mainCallback)  => {
			mainCallback("Invalid payment type")
		},
		recordShare: (rediscmd, miner, job, shareDiff, hashHex, shareType, blockTemplate) => {
			return rediscmd;
		},
		blockCandidate: (rediscmd, miner, job, shareDiff, hashHex, shareType, blockTemplate) => {
			return rediscmd;
		},
		afterSubmit: (results, miner, job, shareDiff, blockCandidate, hashHex, shareType, blockTemplate) => {
			return []
		}

	};
}
