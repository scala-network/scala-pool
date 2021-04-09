'use strict'
 
const fs = require('fs')
const path = require('path')
const util = require('util')
const readJson = require('read-package-json')
const packageJson = util.promisify(readJson)

module.exports = configFile => {
	let config = null
	
	try {
    	config = JSON.parse(fs.readFileSync(configFile));
    	
	} catch(e){
	    console.error('Failed to read config file ' + configFile + '\n\n' + e);
	    process.exit();
	    return;
	}
	
	if (!config.poolServer.paymentId || !config.poolServer.paymentId.addressSeparator) {
		config.poolServer.paymentId = {
			addressSeparator:"+"
		};
	}
	
	if (!config.poolServer.donations || !config.poolServer.donations.addressSeparator) {
		config.poolServer.donations = {
			addressSeparator:"%"
		};
	}
	
	if (!config.poolServer.fixedDiff || !config.poolServer.fixedDiff.addressSeparator) {
		config.poolServer.fixedDiff = {
			addressSeparator:"."
		};
	}
    const paymentTypes = [];
    for(let i in config.poolServer.ports) {
        const port = config.poolServer.ports[i];
        const poolType = port.poolType || 'props'
        if(!!~paymentTypes.indexOf(poolType)) {
            continue;
        }
        paymentTypes.push(poolType);
    }

    config.payments.supported = paymentTypes;
    config.version = 0
    
    try {
    	const pjson = JSON.parse(fs.readFileSync(path.join(process.cwd(),'package.json')));
    	config.version = pjson.version;
	} catch(e){
	    console.error('Failed to read config file ' + configFile + '\n\n' + e);
	    process.exit();
	    return;
	}


	config.addresses = {
		dev: "Svk7VUPASsbZhFErf8rEfuEEX94GWsSWKVS8GNAUDfH363EsSLZ58wd3rph8okcaFALthwMkQ4fWJBzYYjqA3Lk61McroQbno",
		donation: "SvjVtrdgZ4kR3YXaZ3yzvd1Vr13dU4c4HbfcTZsnEo9YJD47vrVtkZqQFHWWX9GunAUDq4iFA2jdo8eBua3cE96W1y9eSpgCk"
	}
	
	return config;
}
