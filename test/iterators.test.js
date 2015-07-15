'use strict';
var exporter = require('../lib/exporter.js');
var assert = require('assert');
var sinon = require('sinon');
var http = require('http');
var toObject = require('../lib/stream').toObject;
var JSONStream = require('JSONStream');

/*global describe, it, beforeEach, afterEach*/

describe('iterators', function () {
  var port = 0;
  var mock = [];
  var oldEngine;

  beforeEach(function (done) {
    exporter.interpolate = {};

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

      exporter.config = require('./fixtures/config.json');
      exporter.config.$root = 'http://localhost:' + port;

      done();
    });
  });

  afterEach(function () {
    exporter.iterators = {};
    exporter.engines['couch-csv'] = oldEngine;
  });

  it('should maintain object structure', function () {
    exporter.iterators.boolAsText = function (row) {
      Object.keys(row).forEach(function (key) {
        if (typeof row[key] === 'boolean') {
          row[key] = row[key] ? 'TRUE' : 'FALSE';
        }
      });
      return row;
    };

    var source = [{
      name: 'rem',
      human: true,
    }, {
      name: 'nap',
      human: false,
    }, {
      name: 'sam',
      human: false,
    }, ];

    return exporter(source)
    .boolAsText()
    .then(function (data) {
      data.pipe(toObject(function (data) {
        assert.deepEqual(data, source.map(function (row) {
          row.human = row.human ? 'TRUE' : 'FALSE';
          return row;
        }));
      }));
    }).__state;

  })

  it('should add and keep iterators', function () {
    var spy = sinon.spy();
    exporter.iterators.asString = function (data) {
      spy();
      return data.toString();
    };

    return exporter()
      .get
      .participants
      .byDate()
      .asString()
      .then(function (data) {
        data.pipe(toObject(function (data) {
          // ensure the data remained intact
          assert.deepEqual(data, mock.map(function (v) {
            return v.toString();
          }));
          assert.ok(spy.callCount === mock.length, spy.callCount + ' v ' + mock.length);
        }));
      }).__state;
  });
});