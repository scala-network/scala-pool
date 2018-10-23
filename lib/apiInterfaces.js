/* Stellite Nodejs Pool
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
 
var http = require('http');
var https = require('https');

/**
 * Send API request using JSON HTTP
 **/
function jsonHttpRequest(host, port, data, callback, path){
    path = path || '/json_rpc';
    callback = callback || function(){};

    var options = {
        hostname: host,
        port: port,
        path: path,
        method: data ? 'POST' : 'GET',
        headers: {
            'Content-Length': data.length,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    var req = (port === 443 ? https : http).request(options, function(res){
        var replyData = '';
        res.setEncoding('utf8');
        res.on('data', function(chunk){
            replyData += chunk;
        });
        res.on('end', function(){
            var replyJson;
            try{
                replyJson = JSON.parse(replyData);
            }
            catch(e){
                callback(e, {});
                return;
            }
            callback(null, replyJson);
        });
    });

    req.on('error', function(e){
        callback(e, {});
    });

    req.end(data);
}

/**
 * Send RPC request
 **/
function rpc(host, port, method, params, callback){
    var data = JSON.stringify({
        id: "0",
        jsonrpc: "2.0",
        method: method,
        params: params
    });
    jsonHttpRequest(host, port, data, function(error, replyJson){
        if (error){
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
 * Load Balancing functions
 **/
var loadBalanceCurrent = 0;
function loadBalance(){

    if(!global.config.daemon.servers){
        return  global.config.daemon;
    }
    if(!Array.isArray(global.config.daemon.servers)){
        return  global.config.daemon.servers;
    }
    
    let i = global.config.daemon.servers.length;
    
    if(i === 1){
        return global.config.daemon.servers[0]; 
    }
    const server = global.config.daemon.servers[loadBalanceCurrent];
    switch(global.config.daemon.type){
        case "roundRobin" :
           loadBalanceCurrent++;
           if(i <= loadBalanceCurrent){
               loadBalanceCurrent=0;
           }
           break;
        case "random":
        default:
            loadBalanceCurrent = Math.floor(Math.random() * Math.floor(i -1));
            break;
    }
    
    
    return server;

}

/**
 * Exports API interfaces functions
 **/
module.exports = {
    batchRpcDaemon: function(batchArray, callback){
        const daemon = loadBalance();
        batchRpc(daemon.host, daemon.port, batchArray, callback);
    },
    rpcDaemon: function(method, params, callback){
        const daemon = loadBalance();
        rpc(daemon.host, daemon.port, method, params, callback);    
    },
    rpcWallet: function(method, params, callback){
        rpc(global.config.wallet.host, global.config.wallet.port, method, params, callback);
    },
    pool: function(path, callback){
        var bindIp = config.api.bindIp ? config.api.bindIp : "0.0.0.0";
        poolRpc(bindIp, global.config.api.port, path, callback);
    },
    jsonHttpRequest: jsonHttpRequest
};