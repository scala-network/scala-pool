class BaseDatasource
{
	_config = {};
	client;

	constructor(config) {
		this._config = config;
		this.init();
	}

	set config(c) {
		this._config = c;
	}

	get config() {
		return this._config;
	}

	init() {
		
	}
}


module.exports = BaseDatasource;