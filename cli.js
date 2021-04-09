
'use strict'
 
const fs = require('fs')
const path = require('path')
const util = require('util')
const args = require("args-parser")(process.argv);

const configFile = args.config || 'config.json';
let config;
try {
	config = JSON.parse(fs.readFileSync(configFile));
} catch(e){
	config = {};
}

const Redis = require('./lib/datasource/redis');
const redis = new Redis(config.redis);
global.redisClient = redis.client;
async function init() {
	const checkVersion = new Promise((r,e) => redis.check(er => { if(er) e(er); r(null);}));
	await checkVersion;
	const Cli = require('./cli/cli');
	new Cli();
}
init();