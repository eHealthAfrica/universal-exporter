'use strict';
var XlsxExport = require('xlsx-export');
var fs = require('fs');
var debug = require('debug')('exporter:xlsx');

function parse(stream, columns) {
  return new Promise(function (resolve) {
    var map = {};
    var headers = [];

    if (columns) {
      map = columns.reduce(function (acc, curr) {
        var key = Object.keys(curr).pop();
        acc[key] = 'string';
        headers.push({ caption: curr[key] });
        return acc;
      }, {});
    }

    var options = {
      map: map,
      headers: headers,
      stream: stream
    };

    debug('make xlsx object');
    var writer = new XlsxExport(options);
    resolve(writer);
  });
}

function stream(s) {
  return s;
}

function write(data, filename, altfn) {
  if (altfn) { // allows the user to change the filename on the fly
    filename = altfn;
  }

  return data.pipe(fs.createWriteStream(filename));
}

module.exports = {
  parse: parse,
  stream: stream,
  write: write,
  name: 'xlsx',
  mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  version: '2.0.0',
};