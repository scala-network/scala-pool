let config = {};

module.exports = cli => {
	const default = {
    	"timeout":1000,
        "enabled": true,
        "clusterForks": 4,
        "poolAddress":"Svk1ZQ6mPfjhYR3Nnp3kifZLimjuDcmyMHecLmY6Ek2QbGQi93XzkJFbdFDaQZVdBF2V43q79z2UTirvJcHT3TnC2h988J2hF",
        "blockRefreshInterval": 500,
        "minerTimeout": 750,
        "sslCert": "./cert.pem",
        "sslKey": "./privkey.pem",
        "sslCA": "./chain.pem",
        "ports": [
            {
                "port": 3333,
                "difficulty": 10000,
                "desc": "Props Low end hardware diff: 10000",
                "poolType":"props",
                "donation":0
            }	
        ],
        "varDiff": {
            "minDiff": 100,
            "maxDiff": 100000000,
            "targetTime": 45,
            "retargetTime": 35,
            "variancePercent": 30,
            "maxJump": 100
        },
        "paymentId": {
            "enabled": true,
            "addressSeparator": "."
        },
        "fixedDiff": {
            "enabled": true,
            "addressSeparator": "+"
        },
        "donations": {
            "enabled": true,
            "addressSeparator":"%",
            "address":"Svk1ZQ6mPfjhYR3Nnp3kifZLimjuDcmyMHecLmY6Ek2QbGQi93XzkJFbdFDaQZVdBF2V43q79z2UTirvJcHT3TnC2h988J2hF"
        },
        "shareTrust": {
            "enabled": true,
            "min": 10,
            "stepDown": 3,
            "threshold": 10,
            "penalty": 30
        },
        "banning": {
            "enabled": true,
            "time": 30,
            "invalidPercent": 50,
            "checkThreshold": 30
        },
        "slushMining": {
            "enabled": false,
            "weight": 300,
            "blockTime": 60,
            "lastBlockCheckRate": 1
        }
    };

    config = default;
    return config;
}