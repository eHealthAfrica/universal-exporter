'use strict';
var exporter = require('../lib/exporter.js');
var assert = require('assert');
var http = require('http');
var fs = require('fs');
var debug = require('debug')('test');
var fork = require('child_process').fork;

/*global describe, it, beforeEach, afterEach*/

describe('big data', function () {
  var port = 0;

  beforeEach(function (done) {
    exporter.interpolate = {};
    exporter.config = {};

    var child = fork(__dirname + '/fixtures/big-server.js', [], {
      // silent: true,
    });

    child.on('message', function (event) {
      event = JSON.parse(event);
      if (event.type === 'ready') {
        port = event.data.port;
        done();
      }
    });
  });

  afterEach(function (done) {
    fs.unlink('my-file.xlsx', done);
  });

  it('should be able to write big data', function (done) {
    exporter.config = require('./fixtures/config.json');
    var e = exporter().config({
      $root: 'http://localhost:' + port,
    });

    e.get.participants.byDate({
      formattedDate: new Date().toJSON(),
    }).columns([
      'createdOn: Created',
      'createdBy.fullName: Created By',
      'callNature: Call Nature'
    ])
    .forEach(function (data, i) {
      if (i % 10000 === 0) {
        debug('processed %s', i);
      }
    })
    .save('my-file.xlsx')
    .write()
    .then(function (saver) {
      saver.data.on('end', function () {
        // give the write stream a moment to catch up
        setTimeout(function () {
          assert.ok(fs.existsSync('my-file.xlsx'), 'file exists');
          done();
        }, 100);
      });
    });
  });

});