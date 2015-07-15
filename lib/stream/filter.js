var through = require('through');

module.exports = function map(sync) {
  var i = 0;
  return through(function write(data) {
    if (sync(data, ++i)) {
      this.emit('data', data);
    }
  });
};