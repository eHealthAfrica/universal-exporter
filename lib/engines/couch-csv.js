'use strict';
var Promise = global.Promise || require('es6-promise'); // jshint ignore:line
var JSONStream = require('JSONStream');
var map = require('../stream').map;

function parse(stream) {
  return new Promise(function (resolve, reject) {
    // SUPER IMPORTANT: if the data doesn't have a root of `"rows": []`
    // then *nothing* happens, the stream just goes quiet, it doesn't
    // throw any errors...sadly :'(
    var hasDoc = false;
    var output = stream.pipe(JSONStream.parse('rows.*')).pipe(map(function (data) {

      if (hasDoc) {
        return data.doc;
      }

      if (data.doc) {
        hasDoc = true;
        return data.doc;
      }

      return data;
    }));

    resolve(output);
  });
}

module.exports = {
  parse: parse,
  name: 'couch-csv',
  version: '1.0.0', // via package.json#version one day?
};