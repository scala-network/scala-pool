

const question = 
// 	2) Scala - Panthera Algo\
// 	3) Scala - Progpow Algo\
// ",
module.exports = async cli => {
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

	const ans1 = await cli.questionSync("Where do you want miners from event to redirect?(IP)\n>");
	const parse1 = cli.parseIp(ans1);
	if(parse1 === false || parse1 === null) {
		cli.quit();
		return;
	}


	const ans2 = await cli.questionSync("Which miners do you want to filter for redirect?\n\
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
		break;
		case 4:
		const ans24 = await cli.questionSync("Please state IP");
		const parse24 = cli.parseIp(ans24);
		if(parse24 === false || parse24 === null) {
			cli.quit();
			return;
		}

		break;
		default:
		console.log("Invalid options");
		break;
	}
		cli.quit();

}