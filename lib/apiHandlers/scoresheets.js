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
	    
	    if(!urlParts.query.address || !urlParts.query.height){
	    	return sendData({status:'error',message:"Missing parameters"});
	    }
	    
	    var id = urlParts.query.address;
	    
	    if(!utils.validateMinerAddress(id)){
	        return sendData({status:'error',message:"Invalid wallet address"});
	    }

	    if(urlParts.query.height && !utils.isInteger(height)){
	    	return sendData({status:'error',message:"Invalid height"});
	    }
	   
		var height = urlParts.query.height;
	    
	        redisClient.zrange(config.coin + ':block_scoresheets:'+id,height,height,function(err, results){
        	    sendData((err) ? {message: 'Query failed',status:'error'} : {data:results,status:'success'});
        	});
	},
	miner:function(urlParts, sendData){
		
	    if(!urlParts.query.address){
	    	return sendData({status:'error',message:"Missing parameters"});
	    }
		
	    var id = urlParts.query.address;
	    
	    if(!utils.validateMinerAddress(id)){
	        return sendData({status:'error',message:"Invalid wallet address"});
	    }
	    
	    const redisQuery = [];
		let page = 0;
	    if(urlParts.query.page){
	    	page = urlParts.query.page;
	    }
	    
		if(!utils.isInteger(page)){
	    	return sendData({status:'error',message:"Invalid page"});
	    }
	    
		if(urlParts.query.height && !utils.isInteger(height)){
	    	return sendData({status:'error',message:"Invalid height"});
	    }
	   
		var height = urlParts.query.height || '+inf';
	    
	    redisClient.zrevrangebyscore(
                config.coin + ':block_scoresheets:'+id,
                '(' + height,
                '-inf',
                'WITHSCORES',
                'LIMIT',
                page,
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
	    if(height.toLowerCase() === "current"){
	    	return sendData({data:currentRound,status:'success',height:"Current"});
	    }
	    
	    height = parseInt(height)+"";
	    if(!utils.isInteger(height)){
		return sendData({status:'error',message:"Invalid height"});
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
                
                let newWallet = wallet;

                let replied = replies[wallet];
                if(newWallet.toLowerCase() == 'info'){
                	let replys = replied.split(":");
                	replys[replys.length-1] = utils.truncateAddress(replys[replys.length -1]);
                	replied = replys.join(":");
                }else{
                   	newWallet = utils.truncateAddress(wallet);
	            	if(!utils.isInteger(replied)){
	       				replied = JSON.parse(replied);
	       			}
      	 		}

                o[newWallet] = replied;
            }

            if(o.hasOwnProperty("Info")){
            	avaliableHeights[height] = o;
            	setTimeout(function(){
            		delete avaliableHeights[height];
            	},3600000);
            }
            
			return sendData({status:'success',data:o,height:height});
        });
	},
	setCurrentRound:function(data){
		currentRound=data;
	}
}
