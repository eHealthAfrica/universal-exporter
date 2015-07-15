'use strict';
var exporter = require('../lib/exporter.js');
var assert = require('assert');

describe('exporter', function () {

  beforeEach(function () {
    exporter.interpolate = {};
    exporter.config = {};
  });

  it('should load', function () {
    assert(exporter() !== undefined);
  });

  it('should allow data to be passed directly in', function (done) {
    var mock = [1, 2, 3];

    exporter(mock)._toObject(function (data) {
      assert.deepEqual(data, mock, data);
      done();
    }).catch(function (error) {
      console.log('error', error);
      done(error);
    });
  });

  it('should allow us to catch errors', function () {
    var mock = [1, 2, 3];

    return exporter(mock).then(function (data) {
      throw new Error('ok');
    }).catch(function (error) {
      assert.ok(error.message === 'ok', error.message);
    }).__state;
  })


  it('should support adding plugins', function (done) {
    exporter.plugins.foo = function () {
      assert(true);
      done();
      return this;
    };
    exporter().foo();
  });

  it('should have a global and local config', function () {
    exporter.config = {
      foo: 10,
      bar: 10,
    };

    // config merges with global config, it doesn't overwrite
    var e = exporter().config({
      foo: 20,
    });

    // modified exporter object don't override global values
    assert(e.settings.foo === 20, 'foo actual: ' + JSON.stringify(e.settings));
    assert(e.settings.bar === 10, 'bar actual: ' + JSON.stringify(e.settings));
    // new exporter objects have foo = 10
    assert(exporter().settings.foo === 10, 'top.foo actual: ' + JSON.stringify(exporter().settings));
  });


});