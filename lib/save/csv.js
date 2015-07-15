'use strict';
var csv = require('csv-write-stream');
var fs = require('fs');

function parse(stream, columns, filename, sep) {
  var cols = columns ? columns.map(function (col) {
    var key = Object.keys(col).pop();
    return col[key];
  }) : undefined;

  var writer = csv({
    separator: sep || ',',
    newline: '\n',
    headers: cols,
    // sendHeaders: false,
  });

  return new Promise(function (resolve) {
    stream.pipe(writer);
    resolve(writer);
  });
}

function stream(s) {
  return s;
}

module.exports = {
  parse: parse,
  stream: stream,
  name: 'csv',
  mime: 'text/csv',
  version: '1.0.0',
};