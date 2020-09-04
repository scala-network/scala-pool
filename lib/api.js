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
    shares:require('./apiHandlers/shares'),
    payments:require('./apiHandlers/payments'),
    market:require('./apiHandlers/market')
};
 /**
 * Return pool public ports
 **/
 function getPublicPorts(ports){
    return ports.filter(function(port) {
        return !port.hidden;
    });
 }

const getPoolConfigs = {
    supportedPayments : global.config.payments.supported,
    ports: getPublicPorts(config.poolServer.ports),
    hashrateWindow: config.api.hashrateWindow,
    fees : global.config.payments.poolFees,
    donations:global.config.poolServer.donations,
    devFee: global.config.blockUnlocker.devFee || 0,
    networkFee: global.config.blockUnlocker.networkFee || 0,
    coin: global.config.coin,
    coinUnits: global.config.coinUnits,
    coinDecimalPlaces: global.config.coinDecimalPlaces || 2, 
    coinDifficultyTarget: global.config.coinDifficultyTarget,
    symbol: global.config.symbol,
    depth: global.config.blockUnlocker.depth,
    version: global.config.version,
    paymentsInterval: global.config.payments.interval,
    minPaymentThreshold: global.config.payments.minPayment,
    minPaymentExchangedAddressThreshold: global.config.payments.minPaymentExchangeAddress || global.config.payments.minPaymentIntegratedAddress || config.payments.minPayment,
    minPaymentSubAddressThreshold: global.config.payments.minPaymentSubAddress || config.payments.minPayment,
    maxPaymentThreshold: global.config.payments.maxPayment || config.payments.maxTransactionAmount,
    transferFee: global.config.payments.dynamicTransferFee?0:config.payments.transferFee,
    dynamicTransferFee:global.config.payments.dynamicTransferFee,
    denominationUnit  :global.config.payments.denomination,
    priceSource:global. config.prices ? global.config.prices.source : 'tradeorge',
    priceCurrency: global.config.prices ? global.config.prices.currency : 'USD',
    paymentIdSeparator: global.config.poolServer.paymentId,
    fixedDiffEnabled: global.config.poolServer.fixedDiff.enabled,
    fixedDiffSeparator: global.config.poolServer.fixedDiff.addressSeparator,
    blocksChartEnabled: (global.config.charts.blocks && global.config.charts.blocks.enabled),
    blocksChartDays: global.config.charts.blocks && global.config.charts.blocks.days ? global.config.charts.blocks.days : null,
    unlockBlockReward: global.config.blockUnlocker.reward || 0
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
        // case '/miners_scoresheet':
        // handlers.scoresheets.miner(urlParts, function(data){
        //     sendData(response,data);
        // });
        // break;
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
    var processAddresses = {}

    for (var key in addressConnections){
        let addrOffset = key.indexOf(':')
        let address = key.substr(0, addrOffset)
        if (!processAddresses[address]) {
            processAddresses[address] = []
        }
        processAddresses[address].push(addressConnections[key]);
    }
    
    for (let address in processAddresses) {
        var data = currentStats;
        data.miner = {};
        if (address && minerStats[address]){
            data.miner = minerStats[address];
        }
        sendLiveStats(data,  processAddresses[address])
    }
}

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
    
    var longpoll = (urlParts.query.longpoll === 'true');
    
    data.miner = {};

    var address = urlParts.query.address;
    
    if(utils.validateMinerAddress(address) && address in minerStats) {
        data.miner = minerStats[address];
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
        sendData(response, data);
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
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
    return list;
}

/**
 * Handle multi-thread messages
 **/ 

 let lastApiUpdated = Date.now()
 process.on('message', function(msg) {
    switch(msg.type) {
        case 'apiStats':
            lastApiUpdated = Date.now()
            currentStats = msg.data.poolStats
            currentStats.config = getPoolConfigs
            minerStats = msg.data.minerStats
        break
    }
});


setInterval(() => {
    if(!currentStats) {
        log('warn',logSystem, "API data is empty")
    }
    let d = parseInt((Date.now() - currentStats.updated) / 1000);
    if(d > 20) {
        process.send({type:"apiStatsRefresh"})
        log('warn',logSystem, "API data updated last %s secs", [d])
    }
}, 10000)
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
