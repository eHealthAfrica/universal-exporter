// based entirely on https://github.com/mimetnet/node-stream-array
'use strict';
var Readable = require('stream').Readable;
var EOL = require('os').EOL;

function fromArray(array) {
  if (!Array.isArray(array)) {
    throw new TypeError('Expected an array');
  }

  if (array.slice(-1) !== EOL) {
    // array.push(EOL);
  }

  Readable.call(this, { objectMode: true });

  this._i = 0;
  this._length = array.length;
  this._array = array;
}

fromArray.prototype = Object.create(Readable.prototype, {
  constructor: {value: fromArray },
});

fromArray.prototype._read = function (size) {
  this.push(this._i < this._length ? this._array[this._i++] : null);
};

module.exports = function (array) {
  return new fromArray(array);
};