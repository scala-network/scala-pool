const BaseDatasource = require('./base');

const logSystem = "datasource/redis";

class RedisDatasource extends BaseDatasource
{
	
	get config {
		host: this._config.host  || "127.0.0.1",
		port: this._config.port  || 6379,
		db: this._config.db  || 0,
		auth: this._config.auth  || false,
	}

	async init() {
		const config = this.config;
		this,client = require('redis').createClient((function(){
			const options = { 
				host: config.host,
				socket_keepalive:true,
				port:config.port, 
				retry_strategy: function (options) {
			        if (options.error && options.error.code === 'ECONNREFUSED') {
			            // End reconnecting on a specific error and flush all commands with
			            // a individual error
			        	log('error', logSystem,'The server refused the connection');
						return;
			        }
			        if (options.total_retry_time > 1000 * 60 * 60) {
			            // End reconnecting after a specific timeout and flush all commands
			            // with a individual error
			            return new Error('Retry time exhausted');
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
			
			if(config.redis.auth){
				options.auth_pass = config.auth;
			}
			return options;
		})());

		this.client.on('error', function (err) {
		    log('error', logSystem, "Error on redis with code : %s",[err.code]);
		});

		 /**
		 * Check redis database version
		 **/
		 const self = this;
		 const checkVersion = new Promise((r,e) => {
			self.client.info(function(error, response){
		        if (error){
		            log('error', logSystem, 'Redis version check failed');
		            e("Redis version check failed");
		            process.exit();
		            return;
		        }
		        var parts = response.split('\r\n');
		        var versionStringn;
		        var versionString;
		        for (var i = 0; i < parts.length; i++){
		            if (parts[i].indexOf(':') !== -1){
		                var valParts = parts[i].split(':');
		                if (valParts[0] === 'redis_version'){
		                    versionString = valParts[1];
		                    version = parseFloat(versionString);
		                    break;
		                }
		            }
		        }
		        
		        if (!version){
		            log('error', logSystem, 'Could not detect redis version - must be super old or broken');
		            e('Could not detect redis version - must be super old or broken');
		        } else if (version < 2.6){
		            log('error', logSystem, "You're using redis version %s the minimum required version is 2.6. Follow the damn usage instructions...", [versionString]);
		            e(`You're using redis version ${versionString} the minimum required version is 2.6. Follow the damn usage instructions`);
		        } else {
		        	r(null);
		        	return;
		        }
		        process.exit();
			 });
	    });

		 await checkVersion;
	}
}

module.exports = RedisDatasource;