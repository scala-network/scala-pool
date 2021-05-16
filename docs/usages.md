## Table of contents
  * [Requirements](#requirements)
  * [Downloading & Installing](#1-downloading--installing)
  * [Configuration](#2-configuration)
  * [Starting the Pool](#3-start-the-pool)
  * [Host the front-end](#4-host-the-front-end)
  * [Customizing your website](#5-customize-your-website)
  * [SSL](#ssl)
  * [Upgrading](#upgrading)
  * [JSON-RPC](#json-rpc)
  * [Monitoring](#monitoring)


Usage
===

#### Requirements
* Coin daemon(s) (find the coin's repo and build latest version from source)
* [Node.js](http://nodejs.org/) v14.0+
  * For Ubuntu: 
 ```
	sudo apt-get update
	sudo apt-get install build-essential libssl-dev
	curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.38.0/install.sh | bash
	source ~/.profile
	nvm install 14
	nvm alias default 14
	nvm use default
```
* [Redis](http://redis.io/) key-value store v2.6+ 
  * For Ubuntu: 
```
	sudo add-apt-repository ppa:chris-lea/redis-server
	sudo apt-get update
	sudo apt-get install redis-server
 ```
* libssl required for the hashing module
  * For Ubuntu: `sudo apt-get install libssl-dev`

* Boost is required for the cryptoforknote-util module
  * For Ubuntu: `sudo apt-get install libboost-all-dev`


[**Redis warning**](http://redis.io/topics/security): It'sa good idea to learn about and understand software that
you are using - a good place to start with redis is [data persistence](http://redis.io/topics/persistence).

**Do not run the pool as root** : create a new user without ssh access to avoid security issues :
```bash
sudo adduser --disabled-password --disabled-login your-user
```
To login with this user : 
```
	sudo su - your-user
```

#### 1) Downloading & Installing


Clone the repository and run `npm update` for all the dependencies to be installed:

```bash
	git clone https://github.com/scala-network/scala-pool.git pool
	cd pool
	npm install
```

#### 2) Configuration

Copy the `default/config.default.json` file of your choice to `config.json` then overview each options and change any to match your preferred setup. To see avaliable config go to [table](config.md). Configuration now can be setup via CLI. To see cli usages go to [cli docs](cli.md)


#### 3) Start the pool

```bash
	node init.js
```

The file `config.json` is used by default but a file can be specified using the `-config=file` command argument, for example:

```bash
	node init.js -config=config_backup.json
```

This software contains four distinct modules:
* `pool` - Which opens ports for miners to connect and processes shares
* `api` - Used by the website to display network, pool and miners' data
* `unlocker` - Processes block candidates and increases miners' balances when blocks are unlocked
* `payments` - Sends out payments to miners according to their balances stored in redis


By default, running the `init.js` script will start up all four modules. You can optionally have the script start
only start a specific module by using the `-module=name` command argument, for example:

```bash
	node init.js -module=api
```
alternatively you can run `npm run <module>`
```bash
  npm run api
```
or running multiple certain module

```bash
	node init.js -module=api,charts,payments
```

[Example screenshot](http://i.imgur.com/SEgrI3b.png) of running the pool in single module mode with tmux.


To keep your pool up, on operating system with systemd, you can create add your pool software as a service.  
Use default/service to create the systemd service `/lib/systemd/system/scala-pool.service`
Then enable and start the service with the following commands : 

```
sudo systemctl enable scala-pool.service
sudo systemctl start scala-pool.service
```

#### 4) Host the front-end

Simply host the contents of the `public` directory on file server capable of serving simple static files.


Edit the variables in the `public/config.js` file to use your pool's specific configuration.
Variable explanations:

```javascript
window.config = {
	/* Must point to the API setup in your config.json file. */
	api:"http://mine.scalaproject.io:8001",
	/* Pool server host to instruct your miners to point to (override daemon setting if set) */
	poolHosts:[
		"mine.scalaproject.io"
	],
	/* Contact email address. */
	email:"support@scalaproject.io",
	/* Pool Telegram URL. */
	telegram:"",
	/* Pool Discord URL */
	discord:"https://discord.gg/zng9k2D",
	/* Market stat display params from https://www.cryptonator.com/widget */
	marketCurrencies:["{symbol}-BTC","{symbol}-USD","{symbol}-EUR","{symbol}-CAD"],
	/* Used for front-end block links. */
	blockchainExplorer:"https://explorer.scalaproject.io/block?block_info={id}",
	/* Used by front-end transaction links. */
	transactionExplorer:"https://explorer.scalaproject.io/tx?tx_info={id}",
	/* Any custom CSS theme for pool frontend */
	themeCss:"themes/dark.css"
}

/* Number of coin decimals places (override daemon setting if set) */
"coinDecimalPlaces": 4,

/* Default language */
var defaultLang = 'en';

```

#### 5) Customize your website

The following files are included so that you can customize your pool website without having to make significant changes
to `index.html` or other front-end files thus reducing the difficulty of merging updates with your own changes:
* `css/custom.css` for creating your own pool style
* `js/custom.js` for changing the functionality of your pool website


Then simply serve the files via nginx, Apache, Google Drive, or anything that can host static content.

#### SSL

You can configure the API to be accessible via SSL using various methods. Find an example for nginx below:

* Using SSL api in `config.json`:

By using this you will need to update your `api` variable in the `website_example/config.js`. For example:  
`window.config.api = "https://poolhost:8119";`

* Inside your SSL Listener, add the following:

``` javascript
location ~ ^/api/(.*) {
    proxy_pass http://127.0.0.1:8117/$1$is_args$args;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

By adding this you will need to update your `api` variable in the `website_example/config.js` to include the /api. For example:  
`window.config.api = "http://poolhost/api";`

You no longer need to include the port in the variable because of the proxy connection.

* Using own subdomain, for example `https://api.poolhost.com`:

```bash
server {
    server_name api.poolhost.com
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    ssl_certificate /your/ssl/certificate;
    ssl_certificate_key /your/ssl/certificate_key;

    location / {
        more_set_headers 'Access-Control-Allow-Origin: *';
        proxy_pass http://127.0.01:8117;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

By adding this you will need to update your `api` variable in the `website_example/config.js`. For example:  
`window.config.api = "https://api.poolhost.com";`

You no longer need to include the port in the variable because of the proxy connection.


#### Upgrading
When updating to the latest code its important to not only `git pull` the latest from this repo, but to also update
the Node.js modules, and any config files that may have been changed.
* Inside your pool directory (where the init.js script is) do `git pull` to get the latest code.
* Remove the dependencies by deleting the `node_modules` directory with `rm -r node_modules`.
* Run `npm update` to force updating/reinstalling of the dependencies.
* Compare your `config.json` to the latest example ones in this repo or the ones in the setup instructions where each config field is explained. You may need to modify or add any new changes.

#### JSON-RPC

Curl can be used to use the JSON-RPC commands from command-line. Here is an example of calling `getblockheaderbyheight` for block 100:

```bash
curl 127.0.0.1:11812/json_rpc -d '{"method":"getblockheaderbyheight","params":{"height":1000}}'
```

To enable wallet rpc you can do as below but make sure rpc-bind-port matches the one in your config

```bash
./scala-wallet-rpc --wallet-file walletfile --prompt-for-password --rpc-bind-port 9000 --rpc-bind-ip 127.0.0.1  --disable-rpc-login --daemon-address 127.0.0.1:11812
```

#### Monitoring

* To inspect and make changes to redis I suggest using [redis-commander](https://github.com/joeferner/redis-commander)
* To monitor server load for CPU, Network, IO, etc - I suggest using [Netdata](https://github.com/firehol/netdata)
* To keep your pool node script running in background, logging to file, and automatically restarting if it crashes - I suggest using [forever](https://github.com/nodejitsu/forever) or [PM2](https://github.com/Unitech/pm2)

##### Monitoring with PM2
To start and register your modules seperately via pm2 use the below commands
```bash
cd <path_to_pool>
pm2 start init.js --name=pool -- --module=pool
pm2 start init.js --name=api -- --module=api,charts
pm2 start init.js --name=unlocker -- --module=unlocker
pm2 start init.js --name=payments -- --module=payments
```
It will help you to log each module easily by using `pm2 log <module_name>`.

