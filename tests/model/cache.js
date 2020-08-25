const test = require('ava')
const Cache = require('../../lib/model/Cache')


test.cb("Cache Simple Read Write", t=>{
	t.plan(2)

    const cache = new Cache()
    cache.write("Hello", "WORLD", 1)
    
    t.is(cache.read("Hello"), "WORLD")

    setTimeout(() => {
    	t.is(cache.read("Hello"),false)
    	t.end()
    },1000)

})


test.cb("Cache Callback Read Write", t=>{
	t.plan(2)

    const cache = new Cache()
    cache.readCallback("Hello", c => {
    	c("WORLD",1)
    }, d => {
    	t.is(d, "WORLD")
	    setTimeout(() => {
	    	t.is(cache.read("Hello"),false)
	    	t.end()
	    },1001)
    })
})

test.cb("Cache Multi Callbacks Read Write", t=>{
	t.plan(15)

    const cache = new Cache()
    cache.write("d", "0", 1)
    cache.readMultiCallback(["W","o","r","l","d"], c => {
    	c(["H","e","l","l","o"], 1)
    }, d => {
    	t.is(d[0], "H")
    	t.is(d[1], "e")
    	t.is(d[2], "l")
    	t.is(d[3], "l")
    	t.is(d[4], "o") // Overwrites

    	t.is(cache.read("W"),"H")
    	t.is(cache.read("o"),"e")
    	t.is(cache.read("r"),"l")
    	t.is(cache.read("l"),"l")
    	t.is(cache.read("d"),"o")

    	cache.write("l", "L", 5)

	    setTimeout(() => {
	    	t.is(cache.read("W"),false)
	    	t.is(cache.read("o"),false)
	    	t.is(cache.read("r"),false)
	    	t.is(cache.read("l"),"L")
	    	t.is(cache.read("d"),false)
	    	t.end()
	    },2000)
    })
})

test.cb("Cache Multi Callbacks Read Write With An Expired Key", t=>{
	t.plan(20)

    const cache = new Cache()
    const World = ["W","o","r","l","d"]
    const Hello = ["H","e","l","l","o"]
    cache.readMultiCallback(World, c => {
    	c(Hello, 1000)
    }, d => {
    	t.is(d[0], "H")
    	t.is(d[1], "e")
    	t.is(d[2], "l")
    	t.is(d[3], "l")
    	t.is(d[4], "o")

    	t.is(cache.read("W"),"H")
    	t.is(cache.read("o"),"e")
    	t.is(cache.read("r"),"l")
    	t.is(cache.read("l"),"l")
    	t.is(cache.read("d"),"o")
    	
    	cache.clear("r")

    	cache.readMultiCallback(["W","o","r","l","d"], c => {
	    	c(Hello, 1000)
	    }, d => {
	    	t.is(d[0], "H")
	    	t.is(d[1], "e")
	    	t.is(d[2], "l")
	    	t.is(d[3], "l")
	    	t.is(d[4], "o")

	    	t.is(cache.read("W"),"H")
	    	t.is(cache.read("o"),"e")
	    	t.is(cache.read("r"),"l")
	    	t.is(cache.read("l"),"l")
	    	t.is(cache.read("d"),"o")

	    	t.end()
		})
    })
})