'use strict'
const utils = require('../utils')
class Cache {
  #_data = {}
  #_ttl = {}
  #_st = 0
  constructor(secondsToLive) {
    
    if(secondsToLive) {
      if(secondsToLive < 1000) {
        millisecondsToLive = secondsToLive * 1000
      } else {
        millisecondsToLive = secondsToLive || 1000
      }
      this.millisecondsToLive = secondsToLive
    } else {
      this.millisecondsToLive = secondsToLive || 1000
    }

    const self = this

    setInterval(() => {
      const now = Date.now()
      const keys = Object.keys(self.#_ttl)
      for(let i=0;i<keys.length;i++) {
        const key = keys[i]
        const ttl = self.#_ttl[key]
        if(now >= ttl) {
          self.clear(key)
        }
      }      

    }, 500)
  }

  logMemory() {
    const bytes = JSON.stringify(this.#_data).length
    if(this.#_st !== bytes) {
      this.#_st = bytes
      log('info',process.env.workerType || "init", `Cached memory usage : ${utils.readableSI(bytes)}B`)
    }
  }

  write (key, data, secondsToLive) {
    if(!data) { return }
    const now = Date.now()
    let millisecondsToLive
    if(secondsToLive > 0) {
      if(secondsToLive < 1000) {
        millisecondsToLive = secondsToLive * 1000
      } else {
        millisecondsToLive = secondsToLive || 1000
      }
    
      millisecondsToLive = secondsToLive || this.millisecondsToLive
      this.#_ttl[key] = now + millisecondsToLive
    } else if(secondsToLive !== -1) {
      millisecondsToLive = this.millisecondsToLive
      this.#_ttl[key] = now + millisecondsToLive
    }
/*    console.log(this.#_ttl)
*/    this.#_data[key] = data

  }
  readMultiCallback(keys, writecallback, ondatacallback) {
    let data = this.readMany(keys)
    if(data) {
      ondatacallback(data)
      return
    }
    const self = this
    writecallback((data, ttl) => {
      for(let i in keys) {
        const key = keys[i]
        const value = data[i]
        self.write(key, value, ttl)

      }
      ondatacallback(data)
    })
  }
  /**
  * key - String
  * writecallback - callback()
  * ondatacallback - callback(data)
  **/
  readCallback(key, writecallback, ondatacallback) {
    let data = this.#_data[key]
    if(data) {
      ondatacallback(data)
      return
    }
    const self = this
    writecallback((data, ttl) => {
      self.write(key, data, ttl)
      ondatacallback(data)
    })
  }

  readMany(keys) {
    let data = []
    for(let i in keys) {
      const key = keys[i]
      const value = this.#_data[key]
      if(value) {
        data.push(value)
        continue
      }
      return null
    }
    return data
  }
  read(key) {
    if(!this.#_data[key]) {
      return false
    }
    let data = this.#_data[key]
    return data
  }

  clear(key) {
      if(this.#_data[key]) {
        delete this.#_data[key]
      }
      if(this.#_ttl[key]) {
        delete this.#_ttl[key]
      }
  }

  clearall() {

    this.#_data = {}
    this.#_ttl = {}


  }
  
}


module.exports = Cache