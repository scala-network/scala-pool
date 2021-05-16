

const question = "Please choose a config to generate.\n\
	1) Global\n\
>";
// 	2) Scala - Panthera Algo\
// 	3) Scala - Progpow Algo\
// ",
module.exports = cli => cli.question(question, ans => {
	const parse = cli.parseInt(ans);
	if(!parse) {
		cli.quit();
		return;
	}

	cli.getTemplate(`1/${parse}`)(cli);

});
