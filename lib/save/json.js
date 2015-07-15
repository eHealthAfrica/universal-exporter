'use strict';

var fs = require('fs');
var stringify = require('JSONStream').stringify;

function parse(stream) {
  return new Promise(function (resolve) {
    resolve(stream.pipe(stringify('[', ',', ']')));
  });
}

function stream(s) {
  return s;
}

module.exports = {
  parse: parse,
  name: 'json',
  mime: 'application/json',
  version: '1.0.0',
};