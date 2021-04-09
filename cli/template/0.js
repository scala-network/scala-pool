

const question = "\
####################################################\n\
##                                                ##\n\
##   ##########################################   ##\n\
##   ##########################################   ##\n\
##   ##########################################   ##\n\
##                                                ##\n\
##                       ##                       ##\n\
##                     ######                     ##\n\
##                   ##########                   ##\n\
##                ################                ##\n\
##             ##########  ##########             ##\n\
##           ##########      ##########           ##\n\
##         ##########          ##########         ##\n\
##      ###########              ###########      ##\n\
##   ############                  ############   ##\n\
##                                                ##\n\
####################################################\n\
\n\
Welcome to Scala-Pool Command Line Interface (CLI)\n\
Please choose an option below\n\
	1) Coin Config(s)\n\
	2) Redirect\n\
>";
	// 2) IP Banning\
// ";

module.exports = cli => {
	console.clear();


	cli.question(question, ans => {
		const parse = cli.parseInt(ans)
		if(!parse) {
			cli.quit();
			return;
		}

		cli.getTemplate(parse)(cli);

	});
}
