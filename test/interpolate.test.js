'use strict';
var interpolate = require('../lib/interpolate.js');
var exporter = require('../lib/exporter.js');
var assert = require('assert');

/*global describe, it, beforeEach*/

describe('interpolate', function () {
  var string = 'name={{name | lc}}&start={{date}}&end={{date}}';
  var date = new Date().toJSON();
  var values = {
    name: 'Napoleon Bonaparte',
    date: date,
  };

  beforeEach(function () {
    exporter.interpolate = {};
    exporter.config = {};
  });

  it('should strip variables that are not found', function () {
    var s = interpolate(string);
    assert.ok(s === 'name=&start=&end=', s);
  });

  it('should interpolate and ignore functions', function () {
    var s = interpolate(string, values);
    assert.ok(s === 'name=' + values.name + '&start=' + date +
      '&end=' + date, s);
  });

  it('should support interpolation with just a single function', function () {
    var now = Date.now();
    exporter.interpolate.now = function () {
      return now; // imagine this would be `Date.now()`
    };
    var string = 'now={{ now }}';
    var s = interpolate(string);

    assert.ok(s === 'now=' + now, s);
  });

  it('should support multiple functions', function () {
    exporter.interpolate.couchFormat = function (date) {
      return '[' + [
          date.getFullYear(),
          date.getMonth() + 1,
          date.getDate(),
        ].join(',') + ']';
    };

    exporter.interpolate.now = function () {
      return new Date('2015-05-14 12:00:00');
    };

    var string = '{{ now | couchFormat }}';
    var s = interpolate(string);

    assert.ok(s === '[2015,5,14]', s);
  });

  it('should support deep objects', function () {
    var string = '{{ my.value.is.deep }}';
    var s = interpolate(string, {
      my: { value: { is: { deep: 'remy' }}}
    });

    assert.ok(s === 'remy', s);
  });

  it('should handle object assignment with function refs', function () {
    exporter.interpolate = {
      json: JSON.stringify,
      escape: encodeURIComponent,
    };

    var data = {
      cats: 'sam nap'.split(' '),
      totalLegs: 8,
    };

    var template = '{{ query | json | escape }}';
    var result = exporter.interpolate(template, { query: data });
    assert.equal(result, escape(JSON.stringify(data)));
  })

  it('should support filtering through functions', function () {
    exporter.interpolate.lc = function (s) {
      return (s || '').toLowerCase();
    };

    var s = interpolate(string, values);
    assert.ok(s === 'name=' + values.name.toLowerCase() + '&start=' + date +
      '&end=' + date, s);

  });
});