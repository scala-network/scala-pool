/* Stellite Nodejs Pool
 * Contributors:
 * StelliteCoin <https://github.com/stellitecoin/cryptonote-stellite-pool>
 * Ahmyi            <https://github.com/ahmyi/cryptonote-stellite-pool>
 * Dvandal      <https://github.com/dvandal/cryptonote-nodejs-pool>
 * Fancoder     <https://github.com/fancoder/cryptonote-universal-pool>
 * zone117x     <https://github.com/zone117x/node-cryptonote-pool>
 * jagerman     <https://github.com/jagerman/node-cryptonote-pool>
 
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
 const http = require('http');
 const https = require('https');
 const url = require("url");
 const async = require('async');

 const apiInterfaces = require('./apiInterfaces.js');
 const authSid = Math.round(Math.random() * 10000000000) + '' + Math.round(Math.random() * 10000000000);

// const charts = require('./charts.js');

const utils = require('./utils.js');
const os = require('os');

const rpcDaemon = require("./rpc/daemon");
// Initialize log system
const logSystem = 'api';
require('./exceptionWriter.js')(logSystem);
// Data storage variables used for live statistics
var currentStats = {};
var minerStats = {};
var minersHashrate = {};
var liveConnections = {};
var addressConnections = {};
const handlers = {
    blocks:require('./apiHandlers/blocks'),
    payouts:require('./apiHandlers/payouts'),
    scoresheets:require('./apiHandlers/scoresheets'),
    topminers:require('./apiHandlers/topminers'),
    payments:require('./apiHandlers/payments'),
    market:require('./apiHandlers/market')
};


/**
 * Handle server requests
 **/
 function handleServerRequest(request, response) {
    var urlParts = url.parse(request.url, true);

    switch(urlParts.pathname){
        // Pool statistics
        case '/stats':
        handleStats(urlParts, response);
        break;
        case '/live_stats':
        response.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
            'Connection': 'keep-alive'
        });

        var address = urlParts.query.address ? urlParts.query.address : 'undefined';

        var uid = Math.random().toString();
        var key = address + ':' + uid;

        response.on("finish", function() {
            delete liveConnections[key];
        });
        response.on("close", function() {
            delete liveConnections[key];
        });

        liveConnections[key] = response;
        break;

        // Worker statistics
        case '/stats_address':
        handleMinerStats(urlParts, response);
        break;

        // Payments
        case '/get_payments':
        handlers.payments(urlParts, function(data){
            sendData(response,data);
        });
        break;
        // Blocks
        case '/get_block':
        handlers.blocks.getBlock(urlParts, function (data) {
            sendData(response,data);
        });
        break;
        // Blocks
        case '/get_blocks':
        handlers.blocks.getBlocks(urlParts, function (data) {
            sendData(response,data);
        });
        break;

        // Get market prices
        case '/get_market':
        handlers.market(urlParts,function (data) {
            sendData(response,data);
        });
        break;

        // Top 10 miners
        case '/get_top10':
        handlers.topminers.getHandler(function(data){
            sendData(response,data);
        });
        break;
        
        // Miner settings
        case '/reset_donation_level':
        var address = urlParts.query.address;
        if(!utils.validateMinerAddress(address)){
            return sendData(response,{status:'error',message:'Invalid address'})
        }
        redisClient.hset(config.coin + ':workers:' + address,'donation_level',0,function(err){
            return sendData(response,(err)?{status:'error',message:"Unable to reset donation level"}:{status:"success"});
        });
        break;
        case '/get_miner_payout_level':
        handlers.payouts.getMinerPayoutLevel(urlParts,  function(data){
            sendData(response,data);
        });
        break;
        case '/set_miner_payout_level':
        handlers.payouts.setMinerPayoutLevel(urlParts, function(data){
            sendData(response,data);
        });
        break;
        case '/miners_scoresheet':
        handlers.scoresheets.miner(urlParts, function(data){
            sendData(response,data);
        });
        break;
        case '/pool_scoresheet':
        handlers.scoresheets.pool(urlParts, function(data){
            sendData(response,data);
        });
        break;
        // Pool Administration
        // case '/admin_stats':
        //     if (!authorize(request, response)) {
        //         return;
        //     }
        //     handleAdminStats(response);
        //     break;
        // case '/admin_monitoring':
        //     if (!authorize(request, response)) {
        //         return;
        //     }
        //     handleAdminMonitoring(response);
        //     break;
        // case '/admin_log':
        //     if (!authorize(request, response)) {
        //         return;
        //     }
        //     handleAdminLog(urlParts, response);
        //     break;
        // case '/admin_users':
        //     if (!authorize(request, response)) {
        //         return;
        //     }
        //     handleAdminUsers(response);
        //     break;
        // case '/admin_ports':
        //     if (!authorize(request, response)) {
        //         return;
        //     }
        //     handleAdminPorts(response);
        //     break;

        // Default response
        default:
        response.writeHead(404, {
            'Access-Control-Allow-Origin': '*'
        });
        response.end('Invalid API call');
        break;
    }
}


function sendData(response,data){


    var reply = JSON.stringify(data);

    response.writeHead("200", {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(reply, 'utf8')
    });
    return response.end(reply); 
    
};

/**
 * Broadcast live statistics
 **/
 function broadcastLiveStats(){
    // log('info', logSystem, 'Broadcasting to %d visitors and %d address lookups', [Object.keys(liveConnections).length, Object.keys(addressConnections).length]);

    // Live statistics
    var processAddresses = {};
    for (var key in liveConnections){
        var addrOffset = key.indexOf(':');
        var address = key.substr(0, addrOffset);
        if (!processAddresses[address]) processAddresses[address] = [];
        processAddresses[address].push(liveConnections[key]);
    }
    
    for (var address in processAddresses) {
        var data = currentStats;

        data.miner = {};
        if (address && minerStats[address]){
            data.miner = minerStats[address];
        }

        var destinations = processAddresses[address];
        sendLiveStats(data, destinations);
    }

    // Workers Statistics
    var processAddresses = {};
    for (var key in addressConnections){
        let addrOffset = key.indexOf(':')
        let address = key.substr(0, addrOffset)
        if (!processAddresses[address]) {
            processAddresses[address] = []
        }
        processAddresses[address].push(addressConnections[key]);
    }
    
    for (let address in processAddresses) {
        let stats = minerStats[address]
        sendLiveStats(data,  processAddresses[address])
        // broadcastWorkerStats(address, processAddresses[address]);
    }
}


// /**
//  * Broadcast worker statistics
//  **/
//  function broadcastWorkerStats(address, destinations) {
//     collectWorkerStats(address, data => sendLiveStats(data, destinations));
// }
/**
 * Send live statistics to specified destinations
 **/
 function sendLiveStats(data, destinations){
    if (!destinations) return ;

    let dataJSON = JSON.stringify(data);
    for (let i in destinations) {
        destinations[i].end(dataJSON);
    }
}

/**
 * Return pool statistics
 **/
 function handleStats(urlParts, response){
    var data = currentStats;

    data.miner = {};
    var address = urlParts.query.address;
    if (address && minerStats[address]) {
        data.miner = minerStats[address];
    }

    sendData(response,data);
}

/**
 * Return miner (worker) statistics
 **/
 function handleMinerStats(urlParts, response){
    var address = urlParts.query.address;
    
    var longpoll = (urlParts.query.longpoll === 'true');
    
    if(!utils.validateMinerAddress(address)){
        return sendData(response,{message:"Invalid miner address",status:'error'});
    }

    let stats = minerStats[address]

    if(!stats){
        return sendData(response,{message:"Not found",status:'error'});
    }


    if (longpoll){
        response.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
            'Connection': 'keep-alive'
        });

        const uid = Math.random().toString();
        const key = address + ':' + uid;

        response.on("finish", function() {
            delete addressConnections[key];
        })

        response.on("close", function() {
            delete addressConnections[key];
        })

        addressConnections[key] = response;
        // sendLiveStats(stats, response)
    } else {
        sendData(response, stats);
    }

}



/**
 * Authorize access to a secured API call
 **/
 function authorize(request, response){
    var sentPass = url.parse(request.url, true).query.password;

    var remoteAddress = request.connection.remoteAddress;
    if(config.api.trustProxyIP && request.headers['x-forwarded-for']){
      remoteAddress = request.headers['x-forwarded-for'];
  }

  const bindIp = config.api.bindIp ? config.api.bindIp : "0.0.0.0";
  if (typeof sentPass == "undefined" && (remoteAddress === '127.0.0.1' || remoteAddress === '::ffff:127.0.0.1' || remoteAddress === '::1' || (bindIp != "0.0.0.0" && remoteAddress === bindIp))) {
    return true;
}

response.setHeader('Access-Control-Allow-Origin', '*');

var cookies = parseCookies(request);
if (typeof sentPass == "undefined" && cookies.sid && cookies.sid === authSid) {
    return true;
}

if (sentPass !== global.config.api.password){
    response.statusCode = 401;
    response.end('Invalid password');
    return;
}

log('warn', logSystem, 'Admin authorized from %s', [remoteAddress]);
response.statusCode = 200;

var cookieExpire = new Date( new Date().getTime() + 60*60*24*1000);
response.setHeader('Set-Cookie', 'sid=' + authSid + '; path=/; expires=' + cookieExpire.toUTCString());
response.setHeader('Cache-Control', 'no-cache');
response.setHeader('Content-Type', 'application/json');

return true;
}


/**
 * Parse cookies data
 **/
 function parseCookies(request) {
    var list = {},
    rc = request.headers.cookie;
    rc && rc.split(';').forEach(function(cookie) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = unescape(parts.join('='));
    });
    return list;
}

/**
 * Handle multi-thread messages
 **/ 
 process.on('message', function(message) {
    switch (message.type) {
        case 'collectStats':
        currentStats = message.stats
        // minersHashrate = message.minersHashrate
        minerStats = message.minerStats
        // console.log(minerStats)
        // handlers.topminers.setMinersHashrate(minersHashrate)
        // handlers.scoresheets.setCurrentRound(message.currentRoundMiners.sort(function(a,b){
     //     var v1 = a.roundHashes ? parseInt(a.roundHashes) : 0;
     //     var v2 = b.roundHashes ? parseInt(b.roundHashes) : 0;
     //     if (v1 > v2) return -1;
     //     if (v1 < v2) return 1;
     //     return 0;   
     // }));
     broadcastLiveStats()
     break
 }
});

/**
 * Start pool API
 **/

// Collect statistics for the first time
// collectStats();

// Initialize RPC monitoring
//initMonitoring();

// Enable to be bind to a certain ip or all by default
var bindIp = config.api.bindIp || "0.0.0.0";

// Start API on HTTP port
var server = http.createServer(function(request, response){
    if (request.method.toUpperCase() === "OPTIONS"){
        response.writeHead("204", "No Content", {
            "access-control-allow-origin": '*',
            "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
            "access-control-allow-headers": "content-type, accept",
            "access-control-max-age": 10, // Seconds.
            "content-length": 0
        });
        return(response.end());
    }

    handleServerRequest(request, response);
});

server.listen(config.api.port, bindIp, function(){
    log('info', logSystem, 'API started & listening on %s port %d', [bindIp, config.api.port]);
});

if(config.api.ssl && config.api.ssl.enabled){
    var bindIpSsl = config.api.ssl.bindIp || "0.0.0.0";
    var sslPort = config.api.ssl.port;
    if (!config.api.ssl.cert) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL certificate not configured', [bindIpSsl, sslPort]);
    } else if (!config.api.ssl.key) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL key not configured', [bindIpSsl, sslPort]);

    } else if (!config.api.ssl.ca) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL certificate authority not configured', [bindIpSsl, sslPort]);
        
    } else if (!fs.existsSync(config.api.ssl.cert)) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL certificate file not found (configuration error)', [bindIpSsl, sslPort]);
        
    } else if (!fs.existsSync(config.api.ssl.key)) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL key file not found (configuration error)', [bindIpSsl, sslPort]);
        
    } else if (!fs.existsSync(config.api.ssl.ca)) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL certificate authority file not found (configuration error)', [bindIpSsl, sslPort]);
    }else{

        var sslOptions = {
            key: fs.readFileSync(config.api.ssl.key),
            cert: fs.readFileSync(config.api.ssl.cert),
            ca: fs.readFileSync(config.api.ssl.ca),
            honorCipherOrder: true
        };
        
        var ssl_server = https.createServer(sslOptions, function(request, response){
            if (request.method.toUpperCase() === "OPTIONS"){
                response.writeHead("204", "No Content", {
                    "access-control-allow-origin": '*',
                    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "access-control-allow-headers": "content-type, accept",
                    "access-control-max-age": 10, // Seconds.
                    "content-length": 0,
                    "strict-transport-security": "max-age=604800"
                });
                return(response.end());
            }

            handleServerRequest(request, response);
        });
        
        ssl_server.listen(sslPort, bindIpSsl, function(){
            log('info', logSystem, 'API started & listening on %s port %d (SSL)', [bindIpSsl, sslPort]);
        });
    }
}
