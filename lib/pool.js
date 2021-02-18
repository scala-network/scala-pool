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
 

 const paymentSystem = require('./payments/payment_system.js');
 const fs = require('fs');
 const net = require('net');
 const tls = require('tls');
 const async = require('async');
 const bignum = require('bignum');

 const rpcDaemon = require('./rpc/daemon.js');
 const utils = require('./utils.js');

// Set nonce pattern - must exactly be 8 hex chars
const noncePattern = new RegExp("^[0-9A-Fa-f]{8}$");

// Set redis database cleanup interval

// Initialize log system
const logSystem = 'pool';
require('./exceptionWriter.js')(logSystem);

const threadId = '(Thread ' + process.env.forkId + ') ';
const log = function(severity, system, text, data){
    global.log(severity, system, threadId + text, data);
};

let cryptoNight = require('cryptonight-hashing')['randomx'];


// Set instance id
const instanceId = utils.instanceId();

// Pool variables
const connectedMiners = {};


/**
  * Event Management
  */
global.EventManager.register('pool:server:created',{
    workerType: 'pool',
    forkId: 0
}, (portData, next) => {

    log('info', logSystem, 'Started server listening on port %d', [portData.port]);
    next();
}).register('pool:block:found',{
    workerType: 'pool'
},(cm, block, next) => {
    process.send({type:'jobRefresh'});
}).register('pool:miners:connected',{
    workerType: 'pool'
}, (miner, next) => {

    log('info', logSystem, 'Miner connected %s@%s on port', [miner.login, miner.ip, miner.port]);
    connectedMiners[miner.id] = miner

    const dateNow = Date.now();
    const dateNowSeconds = dateNow / 1000 | 0;

    const cmds = [];
    const workerPortType = ['workers', miner.poolType].join('_');
    const porto = ['port', miner.port].join('_');
    cmds.push(['hincrby', global.config.coin + ':stats', 'workers', '+1']);
    cmds.push(['hincrby', global.config.coin + ':stats', workerPortType, '+1']);
    cmds.push(['hincrby', global.config.coin + ':stats', porto, '+1']);

    cmds.push(['hset',global.config.coin +  ':workers_ip:'+miner.login, miner.ip, Date.now()]);
    // cmds.push(['hget', global.config.coin + ':stats', ['workers',workerPortType ]]);

    // cmds.push(['sadd', global.coin + ':ip', ['port', miner.port].join('_'), '+1']);
    // redisClient.sadd(config.coin + ':workers_ip:' + miner.login, miner.ip);

    redisClient.multi(cmds).exec((e,r) => {
        if(e) {
            return;
        }

        // const re = [];
        // const rr = r[r.length-1];
        // re.push(['hset', global.config.coin + ':graph:connects:all', dateNowSeconds, rr[0]]);
        // re.push(['hset',global.config.coin + ':graph:connects:' + miner.poolType, dateNowSeconds, rr[1]]);
        // redisClient.multi(re).exec((ee,rr) => {});
        next()
    });

}).register('pool:miners:disconnected',{
    workerType: 'pool'
}, (miner,reason, next) => {

    const dateNow = Date.now();
    const dateNowSeconds = dateNow / 1000 | 0;

    delete connectedMiners[miner.id]

    const cmds = [];
    const workerPortType = ['workers', miner.poolType].join('_');
    const porto = ['port', miner.port].join('_');
    cmds.push(['hincrby', global.config.coin + ':stats', 'workers', '-1']);
    cmds.push(['hincrby', global.config.coin + ':stats', workerPortType, '-1']);
    cmds.push(['hincrby', global.config.coin + ':stats', porto, '-1']);
    cmds.push(['hdel',global.config.coin +  ':workers_ip:'+miner.login, miner.ip]);

    //cmds.push(['hmget', global.config.coin + ':stats', ['workers',workerPortType]]);
    redisClient.multi(cmds).exec((e,r) => {
        if(e) {
            return;
        }
        // const re = [];
        // const rr = r[r.length-1];
        // re.push(['hset', global.config.coin + ':graph:connects:all', dateNowSeconds, rr[0]]);
        // re.push(['hset', global.config.coin + ':graph:connects:' + miner.poolType, dateNowSeconds, rr[1]]);
        // redisClient.multi(re).exec((ee,rr) => {});
    });

    next()
})


// Pool settings
const cleanupInterval = config.redis.cleanupInterval && config.redis.cleanupInterval > 0 ? config.redis.cleanupInterval : 15;

const shareTrustEnabled = global.config.poolServer.shareTrust && global.config.poolServer.shareTrust.enabled;
const shareTrustStepFloat = shareTrustEnabled ? global.config.poolServer.shareTrust.stepDown / 100 : 0;
const shareTrustMinFloat = shareTrustEnabled ? global.config.poolServer.shareTrust.min / 100 : 0;

var banningEnabled = global.config.poolServer.banning && global.config.poolServer.banning.enabled;
var bannedIPs = {};
var perIPStats = {};

let previousOffset = global.config.previousOffset || 7
let offset = global.config.offset || 2

// Block templates
let validBlockTemplates = [];
let currentBlockTemplate;

// Difficulty buffer
var diff1 = bignum('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', 16);


/**
 * Convert buffer to byte array
 **/
 Buffer.prototype.toByteArray = function () {
    return Array.prototype.slice.call(this, 0);
};

/**
 * Periodical updaters
 **/
 
// Variable difficulty retarget
setInterval(function(){
    var now = Date.now() / 1000 | 0;
    for (var minerId in connectedMiners){
        var miner = connectedMiners[minerId];
        if(!miner.noRetarget) {
            miner.retarget(now);
        }
    }
}, global.config.poolServer.varDiff.retargetTime * 1000);

// Every 30 seconds clear out timed-out miners and old bans
setInterval(function(){
    var now = Date.now();
    var timeout = global.config.poolServer.minerTimeout * 1000;
    for (var minerId in connectedMiners){
        var miner = connectedMiners[minerId];
        if (now - miner.lastBeat > timeout){
            // log('warn', logSystem, 'Miner timed out and disconnected %s@%s', [miner.login, miner.ip]);
            EventManager.parallel('pool:miners:disconnected',(fn,next) => {
                fn(miner,'timeout', next)
            })
        }
    }    

    if (banningEnabled){
        for (let ip in bannedIPs){
            var banTime = bannedIPs[ip];
            if (now - banTime > global.config.poolServer.banning.time * 1000) {
                delete bannedIPs[ip];
                delete perIPStats[ip];
                log('info', logSystem, 'Ban dropped for %s', [ip]);
            }
        }
    }

}, 30000);

/**
 * Handle multi-thread messages
 **/ 
 let poolStarted = false

 const refreshBlockTemplate = (block) => {
    let buffer = Buffer.from(block.blocktemplate_blob, 'hex');
    let new_hash = Buffer.alloc(32);
    buffer.copy(new_hash, 0, previousOffset, 39);
    try {
        if (!currentBlockTemplate || currentBlockTemplate.compare(block)) {
            log('info', logSystem, 'New %s block to mine at height %d w/ difficulty of %d (%d transactions)', [
                global.config.coin, 
                block.height, 
                block.difficulty, (block.num_transactions || 0)
            ]);
            processBlockTemplate(block);
            
        } 
    } catch (e) {
        log('error', logSystem, `BlockTemplate ${e}`)
    }
 }

 process.on('message', function(message) {
    switch (message.type) {
        case 'banIP':
        bannedIPs[message.ip] = Date.now();
        break;
        case 'blockTemplate':
        log('info', logSystem, 'New Block Template recieved');
        if(!poolStarted) {
            startPoolServerTcp(() => {
                refreshBlockTemplate(message.block)
                poolStarted = true
            })
        } else {
            refreshBlockTemplate(message.block)
        }
        
        break;
    }
});

/**
 * Block template
 **/
 const BlockTemplate = function (template){
    this.blob = template.blocktemplate_blob;
    this.blocktemplate_blob = template.blockhashing_blob.substring(7,39);
    this.difficulty = template.difficulty;
    this.height = template.height;
    this.reserveOffset = template.reserveOffset || template.reserved_offset;
    this.seed_hash = template.seed_hash;
    this.next_seed_hash = template.next_seed_hash;
    this.buffer = Buffer.from(this.blob, 'hex');
    instanceId.copy(this.buffer, this.reserveOffset + 4, 0, 4);
    this.previous_hash = Buffer.alloc(32);
    this.buffer.copy(this.previous_hash, 0, previousOffset, 39);
    this.extraNonce = 0;
    this.prev_hash = template.prev_hash;

    // The clientNonceLocation is the location at which the client pools should set the nonces for each of their clients.
    this.clientNonceLocation = this.reserveOffset + 12;
    // The clientPoolLocation is for multi-thread/multi-server pools to handle the nonce for each of their tiers.
    this.clientPoolLocation = this.reserveOffset + 8;
    this.compare = function(result){
        return (this.height != result.height || result.toString('hex') !== this.prev_hash.toString('hex') || (this.num_transactions === 0 && result.num_transactions > 0))
    };
    this.nextBlob = function(){
        this.buffer.writeUInt32BE(++this.extraNonce, this.reserveOffset);
        return utils.cnUtil.convert_blob(this.buffer, 0).toString('hex');
    };
    this.nextBlobWithChildNonce = function(){
        // Write a 32 bit integer, big-endian style to the 0 byte of the reserve offset.
        this.buffer.writeUInt32BE(++this.extraNonce, this.reserveOffset);
        // Don't convert the blob to something hashable.  You bad.
        return this.buffer.toString('hex');
    };
};

/**
 * Process block template
 **/
 function processBlockTemplate(template){
    if (currentBlockTemplate) {
        validBlockTemplates.push(currentBlockTemplate);
    }

    if (validBlockTemplates.length > 3) {
        validBlockTemplates.shift();
    }

    currentBlockTemplate = new BlockTemplate(template);
    const miners = Object.keys(connectedMiners);
    if(miners.length <= 0) {
        return
    }

    const start = process.hrtime.bigint();

    async.each(miners,function(minerID,done) {
        const miner = connectedMiners[minerID]
        miner.cachedJob = null
        miner.pushMessage('job', miner.getJob())
        done()
    }, () => {
        const end = process.hrtime.bigint();
        log('info', logSystem, 'Distributed work to %s miners time taken %s', [miners.length, utils.readableSI(Number(end - start)," ", "nsecs", true)]);
    });
    
}

/**
 * Variable difficulty
 **/
 const VarDiff = (function(){
    var variance = global.config.poolServer.varDiff.variancePercent / 100 * global.config.poolServer.varDiff.targetTime;
    return {
        variance: variance,
        bufferSize: global.config.poolServer.varDiff.retargetTime / global.config.poolServer.varDiff.targetTime * 4,
        tMin: global.config.poolServer.varDiff.targetTime - variance,
        tMax: global.config.poolServer.varDiff.targetTime + variance,
        maxJump: global.config.poolServer.varDiff.maxJump
    };
})();

/**
 * Miner
 **/
 const Miner = function (login, pass, ip, portData, agent, workerName, startingDiff, noRetarget, pushMessage){
    this.id = utils.uid();
    this.login = login;
    this.pass = pass;
    this.ip = ip;
    this.port = portData.port;
    this.poolType = portData.poolType || 'props';
    this.proxy = (agent && agent.includes('xmr-node-proxy'));
    this.agent = agent;
    this.workerName = workerName;
    this.pushMessage = pushMessage;
    this.heartbeat();
    this.noRetarget = noRetarget;
    this.difficulty = startingDiff;
    this.validJobs = [];
    this.workerAlias = login + '~' + workerName

    // Vardiff related variables
    this.shareTimeRing = utils.ringBuffer(16);
    this.lastShareTime = Date.now() / 1000 | 0;

    if (shareTrustEnabled) {
        this.trust = {
            threshold: global.config.poolServer.shareTrust.threshold,
            probability: 1,
            penalty: 0
        };
    }
    this.donation = 0.0;
    this.wallet = login
    this.paymentId = null
}

Miner.prototype = {

	retarget: function(now){

        var options = global.config.poolServer.varDiff;

        var sinceLast = now - this.lastShareTime;
        var decreaser = sinceLast > VarDiff.tMax;

        var avg = this.shareTimeRing.avg(decreaser ? sinceLast : null);
        var newDiff;

        var direction;

        if (avg > VarDiff.tMax && this.difficulty > options.minDiff){
            newDiff = options.targetTime / avg * this.difficulty;
            newDiff = newDiff > options.minDiff ? newDiff : options.minDiff;
            direction = -1;
        } else if (avg < VarDiff.tMin && this.difficulty < options.maxDiff){
            newDiff = options.targetTime / avg * this.difficulty;
            newDiff = newDiff < options.maxDiff ? newDiff : options.maxDiff;
            direction = 1;
        } else{
            return;
        }

        if (Math.abs(newDiff - this.difficulty) / this.difficulty * 100 > options.maxJump){
            var change = options.maxJump / 100 * this.difficulty * direction;
            newDiff = this.difficulty + change;
        }

        this.setNewDiff(newDiff);
        this.shareTimeRing.clear();
        if (decreaser){
        	this.lastShareTime = now;	
        } 
    },
    setNewDiff: function(newDiff){
        newDiff = Math.round(newDiff);
        if (this.difficulty === newDiff) {
        	return;
        }
        // log('info', logSystem, 'Retargetting difficulty %d to %d for %s', [this.difficulty, newDiff, this.login]);
        this.pendingDifficulty = newDiff;
        this.pushMessage('job', this.getJob());
    },
    heartbeat: function(){
        this.lastBeat = Date.now();
    },
    getTargetHex: function(){
        if (this.pendingDifficulty){
            this.lastDifficulty = this.difficulty;
            this.difficulty = this.pendingDifficulty;
            this.pendingDifficulty = null;
        }

        let padded = Buffer.alloc(32);
        padded.fill(0);

        var diffBuff = diff1.div(this.difficulty).toBuffer();
        diffBuff.copy(padded, 32 - diffBuff.length);

        var buff = padded.slice(0, 4);
        var buffArray = buff.toByteArray().reverse();
        let buffReversed = Buffer.from(buffArray);
        this.target = buffReversed.readUInt32BE(0);
        var hex = buffReversed.toString('hex');
        return hex;
    },
    getJob:function(){

        if (this.lastBlockHeight === currentBlockTemplate.height && !this.pendingDifficulty && this.cachedJob !== null) {
            return this.cachedJob;
        }

        let newJob = {
            id: utils.uid(),
            height: currentBlockTemplate.height,
            submissions: []
        };

        let blob = this.proxy ? currentBlockTemplate.nextBlobWithChildNonce() : currentBlockTemplate.nextBlob();
        this.lastBlockHeight = currentBlockTemplate.height;
        let target = this.getTargetHex();

        newJob.difficulty = this.difficulty
        newJob.diffHex = this.diffHex
        newJob.extraNonce = currentBlockTemplate.extraNonce
        newJob.seed_hash = currentBlockTemplate.seed_hash
        newJob.next_seed_hash = currentBlockTemplate.next_seed_hash

        this.validJobs.push(newJob);

        while (this.validJobs.length > 4)
            this.validJobs.shift();

        this.cachedJob = {
            job_id: newJob.id,
            id: this.id
        };

        if (this.proxy) {
            newJob.clientPoolLocation = currentBlockTemplate.clientPoolLocation
            newJob.clientNonceLocation = currentBlockTemplate.clientNonceLocation

            this.cachedJob.blocktemplate_blob = blob
            this.cachedJob.difficulty = currentBlockTemplate.difficulty
            this.cachedJob.height = currentBlockTemplate.height
            this.cachedJob.childHeight = this.lastChildBlockHeight
            this.cachedJob.reserved_offset = currentBlockTemplate.reserveOffset
            this.cachedJob.client_nonce_offset = currentBlockTemplate.clientNonceLocation
            this.cachedJob.client_pool_offset = currentBlockTemplate.clientPoolLocation
            this.cachedJob.target_diff = this.difficulty
            this.cachedJob.target_diff_hex = this.diffHex

        } else {
            this.cachedJob.blob = blob
            this.cachedJob.target = target
        }

        this.cachedJob.algo = "panthera"
        this.cachedJob.height = currentBlockTemplate.height
        if (newJob.seed_hash) {
            this.cachedJob.seed_hash = newJob.seed_hash;
            this.cachedJob.next_seed_hash = newJob.next_seed_hash;
        }
        return this.cachedJob;
    },
    checkBan : function(validShare){
        if (!banningEnabled) return;

        // Init global per-ip shares stats

        if (!perIPStats[this.ip]){
            perIPStats[this.ip] = { validShares: 0, invalidShares: 0 };
        }

        var stats = perIPStats[this.ip];
        validShare ? stats.validShares++ : stats.invalidShares++;

        if (stats.validShares + stats.invalidShares >= global.config.poolServer.banning.checkThreshold){
            if (stats.invalidShares / stats.validShares >= global.config.poolServer.banning.invalidPercent / 100){
                validShare ? this.validShares++ : this.invalidShares++;
                log('warn', logSystem, 'Banned %s@%s', [this.login, this.ip]);
                bannedIPs[this.ip] = Date.now();
                process.send({type: 'banIP', ip: this.ip});
		const miner = this;
                EventManager.parallel('pool:miners:disconnected',(fn,next) => {
                    fn(miner,'banned', next)
                })
            }
            else{
                stats.invalidShares = 0;
                stats.validShares = 0;
            }
        }
    }
};

/**
 * Handle miner method
 **/
function handleMinerMethod(method, params, ip, portData, sendReply, pushMessage)
{
 // function handleMinerMethod(req, res){
    let miner = connectedMiners[params.id] || false;
    
    // Check for ban here, so preconnected attackers can't continue to screw you
    if (IsBannedIp(ip)){
        sendReply('Your IP is banned',miner);
        return;
    }
    switch(method){
        case 'login':
        let login = params.login;
        if (!login){
            sendReply('Missing login',miner);
            return;
        }

        var pass = params.pass;
        var workerName = '';
        if (params.rigid) {
            workerName = params.rigid.trim();
        }else if (pass) {
            workerName = pass.trim();
            if (pass.indexOf(':') >= 0 && pass.indexOf('@') >= 0) {
                passDelimiterPos = pass.lastIndexOf(':');
                workerName = pass.substr(0, passDelimiterPos).trim();
            }
            workerName = workerName.replace(/:/g, '');
            workerName = workerName.replace(/\+/g, '');
            workerName = workerName.replace(/\s/g, '');
            if (workerName.toLowerCase() === 'x') {
                workerName = '';
            }
        }
        if (!workerName || workerName === '') {
            workerName = 'undefined';
        }
        workerName = utils.cleanupSpecialChars(workerName);

        let donations = 0;
        if (global.config.poolServer.donations && global.config.poolServer.donations.enabled) {
            
            var escaped_delimiter = ((config.poolServer.donations.addressSeparator || '%') + '').replace(
                /([.\\+*?\[\]^$()])/g, '\\$1');
            login = login.replace(new RegExp(escaped_delimiter + "(\\d+(?:\\.\\d+)?|\\.\\d+)" + escaped_delimiter),
                function(match, p1) {
                    donations = parseFloat(p1);
                    return '';
                });

            if(!donations && portData.donation) {
                donations = portData.donation
            }
        }

        
        let difficulty = portData.difficulty;
        const poolType = portData.poolType
        let noRetarget = false;
        if(global.config.poolServer.fixedDiff.enabled) {
            let fixedDiffCharPos = login.lastIndexOf(config.poolServer.fixedDiff.addressSeparator);

            if (fixedDiffCharPos !== -1 && (login.length - fixedDiffCharPos < 32)){
                diffValue = login.substr(fixedDiffCharPos + 1);
                difficulty = parseInt(diffValue);
                login = login.substr(0, fixedDiffCharPos);
                if (!difficulty || difficulty != diffValue) {
                    log('warn', logSystem, 'Invalid difficulty value "%s" for login: %s', [diffValue, login]);
                    difficulty = portData.difficulty;
                } else {
                    noRetarget = true;
                    if (difficulty < global.config.poolServer.varDiff.minDiff) {
                        difficulty = global.config.poolServer.varDiff.minDiff;
                    }
                }
            }
        }

        const addr = login.split(global.config.poolServer.paymentId.addressSeparator);
        let address = addr[0] || null;

        if (!address) {
            log('warn', logSystem, 'No address specified for login');
            return sendReply('Invalid address used for login');
        }

        login = address.replace(/\s/g, '');
        const addressType = utils.validateMinerAddress(login)
        if (!addressType) {
            var addressPrefix = utils.getAddressPrefix(login);
            if (!addressPrefix) {
               addressPrefix = 'N/A';
           }

           log('warn', logSystem, 'Invalid address used for login (prefix: %s): %s', [addressPrefix, login]);
           sendReply('Invalid address used for login');
           return;
        }


        miner = new Miner(login, pass, ip, portData, params.agent, workerName, difficulty, noRetarget, pushMessage);
        miner.donation = donations;

        connectedMiners[miner.id] = miner;

       sendReply(null, {
            id: miner.id,
            job: miner.getJob(),
            algo:"panthera",
            status: 'OK'
        });

       EventManager.parallel('pool:miners:connected',(fn,next) => {
        	fn(miner, next)
    	})
	
       break;
       case 'getjob':
       if (!miner){
        sendReply('Unauthenticated');
        return;
    }
    miner.heartbeat();
    sendReply(null, miner.getJob());
    break;
    case 'submit':
    if (!miner){
        sendReply('Unauthenticated');
        return;
    }
    miner.heartbeat();

    var job = miner.validJobs.filter(function(job){
        return job.id === params.job_id;
    })[0];

    if (!job){
        sendReply('Invalid job id',miner);
        return;
    }

    if (!params.nonce || !params.result) {
        sendReply('Attack detected',miner);
        log('warn', logSystem, 'Malformed miner share: %s from (%s@%s)', [JSON.stringify(params), miner?miner.login:'', ip])
        return;
    }

    if (!noncePattern.test(params.nonce)) {
        var minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
        log('warn', logSystem, 'Malformed miner nonce: %s from (%s@%s)', [JSON.stringify(params), miner?miner.login:'', ip])
        perIPStats[ip] = { validShares: 0, invalidShares: 999999 };
        miner.checkBan(false);
        sendReply('Duplicate share',miner);
        return;
    }

        // Force lowercase for further comparison
        params.nonce = params.nonce.toLowerCase();

        if (!miner.proxy) {
            if (job.submissions.indexOf(params.nonce) !== -1){
                var minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                log('warn', logSystem, 'Duplicate share: ' + JSON.stringify(params) + ' from ' + minerText);
                perIPStats[miner.ip] = { validShares: 0, invalidShares: 999999 };
                miner.checkBan(false);
                sendReply('Duplicate share',miner);
                return;
            }

            job.submissions.push(params.nonce);
        } else {
            if (!Number.isInteger(params.poolNonce) || !Number.isInteger(params.workerNonce)) {
                var minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                log('warn', logSystem, 'Malformed nonce: ' + JSON.stringify(params) + ' from ' + minerText);
                perIPStats[miner.ip] = { validShares: 0, invalidShares: 999999 };
                miner.checkBan(false);
                sendReply('Duplicate share',miner);
                return;
            }
            let nonce_test = `${params.nonce}_${params.poolNonce}_${params.workerNonce}`;
            if (job.submissions.indexOf(nonce_test) !== -1) {
                var minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                log('warn', logSystem, 'Duplicate share: ' + JSON.stringify(params) + ' from ' + minerText);
                perIPStats[miner.ip] = { validShares: 0, invalidShares: 999999 };
                miner.checkBan(false);
                sendReply('Duplicate share',miner);
                return;
            }
            job.submissions.push(nonce_test);

        }

        var blockTemplate = currentBlockTemplate.height === job.height ? currentBlockTemplate : validBlockTemplates.filter(function(t){
            return t.height === job.height;
        })[0];

        if (!blockTemplate){
            sendReply('Block expired',miner);
            return;
        }

        let shareAccepted = processShare(miner, job, blockTemplate, params);
        miner.checkBan(shareAccepted);
        
        if (shareTrustEnabled){
            if (shareAccepted){
                miner.trust.probability -= shareTrustStepFloat;
                if (miner.trust.probability < shareTrustMinFloat)
                    miner.trust.probability = shareTrustMinFloat;
                miner.trust.penalty--;
                miner.trust.threshold--;
            }
            else{
                log('warn', logSystem, 'Share trust broken by %s@%s', [miner.login, ip]);
                miner.trust.probability = 1;
                miner.trust.penalty = global.config.poolServer.shareTrust.penalty;
            }
        }
        
        if (!shareAccepted){
            sendReply('Rejected share: invalid result',miner);
            return;
        }

        const now = Date.now() / 1000 | 0;
        miner.shareTimeRing.append(now - miner.lastShareTime);
        miner.lastShareTime = now;
        //miner.retarget(now);

        sendReply(null, {status: 'OK'});
        break;
        case 'keepalived' :
        if (!miner){
            sendReply('Unauthenticated');
            return;
        }
        miner.heartbeat();
        sendReply(null, { status:'KEEPALIVED' });
        break;
        default:
        sendReply('Invalid method', miner);
        log('warn', logSystem, 'Invalid method: %s (%j) from (%s@%s)', [method, params, miner?miner.login:'', ip]);
        break;
    }
}

/**
 * Return if IP has been banned
 **/
 function IsBannedIp(ip){
    if (!banningEnabled || !bannedIPs[ip]) return false;

    var bannedTime = bannedIPs[ip];
    var bannedTimeAgo = Date.now() - bannedTime;
    var timeLeft = global.config.poolServer.banning.time * 1000 - bannedTimeAgo;
    if (timeLeft > 0){
        return true;
    } else {
        delete bannedIPs[ip];
        log('info', logSystem, 'Ban dropped for %s', [ip]);
        return false;
    }
}

/**
 * Record miner share data
 **/
 function recordShareData(miner, job, shareDiff, blockCandidate, hashHex, shareType, blockTemplate){
    var dateNow = Date.now();
    var dateNowSeconds = dateNow / 1000 | 0;

    let updateScore;
    // Weighting older shares lower than newer ones to prevent pool hopping
    const diff = job.difficulty;
    const donations = diff * (miner.donations || 0);
    const shares =  diff - donations;
    const poolType = miner.poolType || 'props'
    const login = miner.login
    const coin = global.config.coin
    const workerAlias = miner.workerAlias

   let redisCommands =  []

   redisCommands = paymentSystem(poolType).recordShare(redisCommands, miner, job, shareDiff, hashHex, shareType, blockTemplate);
        
    redisCommands.push(['hincrby', coin + ':stats', 'totalShares', diff]);
    redisCommands.push(['hincrby', coin + ':stats', 'totalShares_'+poolType, diff]);
    redisCommands.push(['hincrby', coin + ':stats', 'roundShares', diff]);
    redisCommands.push(['hincrby', coin + ':stats', 'roundShares'+poolType, diff]);

    redisCommands.push(['zadd', coin + ':hashrate', dateNowSeconds, [diff, login, dateNow].join(':')])
    redisCommands.push(['hincrby', coin + ':workers:' + login, 'donations',donations])
    redisCommands.push(['hincrby', coin + ':workers:' + login, 'hashes', shares])
    redisCommands.push(['hset', coin + ':workers:' + login, 'lastShare', dateNowSeconds])

    if (workerAlias) {
        redisCommands.push(['zadd', coin + ':hashrate', dateNowSeconds, [diff, workerAlias, dateNow].join(':')]);
        redisCommands.push(['hincrby', coin + ':unique_workers:' + workerAlias, 'hashes', job.difficulty]);
        redisCommands.push(['hset', coin + ':unique_workers:' + workerAlias, 'lastShare', dateNowSeconds]);
        redisCommands.push(['hset', coin + ':unique_workers:' + workerAlias, 'poolType', poolType]);
        redisCommands.push(['hincrby', coin + ':unique_workers:' + workerAlias, 'donations', donations]);
        redisCommands.push(['expire', coin + ':unique_workers:' + workerAlias, (86400 * cleanupInterval)]);
    }
    
    if (blockCandidate){
        redisCommands.push(['hincrby', coin + ':stats', 'totalDiff', blockTemplate.difficulty]);
        redisCommands.push(['hincrby', coin + ':stats', 'totalDiff_'+poolType, blockTemplate.difficulty]);
        redisCommands.push(['hset', coin + ':stats', 'roundShares', 0]);
        redisCommands.push(['hset', coin + ':stats', 'roundShares'+poolType, 0]);
        redisCommands.push(['hset', coin + ':stats', 'lastBlockFound', Date.now()]);
        redisCommands.push(['hset', coin + ':stats', 'lastBlockFound_'+poolType, Date.now()]);
        redisCommands.push(['hincrby', coin + ':stats', 'blocksFound',1]);
        redisCommands.push(['hincrby', coin + ':stats', 'blocksFound_'+poolType,1]);
        redisCommands.push(['hincrby', coin + ':workers:' + login, 'blocksFound', 1]);
        redisCommands.push(['hincrby', coin + ':unique_workers:' + workerAlias, 'blocksFound', 1]);
    
        redisCommands = paymentSystem(poolType).blockCandidate(redisCommands, miner, job, shareDiff, hashHex, shareType, blockTemplate);

    }

    redisClient.multi(redisCommands).exec(function(err, replies){
        if (err){
            log('error', logSystem, 'Failed to insert share data into redis %j \n %j', [err, redisCommands]);
            return;
        }

        const redCmd = paymentSystem(poolType).afterSubmit(replies, miner, job, shareDiff, blockCandidate, hashHex, shareType, blockTemplate) || [];

        if(redCmd.length > 0) {
    	   redisClient.multi(redCmd).exec((ee,rr) => {});
        }

    });

    if(blockCandidate) {
        EventManager.parallel('pool:block:found',(fn, next) => {
            fn(connectedMiners,{
                height:job.height,
                poolType: miner.poolType
            }, next)
        })
    }

    // log('info', logSystem, 'Accepted %s share %d at difficulty %d from %s@%s', [shareType, job.difficulty, shareDiff, miner.login, miner.ip]);
 }


function getShareBuffer (miner, job, blockTemplate, params) {
    let nonce = params.nonce;
    let resultHash = params.result;
    let template = Buffer.alloc(blockTemplate.buffer.length);
    if (!miner.proxy) {
        blockTemplate.buffer.copy(template);
        template.writeUInt32BE(job.extraNonce, blockTemplate.reserveOffset);
    } else {
        blockTemplate.buffer.copy(template);
        template.writeUInt32BE(job.extraNonce, blockTemplate.reserveOffset);
        template.writeUInt32BE(params.poolNonce, job.clientPoolLocation);
        template.writeUInt32BE(params.workerNonce, job.clientNonceLocation);
    }

    try {
        let shareBuffer = utils.cnUtil.construct_block_blob(template, Buffer.from(nonce, 'hex'), 0);
        return shareBuffer;
    } catch (e) {
        log('error', logSystem, "Can't get share buffer with nonce %s from %s@%s: %s", [nonce, miner.login, miner.ip, e]);
        return null;
    }
}

/**
 * Process miner share data
 **/
 function processShare(miner, job, blockTemplate, params){
    let shareBuffer = getShareBuffer(miner, job, blockTemplate, params)
    if (!shareBuffer) {
        return false
    }
    let resultHash = params.result
    let hash;
    let shareType;


    if (shareTrustEnabled && miner.trust.threshold <= 0 && miner.trust.penalty <= 0 && Math.random() > miner.trust.probability){
        hash = Buffer.from(resultHash, 'hex');
        shareType = 'trusted';
    } else {
        let convertedBlob = utils.cnUtil.convert_blob(shareBuffer, 0);
        let hard_fork_version = convertedBlob[0];

        hash = cryptoNight(convertedBlob, Buffer.from(blockTemplate.seed_hash, 'hex'));
        
        shareType = 'valid'
    }

    if (hash.toString('hex') !== resultHash) {
        log('warn', logSystem, 'Bad hash from miner %s@%s', [miner.login, miner.ip]);
        return false;
    }

    var hashArray = hash.toByteArray().reverse();
    let hashNum = bignum.fromBuffer(Buffer.from(hashArray));
    var hashDiff = diff1.div(hashNum);

    if (hashDiff.ge(blockTemplate.difficulty)){

        rpcDaemon.submitBlock(shareBuffer.toString('hex'), function(error, result){
            if (error){
                log('error', logSystem, 'Error submitting block at height %d from %s@%s, share type: "%s" - %j', [job.height, miner.login, miner.ip, shareType, error]);
            }else{
                var blockFastHash = utils.cnUtil.get_block_id(shareBuffer, 0).toString('hex');
                log('info', logSystem,
                    'Block %s found at height %d by miner %s@%s - submit result: %j',
                    [blockFastHash.substr(0, 6), job.height, miner.login, miner.ip, result]
                    );
                recordShareData(miner, job, hashDiff.toString(), true, blockFastHash, shareType, blockTemplate);

            }
        });
    } else if (hashDiff.lt(job.difficulty)){
        log('warn', logSystem, 'Rejected low difficulty share of %s from %s@%s', [hashDiff.toString(), miner.login, miner.ip]);
        return false;
    } else{
        recordShareData(miner, job, hashDiff.toString(), false, null, shareType);
    }

    return true;
}

/**
 * Start pool server on TCP ports
 **/
 var httpResponse = ' 200 OK\nContent-Type: text/plain\nContent-Length: 20\n\nMining server online';

 function startPoolServerTcp(callback){
    EventManager.parallel('pool:beforeStart', (fn, next) => {
        fn()
    }, e => {
        poolStart(callback);
    })        
}

function poolStart(callback){
    
    async.each(config.poolServer.ports, function(portData, cback){
        let handleMessage = function(socket, jsonData, pushMessage){
            if (!jsonData.id) {
                log('warn', logSystem, 'Miner RPC request missing RPC id');
                return;
            } else if (!jsonData.method) {
                log('warn', logSystem, 'Miner RPC request missing RPC method');
                return;
            } else if (!jsonData.params) {
                log('warn', logSystem, 'Miner RPC request missing RPC params');
                return;
            }

            const sendReply = function(error, result){
	        if(!socket.writable) return;

                const sendData = JSON.stringify({
                    id: jsonData.id,
                    jsonrpc: "2.0",
                    error: error ? {code: -1, message: error} : null,
                    result: result
                }) + "\n";

                socket.write(sendData);
                // if(error && result){
                // 	redisClient.hincrby(config.coin + ':unique_workers:' + result.login + "~" + result.workname, 'error', 1);
                // }
            }

            handleMinerMethod(jsonData.method, jsonData.params, socket.remoteAddress, portData, sendReply, pushMessage);
        };

        const socketResponder = function(socket){
            socket.setKeepAlive(true);
            socket.setEncoding('utf8');

            let dataBuffer = '';

            let pushMessage = function(method, params){
                if(!socket.writable) return;
                var sendData = JSON.stringify({
                    jsonrpc: "2.0",
                    method: method,
                    params: params
                }) + "\n";
                socket.write(sendData);
            };

            socket.on('data', function(d){
                dataBuffer += d;
                if (Buffer.byteLength(dataBuffer, 'utf8') > 10240){ //10KB
                    dataBuffer = null;
                    log('warn', logSystem, 'Socket flooding detected and prevented from %s', [socket.remoteAddress]);
                    socket.destroy();
                    return;
                }
                if (dataBuffer.indexOf('\n') !== -1){
                    var messages = dataBuffer.split('\n');
                    var incomplete = dataBuffer.slice(-1) === '\n' ? '' : messages.pop();
                    for (var i = 0; i < messages.length; i++){
                        var message = messages[i];
                        if (message.trim() === '') continue;
                        let jsonData;
                        try{
                            jsonData = JSON.parse(message);
                        }
                        catch(e){
                            if (message.indexOf('GET /') === 0) {
                                if (message.indexOf('HTTP/1.1') !== -1) {
                                    socket.end('HTTP/1.1' + httpResponse);
                                    break;
                                }
                                else if (message.indexOf('HTTP/1.0') !== -1) {
                                    socket.end('HTTP/1.0' + httpResponse);
                                    break;
                                }
                            }

                            log('warn', logSystem, 'Malformed message from %s: %s', [socket.remoteAddress, message]);
                            socket.destroy();
                            break;
                        }
                        
			try {
                            handleMessage(socket, jsonData, pushMessage);
                        } catch (e) {
                            log('warn', logSystem, 'Malformed handle message from ' + socket.remoteAddress + ' generated an exception. Message: ' + message);
                            if (e.message) {
                              log('warn', logSystem, 'Exception: ' + e.message);
                          }
                      }
                  }
                  dataBuffer = incomplete;
              }
          }).on('error', function(err){
            if (err.code !== 'ECONNRESET')
                log('warn', logSystem, 'Socket error from %s %j', [socket.remoteAddress, err]);
        }).on('close', function(){
            pushMessage = function(){};
        });
    };

    if (portData.ssl) {
        if (!config.poolServer.sslCert) {
            log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL certificate not configured', [portData.port]);
            cback(true);
        } else if (!config.poolServer.sslKey) {
            log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL key not configured', [portData.port]);
            cback(true);
        } else if (!config.poolServer.sslCA) {
            log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL certificate authority not configured', [portData.port]);
            cback(true);
        } else if (!fs.existsSync(config.poolServer.sslCert)) {
            log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL certificate file not found (configuration error)', [portData.port]);
            cback(true);
        } else if (!fs.existsSync(config.poolServer.sslKey)) {
            log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL key file not found (configuration error)', [portData.port]);
            cback(true);
        } else if (!fs.existsSync(config.poolServer.sslCA)) {
            log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL certificate authority file not found (configuration error)', [portData.port]);
            cback(true);
        } else {
            const options = {
                key: fs.readFileSync(config.poolServer.sslKey),
                cert: fs.readFileSync(config.poolServer.sslCert),
                ca: fs.readFileSync(config.poolServer.sslCA)
            };

            tls.createServer(options, socketResponder).listen(portData.port, function (error, result) {
                if (error) {
                    log('error', logSystem, 'Could not start server listening on port %d (SSL), error: $j', [portData.port, error]);
                    cback(true);
                    return;
                }

                EventManager.parallel('pool:server:created', (fn, cb) => {
                    fn(portData, cb)
                }, cback)
            });
        }
    } 
    else {
        net.createServer(socketResponder).listen(portData.port, function (error, result) {
            if (error) {
                log('error', logSystem, 'Could not start server listening on port %d, error: $j', [portData.port, error]);
                cback(true);
                return;
            }
            EventManager.parallel('pool:server:created', (fn, cb) => {
                fn(portData, cb)
            }, cback)
        });
    }
}, callback);
}


let initCT;
const init = () => {
    
    if(poolStarted) {
       return 
    }

    if(initCT) {
        clearTimeout(initCT)
        initCT = null
    }

    redisClient.hget(global.config.coin + ":stats", 'blockTemplate', (e,r) => {

        if(e || !r) {
            log('warn', logSystem, 'Block template not avaliable %j', [e]);
            initCT = setTimeout(init,1000)
            return;
        }

        let block;
        try{
            block = JSON.parse(r)
        } catch(e) {
            initCT = setTimeout(init,1000)
            log('error', logSystem, 'Could parse block template %j', [e]);
            return;   
        }

        startPoolServerTcp(() => {
            poolStarted = true
            refreshBlockTemplate(block)
        })
    })
}
initCT = setTimeout(init,1000)

