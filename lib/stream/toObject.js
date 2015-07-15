'use strict';
var through = require('through');

module.exports = function toObject(fn) {
  var results = [];
  return through(function write(data) {
    this.emit('data', data);
    results.push(data);
  }, function () {
    fn(results);
  });
};