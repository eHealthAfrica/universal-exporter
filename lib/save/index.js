'use strict';
var BufferToStream = require('../stream/bufferToStream');
var fs = require('fs');
var toObject = require('../stream').toObject;

var scope = typeof self === 'undefined' ? global : self;

var support = {
  blob: 'FileReader' in scope && 'Blob' in scope && (function () {
    try {
      new Blob();
      return true
    } catch (e) {
      return false
    }
  })(),
}

function saveAs(data, lib, callback) {
  var res = new Buffer('');
  data.on('data', function (data) {
    res += data;
  }).on('end', function () {
    callback('data:' + (lib.mime || 'text/plain') + ';charset=' +
      (lib.charset || 'utf-8') + ';base64,' +
      new Buffer(res).toString('base64'));
  });
}

function saver(filename, data, lib) {
  return {
    data: support.blob ? new Blob([data]) : data,
    filename: filename,
    mime: lib.mime,
    base64: saveAs.bind(null, data, lib),
    write: lib.write ? lib.write.bind(null, data, filename) : function (alt) {
      return data.pipe(fs.createWriteStream(alt || filename));
    },
    stream: function () {
      return lib.stream ?
        lib.stream(data) :
        new BufferToStream(new Buffer(data));
    },
    pipe: data.pipe ? function (stream) {
      return data.pipe(stream);
    } : function (stream) {
      new BufferToStream(new Buffer(data)).pipe(stream);
    },
  };
}

function createSaver(lib) {
  return function (data, columns, filename) {
    var args = [].slice.apply(arguments);
    return lib.parse.apply(null, args).then(function (data) {
      return saver(filename, data, lib);
    });
  }
}

module.exports = {
  csv: createSaver(require('./csv')),
  json: createSaver(require('./json')),
  xlsx: createSaver(require('./xlsx')),
};