const https = require('https')
const ipUtils = require('../utils/ip');


class PoolRedirect {
	static isEnabled() {
                return global.config.poolRedirect && global.config.poolRedirect.enabled;
	}
	static cached = new Map();
	static geoLocateByIp(ip, callback) {
		
		if(ipUtils.isLocalNetwork(ip)) {
			callback("UNAVALIABLE");
			return;
		}

		const info = PoolRedirect.cached.get(ip);
		if(info) {
			callback(null, info);
			return;
		}
// GET https://api.ipgeolocationapi.com/geolocate/91.213.103.0 HTTP/1.1
		const options = {
		  hostname: 'api.ipgeolocationapi.com',
		  port: 443,
		  path: '/geolocate/' + ip,
		  method: 'GET'
		}
		
		const req = https.request(options, res => {

			if(parseInt(res.statusCode) === 200) {
				  res.on('data', d => {
				  	try{
				  		const json = JSON.parse(d);
						PoolRedirect.cached.set(json);
				    	callback(null, json);
				  	} catch (e) {
						callback("Parse Error", null);
				  	}
				  });
			} else {
				callback("UNAVALIABLE", null);
			}
		});

		req.on('error', error => {
		  console.error(error)
		})

		req.end()
	}

	static byMiner (miner, eventName, fn) {
		const ip = miner.ip;
		const login = miner.login;
        
        const options = [
            "all", "ip_"+ip, 'login_' + login
        ];
        
		PoolRedirect.geoLocateByIp(ip, (error, geodata) => {
			if(error) {
				if(error !== "UNAVALIABLE") {
					fn(error);
					return;
				}
			} else if(geodata) {
		        if(geodata.continent) {
		            options.push( "continent_" + geodata.continent.toLowerCase());
		        }

		        if(geodata.name) {
		            options.push( "country_" + geodata.name.toLowerCase());
		        }
			}

	        redisClient.hmget(global.config.coin + ":redirect:" + eventName, options, (er, res) => {
	        	if(er) {
	        		fn(er);
	        		return;
	        	}
                for(let i = 0;i<options.length;i++) {
                    const redirect = res[i];
                    if(redirect) {
                        const redirection = redirect.split(":");
                        fn(null, {
                        	miner,
                        	redirect: {
                        		host: redirection[0],
                                port: parseInt(redirection[1])
                        	}
                        });
                        return; 
                    }
                }

	            fn(null, {
                	miner,
                });
	        });
		});
	}
}

module.exports = PoolRedirect;
