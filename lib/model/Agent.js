'use strict'


const regex = {
	XMRig     : /xmrig(?:-[a-zA-Z]+)?\/(\d+)\.(\d+)\./, // 2.8.0
	XLArig     : /xlarig(?:-[a-zA-Z]+)?\/(\d+)\.(\d+)?(\.\d+|\s)/, // 2.8.0
	XmrStakRX : /\w+-stak-rx\/(\d+)\.(\d+)\.(\d+)/, // 1.0.1
	XmrStak : /\w+-stak(?:-[a-zA-Z]+)?\/(\d+)\.(\d+)\.(\d+)/, // 2.5.0
	XmrNodeProxy  : /xmr-node-proxy\/(\d+)\.(\d+)\.(\d+)/, // 0.3.2
	CastXMR      : /cast_xmr\/(\d+)\.(\d+)\.(\d+)/, // 1.5.0
	SRB       : /srbminer cryptonight amd gpu miner\/(\d+)\.(\d+)\.(\d+)/, // 1.6.8
	SRBMULTI  : /srbminer-multi\/(\d+)\.(\d+)\.(\d+)/, // 0.1.5
}

class Agent {
	
	#_agent = "Unknown";
	#_miner = "Unknown";
	#_proxy = false;
	#_version = [0,0,0];

	get version() {
		return this.#_version.join('.');
	}

	get versionInt() {
		 return this.#_version[0] * 10000 + this.#_version[1] * 100 + this.#_version[2];
	}

	get isProxy() {
		return this.#_proxy;
	}
	
	get name() {
		return this.#_miner;
	}

	get raw() {
		return this.#_agent;
	}

	constructor(agent) {
		if(!agent) {
			return;
		}
		this.#_agent = agent;
		this.#_proxy = (agent && agent.includes('xmr-node-proxy'));
		for(let [ag,me] of Object.entries(regex)) {
			const m = me.exec(agent.toLowerCase());
			if(!m) {
				continue;
			}

            this.#_miner = ag;
            let m3;
            if(m.length <= 3 || !m[3].trim()){
            	m3 = 0;
            } else {
            	m3 = parseInt(m[3].trim().replace('.',''));
            }
            this.#_version = [
				m.length > 1 ? parseInt(m[1]) : 0,
				m.length > 2 ? parseInt(m[2]) : 0,
				m3
        	];
        	break;
		}
	}

}

module.exports = Agent;