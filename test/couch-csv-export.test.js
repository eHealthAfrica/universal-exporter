'use strict';
var exporter = require('../lib/exporter.js');
var streamTools = require('../lib/stream');
var through = require('through');
var assert = require('assert');

/*global describe, it, beforeEach*/

describe('engine: couchdb', function () {
  beforeEach(function () {
    exporter.interpolate = {};
    exporter.config = require('./fixtures/config.json');
    if (process.env.COUCH_HOST) {
      exporter.config.$root = process.env.COUCH_HOST;
    } else {
      // set up a fake couch responder?
    }
    exporter.interpolate.couchFormat = function (date) {
      return '[' + [
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
      ].join(',') + ']';
    };
  });

  it('should get data from local couchdb', function (done) {
    exporter().get.participants.all({
      play: 'HENRY IV',
    }).then(function (data) {
      data.pipe(streamTools.toObject(function (data) {
        assert.ok(data);
        done();
      }));
    }).catch(function (error) {
      done(error);
    });
  });

  it('should support custom separators', function () {
    var age = function () {
      return Math.random() * 10 + 2 | 0;
    };
    var cats = 'nap sam prince'.split(' ').map(function (cat) {
      return { name: cat, age: age() };
    });

    var sep = '^';

    return exporter(cats)
      .save('test.csv', 'csv', sep)
      .then(function (saver) {
        return new Promise(function (resolve) {
          saver.pipe(streamTools.toObject(function (data) {
            var lines = data;
            lines.shift(); // shift the headings off
            assert.ok(lines.length === 3, '3 rows = ' + lines.length);
            assert.ok(lines.slice(1, 2).pop().indexOf(sep) !== -1, 'correct separator was used');
            assert.equal(lines[0], '"nap"^"' + cats[0].age + '"\n', 'row matches');
            resolve(true);
          }));
        });
      }).__state;
  });
});