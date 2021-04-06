

const question = 
// 	2) Scala - Panthera Algo\
// 	3) Scala - Progpow Algo\
// ",
module.exports = cli => {
	const ans = cli.questionSync("Please choose a redirect event to access.\n\
	1) On Login \n\
	2) On Mining \n\
	3) Both\n");

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
		const ans22 = cli.questionSync("Choose a Continent?");
		break;
		case 3:
		const ans23 = cli.questionSync("Choose a Country?");
		break;
		case 4:
		const ans24 = cli.questionSync("Please state IP");
		break;
	}

}