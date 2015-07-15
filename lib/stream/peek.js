'use strict';
var through = require('through');

module.exports = function peek(fn) {
  var peeked = false;
  return through(function write(data) {
    this.emit('data', data);
    if (peeked) {
      return;
    }
    peeked = true;
    fn(data);
  });
};