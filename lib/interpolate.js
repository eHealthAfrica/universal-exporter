'use strict';
module.exports = interpolate;

// note: exporter is the object constructor, not an instance
function interpolate(string, values) {
  if (!values) {
    values = {};
  }

  return (string || '').replace(/({{.*?}})/g, function (all, match) {
    var key = match.slice(2, -2); // ditch the wrappers
    var parts = key.split('|').map(trim);
    // exit function with interpolate string through functions
    return parts.reduce(function (prev, curr) {
      var value = pluck(curr, values);
      if (value) {
        prev = value;
      } else if (typeof interpolate[curr] === 'function') {
        prev = interpolate[curr](prev);
      }
      return prev;
    }, '');
  });
}

function pluck(path, values) {
  path = path.split('.');
  return path.reduce(function (prev, curr) {
    if (prev && prev[curr]) {
      return prev[curr];
    }
    return undefined;
  }, values);
}

function trim(s) {
  return s.trim();
}