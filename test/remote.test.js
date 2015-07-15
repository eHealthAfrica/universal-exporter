'use strict';
var exporter = require('../lib/exporter.js');
var assert = require('assert');
var sinon = require('sinon');
var http = require('http');
var express = require('express');
var debug = require('debug')('exporter:test');
var bodyParser = require('body-parser');
var qs = require('querystring');
var JSONStream = require('JSONStream');
var stream = require('../lib/stream');

describe('remote', function () {
  var mock = [];
  var oldEngine;
  var spy;
  var remoteSpy;
  var remoteURL = '';
  var expected;

  function startRemoteSpy(done) {
    remoteSpy = sinon.spy();
    var remote = express();
    remote.use(bodyParser.json());
    remote.post('*', function (req, res) {
      remoteSpy(req.body);
      res.status(200, { 'content-type': 'application/json' });
      debug('remote spy responding');
      res.send(expected || mock);
    });

    var server = http.createServer(remote);

    server.listen(0);

    // reconfigure exporter to send fetch requests to this new server
    server.on('listening', function () {
      remoteURL = 'http://localhost:' + server.address().port;
      debug('remote spy listening on %s', remoteURL);
      done();
    });
  }

  beforeEach(function (done) {
    expected = null;
    // create a data-passthrough "fake" engine
    exporter.engines.fake = function (data) {
      return new Promise(function (resolve, reject) {
        resolve(data.pipe(JSONStream.parse([true])));
      });
    };

    // create a server that calls the spy on each request
    mock = [1, 2, 3, 4, 5, 6];
    spy = sinon.spy();
    var server = http.createServer(function (req, res) {
      res.writeHead(200, { 'content-type': 'application/json' });
      spy();
      res.end(JSON.stringify(expected || mock));
    });
    server.listen(0);

    // reconfigure exporter to send fetch requests to this new server
    server.on('listening', function () {
      exporter.config.$root = 'http://localhost:' + server.address().port;
      startRemoteSpy(done);
    });

    exporter.config = {};
    exporter.config = require('./fixtures/config.json');
    exporter.config.participants.$engine = 'fake';
    exporter.iterators = {
      toObject: function (value) {
        value.date = '2015-09-13';
        return value;
      },
    };
  });

  afterEach(function () {
    delete exporter.engines.fake;
    delete exporter.config.$remote;
    delete process.env.NODE_ENV;
  });

  it('should defer gets and compile config', function (done) {
    expected = [
      { title: 1, date: '2015-07-14' },
      { title: 2, date: '1978-09-13' },
      { title: 3, date: '1978-11-18' },
      { title: 4, date: '2000-01-01' },
    ];

    exporter().config({
      $remote: remoteURL,
    }).get.participants.byDate({
      date: '[2015,05,22]',
    })
    .toObject()
    .slice(0, 2)
    .columns([
      'title: Blog title',
      'date: Post date',
    ])
    .save('my-file.csv')
    .then(function (saver) {
      if (spy.called) {
        throw new Error('local server was hit - fail');
      }

      if (!remoteSpy.called) {
        throw new Error('remote server was not called - fail');
      }

      // note to self: the remote url IN THIS TEST CASE isn't do the work for
      // us, so we're replicating what the server would do below

      var commands = remoteSpy.args[0].pop();

      exporter().remote(commands).then(function (data) {
        data.pipe(stream.toObject(function (data) {
          assert.deepEqual(data, expected.slice(0, 2).map(function (v) {
            v.date = '2015-09-13';
            return v;
          }));
          done();
        }));
      }).catch(done);
    }).catch(function (error) {
      done(error);
    });
  });
});