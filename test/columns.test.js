'use strict';
var exporter = require('../lib/exporter.js');
var assert = require('assert');
var toObject = require('../lib/stream').toObject;

describe('columns', function () {

  var mock;

  beforeEach(function () {
    mock = [{
      name: 'nap',
      version: 1,
      type: {
        species: 'cat',
        legs: 4,
      },
    }, {
      name: 'sam',
      version: 1,
      type: {
        species: 'cat',
        legs: 4,
      },
    }, {
      firstname: 'prince',
      version: 0.1,
      type: {
        species: 'cat',
        legs: 4,
      },
    }];
    exporter.interpolate = {};
    exporter.config = {};
  });

  it('should add columns and pluck defined fields', function () {
    var columns = [{
      name: 'Name',
    }, {
      version: 'App Version',
    },];

    return exporter(mock)
      .columns(columns)
      .slice(0, 1)
      .save('my-file', 'csv')
      .then(function (saver) {
        saver.data.pipe(toObject(function (data) {
          assert.deepEqual(data, 'Name,App Version\nnap,1');
        }))
      })
      .__state;
  });

  it('should allow for an array of strings', function () {
    var columns = ['name', 'version'];

    return exporter(mock)
      .columns(columns)
      .slice(0, 1)
      .save('my-file', 'csv')
      .then(function (saver) {
        saver.data.pipe(toObject(function (data) {
          assert.deepEqual(data, 'name,version\nnap,1');
        }));
      })
      .__state;
  });

  it('should allow for an array of mapping strings', function () {
    var columns = ['name: Name', 'version: Cat Version'];

    return exporter(mock)
      .columns(columns)
      .slice(0, 1)
      .save('my-file', 'csv')
      .then(function (saver) {
        saver.data.pipe(toObject(function (data) {
          assert.deepEqual(data, 'Name,Cat Version\nnap,1');
        }));
      })
      .__state;
  });

  it('should add columns using a string', function () {
    var columns = 'name: Name\nversion: App Version';

    return exporter(mock)
      .columns(columns)
      .slice(0, 1)
      .save('my-file', 'csv')
      .then(function (saver) {
        saver.data.pipe(toObject(function (data) {
          assert.deepEqual(data, 'Name,App Version\nnap,1');
        }));
      })
      .__state;
  });
});