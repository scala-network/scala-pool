'use strict'
const utils = require('../utils')
class Cache {
  #_data = {}
  #_ttl = {}
  #_st = 0
  constructor(secondsToLive) {
    if(secondsToLive && secondsToLive < 1000) {
      this.millisecondsToLive = secondsToLive * 1000
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

        if(now > ttl) {
          delete self.#_data[key]
          delete self.#_ttl[key]
        }

      }      

    }, 1000)
  }

  logMemory() {
    const bytes = JSON.stringify(this.#_data).length
    if(this.#_st !== bytes) {
      this.#_st = bytes
      log('info',process.env.workerType || "init", `Cached memory usage : ${utils.readableSI(bytes)}B`)
    }
  }

  write (key, data, secondsToLive) {
    this.#_data[key] = data
    if(secondsToLive !== -1) {
      const now = Date.now()
      let millisecondsToLive = (secondsToLive  * 1000) || this.millisecondsToLive
      this.#_ttl[key] = now + millisecondsToLive
    }

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
        self.write(key, data, ttl)

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
    let data = this.#_data[key]
    return data
  }

  clearall() {

    this.#_data = {}
    this.#_ttl = {}

    this.logMemory()

  }
  
}


module.exports = Cache