'use strict';

var assert = require("assert");
var exec = require('child_process').exec;
var path = require('path');

describe('wuml bin', function() {
    var cmd = 'node ' + path.join(__dirname, '../bin/wuml') + ' ';
    console.log(cmd);

    it('--help should run without errors', function (done) {
        exec(cmd + '--help', function (error, stdout, stderr) {
            console.log(stderr);
            assert(!error);
            assert(stdout.indexOf('Usage: wuml') >= 0);
            done();
        });
    });
});