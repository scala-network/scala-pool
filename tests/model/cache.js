const test = require('ava')
const Cache = require('../../lib/model/Cache')


test("Cache write", t=>{

    const cache = new Cache()
    cache.write("Hello", "WORLD")
    t.pass()

})