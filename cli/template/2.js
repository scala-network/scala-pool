const fs = require('fs');
const path = require('path');
const Redis = require(path.join(process.cwd(),'lib','datasource','redis'));

module.exports = async cli => {

	// const configs = fs.readdirSync(path.join(process.cwd(),'config'));
	// const configs = fs.readFileSync(path.join(process.cwd(),'config.json'));
	// if(configs) {
	// 	console.log("No config files found");
	// 	cli.quit();
	// 	return;
	// }
	

	// let ans_options = "";
	// for(let i in configs) {
	// 	const ai = i+1;
	// 	ans_options +=` ${ai}) ${configs[i]}\n`;
	// }

	// const _ans = await cli.questionSync(`Please choose a config.\n ${ans_options}\n>`);
	// const parse_ans = cli.parseInt(_ans);
	// if(parse_ans === false || parse_ans === null) {
	// 	cli.quit();
	// 	return;
	// }

	let config;
	try{
		// config = JSON.parse(fs.readFileSync(configs[parse_ans-1]));
		// if(!('redis' in config)) {
		// config = JSON.parse(fs.readFileSync(path.join(process.cwd(),'config','config.json')));
		config = JSON.parse(fs.readFileSync(path.join(process.cwd(),'config.json')));
		// }
	}catch(e) {
		console.log(e);
		console.log("Invalid json file");
		cli.quit();
		return;
	}

	if(!('redis' in config)) {
		console.log("Missing redis config");
		cli.quit();
		return;
	}

	const redis = new Redis(config.redis);

	const ans = await cli.questionSync("Please choose a redirect event to access.\n\
1) On Login \n\
2) On Mining \n\
3) Both\n\
4) Delete set redirect\n\
>");

	const parse = cli.parseInt(ans);
	if(parse === false || parse === null) {
		cli.quit();
		return;
	}

	let eventName = "";
	if(parse === 1) {
		eventName = 'onLogin';
	} else if(parse === 2) {
		eventName = 'onMining';
	} else if (!~[3,4].indexOf(parse)) {
		console.log("Invalid event name");
		cli.quit();
		return;
	}
	
	let parse1;
	let questionNext = "Which category do you want to filter for redirect?";
	if(parse !== 4) {

		const ans1 = await cli.questionSync("Where do you want miners from event to redirect? (IP:PORT)\n>");
		const ans1s = ans1.split(':');


		let parse1p;
		if(ans1s.length <= 1) {
			parse1 = cli.parseIp(ans1s[0]);
			parse1p = 3333;
		} else {
			parse1 = cli.parseIp(ans1s[0]);
			parse1p = cli.parseInt(ans1s[1]);

		}
		if(parse1 === false || parse1 === null || parse1p === false || parse1p === null) {
			cli.quit();
			return;
		}

		parse1 = parse1 + ":" + parse1p;
	} else {
		questionNext = "Which category do you want to filter for redirect deletion?";
	}

	const ans2 = await cli.questionSync(questionNext+"\n\
1) ALL\n\
2) Continent\n\
3) Country\n\
4) IP\n\
>");

	const parse2 = cli.parseInt(ans2)
	if(parse2 === false || parse2 === null) {
		cli.quit();
		return;
	}
	let options = "";

	switch(parse2) {
		case 1:
		if(parse === 3) {
			redis.client.multi([
				['hset',[config.coin, "redirect", 'onLogin'].join(':'),'all', parse1],
				['hset',[config.coin, "redirect", 'onMining'].join(':'),'all', parse1]
				]).exec((e,r) => {
					console.log(`Redirect all requests to ${parse1} for all events set`);
					cli.quit();
				})
		} else if(parse === 4) {
			redis.client.multi([
				['hdel',[config.coin, "redirect", 'onLogin'].join(':'),'all'],
				['hdel',[config.coin, "redirect", 'onMining'].join(':'),'all']
				]).exec((e,r) => {
					console.log(`All redirect events deleted`);
					cli.quit();
				});
			return;
		} else {
			console.log(parse1);
			const redout = new Promise((res,rej) => {
				redis.client.hset([config.coin, "redirect", eventName].join(':'),'all',parse1, (e,r) => {
					if(e) {
						return rej(e);
					}
					res(r);
				});
			});

			const result  = await redout;
			console.log(`Redirect all requests to ${parse1} for event ${eventName} set`);
		}
		break;
		case 2:
		for(let i in cli.getContinents()) {
			const continent = cli.getContinents()[i];
			const n = i+1;
			options+=`${n}) ${continent}\n`;
		}

		const ans22 = await cli.questionSync("Choose a Continent?\n"+options+">");
		const parse22 = cli.parseInt(ans22);
		if(parse22 === false) {
			cli.quit();
			return;
		}
		const index22 = parse22-1;
		if(!~cli.getContinents().indexOf(index22)) {
			console.log("Invalid continent");
			cli.quit();
			return;
		}
		const selected_continent  = cli.getContinents()[index22];
		if(parse === 3) {
			redis.client.multi([
				['hset',[config.coin, "redirect", 'onLogin'].join(':'),"continent_" + selected_continent.toLowerCase(), parse1],
				['hset',[config.coin, "redirect", 'onMining'].join(':'),"continent_" + selected_continent.toLowerCase(), parse1]
				]).exec((e,r) => {
					console.log(`Redirect all requests to ${parse1} for all events set`);
					cli.quit();
				})
		} else if(parse === 4) {
			redis.client.multi([
				['hdel',[config.coin, "redirect", 'onLogin'].join(':'),"continent_" + selected_continent.toLowerCase()],
				['hdel',[config.coin, "redirect", 'onMining'].join(':'),"continent_" + selected_continent.toLowerCase()]
				]).exec((e,r) => {
					console.log(`All redirect requests for all events deleted`);
					cli.quit();
				});
		} else {
			redis.client.hset([config.coin, "redirect", eventName].join(':'),"continent_" + selected_continent.toLowerCase(),parse1, (e,r) => {
				console.log(`Redirect all requests to ${parse1} for event ${eventName} set`);
				cli.quit();
			});
		}
		break;
		case 3:
		const countries = cli.getCountries();
		for(let i in countries) {
			const country = countries[i];
			const n = i+1;
			options+=`${n}) ${country}\n`;
		}

		const ans23 = await cli.questionSync("Choose a Country?\n"+options);
		const parse23 = cli.parseInt(ans23);
		if(parse23 === false) {
			cli.quit();
			return;
		}
		const index23 = parse23-1;
		if(!~countries.indexOf(index23)) {
			console.log("Invalid country");
			cli.quit();
			return;
		}
		const selected_country  = countries[index23].trim().replace(' ','_').toLowerCase();
		if(parse === 3) {
			redis.client.multi([
				['hset',[config.coin, "redirect", 'onLogin'].join(':'),"country_" + selected_country, parse1],
				['hset',[config.coin, "redirect", 'onMining'].join(':'),"country_" + selected_country, parse1]
				]).exec((e,r) => {
					console.log(`Redirect all requests to ${parse1} for country_${selected_country} events set`);
					cli.quit();
				})
		} else if(parse === 4) {
			redis.client.multi([
				['hdel',[config.coin, "redirect", 'onLogin'].join(':'),"country_" + selected_country],
				['hdel',[config.coin, "redirect", 'onMining'].join(':'),"country_" + selected_country]
				],(e,r) => {
					console.log(`All redirect requests for country_${selected_country} events deleted`);
					cli.quit();
				});
		} else {
			redis.client.hset([config.coin, "redirect", eventName].join(':'),"country_" + selected_country,parse1, (e,r) => {
				console.log(`Redirect country_${selected_country} requests to ${parse1} for event ${eventName} set`);
				cli.quit();
			});
		}
		break;
		case 4:
		const ans24 = await cli.questionSync("Please state IP");
		const parse24 = cli.parseIp(ans24);
		if(parse24 === false || parse24 === null) {
			cli.quit();
			return;
		}
		if(parse === 3) {
			redis.client.multi([
				['hset',[config.coin, "redirect", 'onLogin'].join(':'),"ip_" + parse24, parse1],
				['hset',[config.coin, "redirect", 'onMining'].join(':'),"ip_" + parse24, parse1]
				]).exec((e,r) => {
					console.log(`Redirect all requests to ${parse1} for ip_${parse24} events set`);
					cli.quit();
				})
		} else if(parse === 4) {
			redis.client.multi([
				['hdel',[config.coin, "redirect", 'onLogin'].join(':'),"ip_" + parse24],
				['hdel',[config.coin, "redirect", 'onMining'].join(':'),"ip_" + parse24]
				]).exec((e,r) => {
					console.log(`All redirect requests for ip_${parse24} events deleted`);
					cli.quit();
				});
		} else {
			redis.client.hset([config.coin, "redirect", eventName].join(':'),"ip_" + parse24,parse1, (e,r) => {
				console.log(`Redirect ip_${parse24} requests to ${parse1} for event ${eventName} set`);
				cli.quit();
			});
		}
		break;
		default:
		console.log("Invalid options");
		break;
	}
	console.log("Redirect setup completed");
	cli.quit();
	return;

}