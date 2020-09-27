'use strict'

class BlockStats {
	#_stats = {}
	
	getHeights = () => Object.keys(this.#_stats)
	

	addInfo = (height,wallet,key,value) => {
		if(!this.#_stats[height]){
			this.#_stats[height] = {}
		}

		if(!this.#_stats[height][wallet]){
			this.#_stats[height][wallet]= {
				shares:0,
				earn:0, 
				percent:0.0,
				donations:0.0,
				unlockReward:0.0,
				height: height,

			}
		}

		this.#_stats[height][wallet][key] = parseFloat(this.#_stats[height][wallet][key])+parseFloat(value)
	}

	addBlock = (block) => {
		if(!this.#_stats[block.height]) {
         	this.#_stats[block.height] = {}
        }
        this.#_stats[block.height]["Info"] = block.toRedis()
	}

	toRedis = () => {
		const heights = this.getHeights()
		const cmds = []
		
		if(heights.length <=0) {
			return
		}

		for(let i=0;i< heights.length;i++) {
			const height = heights[i]
      		const wallets = Object.keys(this.#_stats[height])
      		const block = this.#_stats[height]['Info']
      		for(let w =0;w< wallets.length;w++) {
      			const wallet = wallets[w]
         		if(wallet === 'Info') {
         			continue
         		}
         		
         		const stats = this.#_stats[height][wallet]

         		stats.poolType = block.poolType

         		const shareKeys = JSON.stringify(stats)
     			cmds.push(["hmset",global.config.coin+":block_shares:"+height, wallet, shareKeys])
      			cmds.push(["zadd", global.config.coin+":block_worker_shares:"+wallet, height, shareKeys]);
      		}
/*			cmds.push(["expire", global.config.coin+":block_shares:"+height, 60 * 86400])
*/		}

		this.#_stats = {}

		return cmds
	}
}

module.exports = BlockStats;