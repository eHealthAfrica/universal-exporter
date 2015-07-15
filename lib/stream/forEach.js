var through = require('through');

module.exports = function forEach(fn) {
  var i = 0;
  return through(function forEach(data) {
    this.emit('data', data);
    fn(data, i);
    i++;
  });
};