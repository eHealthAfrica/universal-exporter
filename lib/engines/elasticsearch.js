'use strict';
var Promise = global.Promise || require('es6-promise'); // jshint ignore:line
var JSONparse = require('JSONStream').parse;
var map = require('../stream').map;
var filter = require('../stream').filter;

function parse(data) {
  return new Promise(function (resolve, reject) {
    var stream = data.pipe(JSONparse('hits.hits.*')).pipe(map(function (data) {
      // this won't happen
      if (data['timed_out']) { // jshint ignore:line
        // shame we can't reject at this point, but alas: we have streams
        throw new Error('Elasticsearch query timed out');
        return null;
      }

      // if there are no fields, then check if there's a source property
      // and then copy across that object instead
      if (!data.fields) {
        if (data._source) {
          return data._source;
        } else {
          return false;
        }
      }

      var result = {};
      Object.keys(data.fields).forEach(function (key) {
        var value = data.fields[key].pop();
        if (key.indexOf('.') !== -1) {
          // the following code will explode out a path like 'a.b.c.d' into
          // { a: { b: { c: {  }}}} - note that it leaves off the last part
          // then we set the (a.b.c)['d'] = value
          // via https://remysharp.com/2008/02/04/javascript-namespaces
          var ns = key.split('.');
          var p = result;
          for (var i = 0; i < ns.length - 1; i++) {
            p = p[ns[i]] = p[ns[i]] || {};
          }

          p[ns[i]] = value;
        } else {
          result[key] = value;
        }
      });
      return result;
    })).pipe(filter(Boolean));

    resolve(stream);
  });
}

module.exports = {
  parse: parse,
  name: 'elasticsearch',
  version: '1.0.0', // via package.json#version one day?
};