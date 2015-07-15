var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var exporter = require(__dirname + '/../../lib/exporter.js');

// enabling production mode requires that all exporter remote calls
// have correct signatures included. for testing, this is disabled.
// process.env.NODE_ENV = 'production';
// var signatures = [ ... ];

var app = express();

// support cors by default - again this is an example server
app.use(cors());

// create application/json parser
var jsonParser = bodyParser.json();

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false });

app.use(urlencodedParser);
app.use(jsonParser);

// expose a demo in index.html
app.use('/', express.static(__dirname + '/public'));

app.post('/export', urlencodedParser, function (req, res) {
  if (!req.body) {
    return res.sendStatus(400);
  }

  var commands = req.body;
  var saver = commands.saver;

  if (process.env.EXPORT_ROOT) {
    commands.root = process.env.EXPORT_ROOT;
  }

  exporter().config({
    // this would be populated with hashes in production mode
    // signatures: signatures,
  })
  .remote(commands)
  .save(saver.filename, saver.type, saver.args.pop())
  .then(function (saver) {
    res.writeHead(200, 'OK', {
      'Content-Type': saver.mime,
      'Content-Disposition': 'inline; filename=' + saver.filename,
    });
    saver.pipe(res);
  })
  .catch(function (error) {
    console.log(error.stack);
    res.status(500).send(error.message);
  });
});

// test endpoint to catch 404s...
app.get('*', function (req, res) {
  res.end('pong');
});

app.listen(process.env.PORT || 8000, function (server) {
  console.log('Running on http://localhost:' + (process.env.PORT || 8000));
});