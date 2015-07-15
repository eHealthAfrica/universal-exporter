'use strict';
var exporter = require('../lib/exporter.js');
var assert = require('assert');
var _ = require('lodash');

describe('config', function () {
  var url = 'http://localhost:1337';

  beforeEach(function () {
    exporter.config = {};
  });

  it('should read a global config', function () {
    var config = exporter.config = require('./fixtures/config.json');
    var e = exporter();
    assert.deepEqual(e.settings, config, 'config match');
  });

  it('should allow for instance config values', function () {
    var e = exporter().config({
      $root: url,
    });
    assert.deepEqual(e.settings, { $root: url }, 'config match');
  });

  it('should shallow merge', function () {
    var config = exporter.config = require('./fixtures/config.json');
    var e = exporter().config({
      $root: url,
    });

    var copy = _.cloneDeep(config);
    copy.$root = url;

    assert.deepEqual(e.settings, copy);
  });

  it('should deep merge and maintain surrounding structure', function () {
    var config = exporter.config = require('./fixtures/config.json');
    var e = exporter().config({
      participants: {
        $methods: {
          custom: url,
        },
      },
    });

    var copy = _.cloneDeep(config);
    copy.participants.$methods.custom = url;

    assert.deepEqual(e.settings, copy);
  });

});