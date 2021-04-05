let config = {};

module.exports = cli => {
	const default = {
		"daemon": {
			"host": "127.0.0.1",
			"port": 11812
		},
		"wallet": {
			"host": "127.0.0.1",
			"port": 9000
		},
		"redis": {
			"host": "127.0.0.1",
			"port": 6379,
			"auth": null,
			"db":0
		}
	};

	config = default;
	return config;
}