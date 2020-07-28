'use strict'

class Blocks {

	#_properties = [
		'height',
		'hash',
		'timestamp',
		'difficulty',
		'shares',
		'donations',
		'reward',
		'miner',
		'poolType',
		'orphaned',
		'unlocked'
	]

	#_placeHolder = [
		0,
		'XXXXXXXXXXXXX',
		Date.now() /1000,
		0,
		0,
		0,
		0,
		'xxxxxxx...xxxxxxx',
		'ppbs',
		0,
		false,
	]
	#_workerShares = {}
	
	serialized=''
	
	isDirty() {
//		console.log(this.toRedis(), this.serialized);
		return this.toRedis() !== this.serialized
	}

	set workerShares(ws) {
		this.#_workerShares = ws
	}

	get workerShares() {
		return this.#_workerShares
	}

	setBlockHeader(blockHeader) {
		this.orphaned = blockHeader.hash === this.hash ? 0 : 1;
		this.unlocked = blockHeader.depth >= global.config.blockUnlocker.depth;
		this.reward = blockHeader.miner_reward || blockHeader.reward || 0;
	}

	original = {}
	dirty = {}
	 
	constructor(input) {
		if(typeof input === 'string') {
			const parts = input.split(":")
			for(let i in this.#_properties) {
				const property = this.#_properties[i]
				this.original[property] = (parts.length >= i) ? parts[i] : this.#_placeHolder[i]
			}
		} else if(input instanceof Array || Array.isArray(input)) {
			for(let i in this.#_properties) {
				const property = this.#_properties[i]
				this.original[property] = (input.length >= i) ? input[i] : this.#_placeHolder[i]
			}
		} else if(input instanceof Object) {
			for(let i in this.#_properties) {
				const property = this.#_properties[i]
				this.original[property] = (property in input) ? input[property] : this.#_placeHolder[i]
			}
		}

		for(let i in this.#_properties) {
			const property = this.#_properties[i]
			Object.defineProperty(this, property, { 
			  get: function() {
			    return this.dirty[property] || this.original[property] || this.#_placeHolder[i];
			  },
			  set: function(newValue) {
			    this.dirty[property] = newValue;
			  }
			});
		}
		for(let i in this.#_properties) {
				const property = this.#_properties[i]
				switch(property) {
					case 'unlocked':
					this.original[property] = (this.original[property] === true || this.original[property] === 'true');
					break;
					case 'orphaned':
					case 'height':
					case 'timestamp':
					case 'difficulty':
					case 'shares':
					case 'donations':
					case 'reward':
					case 'orphaned':
					this.original[property] = parseInt(this.original[property])
					break;
				}
		}
		this.serialized = this.toRedis()
	}


	toRedis() {
		const arr = []
		for(let i in this.#_properties) {
			const property = this.#_properties[i]
			let val;
			if(property in this.dirty) {
				arr.push(this.dirty[property])	
			}else if(property in this.original) {
				arr.push(this.original[property])	
			} else {
				arr.push(this.#_placeHolder[i])	
			}
		}

		return arr.join(':')

	}

	toArray() {
		const arr = []
		for(let i in this.#_properties) {
			const property = this.#_properties[i]
			arr.push(this.dirty[property] || this.original[property] || this.#_placeHolder[i]);
		}

		return arr;
	}

	toObject() {
		return {...this.original, ...this.dirty}
	}

}


module.exports = Blocks;
