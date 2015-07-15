'use strict';
var exporter = require('../lib/exporter.js');
var streamTools = require('../lib/stream');
var assert = require('assert');
var expected = 0;
var actual = 0;

/*global describe, it, beforeEach*/

describe('stream array like methods', function () {
  var mock;

  beforeEach(function () {
    mock = [1, 2, 3, 4, 5, 6, 7];
  });

  it('should map', function (done) {
    var fn = function (v) {
      return v * 2;
    };
    exporter(mock)
      .map(fn)
      ._toObject(function (data) {
        assert.deepEqual(data, mock.map(fn));
        done();
      });
  });

  it('should filter', function (done) {
    var fn = function (v) {
      return v % 2 === 0;
    };

    exporter(mock)
      .filter(fn)
      ._toObject(function (data) {
        assert.deepEqual(data, mock.filter(fn));
        done();
      });
  });

  it('should slice', function (done) {
    exporter(mock)
      .slice(2, 4)
      ._toObject(function (data) {
        assert.deepEqual(data, mock.slice(2, 4));
        done();
      });
  });

  it('should reduce', function (done) {
    var fn = function (acc, curr) {
      acc.push(curr * 2);
      return acc;
    };

    exporter(mock)
      .reduce(fn, [])
      ._toObject(function (data) {
        // note: data has been transformed from a stream of objects
        // to an array (via the reduce), so I'm poping first
        assert.deepEqual(data.pop(), mock.reduce(fn, []));
        done();
      });
  });

  it('should chain', function (done) {
    var map = function (n) {
      return n * 2;
    };

    var filter = function (n) {
      return n > 10;
    };

    exporter(mock)
      .map(map)
      .filter(filter)
      .slice(0, 3)
      ._toObject(function (data) {
        assert.deepEqual(data, mock.map(map).filter(filter).slice(0, 3));
        done();
      })
  });
});