'use strict';

var assert = require("assert");
var exec = require('child_process').exec;
var path = require('path');
var dotUtils = require('../bin/dot/commonDot');
var fs = require('fs');
var waggly = require('wsvg');
var _ = require('lodash');

describe("'commonDot Utils'", function() {

    describe("'recordName'", function () {
        it('should extract the records name', function() {
            assert.strictEqual(dotUtils.recordName('ICustomer|+name;+email|'), 'ICustomer');
            assert.strictEqual(dotUtils.recordName('ICustomer'), 'ICustomer');
            assert.strictEqual(dotUtils.recordName('<<Interface>>;ICustomer'), '<<Interface>>;ICustomer');
        });
    });

    describe("'prepareLabel'", function() {
        it('should prepare input labels properly', function () {
            assert.strictEqual(dotUtils.prepareLabel('ICustomer|+name;+email|'),
                'ICustomer\\n|+name\\n+email\\n|\\n');
            assert.strictEqual(dotUtils.prepareLabel('<<Interface>>;ICustomer|+name;+email|'),
                '\\<\\<Interface\\>\\>\\nICustomer\\n|+name\\n+email\\n|\\n');
            assert.strictEqual(
                dotUtils.prepareLabel('ICustomer|+email|+method(List<String> foo)'),
                'ICustomer\\n|+email\\n|+method(List\\<String\\>\\ foo)\\n');
        });
        it('should prepare input labels properly', function () {
            assert.strictEqual(dotUtils.prepareLabel('ICustomer|+email|+method(List<String> foo)', 'TD'),
                '{ ICustomer\\n|+email\\n|+method(List\\<String\\>\\ foo)\\n }');
        });
    });
});