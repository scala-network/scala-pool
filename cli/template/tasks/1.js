const path = require('path');
const fs = require('fs');
const util = require(path.join(process.cwd(), 'lib','utils'));

let config = {};

const qApi = async cli => {
	const ans = await cli.questionSync("Would you like to enable api services? (y/n)\n>");
	const parse = cli.parseYesNo(ans);
	if(parse === false || parse === null) {
		cli.quit();
		return;
	}
	if(parse === 'n') {
		config.api = { enabled : false };
		return;
	}

	const ans1 = await cli.questionSync("Would you like to use default settings?\n>");
	const parse1 = cli.parseYesNo(ans1);
	if(parse1 === false || parse1 === null) {
		cli.quit();
		return;
	}
	if(parse1 === 'y') {
		return;
	}

	const ans2 = await cli.questionSync("Set api hashrate update interval?(default: 10)\n>");
	const parse2 = cli.parseInt(ans2);

	if(parse2 === false || parse2 === null) {
		cli.quit();
		return;
	}
	config.api.updateInterval = parse2;

	const ans3 = await cli.questionSync("Set api port?(default: 8001)\n>");
	const parse3 = cli.parseInt(ans3);

	if(parse3 === false || parse3 === null) {
		cli.quit();
		return;
	}

	config.api.port = parse3;

	const ans4 = await cli.questionSync("Set api bindIp?(default: 0.0.0.0)\n>");
	const parse4 = cli.parseIp(ans4);

	if(parse4 === false || parse4 === null) {
		cli.quit();
		return;
	}

	config.api.bindIp = parse4;

	const ans5 = await cli.questionSync("Set admin password for api?\n>");
	const parse5 = cli.parsePassword(ans5);

	if(parse5 === false || parse5 === null) {
		cli.quit();
		return;
	}

	config.api.password = parse5;

	const ans6 = await cli.questionSync("Set SSL for api?\n>");
	const parse6 = cli.parseYesNo(ans6);
	if(parse6 === false || parse6 === null) {
		cli.quit();
		return;
	}
	if(parse6 === 'n') {
		config.api.ssl = { enabled : false };
	} else {
		config.api.ssl.enabled = true;
		const ans7 = await cli.questionSync("Set SSL port for api?\n>");
		const parse7 = cli.parseInt(ans7);
		if(parse7 === false || parse7 === null) {
			cli.quit();
			return;
		}
		config.api.ssl.enabled = parse7;

		let ans8 = await cli.questionSync("Set SSL cert/key/chain folder for api?");
		if(ans8 === null || ans8 === '') {
			ans8 = 'certs';
		}

		const parse8 = cli.parseFilePath(ans8);
		if(parse8 === false) {
			cli.quit();
			return;
		}

		config.api.ssl.cert = path.join(parse8, 'cert.pem');
		config.api.ssl.key = path.join(parse8, 'privkey.pem');
		config.api.ssl.ca = path.join(parse8, 'chain.pem');

		
	}
	const ans9 = await cli.questionSync("Set API Limits for blocks display?");
		
	const parse9 = cli.parseInt(ans9);

	if(parse9 === false) {
		cli.quit();
		return;
	}

	config.api.limit.blocks = parse9;


	const ans10 = await cli.questionSync("Set API Limits for payments display?");
	
	const parse10 = cli.parseInt(ans10);

	if(parse10 === false) {
		cli.quit();
		return;
	}

	config.api.limit.payments = parse10;

	const ans11 = await cli.questionSync("Set API trust proxy ip? (Y/N)");
	
	const parse11 = cli.parseYesNo(ans11);

	if(parse11 === false) {
		cli.quit();
		return;
	}

	config.api.limit.trustProxyIP = parse11 === 'y';

}

const qWebPort = async cli => {
	const ans =await cli.questionSync("Would you like to enable web services? (y/n)\n\
>");
	const parse = cli.parseYesNo(ans);
	if(parse === false || parse === null) {
		cli.quit();
		return;
	}
	if(parse === 'n') {
		config.web = { enabled : false };
		return;
	}
	const ans1 = await cli.questionSync("Please set a port for web services\n\
>");
	const parse1 = cli.parseInt(ans1);
	if(parse1 === false || parse1 === null) {
		cli.quit();
		return;
	}

	config.web = {
		enabled: true,
		port: parse1
	};
	return;
}

const qLoggingConsole = async cli => {

	const ans = await cli.questionSync("Would you like to set default log console options?\n\
>");
	const parse = cli.parseYesNo(ans)
	if(parse === false || parse === null) {
		cli.quit();
		return;
	}
	if(parse === 'y') {
		return;
	}

	const ans0 = await cli.questionSync("Set log level for log console:\n\
		1) info\n\
		2) warn\n\
		3) error\n\
>");
	const parse0 = cli.parseInt(ans0);
	if(parse0 === false || parse0 === null) {
		cli.quit();
		return;
	}

	switch(parse0) {
		case 1:
		config.logging.console.level = 'info';
		break;
		case 2:
		config.logging.console.level = 'warn';
		break;
		case 3:
		config.logging.console.level = 'error';
		break;
		default:
		console.log("Invalid log level");
		cli.quit();
		return;
	}

	const ans1 = cli.question("Set log color for log console?(Y/N)");
	const parse1 = cli.parseYesNo(ans1);
	if(parse1 === false || parse1 === null) {
		cli.quit();
		return;
	}

	config.logging.console.color = parse1 === 'y';


};

const qLoggingFiles = async cli => {

	const ans = await cli.questionSync("Would you like to set default log files options? (y/n)\n\
>");
	const parse = cli.parseYesNo(ans)
	if(parse === false || parse === null) {
		cli.quit();
		return;
	}
	if(parse === 'y') {
		return;
	}


	const ans2 = await cli.questionSync("Set log level for log file:\n\
	1) info\n\
	2) warn\n\
	3) error\n\
>");
	const parse2 = cli.parseInt(ans2);
	if(parse2 === false || parse2 === null) {
		cli.quit();
		return;
	}

	switch(parse2) {
		case 1:
		config.logging.files.level = 'info';
		break;
		case 2:
		config.logging.files.level = 'warn';
		break;
		case 3:
		config.logging.files.level = 'error';
		break;
		default:
		console.log("Invalid log level");
		cli.quit();
		return;
	}

	let ans3 = await cli.questionSync("Set directory for log files? (default: log)\n>");
			
	if(ans3 === null || ans3 === '') {
		ans3 = path.join(process.cwd(),'log');
	}

	const parse3 = cli.parseFilePath(ans3);

	console.log(parse3);
	if(parse3 === false) {
		ans3 = 'log';
	}

	config.logging.files.directory = parse3;

	const ans4 = await cli.questionSync("Set minutes for log files to be written? (default:5)\n\
>");
	const parse4 = cli.parseInt(ans4);
	if(parse4 === false) {
		cli.quit();
		return;
	}

	config.logging.files.flushInterval = parse4;
	return;
};


const qSetAddress = async cli => {
        let ans = await cli.questionSync("Set pool address\n\
>");

        let parse = util.validateMinerAddress(ans);

        if(parse !== 1) {
            console.log("Invalid miner address");
            cli.quit();
            return;
        }


        config.poolServer.poolAddress = parse;
        config.poolServer.donations.address = config.poolAddress;

        return;
}

const qPoolServer = async cli => {
	const def = {
    	"timeout":1000,
        "enabled": true,
        "clusterForks": 1,
        "poolAddress":"Svk1ZQ6mPfjhYR3Nnp3kifZLimjuDcmyMHecLmY6Ek2QbGQi93XzkJFbdFDaQZVdBF2V43q79z2UTirvJcHT3TnC2h988J2hF",
        "blockRefreshInterval": 500,
        "minerTimeout": 750,
        // "sslCert": "./cert.pem",
        // "sslKey": "./privkey.pem",
        // "sslCA": "./chain.pem",
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

    config.poolServer = def;
    
    let ans = await cli.questionSync("Do you want to set default pool server config? (y/n)\n\
>");
    let parse = cli.parseYesNo(ans);

    if(parse === false || parse === null) {
        cli.quit();
        return;
    }

    if (parse === 'y') {
        await qSetAddress(cli);
    } else {
        ans = await cli.questionSync("Set pool server timeout? (default: 1000)\n\
>");
        parse = cli.parseInt(ans);

        if(parse === false || parse === null) {
            cli.quit();
            return;
        }

        config.poolServer.timeout = parse;


        ans = await cli.questionSync("Cluster forks? (default:1)\n\
>");
        parse = cli.parseInt(ans);

        if(parse === false || parse === null) {
            cli.quit();
            return;
        }

        config.poolServer.clusterForks = parse;

        await qSetAddress(cli);

        ans = await cli.questionSync("Set block refresh interval? (default: 500)\n\
>");
        parse = cli.parseInt(ans);

        if(parse === false || parse === null) {
            cli.quit();
            return;
        }

        config.poolServer.blockRefreshInterval = parse;

        ans = await cli.questionSync("Set miner timeout? (default: 750)\n\
>");
        parse = cli.parseInt(ans);

        if(parse === false || parse === null) {
            cli.quit();
            return;
        }

        config.poolServer.minerTimeout = parse;


    }
    return;
}

module.exports = async cli => {

	const def = {
		"coin": "Scala",
	    "symbol": "XLA",
	    "coinUnits":100,
	    "coinDifficultyTarget": 120,
		"logging": {
			"files": {
				"enabled":false,
				"level": "error",
				"directory": "logs",
				"flushInterval": 5
			},
			"console": {
				"level": "info",
				"colors": true
			}
		},
		"web":{
			"port":"8080"
		},
		"api": {
			"hashrateWindow": 600,
			"updateInterval": 10,
			"port": 8001,
			"bindIp":"0.0.0.0",
			"password": "password",
			"ssl": {
				"enabled":false,
				"port": 2889,
				"cert": "./cert.pem",
				"key": "./privkey.pem",
				"ca": "./chain.pem"
			},
			"limit" : {
				"blocks": 30,
				"payments": 30
			},
			"trustProxyIP": false
		},
		"payments" : {
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
	    },
	    "daemon": {
			"host": "127.0.0.1",
			"port": 11812
		},
		"wallet": {
			"host": "127.0.0.1",
			"port": 9000
		},
		"redis": {
			"host": "127.0.0.1",
			"port": 6379,
			"auth": null,
			"db":0
		},
	    "charts" : {
	        "blocks":{
	            "enabled":true,
	            "days":30
	        },
	        "pool": {
	            "difficulty": {
	                "enabled": true,
	                "updateInterval": 60,
	                "stepInterval": 1800,
	                "maximumPeriod": 86400
	            },
	            "hashrate": {
	                "enabled": true,
	                "updateInterval": 60,
	                "stepInterval": 1800,
	                "maximumPeriod": 86400
	            },
	            "workers": {
	                "enabled": true,
	                "updateInterval": 60,
	                "stepInterval": 1800,
	                "maximumPeriod": 86400
	            },
	            "miners": {
	                "enabled": true,
	                "updateInterval": 60,
	                "stepInterval": 1800,
	                "maximumPeriod": 86400
	            },
	            "price": {
	                "enabled": true,
	                "updateInterval": 1800,
	                "stepInterval": 10800,
	                "maximumPeriod": 604800
	            }
	        },
	        "user": {
	            "worker_hashrate": {
	                "enabled": true,
	                "updateInterval": 180,
	                "stepInterval": 1800,
	                "maximumPeriod": 86400
	            },
	            "hashrate": {
	                "enabled": true,
	                "updateInterval": 180,
	                "stepInterval": 1800,
	                "maximumPeriod": 86400
	            },
	            "payments": {
	                "enabled": true
	            }
	        }
	    }
	};

	config = def;

	const ans = await cli.questionSync("Would you like to enable log files? (y/n)\n\
>");
	const parse = cli.parseYesNo(ans)
	if(parse === false || parse === null) {
		cli.quit();
		return;
	}
	if(parse === 'y') {
		await qLoggingFiles(cli);
	} else {
		config.logging.files = {enabled : false};
	}

	await qLoggingConsole(cli);
	await qWebPort(cli);
	await qApi(cli);
	await qPoolServer(cli);

	let data = JSON.stringify(config);
	fs.writeFileSync(path.join(process.cwd(), 'config.json'), data);

	console.log("Config file save");
	cli.quit();
}
