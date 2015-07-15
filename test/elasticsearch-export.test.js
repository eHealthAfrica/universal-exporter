'use strict';
var exporter = require('../lib/exporter.js');
var assert = require('assert');
var ejs = require('elastic.js');
var stream = require('../lib/stream');
var http = require('http');

/*global describe, it, beforeEach*/
// function toStream(data) {
//   // jumping through all the hoops just to get the data to look similar
//   // to an http streaming respone...
//   return new stream.BufferToStream(new Buffer(JSON.stringify(data)));
// }

describe('engine: elasticsearch-export', function () {

  // var esToArray = function (data) {
  //   var res = exporter.engines.elasticsearch(toStream(data));
  //   return res;
  // };
  var port = null;
  var mock;

  beforeEach(function (done) {
    var server = http.createServer(function (req, res) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(mock));
    });
    server.listen(0);
    server.on('listening', function () {
      port = server.address().port;
      done();
    });

    exporter.interpolate = {
      json: JSON.stringify,
      escape: encodeURIComponent,
    };
    exporter.config = require('./fixtures/config.json');
    exporter.config.$root = process.env.ES_HOST || 'http://localhost:9200/';
  });

  it('should support nested field response', function () {
    exporter.iterators.boolAsText = function (row) {
      Object.keys(row).map(function (key) {
        if (typeof row[key] === 'boolean') {
          row[key] = row[key] ? 'TRUE' : 'FALSE';
        }
      });
      return row;
    };

    mock = require('./fixtures/data-elasticsearch.json');

    // this is a mock ES call (manually passing into the ES engine)
    return exporter()
      .config({
        blogs: {
          $root: 'http://localhost:' + port + '/'
        }
      })
      .get
      .blogs
      .search()
      .columns([
        'createdBy.fullName: Call: Created by',
        'createdOn: Call: Date',
      ])
      .boolAsText()
      .save('file.csv', 'csv', ';')
      .then(function (saver) {
        return new Promise(function (resolve) {
          saver.data.pipe(stream.toObject(function (data) {
            assert.equal(data.shift().trim(), 'Call: Created by;Call: Date');
            assert.notEqual(data.shift(), ';');
            resolve();
          }));
        });
      }).__state;
  });

  it('should get data from local elasticsearch', function (done) {
    var dsl = ejs.Request()
          .query(ejs.MatchQuery('speaker', 'KING HENRY IV'));

    exporter().get.blogs.search({
      query: dsl.toJSON(),
    }).then(function (data) {
      data.pipe(stream.toObject(function (data) {
        assert.ok(data.length > 1, data.length);
        done();
      }));
    }).catch(function (error) {
      done(error);
    });
  });

  it('should work when fields are missing', function (done) {
    mock = {
      hits: {
        hits: [
          { fields: { one: [1] } },
          { fields: { two: [1] } },
          {},
        ]
      }
    };

    return exporter()
      .config({
        blogs: {
          $root: 'http://localhost:' + port + '/'
        }
      })
      .get
      .blogs
      .search()
      .then(function (data) {
        data.pipe(stream.toObject(function (data) {
          assert.equal(data.length, 2);
          done();
        }));
      }).catch(function () {
        console.log('error');
      });
  });

  it('should support real requests', function (done) {
    var headings = require('./fixtures/headings');
    mock = require('./fixtures/data-elasticsearch.json');

    exporter()
      .config({
        blogs: {
          $root: 'http://localhost:' + port + '/'
        }
      })
      .columns(headings)
      .save('file.csv')
      .then(function (saver) {
        done();
      });
  })

  it('should save data from local elasticsearch', function () {
    var sep = ';';
    var headings = 'speaker' + sep + 'play_name';
    var dsl = ejs.Request()
          .query(ejs.MatchQuery('speaker', 'KING HENRY IV'))

    return exporter().get.blogs.search({
      query: dsl.toJSON(),
    })
    .then(function (data) {
      data.pipe(stream.toObject(function (data) {
        assert.ok(data.length > 1, data.length);
      }));
      return data;
    })
    .columns(headings.split(sep))
    .save('test.csv', 'csv', sep)
    .then(function (saver) {
      return new Promise(function (resolve) {
        saver.pipe(stream.toObject(function (data) {
          data = data.shift().split('\n');
          assert.deepEqual(headings, data[0]);
          resolve();
        }));
      });
    }).__state;
  });
});