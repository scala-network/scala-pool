let config = {};

module.exports = cli => {
	const default = {
        "blocks":{
            "enabled":true,
            "days":30
        },
        "pool": {
            "difficulty": {
                "enabled": true,
                "updateInterval": 60,
                "stepInterval": 1800,
                "maximumPeriod": 86400
            },
            "hashrate": {
                "enabled": true,
                "updateInterval": 60,
                "stepInterval": 1800,
                "maximumPeriod": 86400
            },
            "workers": {
                "enabled": true,
                "updateInterval": 60,
                "stepInterval": 1800,
                "maximumPeriod": 86400
            },
            "miners": {
                "enabled": true,
                "updateInterval": 60,
                "stepInterval": 1800,
                "maximumPeriod": 86400
            },
            "price": {
                "enabled": true,
                "updateInterval": 1800,
                "stepInterval": 10800,
                "maximumPeriod": 604800
            }
        },
        "user": {
            "worker_hashrate": {
                "enabled": true,
                "updateInterval": 180,
                "stepInterval": 1800,
                "maximumPeriod": 86400
            },
            "hashrate": {
                "enabled": true,
                "updateInterval": 180,
                "stepInterval": 1800,
                "maximumPeriod": 86400
            },
            "payments": {
                "enabled": true
            }
        }
    };

    config = default;
    return config;
};