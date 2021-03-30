

class PoolRedirect {
	static geoLocateByIp(ip, callback) {
// GET https://api.ipgeolocationapi.com/geolocate/91.213.103.0 HTTP/1.1

	}

	static byMiner (miner, eventName, fn) {
		const ip = miner.ip;
		const login = miner.login;
        
        const options = [
            "all", "ip_"+ip, 'login_' + login
        ];

		PoolRedirect.geoLocateByIp(ip, (error, geodata) => {
			if(error) {
				fn(error);
				return;
			}			

	        if(geodata.continent) {
	            options.push( "continent_" + geodata.continent.toLowerCase());
	        }

	        if(geodata.name) {
	            options.push( "country_" + geodata.name.toLowerCase());
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
                                port: redirection[1]
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

module.exports = Redirect;