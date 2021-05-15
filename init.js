/* 
 * Scala Project Nodejs Pool
 * Copyright StelliteCoin	<https://github.com/stellitecoin/cryptonote-stellite-pool>
 * Copyright Ahmyi			<https://github.com/ahmyi/cryptonote-stellite-pool>
 * Copyright Dvandal    	<https://github.com/dvandal/cryptonote-nodejs-pool>
 * Copyright Fancoder   	<https://github.com/fancoder/cryptonote-universal-pool>
 * Copyright zone117x		<https://github.com/zone117x/node-cryptonote-pool>
 *
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

const fs = require('fs');
const cluster = require('cluster');
const os = require('os');

// Initialize log system
const logSystem = 'init';
/**
 * Load pool configuration
 **/
const args = require("args-parser")(process.argv);

global.config = require('./lib/core/bootstrap')(args.config || 'config.json');
global.log = require('./lib/core/logger');
const em = require('./lib/core/event_manager');
global.EventManager = new em();
const Redis = require('./lib/datasource/redis');
const redis = new Redis(global.config.redis);
global.redisClient = redis.client;
const validModules = ['pool', 'api', 'unlocker', 'payments', 'charts','rpcbalancer','web'];
//,'rpcbalancer'];


// Load pool modules
if (cluster.isWorker){
    switch(process.env.workerType){
        case 'pool':
            require('./lib/pool.js');
            break;
        case 'poolWorker':
            require('./lib/pool/worker.js');
            break;
        case 'listener':
            break;
        case 'unlocker':
            require('./lib/blockUnlocker.js');
            break;
        case 'payments':
            require('./lib/paymentProcessor.js');
            break;
        case 'api':
            require('./lib/api.js');
	    break;
        case 'charts':
            require('./lib/chartsDataCollector.js');
            break;
		case 'web':
			require('./lib/web.js');
		break;
        default:
        	console.error(`Invalid worker type ${process.env.workerType}`)
    }
    return;
}

require('./lib/exceptionWriter.js')(logSystem);

// Pool informations
log('info', logSystem, 'Starting Scala Node.JS pool version %s', [global.config.version]);


const createWorker = function(workerType, forkId){
    const worker = cluster.fork({
        workerType: workerType,
        forkId: forkId
    });
    worker.forkId = forkId;
    worker.type = workerType;
    worker.on('exit', function(code, signal){
        log('error', logSystem, '%s fork %s died, spawning replacement worker...', [workerType, forkId]);
        setTimeout(function(){
            createWorker(workerType, forkId);
        }, global.config.poolServer.timeout || 2000);
    }).on('message', function(msg){
        switch(msg.type){
        	case 'statsCollector':
        		Object.keys(cluster.workers).forEach(function(id) {
                    if (cluster.workers[id].type === 'api'){
                        cluster.workers[id].send({type: 'statsCollector', data: msg.data});
                    }
                });	
        	break
            case 'banIP':
                Object.keys(cluster.workers).forEach(function(id) {
                    if (cluster.workers[id].type === 'pool'){
                        cluster.workers[id].send({type: 'banIP', ip: msg.ip});
                    }
                });
                break;
            case 'blockTemplate':
            	Object.keys(cluster.workers).forEach(function(id) {
                    if (cluster.workers[id].type === 'pool'){
                        cluster.workers[id].send({type: 'blockTemplate', block: msg.block});
                    }
                });
               break;
            case 'jobRefresh':
            	Object.keys(cluster.workers).forEach(function(id) {
                    if (cluster.workers[id].type === 'poolWorker'){
                        cluster.workers[id].send({type: 'jobRefresh'});
                    }
                });
            	break;
        }
    });
};
/**
 * Start modules
 **/
(function(){
	/**
	 * Spawn pool workers module
	 **/
	function spawnPoolWorkers(){
	    if (!config.poolServer || !config.poolServer.enabled) {
	    	return;
	    }
	    
	    if (!config.poolServer.ports || config.poolServer.ports.length === 0){
	        log('error', logSystem, 'Pool server enabled but no ports specified');
	        return;
	    }
	
	    const numForks = (function(){
	        if (!config.poolServer.clusterForks){
	            return 1;
	        }
	        if (global.config.poolServer.clusterForks === 'auto'){
	            return os.cpus().length;
	        }
	        if (isNaN(config.poolServer.clusterForks)){
	            return 1;
	        }
	        return global.config.poolServer.clusterForks;
	    })();
	
	
	    let i = 0;
	    createWorker('poolWorker', 0);
	    setTimeout(() => {
	    	let spawnInterval = setInterval(function(){
				i++;
		        if (i -1 === numForks){
		        	log('info', logSystem, 'Pool spawned on %d thread(s)', [numForks]);
		            clearInterval(spawnInterval);
					return;
		        }
		       	createWorker('pool', i.toString());
		    }, 10);
	    },20)
	    
	}
	
	/**
	 * Spawn block unlocker module
	 **/
	function spawnBlockUnlocker(){
	    if (!config.blockUnlocker || !config.blockUnlocker.enabled) {
	    	return;
	    }
	
	    var worker = cluster.fork({
	        workerType: 'unlocker'
	    });
	    worker.on('exit', function(code, signal){
	        log('error', logSystem, 'Block unlocker died, spawning replacement...');
	        setTimeout(function(){
	            spawnBlockUnlocker();
	        }, 2000);
	    });
	}
	
	/**
	 * Spawn payment processor module
	 **/
	function spawnPaymentProcessor(){
	    if (!config.payments || !config.payments.enabled) {
	    	return;
	    }
	
	    var worker = cluster.fork({
	        workerType: 'payments'
	    });
	    worker.on('exit', function(code, signal){
	        log('error', logSystem, 'Payment processor died, spawning replacement...');
	        setTimeout(function(){
	            spawnPaymentProcessor();
	        }, 2000);
	    });
	}
	
	/**
	 * Spawn API module
	 **/
	function spawnApi(){
		if (!global.config.api || !global.config.api.enabled) {
	    	return;
	    }
	    
	    const numForks = (function(){
	        if (!global.config.api.clusterForks){
	            return 1;
	        }
	        if (global.config.api.clusterForks === 'auto'){
	            return os.cpus().length;
	        }
	        if (isNaN(config.api.clusterForks)){
	            return 1;
	        }
	        return global.config.api.clusterForks;
	    })();
	
	
	    
	    let i = 0;
	 // createWorker('apiWorker',0);
	    setTimeout(() => {
	    	let spawnInterval = setInterval(function(){
				i++;
		        if (i -1 === numForks){
		        	log('info', logSystem, 'Api spawned on %d thread(s)', [numForks]);
		            clearInterval(spawnInterval);
					return;
		        }
		       	createWorker('api', i.toString());
		    }, 10);
	    },20)

	}
	
	/**
	 * Spawn charts data collector module
	 **/
	function spawnChartsDataCollector(){
	    if (!config.charts) return;
	
	    var worker = cluster.fork({
	        workerType: 'charts'
	    });
	    worker.on('exit', function(code, signal){
	        log('error', logSystem, 'chartsDataCollector died, spawning replacement...');
	        setTimeout(function(){
	            spawnChartsDataCollector();
	        }, 2000);
	    });
	}
		
	/**
	 * Spawn web service module
	 **/
	function spawnWeb(){
	    if (!global.config.web||!global.config.web.enabled) {
			log('info', logSystem,'Web service not enabled!');
	    	return;
	    }

	    const port = config.web || 80;
	
	    var worker = cluster.fork({
	        workerType: 'web'
	    });
	    worker.on('exit', function(code, signal){
		   if (!signal || code === 0) {
			log('info', logSystem,'Worker spawn success!');
		   } else {
	        log('error', logSystem, `worker was killed by signal: ${signal} : ${code}...`);
		   }
	        setTimeout(function(){
	            spawnWeb();
	        }, 2000);
	    });
	}

	
    	 
	const init = function(){
		const reqModules = (function(){
			if(!args.module){
				return validModules;
			}
			const modules = args.module.split(",");
			const loadModules = [];
		    for (let i in modules){
		    	const moduleName = modules[i].toLowerCase();
	            if (!~validModules.indexOf(moduleName)){
	            	log('error', logSystem, 'Invalid module "%s", valid modules: %s', [moduleName, validModules.join(', ')]);
	            	process.exit();
	            	return;
	            }
	            loadModules.push(moduleName);
		    }
		    return loadModules;
		})();

	            
        if (reqModules.length === 0){
        	reqModules = validModules;
        }

        const listenersKey = [];
        for(let i in reqModules){
        	switch(reqModules[i]){
				case 'web':
					spawnWeb();
				break;
	            case 'pool':
	                spawnPoolWorkers();
	                break;
	            case 'unlocker':
	                spawnBlockUnlocker();
	                break;
	            case 'payments':
	                spawnPaymentProcessor();
	                break;
	            case 'api':
	                spawnApi();
	                break;
	            case 'charts':
	                spawnChartsDataCollector();
	                break;
	            default:
	            	continue;
	        }
	        listenersKey.push(reqModules[i]);
        }
        
		global.config.listenerKey = listenersKey;

    
    };
    
   init();
})();
