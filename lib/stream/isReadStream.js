var Stream = require('stream').Stream;
module.exports = function isReadStream(obj) {
  return obj instanceof Stream &&
    typeof (obj._read === 'function') &&
    typeof (obj._readableState === 'object');
};
