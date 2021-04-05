let config = {};

const qApi = cli => {
	const ans = cli.questionSync("Would you like to enable api services?(Y/N)");
	const parse = cli.parseYesNo(ans);
	if(parse === false || parse === null) {
		cli.quit();
		return;
	}
	if(parse === 'n') {
		config.api = { enabled : false };
		return;
	}

	const ans1 = cli.questionSync("Would you like to use default settings?(Y/N)");
	const parse1 = cli.parseYesNo(ans1);
	if(parse1 === false || parse1 === null) {
		cli.quit();
		return;
	}
	if(parse1 === 'y') {
		return;
	}

	const ans2 = cli.questionSync("Set api hashrate update interval?(default: 10)");
	const parse2 = cli.parseInt(ans2);

	if(parse2 === false || parse2 === null) {
		cli.quit();
		return;
	}
	config.api.updateInterval = parse2;

	const ans3 = cli.questionSync("Set api port?(default: 8001)");
	const parse3 = cli.parseInt(ans3);

	if(parse3 === false || parse3 === null) {
		cli.quit();
		return;
	}

	config.api.port = parse3;

	const ans4 = cli.questionSync("Set api bindIp?(default: 0.0.0.0)");
	const parse4 = cli.parseIp(ans4);

	if(parse4 === false || parse4 === null) {
		cli.quit();
		return;
	}

	config.api.bindIp = parse4;

	const ans5 = cli.questionSync("Set admin password for api?");
	const parse5 = cli.parsePassword(ans5);

	if(parse5 === false || parse5 === null) {
		cli.quit();
		return;
	}

	config.api.password = parse5;

	const ans6 = cli.questionSync("Set SSL for api?");
	const parse6 = cli.parseYesNo(ans6);
	if(parse6 === false || parse6 === null) {
		cli.quit();
		return;
	}
	if(parse6 === 'n') {
		config.api.ssl = { enabled : false };
	} else {
		config.api.ssl.enabled = true;
		const ans7 = cli.questionSync("Set SSL port for api?");
		const parse7 = cli.parseInt(ans7);
		if(parse7 === false || parse7 === null) {
			cli.quit();
			return;
		}
		config.api.ssl.enabled = parse7;

		let ans8 = cli.questionSync("Set SSL cert/key/chain folder for api?");
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
	const ans9 = cli.questionSync("Set API Limits for blocks display?");
		
	const parse9 = cli.parseInt(ans9);

	if(parse9 === false) {
		cli.quit();
		return;
	}

	config.api.limit.blocks = parse9;


	const ans10 = cli.questionSync("Set API Limits for payments display?");
	
	const parse10 = cli.parseInt(ans10);

	if(parse10 === false) {
		cli.quit();
		return;
	}

	config.api.limit.payments = parse10;

	const ans11 = cli.questionSync("Set API trust proxy ip? (Y/N)");
	
	const parse11 = cli.parseYesNo(ans11);

	if(parse11 === false) {
		cli.quit();
		return;
	}

	config.api.limit.trustProxyIP = parse11 === 'y';

}

const qWebPort = cli => {
	const ans = cli.questionSync("Would you like to enable web services?(Y/N)");
	const parse = cli.parseYesNo(ans);
	if(parse === false || parse === null) {
		cli.quit();
		return;
	}
	if(parse === 'n') {
		config.web = { enabled : false };
		return;
	}
	const ans1 = cli.questionSync("Please set a port for web services");
	const parse1 = cli.parseYesNo(ans1);
	if(parse1 === false || parse1 === null) {
		cli.quit();
		return;
	}

	config.web = {
		enabled: true,
		port: parse1
	};
}

const qLoggingConsole = cli => {

	const ans = cli.questionSync("Would you like to set default log console options?");
	const parse = cli.parseYesNo(ans)
	if(parse === false || parse === null) {
		cli.quit();
		return;
	}
	if(parse === 'y') {
		return;
	}

	const ans0 = cli.questionSync("Set log level for log console:\
		1) info\
		2) warn\
		3) error\
		";
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

const qLoggingFiles = cli => {

	const ans = cli.questionSync("Would you like to set default log files options?");
	const parse = cli.parseYesNo(ans)
	if(parse === false || parse === null) {
		cli.quit();
		return;
	}
	if(parse === 'y') {
		return;
	}


	const ans2 = cli.questionSync("Set log level for log file:\
	1) info\
	2) warn\
	3) error\
		";
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

	let ans3 = cli.questionSync("Set directory for log files?");
			
	if(ans3 === null || ans3 === '') {
		ans3 = 'log';
	}

	const parse3 = cli.parseFilePath(ans3);
	if(parse3 === false) {
		cli.quit();
		return;
	}

	config.logging.files.directory = parse3;

	const ans4 = cli.questionSync("Set minutes for log files to be written?(default:5)");
	const parse4 = cli.parseInt(ans4);
	if(parse4 === false) {
		cli.quit();
		return;
	}

	config.logging.files.flushInterval = parse4;
	
};

module.exports = cli => {

	const default = {
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
		}
	};

	config = default;

	const ans = cli.questionSync("Would you like to enable log files? (Y/N)");
	const parse = cli.parseYesNo(ans)
	if(parse === false || parse === null) {
		cli.quit();
		return;
	}
	if(parse === 'y') {
		qLoggingFiles(cli);
		return;
	} else {
		config.logging.files = {enabled : false};
	}

	qLoggingConsole(cli);
	qWebPort(cli);
	qApi(cli);
	config.poolServer = require('./1/poolServer.js')(cli);
	config.payments = require('./1/payments.js')(cli);
	config.charts = require('./1/charts.js')(cli);
	config = Object.merge(config, require('./1/dbs.js')(cli));

}
