

const question = "Please choose a config to generate.\
	1) Global";
// 	2) Scala - Panthera Algo\
// 	3) Scala - Progpow Algo\
// ",
module.exports = cli => cli.question(question, ans => {
	const parse = cli.parse(ans)
	if(!parse) {
		cli.quit();
		return;
	}

	cli.getTemplate(`1/${parse}`)(cli);

});
