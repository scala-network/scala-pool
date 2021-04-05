

const question = 
// 	2) Scala - Panthera Algo\
// 	3) Scala - Progpow Algo\
// ",
module.exports = cli => {
	const ans = cli.questionSync("Please choose a redirect event to access.\n\
	1) On Login \n\
	2) On Mining \n\
	3) Both\n");

	const ans1 = cli.questionSync("Where do you want miners from events to redirect?");
	const ans2 = cli.questionSync("Which miners do you want to filter for redirect?");
	
}