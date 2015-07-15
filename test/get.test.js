'use strict';
var exporter = require('../lib/exporter.js');
var assert = require('assert');
var http = require('http');
var toObject = require('../lib/stream').toObject;
var JSONStream = require('JSONStream');
var map = require('../lib/stream').map;

/*global describe, it, beforeEach, afterEach*/

describe('simple get', function () {
  var port = 0;
  var mock = [];
  var oldEngine;

  beforeEach(function (done) {
    exporter.interpolate = {};
    exporter.config = {};

    // create a fake engine
    oldEngine = exporter.engines['couch-csv'];
    exporter.engines['couch-csv'] = function (data) {
      return new Promise(function (resolve) {
        resolve(data.pipe(JSONStream.parse([true])));
      });
    };

    mock = [1, 2, 3, 4, 5, 6];
    var server = http.createServer(function (req, res) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(mock));
    });
    server.listen(0);
    server.on('listening', function () {
      port = server.address().port;
      done();
    });
  });

  afterEach(function () {
    exporter.engines['couch-csv'] = oldEngine;
  });

  it('should configure .get urls', function (done) {
    exporter.config = require('./fixtures/config.json');
    var e = exporter().config({
      $root: 'http://localhost:' + port,
    });

    e.get.participants.byDate({
      formattedDate: new Date().toJSON(),
    }).then(function (data) {
      data.pipe(toObject(function (data) {
        assert.deepEqual(data, mock);
        done();
      }));
    }).catch(function (error) {
      done(error);
    });
  });

  it('should map', function (done) {
    exporter.config = require('./fixtures/config.json');
    var e = exporter().config({
      $root: 'http://localhost:' + port,
    });

    e.get.participants.byDate({
      formattedDate: new Date().toJSON(),
    }).map(function (value) {
      return value * 10;
    }).then(function (data) {
      data.pipe(toObject(function (data) {
        assert.deepEqual(data, mock.map(function (v) {
          return v * 10;
        }));
        done();
      }));
    }).catch(function (error) {
      done(error);
    });
  });

});