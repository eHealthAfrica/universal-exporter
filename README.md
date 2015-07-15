# exporter

The universal exporter is intended as a module to export complete datasets from a number of different backends using a simple to use, and simple to extend, API.

Internally the `exporter` relies internally on streams and heavily on [promises](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise).

The module can be used both on the client and server (or both using the [remote](#remote-server-calls) feature).

- [Overview of usage](#overview-of-usage)
- [Example](#example)
- [Current supported engines & export targets](#current-supported-engines--export-targets)
- [API](#api)
- [Static methods](#static-api)
- [Instance methods](#instance-methods)
- [Remote server calls](#remote-server-calls)
- [Configuration](#configuration)
- [Passing custom headers in requests](#passing-custom-headers-in-requests)
- [Errors](#errors)
- [TODO / wishlist](#todo--wishlist)

## Overview of usage

In general, developer usage of the exporter library will be as follows:

- Configure the `exporter` object
- Create a new `exporter` instance
- Call a data loading method
- Manipulate the data, `filter`ing, `map`ping, adding `columns`, etc
- `save` to an output format
- Finally define where the saved data should go (download, piped stream, etc)

All function calls will return the *current* instance allowing for a chaining call. Note that this different, for example, to jQuery, whereby each chained call returns a *new instance*. This is not the case for exporter.

Note that [`.save()`](#savefilename-type) is the only method that does not return a thenable containing the data. Otherwise all calls, return a thenable version of the exporter that keeps returning the internal dataset.

## Example

```js
exporter.config = require('./exporter-config.json');
exporter.iterators = require('./iterator-plugins');

function exportData(filename, dsl) {
  exporter()
    .get.callcenter.search({ query: dsl })
    .columns([
      'createdOn: Created Date',
      'participant.symptoms: Case Symptoms',
      // etc...
    ])
    .upgradeDocVersion() // example iterator
    .save(filename)
    .write(filename);
}
```

The exporter will typically load data from a remote resource as defined by the configuration. However, the exporter can also be instantiated with an initial dataset:

```js
exporter(data)
  .columns(columns)
  .upgradeDocVersion()
  .save(filename + '.xlsx')
  .then(function (saver) {
    // now make the browser download the exported file
    saver.write(saver.filename);
  });
```

## Current supported engines & export targets

* Engines: couch-csv, elasticsearch
* Export targets: csv, xlsx, json

Engines can be specified in the [configuration](#configuration).

Export targets are specified in the [`.save()`](#savefilename-type) method, either detected from the filename or can be specified.

## API

### Static

- [`.config`](#config)
- [`.engines`](#engines)
- [`.columns`](#columns)
- [`.interpolate`](#interpolate)
- [`.iterators`](#iterators)
- [`.plugins`](#plugins)
- [`.savers`](#savers)
- [`.utils`](#utils)

### Instance

- [`.config()`](#config-1)
- [`.clone()`](#clone)
- [`.columns` & `.columns`](#columns--columns)
- [`.save(filename[, type])`](#savefilename-type)
- [`.remote()`](#remote)
- [`.then(onFulfilled[, onRejected])`](#thenonfulfilled-onrejected)
- [`.catch(onRejected)`](#catchonrejected)
- [`.sort(fn)`](#instance-array-like-methods)
- [`.filter(fn)`](#instance-array-like-methods)
- [`.map(fn)`](#instance-array-like-methods)
- [`.slice([begin[, end]])`](#instance-array-like-methods)
- [`.reduce(fn[, initialValue])`](#instance-array-like-methods)
- [`.get`](#get)

## Static API

### `.config`

The `exporter.config` is an property object that can be assign a [configuration](#configuration) and all new instances of the exporter will contain this configuration by default.

```js
// import a config wholesale
exporter.config = require('./exporter-config.json');

// or configure a single point
exporter.config.$root = 'https://' + user + ':' + pass + '@localhost:1234';
```

### `.engines`

When the configuration loads data from a remote URL, the response is put through an *engine*, such as a couchdb or elasticsearch (the two default engines provided with exporter).

An engine must export a function that receives the raw data from the source, that returns a promise that fulfils with an array. This can be then attached to `exporter` as seen in this contrived example:

```js
var JSONStream = require('JSONStream');

var jsonEngine = function (stream) {
  return new Promise(function (resolve, reject) {
    resolve(stream.pipe(JSONStream.parse());
  });
};

exporter.engines.json = jsonEngine;
```

See [couch-csv.js](https://github.com/eHealthAfrica/universal-exporter/blob/master/lib/engines/couch-csv.js) and [elasticsearch.js](https://github.com/eHealthAfrica/universal-exporter/blob/master/lib/engines/elasticsearch.js) for more examples.

### `.columns`

To set default columns for new exporter instances, the `exporter.columns` property can be set. The heading value is a mapping of source data properties to the desired columns that would appear on an exported Excel file or CSV file for instance.

```js
exporter.columns = [
  'name: Customer name',
  'location: City'
];
```

Note that if an exporter instance set it's own columns, static columns are not used.

### `.interpolate`

When the configuration is transformed to a function call, the `$methods` can receive an object for string interpolation using `{{` and `}}` to enclose an expression.

Methods can be added to `exporter.interpolate` and can then be used in the expressions.

If a value or method is not found, the interpolation returns an empty string. Real values take precedence over functions during interpolation.

The following adds two new functions to the interpolation:

```js
exporter.interpolate.couchFormat = function (date) {
  return '[' + [
  date.getFullYear(),
  date.getMonth() + 1,
  date.getDate(),
  ].join(',') + ']';
};
exporter.interpolate.now = Date;
exporter.interpolate.json = JSON.stringify;
exporter.interpolate.escape: encodeURIComponent;
```

These can be used as such (where `date` is a user defined value, which can be seen next):

```text
{{ date | couchFormat }}    // converts user provided date object to couch date
{{ now | couchFormat }}     // inserted "today" as couch data
{{ query | json | escape }} // converts "query" (a JS object) to JSON then escapes to URL encoded
```

### `.iterators`

Iterators are plugins that have similar functionality to the `.map` and `.sort` functions, but they can be defined by the author.

To define a new iterator, the `exporter.iterators` property is added to. Note that this happens on the static `exporter` object, not the instance. To use the iterator, the method exists at the root level of the instance object (as seen in the example below).

```js
// define a new iterator
exporter.iterators.boolAsText = function (row) {
  Object.keys(row).map(function (key) {
    if (typeof row[key] === 'boolean') {
      row[key] = row[key] ? 'TRUE' : 'FALSE';
    }
  });

  return row;
};

// using the iterator
exporter()
  .get.participants.all()
  .boolAsText()
  .save('my-file.csv');
```

#### Iterator return values

What the author code returns can be somewhat *magical*. Return values can be:

- `undefined`: or don't return a value from the iterator, and the row remains unchanged
- `false`: the row is removed from the data (similar to a `.filter`)
- `<new object>`: the data is updated with the new row record


### `.plugins`

Plugins give access directly to the exporter `prototype` chain. Akin to jQuery's `.fn`, developers can hang their own functionality off the `.plugins` property and exporter instances will have access to the method.

To maintain the chainability that the exporter has, a plugin must return `this`. To access and work with the dataset, the plugin can (or ideally, *should*) use (and return) `this.then(fn)`.

If the plugin uses a promise to access the data, it is **important that the return value of the promise is the data you wish to maintain inside the exporter**. If the plugin does not `return` (or returns `undefined`), the internal dataset will have the value of `undefined` (which will cause all manners of confusion!).

This example plugin will log out the total length of the dataset and support the existing chaining functionality of the exporter:

```js
exporter.plugins.count = function () {
  // this.then returns `this` so our code will continue to chain
  return this.then(function (data) {
    console.log(data.length);
    // we didn't change the data, so let's return it as it was
    return data;
  });
};

exporter().get.participants.all().count();
```

### `.savers`

**TODO** test and document

### `.utils`

`exporter.utils` is a hanging place for utility functions that might be used inside of iterators. This is only useful when making use of [remote](#remote) calls as iterators *cannot* support use of closures in the remote setting, and as such, the utility method must not use any closures.

The (contrived) example below shows how the utility would be used. Note that this is only useful if there's a function being reused throughout your code.

```js
exporter.utils.boolAsString = function (b) {
  return b ? 'TRUE' : 'FALSE';
};

exporter.iterators.boolAsText = function (row) {
  Object.keys(row).map(function (key) {
    if (typeof row[key] === 'boolean') {
      row[key] = exporter.utils.boolAsString(row[key]);
    }
  });

  return row;
};
```

## Instance methods

### `.config(object)`

Instances can have their own configurations. The config object passed in will be merged with the existing (static) config (if any has been set).

```js
exporter.config({
  $root: window.location.protocol + '//' + window.location.host,
  participants: {
    $methods: {
      today: '?startkey=[2015,05,21]&endkey=[2015,05,21]'
    }
  }
});
```

Now new exporter instance has access to the `.byDate()`, `.all()` *and* `.today()` via the `.get` methods (based on the previous example configuration).

### `.clone()`

As the dataset is constantly being mutated by the iterators, sometimes it is necessary to have a non mutated copy of the exporter. Calling the `clone()` method will create a new instance of the exporter with the data in the current latest state.

```js
var saver = function (saver) {
  saver.write(saver.filename);
};

var e = exporter()
  .get.participants.all();

var copy = e.clone();

// save one version with only the first 10 items
e.slice(0, 10).save(filename).then(saver);

// save a second version with the rest of the items
copy.slice(10).save('more-' + filename).then(saver);
```

### `.columns()` & `.columns`

Columns can be set via the instance method (which allows the code to continue to chain), or it can be set directly on the exporter object.

```js
exporter().columns([
  'name: Customer name',
  'location.city: City'
])...
```

Note that as of version 2.0.0, the `columns` argument is no longer an object, this is to ensure the order of the columns is correct (as object properties cannot be guaranteed).

The `columns` method supports a number of formats, but the above example is the simplest to read.

Others include:

```js
// multiline string heading
exporter().columns(
  'name: Customer name\n' +
  'location.city: City'
)...

// array of objects
exporter().columns([
  { name: 'Customer name' },
  { location.city: 'City' },
])...
```


### `.save(filename[, type])`

This method is the only method that returns a promise that does not fulfil with the internal dataset. Instead it fulfils with the `saver` object.

If the `type` is not specified, it is derived from the filename. For instance, a filename of `my-file.xlsx` will use the `xlsx` export target.

The `save()` method returns a Promise (a native promise, not an exporter), and fulfils with the `saver` object (defined below).

The exporter support 'xlsx', 'csv' and 'json'. More savers can be defined via the [`.savers`](#savers) static property.

Below is an example of a server side exporter returning the last 10 participants:

```js
http.createServer(function (req, res) {
  exporter().get.participants.all()
    .slice(10)
    .save('last-ten.csv')
    .then(function (saver) {
      res.writeHead(200, 'OK', {
        'Content-Type': saver.mime,
        'Content-Disposition': 'inline; filename=' + saver.filename,
      });

      saver.pipe(res);
    }).catch(function (error) {
      res.writeHead(500);
      res.end('Export error: ' + error.message);
    });
});
```

#### Saver API

- `saver.data` - the array of data
- `saver.filename` - the filename
- `saver.mime` - the mime type of the export target
- `saver.base64()` - method that converts the data to a base64 string
- `saver.write(filename)` - commit the file to disk (TODO: support browser disk saving)
- `saver.pipe(stream)` - creates a readable stream that's piped into the `stream` argument

### `.then(onFulfilled[, onRejected])`

The `then()` method returns an exporter. It takes two arguments, both are callback functions for the success and failure cases of the Promise. The failure callback is optional.

### `.catch(onRejected)`

The `catch()` method returns a Promise and deals with rejected cases only. It behaves the same as calling `Promise.prototype.then(undefined, onRejected)`.

## Instance array-like methods

The following methods have all been taken from `Array` and work very much the same, with the exception that they update the dataset internally kept by the exporter and return the instance of the exporter.

- `.sort([fn])`
- `.filter(fn)`
- `.map(fn)`
- `.slice([begin[, end]])`
- `.reduce(fn[, initialValue])`

These methods can be chained together just as they can be with an array, but importantly, they also mutate the data inside of the exporter.

```js
exporter().get.participants.all()
  // now sort by date created
  .sort(function (a, b) {
    return new Date(a.created).getTime() - new Date(b.created).getTime();
  })
  // export the last 10 records
  .slice(-10)
  // then do something with data...
```

## Instance properties

### `.get`

The `.get` property is the hanging point on the exporter instance for all the of the user configured methods. Using the [sample configuration](#sample-configuration), it will automatically generate methods available from the `.get` property:

```js
var byDate = exporter().get.participants.byDate();

// you can now manipulate the data in `byDate` using exporter's methods
```

## Remote server calls

If the dataset is very large, but you want the client to house the main logic, perhaps if the user is invoved in the data transformation somehow, the remote feature can help.

The remote feature will run all the exporter commands, including iterators, on the server automatically for you.

The only change required on the client side is the addition of the [`$remote`](#remote) property in the configuration.

In the example below, an express server will recieve the call, re-run all of the exporter commands, and pipe the response back to the client. After which, the client can then use the `blob` response to either download or do as they wish.

```js
// example server
var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var signatures = require('./signatures');

var app = express();
app.use(cors());

// create application/json parser
app.use(bodyParser.json());

app.post('/export', urlencodedParser, function (req, res) {
  if (!req.body) {
    return res.sendStatus(400);
  }

  var commands = req.body;
  var saver = commands.saver;

  exporter().config({
    // this is what allows pre-agreed user code to be run
    signatures: signatures
  })
  .remote(commands)
  .save(saver.filename, saver.type, saver.args.pop())
  .then(function (saver) {
    res.writeHead(200, 'OK', {
      'Content-Type': saver.mime,
      'Content-Disposition': 'inline; filename=' + saver.filename,
    });
    saver.pipe(res);
  })
  .catch(function (error) {
    console.log(error.stack);
    res.status(500).send(error.message);
  });
});
```

Example client side:

```js
exporter()
  .config(config)
  .boolAsText() // custom iterator
  .actionsRequired() // custom iterator
  .save(filename)
  .then(function (saver) {
    var blob = saver.data;
    var el = document.createElement('a');
    el.href = URL.createObjectURL(blob);
    el.download = saver.filename;
    el.target = '_blank';
    el.click(); // trigger the download
    // then clean up
    setTimeout(function () {
      URL.revokeObjectURL(blob);
    }, 500);
  });
```

### Security

When the server is running without the environment value `NODE_ENV=production` (i.e. development mode) then *any* user code will run. **When used in production, the mode must be in production.**

Once in production mode, the remote exporter will *only* run code that it has a valid signature for.

When the server is run in development mode, it will log out all of the signatures being used. These are sha1 hashes of the iterators and all internal function calls like `map`, `slice`, etc.

These **must** be included in the remote exporters config for it to run in production, otherwise an exception will be thrown.

## Configuration

The exporter configuration can be set at the root object *and* at an instance level. This is useful if there's a common configuration for all exporters.

### Sample configuration

```json
{
  "$root": "https://localhost:9000",
  "$remote": "https://localhost:9001/export",
  "grouping": {
    "$path": "/_design/command/_view/by-date/",
    "$engine": "couch-csv",
    "$methods": {
      "method1": "?startkey={{date | couchFormat}}&endkey={{date | couchFormat}}",
      "method2": "?startkey=[2000,1,1]&endkey={{date | couchFormat}}"
      }
    }
  }
}
```

### Config settings

#### `$root`

`$root` is the common root part of the URL requested. This can live at the very root of the config JSON object, or it can live at the grouping level, allowing for different `$root`s for different groups.

#### `$remote`

The URL to the server running [remote](#remote-server-calls) export commands.

#### grouping

This is a label that is used to firstly create a group of requests (though this can also contain a single request) and *importantly*, forms the property that appears after the `.get`.

For example, if the grouping was `participants`:

```js
exporter().get.participants.method1()...
```

#### `$path`

The rest of the path that is joined to the `$root` which represents the full URL that will be fetched.

*TODO: decide whether this is totally redundant and should be removed for simplicity*

#### `$engine`

The name of the parsing engine used. Out of the box the following parsers are supported:

- `couch-csv`
- `elasticsearch`

More engines can be added if attached to the `exporter.engines` property.

#### `$methods`

An object whose keys are used as method names, and the values are the complete URLs including any query strings and so on.

The intention is that the methods would offer different ways of querying the same backend endpoint URL.

Any part of the URL, from the `$root`, `$path` and the `$method` supports value interpolation.

## Passing custom headers in requests

To send additional heads in the data fetch (the URL set in the [config](#configuration) call), the must be passed into the get method being called under the `$request` property:

```js
var config = {
  participants: {
    $engine: 'couch-csv',
    $path: '/_design/command/_view/by-date/',
    $methods: {
      byDate: '?startkey={{date | couchFormat}}&endkey={{date | couchFormat}}'
    }
  }
};

exporter().config(config).get.participants({
  date: new Date(),
  $request: {
    headers: {
      'x-custom-header': 'x-value'
    }
  }
})
```

The `$request` object is passed directly into the underlying `fetch` called, and maps directly to the options described by the [Fetch Standard](https://fetch.spec.whatwg.org/).

## Errors

### Stream ends too early / file is truncated

During development, I found that node 0.10.x would close the stream, without errors, early if it was exporting a large dataset (500,000 rows upwards) to the `xlsx` output.

I found in my testing an upper limit of ~120,000 rows when exporting to `xlsx`. However, if exporting to `csv` there's no upper limit (that I found).

There's no solution for this problem.

I also tried upgrading to node 0.12.x and although this solved the closing issue, the code now emitted a memory problem that causes the stream processing to get slower and slower. A source of 500,000 rows took 30 minutes to complete. This should only take about 4-5 minutes.

Again, there is no solution to this problem.

### Function signature not recognised for ...

This means that an remote function call was attempted in production mode when the function was not recognised or validated by the server.

When using the [remote](#remote) functionality of the exporter, to protect from arbitrary/untrusted user code being run on the server, signatures are generated for each function that will be called on the server and validated against.

To configure the server exporter with signatures, use the following:

```js
exporter.config.signatures = [<array of hashes>]
```

Whilst the server is *not* in production mode (i.e. `process.env.NODE_ENV !== 'production'`), function signatures will be logged out to stdout.

### Saver "$type" format not supported

The `$type` export method is not supported (or not loaded). To add new saver types, the `exporter.savers` object must be added to with the [appropriate API](#savers).

Note that the server module has support for: csv, xlsx and json. The client module *does not* include xlsx by default (since it adds 200K to the compressed file).

### Bad response from server: $message

When the `GET` or `POST` request was made to request the raw data from the data source, it failed with a `4xx` error response.

This is possibly a permission `403` error and the `$root` property in the config needs to include authentication details. Note that this can also be done on the fly with code such as:

```js
store.get('auth').then(function (details) {
  var e = exporter().config({
    $root: 'https://' + details.username + ':' + details.password + '@host/url'
  });

  // now do something with `e`
});
```

## TODO / Wishlist

### Simplify the configuration

The original design was to allow for a config to support multiple sources of data of any type (couch, elasticsearch, etc), but in reality a project only uses one type of backend, so the configuration options becomes more complicated than it needs to be.

Rather than calling an ES based endpoint like this:

```js
exporter().get.es.search()...
```

If a single data source is provided in the config, ideally the exporter would look like this:

```js
exporter().get()...
```

### Automatically send credentials & `$request`

The `request` object for [fetch](http://fetch.spec.whatwg.org) is currently a dumping ground for anything that needs either custom headers (such as credentials) or `POST` data.

It makes sense to make some of these defaulted and if the configuration said that the data source was a `POST` that passing options to the `$method` could be used as the request data, something along these lines:

```js
// dsl is defined somewhere else, and the JSON is used as the POSTed
// body to our data source.
exporter().get({
  query: dsl.toJSON()
})...
```