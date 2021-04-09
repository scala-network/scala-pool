

const question = 
// 	2) Scala - Panthera Algo\
// 	3) Scala - Progpow Algo\
// ",
module.exports = cli => {
	const ans = cli.questionSync("Please choose a redirect event to access.\n\
	1) On Login \n\
	2) On Mining \n\
	3) Both\n\
	4) Delete set redirect\n\
	");

	const parse = cli.parseInt(ans)
	if(parse === false || parse === null) {
		cli.quit();
		return;
	}

	const ans1 = cli.questionSync("Where do you want miners from event to redirect?");
	const ans2 = cli.questionSync("Which miners do you want to filter for redirect?\n\
1) ALL\n\
2) Continent\n\
3) Country\n\
4) IP\n\
		");

	const parse = cli.parseInt(ans)
	if(parse === false || parse === null) {
		cli.quit();
		return;
	}

	switch(parse) {
		case 1:

		break;
		case 2:
		let options = "";
		for(let i in cli.getContinents()) {
			const continent = cli.getContinents()[i];
			const n = i+1;
			options+=`${n}) ${continent}\n`;
		}

		const ans22 = cli.questionSync("Choose a Continent?\n"+options);
		const parse22 = cli.parseInt(ans22);
		if(parse22 === false) {
			cli.quit();
			return;
		}
		const index = parse22-1;
		if(!~cli.getContinents().indexOf(index)) {
			console.log("Invalid continent");
			cli.quit();
			return;
		}
		const selected_continent  = cli.getContinents()[index];
		break;
		case 3:
		let options = "";
		const countries = cli.getCountries();
		for(let i in countries) {
			const country = countries[i];
			const n = i+1;
			options+=`${n}) ${country}\n`;
		}

		const ans23 = cli.questionSync("Choose a Country?\n"+options);
		const parse23 = cli.parseInt(ans23);
		if(parse23 === false) {
			cli.quit();
			return;
		}
		const index = parse23-1;
		if(!~countries.indexOf(index)) {
			console.log("Invalid country");
			cli.quit();
			return;
		}
		const selected_country  = countries[index].trim().replace(' ','_').toLowerCase();
		break;
		case 4:
		const ans24 = cli.questionSync("Please state IP");
		const parse24 = cli.parseIp(ans24);
		if(parse24 === false || parse24 === null) {
			cli.quit();
			return;
		}

		break;
		default:
		console.log("Invalid options");
		cli.quit();
		break;
	}

}