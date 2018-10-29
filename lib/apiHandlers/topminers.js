const utils = require('../utils.js');


const logSystem = 'api/topminers';
require('../exceptionWriter.js')(logSystem);
var async = require('async');


/**
 * Return top 10 miners
 **/
const topMinersCache = {
	donate:{},
	miner:{},
	unblocker:{},
	hashes:{}
};

let minerStats;

function _handleTops(sendData) {
    var limit = 25;
    async.waterfall([
        function(callback) {
            redisClient.keys(config.coin + ':workers:*', callback);
        },
        function(workerKeys, callback) {
            var redisCommands = workerKeys.map(function(k) {
                return ['hmget', k, 'lastShare', 'hashes', 'donation_level', 'donations', 'blocksFound'];
            });
			
            redisClient.multi(redisCommands).exec(function(error, redisData) {
                var minersData = [];
                for (var i in redisData) {
                    var keyParts = workerKeys[i].split(':');
                    var address = keyParts[keyParts.length-1];
                    var data = redisData[i];
                    minersData.push({
                        miner: utils.truncateAddress(address),
                        hashrate: minerStats[address] && minerStats[address]['hashrate'] ? minerStats[address] : 0,
                        lastShare: data[0],
                        hashes: data[1] || 0,
                        donationLevel: data[2] || 0,
                        donations: data[3] || 0,
                        blocksFound: data[4] || 0,
                    });
                }
                callback(null, minersData);
            });
        }
    ], function(error, data) {
        if(error) {
			if(sendData) sendData({status:'error',message: 'Error collecting top 10 miners stats'});
            return;
        }

		topMinersCache.miner = compareTopMiners(data,limit);
		topMinersCache.donate = compareTopDonators(data,limit);
		topMinersCache.unblocker = compareTopUnblockers(data,limit);
		topMinersCache.hashes = compareTopHashes(data,limit);
    	
    	if(sendData) sendData({data:topMinersCache,status:'success'});
    	
    	setTimeout(function(){
    		_handleTops();
    	},500);
    });
}

function compareTopHashes(data, limit) {
	limit = limit || 10;
	data.sort(function(a,b){
		var v1 = a.hashes ? parseInt(a.hashes) : 0;
	    var v2 = b.hashes ? parseInt(b.hashes) : 0;
	    if (v1 > v2) return -1;
	    if (v1 < v2) return 1;
	    return 0;	
	});

    return data.slice(0,limit);
}

function compareTopUnblockers(data, limit) {
	limit = limit || 10;
	data.sort(function(a,b){
		var v1 = a.blocksFound ? parseInt(a.blocksFound) : 0;
	    var v2 = b.blocksFound ? parseInt(b.blocksFound) : 0;
	    if (v1 > v2) return -1;
	    if (v1 < v2) return 1;
	    return 0;	
	});

    return data.slice(0,limit);
}

function compareTopMiners(data, limit) {
	limit = limit || 10;
	
	data.sort(function(a,b){
		var v1 = a.hashrate ? parseInt(a.hashrate) : 0;
	    var v2 = b.hashrate ? parseInt(b.hashrate) : 0;
	    if (v1 > v2) return -1;
	    if (v1 < v2) return 1;
	    return 0;	
	});
	
	var dataNoHashrate = [];
	var dataWithHashrate = [];
	
	for(var i in data){
		if(data[i].hashrate > 0){
			dataWithHashrate.push(data[i]);
		}else{
			dataNoHashrate.push(data[i]);
		}
	}
	
	if(dataWithHashrate.length >= limit){
		return data.slice(0,limit);
	}

    dataNoHashrate.sort(function(a,b){
		var v1 = a.lastShare ? parseInt(a.lastShare) : 0;
	    var v2 = b.lastShare ? parseInt(b.lastShare) : 0;
	    if (v1 > v2) return -1;
	    if (v1 < v2) return 1;
	    return 0;	
	});
	
	dataNoHashrate = dataNoHashrate.slice(0,limit-dataWithHashrate.length);
	for(var i in dataNoHashrate){
		dataWithHashrate.push(dataNoHashrate[i]);
	}
	return dataWithHashrate;
}

function compareTopDonators(data,limit) {
	limit = limit || 10;
	
	data.sort(function(a,b){
		var v1 = a.donations ? parseInt(a.donations) : 0;
	    var v2 = b.donations ? parseInt(b.donations) : 0;
	    if (v1 > v2) return -1;
	    if (v1 < v2) return 1;
	    return 0;	
	});
	
	var dataNoDonations = [];
	var dataWithDonations = [];
	
	for(var i in data){
		if(data[i].donations > 0){
			dataWithDonations.push(data[i]);
		}else{
			dataNoDonations.push(data[i]);
		}
	}
	
	if(dataWithDonations.length >= limit){
		return data.slice(0,limit);
	}
	
	dataNoDonations.sort(function(a,b){
		var v1 = a.donationLevel ? parseInt(a.donationLevel) : 0;
	    var v2 = b.donationLevel ? parseInt(b.donationLevel) : 0;
	    if (v1 > v2) return -1;
	    if (v1 < v2) return 1;
	    return 0;	
	});
	
	dataNoDonations = dataNoDonations.slice(0,limit-dataWithDonations.length);
	for(var i in dataNoDonations){
		dataWithDonations.push(dataNoDonations[i]);
	}
	return dataWithDonations;
    
}

function handleTop10(sendData){
	
	if(Object.keys(topMinersCache.miner).length === 0){
		return _handleTops(sendData);
	}
	
	sendData({data:topMinersCache,status:'success'});
	
}


module.exports = {
	getHandler:handleTop10,
	setMinersHashrate:function(val){
		minerStats = val;
	}

}