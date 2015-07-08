'use strict';

var assert = require("assert");
var path = require('path');
var umlProcessor = require('../bin/umlProcessor');
var fs = require('fs');
var _ = require('lodash');

describe("'umlProcessor'", function() {
    /*
     * this one does not run on travis-ci (needs investigation)
     */
    it('should turn a svg to a png using convert (no matter if convert produces good results)', function (done) {
        fs.readFile('test/testFixture3.svg', {encoding: 'utf-8'}, function(err, inputData) {
            umlProcessor.transformTo(inputData, 'svg', function (result) {
                assert(Buffer.isBuffer(result));
                assert(Buffer.isEncoding('binary'));
                assert(Buffer.length > 0);
                done();
            });
        });
    });     
});
