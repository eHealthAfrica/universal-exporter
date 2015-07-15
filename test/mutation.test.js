'use strict';
var exporter = require('../lib/exporter.js');
var assert = require('assert');
var toObject = require('../lib/stream').toObject;

describe('mutation', function () {

  var mock;

  beforeEach(function () {
    mock = [1, 2, 3, 4, 5, 6];
    exporter.interpolate = {};
    exporter.config = {};
  });

  it('array methods should not mutate internal data', function () {
    return exporter(mock).then(function (data) {
      data.pipe(toObject(function (data) {
        assert.deepEqual(data, mock.slice(), 'Actual:' + data);
      }));
    }).__state;
  });

  it('iterators should not mutate internal data', function () {
    exporter.iterators.mul = function (value) {
      return value * 10;
    };

    return exporter(mock).mul().then(function (data) {
      data.pipe(toObject(function (data) {
        assert.deepEqual(data, mock.map(function (v) {
          return v * 10;
        }), 'Actual:' + data);
      }));
    }).__state;
  });

  // it('iterators can be re-used without mutation', function () {
  //   var fn = function (v) {
  //     return v * 10;
  //   };

  //   var mul = mock.map(fn);
  //   exporter.iterators.mul = fn;

  //   var e = exporter(mock).mul().then(function (data) {
  //     return data;
  //   });
  //   var states = [];

  //   var clone = e.clone().then(function (data) { // data should be 10, 20, etc
  //     data.pipe(toObject(function (data) {
  //       assert.strictEqual(data[0], 10);
  //     });
  //     return data;
  //   });

  //   // states.push(clone);
  //   states.push(e.mul().then(function (data) {
  //     assert.strictEqual(data[0], 100);
  //     return data;
  //   }));

  //   states.push(clone.mul().then(function (data) {
  //     assert.strictEqual(data[0], 100);
  //     return data;
  //   }));

  //   return Promise.all(states).catch(function (error) {
  //     console.log(error);
  //     throw error;
  //   });
  // });
});