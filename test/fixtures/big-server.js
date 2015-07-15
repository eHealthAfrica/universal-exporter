var http = require('http');
var fs = require('fs');
var Pump = require(__dirname + '/pump');
var data = require(__dirname + '/data-snippet.json');
var port = null;
var parse = require('url').parse;

var https = require('https');

var n = 500000;

var server = http.createServer(function (req, res) {
  res.writeHead(200, { 'content-type': 'application/json' });

  var read = new Pump(n, data, 60 * 1000, '{"total_rows":1272735,"offset":0,"rows":[\n', '\n,\n', '\n] }');
  read.pipe(res);

});

// bind to a random port
server.listen(process.env.PORT || 0);
server.on('listening', function () {
  port = server.address().port;
  // console.log('listening on port %s', port);
  if (process.send) {
    process.send(JSON.stringify({
      type: 'ready',
      data: { port: port }
    }));
  } else {
    console.log(port);
  }
});