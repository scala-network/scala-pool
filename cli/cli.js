const readline = require("readline");
const fs = require("fs"); // Or `import fs from "fs";` with ESM

class Cli {

	constructor() {
		const rl = readline.createInterface({
		    input: process.stdin,
		    output: process.stdout
		});

		rl.on("close", function() {
		    console.log("\nBYE BYE !!!");
		    process.exit(0);
		});

		this.#_rl = rl;

		this.getTemplate(0)(this);

	}

	async questionSync(quest) {
		const self = this;
		let promise = new Promise(function(resolve, reject) {
  		// executor (the producing code, "singer")
	  		self.#_rl.question(quest, ans => resolve(ans));
  		});
	  let result = await promise; // wait until the promise resolves (*)
	  return result;
	}
	question(quest, callback) {
		this.#_rl.question(quest, callback);
	}
	quit(){
		this.#_rl.close();
	}
	getTemplate(template_no) {
		return require('./template/'+template_no);
	}

	parseIp(ans) {
		if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ans)) return ans;
		
		console.log('Not a valid ip address');
		return false;
	}

	parsePassword(ans) {
		if(/^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{6,16}$/.test(ans)) return ans;

		console.log("Password must be 6~16 characters, must contain alphanumeric and symbols");
		return false;

	}

	parseInt(ans) {
		if(ans.toLowerCase() === 'q' || ans.toLowerCase() === 'quit' || ans.toLowerCase() === 'exit') {
			return false;
		}
		
		return parseInt(ans);
	}

	parseYesNo(ans) {
		switch(ans.toLowerCase()) {
			case 'q':
			case 'quit':
			case 'exit':
			return false;
			case 'y':
			case 'yes':
			case 'ye':
			return 'y';
			case 'n':
			case 'no':
			return 'n';
			default:
			console.log("Only yes/no answers");
			return null;
		}
	}

	parseFilePath(ans) {
		if(ans === null || ans === '') {
			ans = process.cwd();
		}

		const dots  = !!~ans.indexOf("../") || !!~ans.indexOf("./");

		if(dots) {
			console.log("Path should be absolute");
			return false;
		}
		

		try{
			if (!fs.existsSync(ans)) {
				fs.mkdirSync(ans);
			}
			const stats = fs.statSync(ans);
			if(!stats.isDirectory()) {
				return false;
			}

			const isWithRoot = repans.startsWith("/");

			if(isWithRoot) {
				return ans;
			}

			return path.join(process.cwd(), ans);

		} catch(e) {
		}

		return false;
	}

}

new Cli();
