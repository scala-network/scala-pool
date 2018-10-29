const utils = require('../utils.js');


const logSystem = 'api/scoresheets';
require('../exceptionWriter.js')(logSystem);
let avaliableHeights = {};
let currentRound;

module.exports = {
	/**
 * Return blocks scoresheet for miner
 **/
	 minerByBlock:function(urlParts, sendData){
		    var id = urlParts.query.address;
		    
		    if(!utils.validateMinerAddress(id)){
		        return sendData({status:'error',message:"Invalid wallet address"});
		    }

		    var height = urlParts.query.height;
	        redisClient.zrange(config.coin + ':block_scoresheets:'+id,height,height,function(err, results){
	            sendData((err) ? {message: 'Query failed',status:'error'} : {data:results,status:'success'});
	        });
		},
	miner:function(urlParts, sendData){
	    var id = urlParts.query.address;
	    const redisQuery = [];
	    if(!utils.validateMinerAddress(id)){
	        return sendData({status:'error',message:"Invalid wallet address"});
	    }

	    if(!urlParts.query.hasOwnProperty('page')){
	    	page = 0;
	    }

	    redisClient.zrevrangebyscore(
                config.coin + ':block_scoresheets:'+id,
                '(' + urlParts.query.height,
                '-inf',
                'WITHSCORES',
                'LIMIT',
                parseInt(page),
                config.api.blocks,
            function(err, results){
                sendData((err) ? {message: 'Query failed',status:'error'} : {data: results,status:'success'} );
        });
	},
/**
 * Return blocks scoresheet for pool
 **/
	pool:function(urlParts, sendData){

	    var height = urlParts.query.height || "Current";
	    if(height !== "Current"){
	        height = parseInt(height)+"";
	    }
	    if(height.toLowerCase() == "current"){
	        height = "Current";
	    }
	    if(height === "Current"){
	    	return sendData({data:currentRound,status:'success',height:"Current"});
	    }
	    if(avaliableHeights.hasOwnProperty(height)){
	    	return sendData({cached:true,data:avaliableHeights[height],status:'success',height:height});
	    }

        redisClient.hgetall(config.coin + ':block_shares:'+height,function(error,replies){
        	if(error){
        		return sendData({
        			status:"error",
        			message:"Invalid height"
        		});
        	}

            let o = {};
            for(let wallet in replies){
                
                var replied = replies[wallet];
                if(wallet == 'Info'){
                	let replys = replied.split(":");
                	replys[replys.length-1] = utils.truncateAddress(replys[replys.length -1]);
                	replied = replys.join(":");
                }
                var newWallet = wallet;
                if(utils.validateMinerAddress(wallet)){
                    newWallet = utils.truncateAddress(wallet);
	            	if(parseInt(replied) != replied){
	                	replied = JSON.parse(replied);
	                }
            	}
                o[newWallet] = replied;
            }

            if(o.hasOwnProperty("Info")){
            	avaliableHeights[height] = o;	
            }
            
			return sendData({status:'success',data:o,height:height});
        });
	},
	setCurrentRound:function(data){
		currentRound=data;
	}
}