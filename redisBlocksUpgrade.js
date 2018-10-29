const args = require("args-parser")(process.argv);

global.config = require('./lib/bootstrap')(args.config || 'config.json');

require('./lib/logger.js');


global.redisClient = require('redis').createClient((function(){
    var options = { 
        host:global.config.redis.host || "127.0.0.1",
        socket_keepalive:true,
        port:global.config.redis.port || 6379, 
        retry_strategy: function (options) {
            if (options.error && options.error.code === 'ECONNREFUSED') {
                // End reconnecting on a specific error and flush all commands with
                // a individual error
                log('error', logSystem,'The server refused the connection');
                return;
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
                // End reconnecting after a specific timeout and flush all commands
                // with a individual error
                return new Error('Retry time exhausted');
            }
            if (options.attempt > 10) {
                // End reconnecting with built in error
                return undefined;
            }
            // reconnect after
            return Math.min(options.attempt * 100, 3000);
        },
        db: config.redis.db || 0,
    };
    
    if(config.redis.auth){
        options.auth_pass= config.redis.auth;
    }
    return options;
})());

global.redisClient.on('error', function (err) {
    log('error', logSystem, "Error on redis with code : %s",[err.code]);
});

const logSystem = 'upgrade';
require('./lib/exceptionWriter.js')(logSystem);


if(!args.hasOwnProperty('version')){
    log("error",logSystem,"Missing arguments -version");
    process.exit();
}

log("info",logSystem,"Running upgrade to "+args.version);
switch(args.version){
    case "1.4.5":
        return require('./upgrades/v1.4.5');
    break;
    case "0.99.1":
        return require('./upgrades/v0.99.1');
    break;
    default:
    break;
}
log("info",logSystem,"No upgrade for "+args.version);
process.exit();