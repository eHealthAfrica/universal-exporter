'use strict';

/*globals fetch, Promise */

require('es6-promise').polyfill();
require('isomorphic-fetch');

var clone = require('lodash.clonedeep');
var merge = require('lodash.merge');
var crypto = require('crypto'); // only used by node + remote
var interpolate = require('./interpolate');
var debug = require('debug')('exporter');

// stream utilities: map, slice, filter
var stream = require('./stream');

// note: `export` is a reserved word!
var exporter = module.exports = function (data) {
  if (!(this instanceof exporter)) {
    return new exporter(data);
  }

  debug('new exporter');

  // internal promise tracking - please don't meddle with this it used to be
  // privately scoped, but that would lead to a memory leak, so it's kept
  // inside our object so GC will throw away the promise once it goes out
  // of scope.
  if (stream.isReadStream(data)) {
    this.__data = data;
  } else {
    // try to convert from an array
    this.__data = stream.fromArray(data || []);
  }

  this.__state = Promise.resolve(this.__data);

  this.__remote = false;

  // .get is configured when the config is loaded
  this.settings = {};

  // things to do after we've created a savable export object
  this.__postSave = {};

  // create local copies of the config
  this.config(clone(exporter.config));

  // if any iterators have been added, then update the prototype chain and
  // plug them in. Sorry, this is magic.
  updatePrototype();

  debug('created');
};

exporter.version = require('../package.json').version;

// engines exposed for testing
var engines = exporter.engines = require('./engines');
var savers = exporter.savers = require('./save');

var plugins = exporter.plugins = exporter.prototype = {};

// used to set iterators
exporter.iterators = {};

// this is primarily used to expose remote utilities to the server
exporter.utils = {};

// used to *get* iterators
plugins.iterators = {};

// used to hang config methods off of
plugins.get = {};

// array like methods (that act on streams...)
'filter map slice reduce _toObject forEach'.split(' ').map(function (method) {
  plugins[method] = arrayMethod(method);
});

function arrayMethod(method) {
  return function () {
    var args = [].slice.call(arguments);
    if (this.__remote) {
      this.__remote.chains.push({
        method: method,
        args: args.map(function (arg) {
          return arg.toString();
        }),
        type: 'native',
      });
    }

    method = method.replace(/^_/, '');

    debug('%s queued', method);

    return this.then(function (data) {
      debug('%s running', method);
      return data.pipe(stream[method].apply(null, args));
    });
  };
}

plugins.remote = function (remote) {
  if (typeof process === 'undefined') {
    console.warn('.remote is not intended for a browser setting: consider aborting');
  }

  var signatures = this.settings.signatures || [];
  var devSignatures = [];
  var utils = '';

  this.config({
    remote: {
      $engine: remote.engine,
      $root: remote.root,
      $methods: {
        get: remote.get,
      },
    },
  });

  this.get.remote.get({ $request: remote.request });

  if (remote.columns) {
    this.columns(remote.columns);
  }

  // this is important: we create a chain of promises (that stack on top of each
  // other), each resolving with the transformed data. We "safely" execute
  // untrusted code (i.e. from the client call) by running it through
  // `sandcastle` - which uses `spawn` and the `vm` module to run code in a
  // separate process to isolate execution (i.e. so if can't go pinching memory
  // from our main process).
  // this code is what allows the developers to write their code as if it were
  // executing on the client, and with one additional config setting ($remote)
  // their code is collected and run against the server (that lives at $remote).
  return this.then(function (data) {
    // first check the util functions
    if (remote.utils) {
      utils = 'var exporter = { utils: { ';
      utils += Object.keys(remote.utils || []).map(function (key) {
        var code = remote.utils[key];
        // will throw if there's an error
        checkSignature(code, signatures, devSignatures);

        return key + ': ' + code;
      }).join(',') + '} };\n';
    }

    debug('running ' + remote.chains.length + ' remote functions');

    return remote.chains.reduce(function (prev, curr) {
      return prev.then(function (data) {
        return new Promise(function (resolve) {
          var head = utils + '\nreturn (';
          var tail = '(data))';
          var code = curr.method;

          if (curr.type === 'native') {
            code = 'function(data){return data.pipe(stream.' + code + '(' + curr.args.join(',') + '))}';
          }

          // will throw if there's an error
          var hash = checkSignature(code, signatures, devSignatures);

          debug('remote call...');

          // debug(head + code + tail)

          // if we got this far, then either we're in development mode
          // or the function signature is good to use.
          var f = new Function('data', 'self', 'stream', head + code + tail); // jshint ignore:line

          resolve(f(data, [], stream));
        });
      });
    }, Promise.resolve(data)).then(function (data) {
      if (devSignatures.length) {
        console.log('Function signatures:\n', devSignatures.join('\n'));
      }
      return data;
    });
  });
};

plugins.config = function (config) {
  merge(this.settings, config);
  bootconfig(this, this.settings);
  return this;
};

plugins.columns = function (columns) {
  this.__columns = parseColumns(columns);
  return this;
};

// FIXME unsure we can support this anymore...
plugins.clone = function () {
  return new exporter(this.__state.then(function (data) {
    return clone(data);
  }));
};

plugins.save = function (filename, type) {
  var args = [].slice.call(arguments, 2); // anything afterwards
  if (!type) {
    type = (filename || '').split('.').slice(-1).pop();
  }

  if (!savers[type]) {
    throw new Error('Saver "' + type + '" format not supported');
  }

  var self = this;
  if (typeof self.columns !== 'function') {
    self.__columns = parseColumns(self.columns);
  }
  var columns = self.__columns;

  if (!columns) { // if no instance columns, try at the root object
    columns = exporter.columns;
  }

  if (this.__remote) {
    // send the payload to the remote server
    var remote = this.__remote;
    delete this.__remote;
    remote.utils = Object.keys(exporter.utils).reduce(function (prev, curr) {
      prev[curr] = exporter.utils[curr].toString();
      return prev;
    }, {});
    remote.columns = columns || null;
    remote.saver = {
      filename: filename,
      type: type,
      args: args,
    };

    return fetch(remote.url, {
      credentials: 'include',
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(remote),
    }).then(function (res) {
      // should return ways to download the data (via a 2nd call???)
      return res[res.blob ? 'blob' : 'text']().then(function (blob) {
        var saver = {
          data: blob,
          length: blob.length,
          filename: filename,
          mime: res.headers.get('content-type'),
        };

        return saver;
      });
    });
  } else {
    this.__nostatesave = true; // don't treat this as a data chain
    debug('begin saver');
    return this.then(function (data) { // data is a stream of data
      self.__saved = true;

      // map the data stream through into the columns that we need
      var prepared = columns ? prepareForExport(data, columns || {}) : data;

      // save arguments: data, columns, filename[, everything else]
      args.unshift(filename);
      args.unshift(columns);
      args.unshift(prepared); // so data is passed in first
      return savers[type].apply(null, args).then(function (saver) {
        debug('saver configured');
        saver.data.on('finish', function () {
          debug('stream finished');
        });

        Object.keys(self.__postSave).forEach(function (key) {
          saver[key].apply(null, self.__postSave[key]);
        });
        return saver;
      });
    });
  }
};

plugins.pipe = function () {
  this.__postSave.pipe = [].slice.apply(arguments);
  return this;
};

plugins.write = function () {
  this.__postSave.write = [].slice.apply(arguments);
  return this;
};

plugins.base64 = function () {
  this.__postSave.base64 = [].slice.apply(arguments);
  return this;
};


plugins.then = function (ok, fail) {
  // keep replacing the thenable with the next
  var self = this;

  // debug('new thenable', ok.name || '');

  this.__state = this.__state.then(
    ok.bind(this), fail ? fail.bind(this) : undefined
  ).then(function (data) {
    if (!self.__nostatesave) {
      // self.__data = data;
    } else {
      delete self.__nostatesave;
    }
    return data;
  });
  return this;
};

plugins.catch = function (fail) {
  this.__state = this.__state.catch(fail.bind(this));
  return this;
};

// global access points
exporter.config = {};

Object.defineProperty(exporter, 'interpolate', {
  get: function () {
    return interpolate;
  },
  set: function (object) {
    Object.keys(exporter.interpolate).forEach(function (key) {
      delete exporter.interpolate[key];
    });

    Object.keys(object).forEach(function (key) {
      exporter.interpolate[key] = object[key];
    });
  },
});

// helper functions
function parseColumns(columns) {
  if (typeof columns === 'string') {
    // turn it it into an array of key/values
    columns = columns.split('\n').map(function (line) {
      // okay, so ES7 would be pretty awesome here.
      var parts = line.trim().split(':');
      var key = parts.shift().trim();
      var value = parts.join(':').trim();
      var result = {};
      result[key] = value;
      return result;
    });
  }

  if (!Array.isArray(columns)) {
    throw new Error('.columns expects either a string mapping of columns or an array. See README for examples');
  }

  if (typeof columns[0] === 'string') {
    // assume the columns is an array of strings
    columns = columns.map(function (line) {
      // okay, so ES7 would be pretty awesome here.
      var parts = line.trim().split(':');
      var key = parts.shift().trim();

      // allow a simple
      var value = parts.join(':').trim() || key;
      var result = {};
      result[key] = value;
      return result;
    });
  }

  return columns;
}

function checkSignature(code, signatures, devSignatures) {
  var hash = crypto.createHash('sha1').update(code).digest('hex');
  var production = process.env.NODE_ENV === 'production';
  if (production && signatures.indexOf(hash) === -1) {
    throw new Error('Function signature not recognised for `' + code + '` - aborting');
  } else if (!production) {
    devSignatures.push(hash);
  }

  return hash;
}

function updatePrototype() {
  // iterate the exporter.iterate functions and mark them once attached
  Object.keys(exporter.iterators).map(function (key) {
    if (plugins[key] && plugins[key].__marked) {
      return null; // skip ones we've done
    }

    if (plugins[key]) {
      console.warn('exporter: overwriting existing method `' + key + '`');
    }

    var plugin = function () {
      var self = this;
      var fn = function (data) {
        return self.__data = data.pipe(stream.map(function (item) { // jshint ignore:line
          var result = exporter.iterators[key].call(item, item);
          if (result !== undefined) {
            return result;
          }

          return item;
        })).pipe(stream.filter(function (value) {
          return value !== false;
        }));
      };
      this.then(fn).catch(catchAndSwallow);

      if (this.__remote) {
        var iterator = '(' + exporter.iterators[key].toString() + ')';
        this.__remote.chains.push({
          method: fn.toString().replace('exporter.iterators[key]', iterator),
          type: 'function',
        });
      }
      return this;
    };

    plugin.__marked = true;

    plugins[key] = plugin;
  });
}

function catchAndSwallow(error) {
  console.log(error.stack.split('\n').slice(0, 2).join('\n'));
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

function prepareForExport(data, columns) {
  var rowColumns = [];
  // var keys = columns.map(function (heading) {
  //   var key = Object.keys(heading).shift();
  //   rowColumns.push(heading[key]);
  //   return key.split('.');
  // });

  var keys = columns.map(function (heading) {
    return Object.keys(heading).shift();
  });

  return data.pipe(stream.map(function (doc) {
    if (typeof doc !== 'object') {
      // we're working with a primative, which isn't expected...abort
      console.error('unexpected non-object in stream');
      return doc;
    }

    var result = keys.reduce(function (acc, curr) {
      acc[curr] = pluck(curr, doc);
      return acc;
    }, {});

    return result;


    var result = keys.map(function (key) {
      return key.reduce(function (prev, curr, i) {
        // if we're at the tip
        if (i === key.length - 1) {
          return prev[curr] === undefined ? '' : prev[curr];
        }
        return prev[curr] || {};
      }, doc);
    });

    return result;
  }));
}

function bootconfig(instance, config) {
  // TODO add validation to the config
  // - $method, $engine
  Object.keys(config).forEach(function (key) {
    // FIXME unsure if we need this extra grouping level
    instance.get[key] = {}; // grouping level
    if (typeof config[key] === 'object' && config[key].$methods) {
      Object.keys(config[key].$methods).forEach(function (method) {
        var callback = function (options) {
          if (!options) {
            options = {};
          }
          // dynamically construct this url in case the config change
          // at the global level...
          var engine = config[key].$engine || config.$engine;
          var remote = config[key].$remote || config.$remote || false;

          var root = config[key].$root || config.$root;
          var url = (config[key].$path || '') + config[key].$methods[method];
          var target = interpolate(url, options);

          var request = options.$request || { method: 'GET' };

          if (!remote) {
            instance.then(function () {
              if (!engines[engine]) {
                throw new Error('engine "' + engine + '" not supported');
              }
              debug('begin fetch', root + target);
              return fetch(root + target, request).then(function (res) {
                debug('fetch response: %s', res.status);
                if (res.status >= 400) {
                  throw new Error('Bad response from server: ' + res.status);
                }

                // important to note that we're returning the stream
                return res.body;
              }).then(engines[engine]);
            });
          } else {
            instance.__remote = {
              url: remote,
              request: request,
              root: root,
              get: target,
              engine: engine,
              chains: [],
            };
          }

          return instance;
        };
        instance.get[key][method] = callback;
      });
    }
  });
}