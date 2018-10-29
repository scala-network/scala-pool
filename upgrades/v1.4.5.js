const logSystem = 'upgrade/v1.4.5';
require('../lib/exceptionWriter.js')(logSystem);
const async = require('async');

 async.waterfall([
 	function(callback){
	    redisClient.keys(config.coin + ':block_histories:*', function(error, result) {
	        if (error) {
	            log('error', logSystem, 'Error trying to get block histories from redis %j', [error]);
	            callback(error);
	            return;
	        }
	        if (result.length <= 0) {
	            log('info', logSystem, 'No block histories to migrate');
	            callback(true);
	            return;
	        }
	    
	    
	        callback(null, result);
	    });
	},
	function(results,callback){
		if(results.length <=0){
			callback(true);
		}
    	var redisCommands = results.map(function(k){
            return ['hkeys', k];
        });

        redisClient.multi(redisCommands).exec(function(e,replies){
        	// callback(redisKeys)
        	if(e){
        		return callback(e);
        	}
        	var keygen = {};
        	for(var i in replies){
        		var hkey = results[i];
        		const tablekeys = hkey.split(":");
    			const miner = tablekeys[tablekeys.length -1];
    			if(!keygen.hasOwnProperty(miner)){
    				keygen[miner] = {heights:[],key:hkey};
    			}
        		for(var ii in replies[i]){
        			var height = replies[i][ii];
        			keygen[miner].heights.push(height);
	        	}
        	}
        	callback(null,keygen);
        });
	},
	function(results,callback){
		if(results.length <=0){
			callback(true);
		}

		var miners = Object.keys(results);

		var redisCmd = [];
		var rediscmdMiners = [];
		for(var i in miners){
			const result = results[miners[i]];
			for(var ii in result.heights){
				var height = result.heights[ii];
				rediscmdMiners.push({
					miner:miners[i],
					height:height
				});
				redisCmd.push(['hget',result.key,height]);
			}
		}
		redisClient.multi(redisCmd).exec(function(e,replies){
			if(e){
        		return callback(e);
        	}
        	for(var i in replies){
        		rediscmdMiners[i].result = replies[i];
        	}
        	callback(null,rediscmdMiners);
        	
		});
	},
	function(results,callback){
		const redisCmds = [];
		const miners = [];
		for(var i in results){
			var miner = results[i].miner;
			if(miners.indexOf(miner) < 0){
				miners.push(miner);
			}
			var height = results[i].height;
			redisCmds.push(['zadd',config.coin+":block_scoresheets:"+miner,height,results[i].result]);
		}
		log("info",logSystem,"Migrating no %d of data",[redisCmds.length]);
		
		redisClient.multi(redisCmds).exec(function(e,results){
			if(e){
        		return callback(e);
        	}
        	callback(null,miners);
		});
	},
	function(miners,callback){
		var redisCommands = miners.map(function(miner){
            return ['del', config.coin+":block_histories:"+miner];
        });
		log("info",logSystem,"Deleting block histories for no %d of miners",[redisCommands.length]);
        redisClient.multi(redisCommands).exec(function(e,results){
			if(e){
        		return callback(e);
        	}
        	callback();
		});
	}],
	function(e){
		log("info",logSystem,"Upgrade completed");
        process.exit();
    }
);