

var apiInterfaces = require('../apiInterfaces.js');
/**
 * Get Network data
 **/
exports.getNetworkData=function(callback) {
    
    // Try get_info RPC method first if available (not all coins support it)
    
    apiInterfaces.rpcDaemon('get_info', {}, callback);
    
}

/**
 * Get Last Block data
 **/
exports.getLastBlockData=function(callback) {
    apiInterfaces.rpcDaemon('getlastblockheader', {},callback);
}

exports.getBlockHeaderByHeight  = function(params,callback){
    apiInterfaces.rpcDaemon('getblockheaderbyheight', params, callback);
};