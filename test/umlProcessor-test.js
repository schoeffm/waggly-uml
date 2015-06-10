'use strict';

var assert = require("assert");
var path = require('path');
var umlProcessor = require('../bin/umlProcessor');
var fs = require('fs');
var _ = require('lodash');

describe("'umlProcessor'", function() {
    it('should turn a svg to a png using convert (no matter if convert produces good results)', function (done) {
        fs.readFile('test/testFixtures/class.svg', {encoding: 'utf-8'}, function(err, inputData) {
            umlProcessor.transformToPNG(inputData, function (result) {
                assert(Buffer.isBuffer(result));
                assert(Buffer.isEncoding('binary'));
                assert(Buffer.length > 0);
                done();
            });
        });
    });     
});