

const question = "Welcome to Scala-nodejs-pool command line interface.\
Please choose an option below\
	1) Coin Config(s)\
	2) Redirect\
";
	// 2) IP Banning\
// ";

module.exports = cli => {
	cli.question(question, ans => {
		const parse = cli.parseInt(ans)
		if(!parse) {
			cli.quit();
			return;
		}

		cli.getTemplate(parse)(cli);

	});
}
