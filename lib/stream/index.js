module.exports = {
  Stream: require('stream').Stream,
  isReadStream: require('./isReadStream'),
  slice: require('slice-through'),
  BufferToStream: require('./bufferToStream'),
  filter: require('./filter'),
  map: require('./map'),
  forEach: require('./forEach'),
  sort: require('sort-stream'),
  reduce: require('stream-reduce'),
  fromArray: require('./fromArray'),
  peek: require('./peek'),
  through: require('through'),
  toObject: require('./toObject'), // avoid using if possible
};