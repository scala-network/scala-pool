const http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    port = process.argv[2] || 80;

const fastify = require('fastify')()
const fastifyStatic = require('fastify-static')
const fastifyCompress = require('fastify-compress');


fastify.get('/', async (request, res) => {
  return res.sendFile('index.html');
})

fastify
	.register(fastifyCompress, {threshold:0})
	.register(fastifyStatic, {
		root: path.join(__dirname, 'public')
	})

// this will work with fastify-static and send ./static/index.html
fastify.setNotFoundHandler((req, res) => {
  res.sendFile('index.html');
});

//


// Run the server!
const start = async () => {
  try {
    await fastify.listen(port, "0.0.0.0")
  } catch (err) {
    fastddify.log.error(err)

  	console.log(`server listening on ${port}`)
    process.exit(1)
  }

  console.log(`server listening on ${port}`)
};

start();
