/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Handle communications to APIs
 **/

// Load required modules
var http = require('http');
var https = require('https');

function jsonHttpRequest (host, port, data, callback, path) {
	path = path || '/json_rpc';
	callback = callback || function () {};
	var options = {
		hostname: host,
		port: port,
		path: path,
		method: data ? 'POST' : 'GET',
		headers: {
			'connection': 'keep-alive',
			'Content-Length': data.length,
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		}
	};
	var req = (port === 443 ? https : http)
		.request(options, function (res) {
			var replyData = '';
			res.setEncoding('utf8');
			res.on('data', function (chunk) {
				replyData += chunk;
			});
			res.on('end', function () {
				var replyJson;
				try {
					replyJson = replyData ? JSON.parse(replyData) : {};
				} catch (e) {
					callback(e, {});
					return;
				}
				callback(null, replyJson);
			});
		});

	req.on('error', function (e) {
		callback(e, {});
	});

	req.end(data);
}



/**
 * Send RPC request
 **/
function rpc (host, port, method, params, callback) {
	var data = JSON.stringify({
		id: "0",
		jsonrpc: "2.0",
		method: method,
		params: params
	});
	jsonHttpRequest(host, port, data, function (error, replyJson) {
		if (error) {
			callback(error, {});
			return;
		}
		callback(replyJson.error, replyJson.result)
	});
}

/**
 * Send RPC requests in batch mode
 **/
function batchRpc(host, port, array, callback){
    var rpcArray = [];
    for (var i = 0; i < array.length; i++){
        rpcArray.push({
            id: i.toString(),
            jsonrpc: "2.0",
            method: array[i][0],
            params: array[i][1]
        });
    }
    var data = JSON.stringify(rpcArray);
    jsonHttpRequest(host, port, data, callback);
}

/**
 * Send RPC request to pool API
 **/
function poolRpc(host, port, path, callback){
    jsonHttpRequest(host, port, '', callback, path);
}


/**
 * Exports API interfaces functions
 **/
module.exports = {
    batchRpcDaemon: function(batchArray, callback){
        const daemon = global.config.daemon;
        batchRpc(daemon.host, daemon.port, batchArray, callback);
    },
    rpcDaemon: function(method, params, callback){
        const daemon = global.config.daemon;
        rpc(daemon.host, daemon.port, method, params, callback);    
    },
    rpcWallet: function(method, params, callback){
        rpc(global.config.wallet.host, global.config.wallet.port, method, params, callback);
    },
    pool: function(path, callback){
        let bindIp = config.api.bindIp ? config.api.bindIp : "127.0.0.1";
        if(bindIp === '0.0.0.0') {
        	bindIp = '127.0.0.1';
        }
        poolRpc(bindIp, global.config.api.port, path, callback);
    },
    jsonHttpRequest,
    promise : {
    	jsonHttpRequest: async function(host, port, data, path) {
	    	return new Promise(function(resolve, reject) {
	    		jsonHttpRequest (host, port, data, function(error, results) {
	    			if(error) return reject(error);
	    			return resolve(results);
	    		}, path);
	    	});
	    },
	    batchRpcDaemon: function(batchArray, callback){
	        return new Promise(function(resolve, reject) {
		        const daemon = global.config.daemon;
				batchRpc(daemon.host, daemon.port, batchArray, function(error, results) {
	    			if(error) return reject(error);
	    			return resolve(results);
	    		});
	    	});
	    },
	    rpcDaemon: function(method, params, callback){
	        const daemon = global.config.daemon;
	        return new Promise(function(resolve, reject) {
		        const daemon = global.config.daemon;
				rpc(daemon.host, daemon.port, method, params, function(error, results) {
	    			if(error) return reject(error);
	    			return resolve(results);
	    		});
	    	});
	    },
	    rpcWallet: function(method, params, callback){
	        return new Promise(function(resolve, reject) {
				rpc(global.config.wallet.host, global.config.wallet.port, method, params, function(error, results) {
	    			if(error) return reject(error);
	    			return resolve(results);
	    		});
	    	});
	    },
	    pool: function(path, callback){
	        let bindIp = config.api.bindIp ? config.api.bindIp : "127.0.0.1";
	        if(bindIp === '0.0.0.0') {
	        	bindIp = '127.0.0.1';
	        }
	        return new Promise(function(resolve, reject) {
				poolRpc(bindIp, global.config.api.port, path, function(error, results) {
	    			if(error) return reject(error);
	    			return resolve(results);
	    		});
	    	});
	    },
    }
    
};
