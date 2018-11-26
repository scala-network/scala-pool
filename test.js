const args = require("args-parser")(process.argv);

global.config = require('./lib/bootstrap')(args.config || 'config.json');
require('./lib/logger.js');


global.required = (lib) =>{
	return require('.'+lib);
}
