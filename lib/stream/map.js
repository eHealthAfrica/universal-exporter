var through = require('through');

module.exports = function map(sync) {
  return through(function write(data) {
    this.emit('data', sync(data));
  });
};