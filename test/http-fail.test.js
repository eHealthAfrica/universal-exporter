'use strict';
var exporter = require('../lib/exporter.js');
var assert = require('assert');
var http = require('http');

/*global describe, it, beforeEach, afterEach*/

describe('simple get', function () {
  var port = 0;
  var mock = [];
  var oldEngine;

  beforeEach(function (done) {
    exporter.interpolate = {};
    exporter.config = {};

    // create a fake engine
    exporter.engines.fake = function (data) {
      return data;
    };

    mock = [1, 2, 3, 4, 5, 6];
    var server = http.createServer(function (req, res) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify(false));
    });
    server.listen(0);
    server.on('listening', function () {
      port = server.address().port;
      done();
    });
  });

  afterEach(function () {
    delete exporter.engines.fake;
  });

  it('should configure .get urls', function () {
    exporter.config = require('./fixtures/config.json');
    var e = exporter().config({
      $root: 'http://localhost:' + port,
    });

    return e.get.participants.byDate()
    .save('test.csv')
    .base64(function (str) {
      done(new Error('we have data when we should not'));
    })
    .then(function () {
      done(new Error('Somehow got data when we did not expect it'));
    }).catch(function (error) {
      assert.ok(error.message.indexOf('404') !== -1, error.message);
    }).__state;
  });
});