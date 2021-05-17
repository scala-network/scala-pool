const BaseDatasource = require('./base');

class RedisDatasource extends BaseDatasource
{
	
	get config (){
		return {
			host: this._config.host  || "127.0.0.1",
			port: this._config.port  || 6379,
			db: this._config.db  || 0,
			auth: this._config.auth  || false,
		}
	}

	init() {
		const config = this.config;
		this.client = require('redis').createClient((function(){
			const options = { 
				host: config.host,
				socket_keepalive:true,
				port:config.port, 
				retry_strategy: function (options) {
			        if (options.error && options.error.code === 'ECONNREFUSED') {
			            // End reconnecting on a specific error and flush all commands with
			            // a individual error
			            return new Error('Datasource/Redis: The server refused the connection');
			        }
			        if (options.total_retry_time > 1000 * 60 * 60) {
			            // End reconnecting after a specific timeout and flush all commands
			            // with a individual error
			            return new Error('Datasource/Redis: Retry time exhausted');
			        }
			        if (options.attempt > 10) {
			            // End reconnecting with built in error
			            return undefined;
			        }
			        // reconnect after
			        return Math.min(options.attempt * 100, 3000);
			    },
				db: config.db,
			};
			
			if(config.auth){
				options.auth_pass = config.auth;
			}
			return options;
		})());

		this.client.on('error', function (err) {
			return console.log(`Datasource/Redis: Error on redis with code : ${err.code}`);
		});

	}

	check(cb) {
		 /**
		 * Check redis database version
		 **/
		const self = this;
		self.client.info(function(error, response){
	        if (error){
	        	console.log(error);
				console.log(`Datasource/Redis: Redis version check failed`);
	            cb("Redis version check failed");
	            process.exit();
	            return;
	        }
	        var parts = response.split('\r\n');
	        let versionString;
	        let version;
	        for (var i = 0; i < parts.length; i++){
	            if (parts[i].indexOf(':') !== -1){
	                var valParts = parts[i].split(':');
	                if (!!~['redis_version','Keydb_version'].indexOf(valParts[0].toLowerCase())){
	                    versionString = valParts[1];
	                    version = parseFloat(versionString);
	                    if(version === 0) {
	                    	versionString = '';
	                    	continue;
	                    }
	                    break;
	                }
	            }
	        }
	        if (!version){
				console.log(`Datasource/Redis: Could not detect redis version - must be super old or broken`);
	            cb('Could not detect redis version - must be super old or broken');
	        } else if (version < 2.6){
				console.log(`Datasource/Redis: You're using redis version ${versionString} the minimum required version is 2.6. Follow the damn usage instructions...`);
	            cb(`You're using redis version ${versionString} the minimum required version is 2.6. Follow the damn usage instructions`);
	        } else {
	        	cb(null);
	        	return;
	        }
	        process.exit();
		 });
	}
}

module.exports = RedisDatasource;