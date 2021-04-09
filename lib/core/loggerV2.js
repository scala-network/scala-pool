
const fs = require('fs');
const util = require('util');
const dateFormat = require('dateformat');
const clc = require('cli-color');


class Logger {
	#_log_system = null;

	debug = false;


	set logSystem(ls) {
		this.#_log_system = ls;
	}
	get logSystem() {
		if(!this.#_log_system) {
			this.#_log_system = process.env.workerType;
		}
		return this.#_log_system;
	}
	// Set CLI colors
	#_severityMap = {
	    'info': clc.blue,
	    'warn': clc.yellow,
	    'error': clc.red
	};
	
	#_pendingWrites = {};

	// Set severity levels
	// #_severityLevels = ['info', 'warn', 'error'];

	constructor(config) {
		const logFileDisbled = !config.files || !config.enabled || false;
		const files = {};
		if(!logFileDisbled) {
			files.enabled = false;
		}

		if(files.enabled){
	
			// Set log directory
			const logDir = config.files.directory || path.join(process.cwd(),'logs');
			
			// Create log directory if not exists
			if (!fs.existsSync(logDir)){
			    try {
			        fs.mkdirSync(logDir);
			    }
			    catch(e){
			        throw e;
			    }
			}

			const flushInterval = config.files.flushInterval || 10;
			/**
			 * Write log entries to file at specified flush interval
			 **/ 
			const self = this;
			setInterval(() => {
			    for (let fileName in self.#_pendingWrites){
			        let data = self.#_pendingWrites[fileName];
			        fs.appendFile(fileName, data, err => {
			            if (err) {
			                console.log("Error writing log data to disk: %s", err);
			            }
			        });
			        delete self.#_pendingWrites[fileName];
			    }
			}, flushInterval * 1000);


			files.directory = logDir;
			files.flushInterval = flushInterval;
			files.level = config.files.level || 'info'
		}

		const consoles = {
			level : config.console.level || 'info',
			colors: config.console.colors || true,
		}



		this.#_config = {
			files,
			console:consoles
		};

	}

		

	get config() {
		return this.#_config;
	}

	output(severity, text, data) {
		if(this.debug !== false && this.logSystem !== this.debug){
			return;
		}
		const system = this.logSystem;
		const severityLevels = Object.keys(this.#_severityMap);
    	const logConsole =  severityLevels.indexOf(severity) >= severityLevels.indexOf(this.config.console.level);
    	const logFiles = this.config.files.enabled ? severityLevels.indexOf(severity) >= severityLevels.indexOf(this.config.files.level):false;
		
	    if (!logConsole && !logFiles) {
	    	return;
	    }

    	const time = dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss');
    	const formattedMessage = text;

	    if (data) {
	    	let input
	    	if(!Array.isArray(data)) {
	    		input = [data]
	    	} else {
	    		input = data
	    	}
	    	
	        input.unshift(text);
	        formattedMessage = util.format.apply(null, input);
	    }

	    if (logConsole){
	        if (this.config.console.colors){
	            console.log(this.#_severityMap[severity](time) + clc.white.bold(' [' + system + '] ') + formattedMessage);
	        }else{
	            console.log(time + ' [' + system + '] ' + formattedMessage);
	        }
	    }


	    if (logFiles) {
	        const fileName = path.join(logDir, system + '_' + severity + '.log';
	        const fileLine = time + ' ' + formattedMessage + '\n';
	        this.#_pendingWrites[fileName] = (this.#_pendingWrites[fileName] || '') + fileLine;
	    }
	}


	info(text, data) {
		return this.output('info', text, data);
	}

	warn(text, data) {
		return this.output('warn', text, data);
	}

	error(text, data) {
		return this.output('error', text, data);
	}
}

module.exports = Logger;