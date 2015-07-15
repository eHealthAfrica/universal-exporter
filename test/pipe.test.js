'use strict';
var exporter = require('../lib/exporter.js');
var assert = require('assert');
var stream = require('stream');

describe('savers', function () {
  it('should allow pipe setup before saving', function (done) {
    var mock = [1, 2, 3, 4];
    var expected = JSON.stringify(mock);

    var res = new Buffer('');
    var out = new stream.Writable();
    out._write = function (chunk, encoding, fin) {
      res += chunk;
      fin();
    };

    out.on('finish', function () {
      // chunk is a buffer, so we have toString-ify it
      // and compare against a JSON version of our mock
      // since we ran it through the JSON saver
      assert.deepEqual(res.toString(), expected, res.toString());
      done();
    });

    exporter(mock)
      .pipe(out)
      .save('my-file.json')
      .catch(function (error) {
        done(error);
      });
  });

  it('should send base64 data when ready', function (done) {
    var mock = [1, 2, 3, 4];
    var expected = new Buffer(JSON.stringify(mock)).toString('base64');

    exporter(mock)
      .base64(function (data) {
        assert.equal(data.split(',', 2).pop(), expected, data);
        done();
      })
      .save('my-file.json')
      .catch(function (error) {
        done(error);
      });
  });
});