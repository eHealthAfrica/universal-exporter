'use strict';
var exporter = require('../lib/exporter.js');
var assert = require('assert');
var ejs = require('elastic.js');
var fs = require('fs');
var stream = require('../lib/stream');

function toStream(data) {
  // jumping through all the hoops just to get the data to look similar
  // to an http streaming respone...
  return new stream.BufferToStream(new Buffer(JSON.stringify(data)));
}

describe('xlsx saving', function () {
  var esData;

  beforeEach(function () {
    esData = toStream(require('./fixtures/data-elasticsearch.json'));
    exporter.interpolate = {
      json: JSON.stringify,
      escape: encodeURIComponent,
    };
    exporter.config = require('./fixtures/config.json');
  });

  afterEach(function (done) {
    fs.unlink('my-file.xlsx', done);
  });

  it('should write a file to disk', function (done) {
    var dsl = ejs.Request()
          .query(ejs.MatchQuery('body', 'require'))
          .fields('title,date'.split(','))

    exporter().get.blogs.search({
      query: dsl.toJSON(),
    })
    .columns([
      'title: Blog title',
      'date: Post date',
    ])
    .save('my-file.xlsx', 'xlsx')
    .then(function (saver) {
      saver.write();
      done();
    }).catch(function (error) {
      done(error);
    });
  });

  it('should write complex data to disk', function (done) {
    exporter.iterators.actionsRequired = require('../plugins/actions-required');
    exporter(esData)
      .then(exporter.engines.elasticsearch)
      .columns(require('./fixtures/headings'))
      // .slice(154, 155) // used to test a specific slice of data
      .actionsRequired()
      .save('my-file.xlsx', 'csv')
      .then(function (saver) {
        var out = fs.createWriteStream(saver.filename);
        saver.pipe(out);
        // FIXME double check the output?

        done();
      }).catch(function (error) {
        done(error);
      });
  });

  it('should support chained write method', function () {
    var dsl = ejs.Request()
          .query(ejs.MatchQuery('body', 'require'))
          .fields('title,date'.split(','))

    return exporter().get.blogs.search({
      query: dsl.toJSON(),
    })
    .columns([
      'title: Blog title',
      'date: Post date',
    ])
    .save('my-file.xlsx', 'xlsx')
    .write()
    .then(function (saver) {
      saver.data.on('finish', function () {
        assert.ok(fs.existsSync('my-file.xlsx'), 'check if file exists');
      });
    });
  });
});