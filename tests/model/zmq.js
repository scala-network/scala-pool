const zmq = require('zeromq');
const test = require('ava')

// const ZapStart = function(count) {
//   var zap = zmq.socket('router');
//   zap.on('message', function() {
//     var data = Array.prototype.slice.call(arguments);
  
//     if (!data || !data.length) throw new Error("Invalid ZAP request");
  
//     var returnPath = [],
//       frame = data.shift();
//     while (frame && (frame.length != 0)) {
//       returnPath.push(frame);
//       frame = data.shift();
//     }
//     returnPath.push(frame);

//     if (data.length < 6) throw new Error("Invalid ZAP request");

//     var zapReq = {
//       version: data.shift(),
//       requestId: data.shift(),
//       domain: Buffer.from(data.shift()).toString('utf8'),
//       address: Buffer.from(data.shift()).toString('utf8'),
//       identity: Buffer.from(data.shift()).toString('utf8'),
//       mechanism: Buffer.from(data.shift()).toString('utf8'),
//       credentials: data.slice(0)
//     };
//     console.log(data)
//     zap.send(returnPath.concat([
//       zapReq.version,
//       zapReq.requestId,
//       Buffer.from("200", "utf8"),
//       Buffer.from("OK", "utf8"),
//       Buffer.alloc(0),
//       Buffer.alloc(0)
//     ]));
//   });
  
//   zap.bindSync("inproc://zeromq.zap.01."+count);
//   return zap;
// }



test.cb('should support req-rep', t => {
  const rep = zmq.socket('rep');
  const req = zmq.socket('req');
  t.plan(4)
  rep.on('message', function(msg){
    t.true(msg instanceof Buffer);
    t.is(msg.toString(),'hello');
    rep.send('world');
  });

  rep.bind('inproc://stuffreqrep',  () => {
    req.connect('inproc://stuffreqrep');
    req.send('hello');
    req.on('message', function(msg){
      t.true(msg instanceof Buffer);
      t.is(msg.toString(),'world');
      req.close();
      rep.close();
      t.end();
    });
  });
});

test.cb('should support multiple', t => {
    var n = 5;

    for (var i = 0; i < n; i++) {
      (function(x){
        const rep = zmq.socket('rep');
        const req = zmq.socket('req');
        rep.bind(`inproc://#${n}`, (e) => {
          rep.on('message', msg => {
            t.true(msg instanceof Buffer);
            t.is(msg.toString(),'hello');
            rep.send('world');
          });

          req.connect(`inproc://#${n}`)
          req.send('hello')
          req.on('message', function(msg){
            
            t.true(msg instanceof Buffer)
            t.is(msg.toString(),'world')
            
            req.close();
            rep.close();
            if (!--n) {
              t.end()
            }
          });
        })
      })(i);
    }

  });

test.cb('should support a burst', t => {
    const rep = zmq.socket('rep'), req = zmq.socket('req'), n = 10
    t.plan(40)
    rep.on('message', function (msg) {
      t.true(msg instanceof Buffer);
      t.is(msg.toString(),'hello');
      rep.send('world');
    });

    rep.bind('inproc://reqrepburst', () => {
      req.connect('inproc://reqrepburst');

      let received = 0;

      req.on('message', function(msg){
        t.true(msg instanceof Buffer);
        t.is(msg.toString(),'world');

        received += 1;

        if (received === n) {
          rep.close();
          req.close();
          t.end();
        }
      });

      for (var i = 0; i < n; i += 1) {
        req.send('hello');
      }
    });
});



test.cb('should support null', t =>{
    const rep = zmq.socket('rep');
    const req = zmq.socket('req');
    var port = 'tcp://127.0.0.1:12345';
    t.plan(6)

    rep.on('message', function(msg){
      t.true(msg instanceof Buffer);
      t.is(msg.toString(),'hello');
      rep.send('world');
    });

    rep.zap_domain = "test";
    t.is(rep.mechanism, 0);

    rep.bind(port, () => {
      t.is(req.mechanism, 0);
      req.connect(port);
      req.send('hello');
      req.on('message', function(msg){
        t.true(msg instanceof Buffer);
        t.is(msg.toString(),'world');
        req.close();
        rep.close();
        t.end();
      });
    });
  });


test.cb('should support plain', t => {
    const rep = zmq.socket('rep');
    const req = zmq.socket('req');

    var port = 'tcp://127.0.0.1:12346';
    t.plan(6)


    rep.on('message', function(msg){
      t.true(msg instanceof Buffer);
      t.is(msg.toString(),'hello');
      rep.send('world');
    });

    rep.zap_domain = "test";
    rep.plain_server = 1;
    t.is(rep.mechanism, 1);

    rep.bind(port,  () => {

      req.plain_username = "user";
      req.plain_password = "pass";
      t.is(rep.mechanism, 1);

      req.connect(port);
      req.send('hello');
      req.on('message', function(msg){
        t.true(msg instanceof Buffer);
        t.is(msg.toString(),'world');
        req.close();
        rep.close();
        t.end();
      });
    });
  });



test.cb('should support curve', t => {
    var port = 'tcp://127.0.0.1:12347';
    const rep = zmq.socket('rep');
    const req = zmq.socket('req');

    t.plan(6)

    var serverPublicKey = Buffer.from('7f188e5244b02bf497b86de417515cf4d4053ce4eb977aee91a55354655ec33a', 'hex')
      , serverPrivateKey = Buffer.from('1f5d3873472f95e11f4723d858aaf0919ab1fb402cb3097742c606e61dd0d7d8', 'hex')
      , clientPublicKey = Buffer.from('ea1cc8bd7c8af65497d43fc21dbec6560c5e7b61bcfdcbd2b0dfacf0b4c38d45', 'hex')
      , clientPrivateKey = Buffer.from('83f99afacfab052406e5f421612568034e85f4c8182a1c92671e83dca669d31d', 'hex');

    rep.on('message', function(msg){
      t.true(msg instanceof Buffer);
      t.is(msg.toString(),'hello');
      rep.send('world');
    });

    rep.zap_domain = "test";
    rep.curve_server = 1;
    rep.curve_secretkey = serverPrivateKey;
    t.is(rep.mechanism, 2);

    rep.bind(port, function (error) {
      if (error) throw error;
      req.curve_serverkey = serverPublicKey;
      req.curve_publickey = clientPublicKey;
      req.curve_secretkey = clientPrivateKey;
      t.is(rep.mechanism, 2);

      req.connect(port);
      req.send('hello');

      req.on('message', function(msg){
        t.true(msg instanceof Buffer);
        t.is(msg.toString(),'world');        
        req.close();
        rep.close();
        t.end();
      });
    });
});

