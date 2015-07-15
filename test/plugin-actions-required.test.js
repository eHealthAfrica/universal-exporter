'use strict';
var plugin = require('../plugins/actions-required.js');
var assert = require('assert');

/*global describe, it, beforeEach*/

describe('actions-required', function () {
  it('should construct a string', function () {
    var data = {
      dispatch: {
        actionsRequired: {
          common: {
            surveillance: true,
            falseIsIgnored: false,
            includeThis: true,
          },
          other: 'something else'
        },
      },
    };

    var result = plugin(data);

    assert.deepEqual(result, { dispatch: { actionsRequired: 'surveillance\nincludeThis\nsomething else'}});
  });
});