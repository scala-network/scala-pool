/* Stellite Nodejs Pool
 * Copyright StelliteCoin	<https://github.com/stellitecoin/cryptonote-stellite-pool>
 * Copyright Ahmyi			<https://github.com/ahmyi/cryptonote-stellite-pool>
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
 *
 */
 
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

/**
 * Get block template
 **/
exports.getBlockTemplate = function(params,callback){
	apiInterfaces.rpcDaemon('getblocktemplate',params,callback)
}

/**
 * On block submit
 **/
exports.submitBlock = function(params,callback){
	apiInterfaces.rpcDaemon('submitblock', params,callback);
}