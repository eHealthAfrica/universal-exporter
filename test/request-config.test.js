'use strict';
var exporter = require('../lib/exporter.js');
var assert = require('assert');
var sinon = require('sinon');
var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var qs = require('querystring');

describe('remote', function () {
  var mock = [];
  var oldEngine;
  var spy;
  var remoteURL = '';

  beforeEach(function (done) {
    // create a data-passthrough "fake" engine
    exporter.engines.fake = function (data) {
      return new Promise(function (resolve, reject) {
        resolve(data);
      });
    };

    // create a server that calls the spy on each request
    mock = [1, 2, 3, 4, 5, 6];

    exporter.config = {};
    exporter.config = require('./fixtures/config.json');
    exporter.config.participants.$engine = 'fake';

    spy = sinon.spy();
    var remote = express();
    remote.use(bodyParser.json());
    remote.all('*', function (req, res) {
      spy({
        body: req.body,
        method: req.method,
        headers: req.headers
      });
      res.status(200, { 'content-type': 'application/json' });
      res.send(mock);
    });

    var server = http.createServer(remote);

    server.listen(0);

    // reconfigure exporter to send fetch requests to this new server
    server.on('listening', function () {
      remoteURL = 'http://localhost:' + server.address().port;
      done();
    });
  });

  afterEach(function () {
    delete exporter.engines.fake;
    delete exporter.config.$remote;
    delete process.env.NODE_ENV;
  });

  it('should support sending headers', function () {
    var expected = [
      { title: 1, date: '2015-09-13' },
      { title: 2, date: '2015-09-13' },
    ];

    return exporter().config({
      $root: remoteURL,
    }).get.participants.byDate({
      date: '[2015,05,22]',
      $request: {
        method: 'post',
        headers: {
          'x-custom': 'true',
        },
      },
    })
    .then(function (data) {
      if (!spy.called) {
        throw new Error('local server not was hit - fail');
      }

      var call = spy.args[0].pop();

      assert.equal(call.method, 'POST', 'request was a ' + call.method);
      assert.equal(call.headers['x-custom'], 'true', 'custom header was present: ' + JSON.stringify(call.headers));
    }).__state;
  });
});