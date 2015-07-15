'use strict';
var debug = require('debug')('test:pump');
var stream = require('stream');
var util = require('util');
var NanoTimer = require('nanotimer');
var timer = new NanoTimer();

function Pump(size, data, time, op, sep, cl, indent) {
  this.size = size;
  this.json = {
    op: op || '[\n',
    sep: sep || '\n,\n',
    cl: cl || '\n]',
    indent: indent || 2,
  };

  stream.Readable.call(this); //, {objectMode: true});
  this.ctr = 0;
  this.data = data;
  this.first = true;

  this.timeout = time ? (time / size / 10) + 'm' : 0;

  debug('starting pump %s @ %ss', this.size, this.timeout);
}

util.inherits(Pump, stream.Readable);

Pump.prototype._read = function () {
  if (this.size > 0) {
    // it takes approximately 1 second to pump 10,000 items through a stream
    if (this.size % 10000 === 0) {
      debug('pump %s left', this.size)
    }

    var run = function () {
      this.data.doc.ctr = this.ctr++; // modify the object a little
      var json = JSON.stringify(this.data, '', this.json.indent);
      if (this.first) {
        this.push(this.json.op + json);
        this.first = false;
      } else {
        this.push(this.json.sep + json);
      }
    }.bind(this);

    if (this.timeout) {
      timer.setTimeout(run, '', this.timeout);
    } else {
      setImmediate(run);
    }

    // setImmediate(function () {
    //   this.data.ctr = this.ctr++; // modify the object a little
    //   this.push(JSON.stringify(this.data));
    // }.bind(this));
    this.size--;
  } else {
    this.push(this.json.cl);
    this.push(null);
  }
};

module.exports = Pump;