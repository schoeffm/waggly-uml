'use strict';

var assert = require("assert");
var exec = require('child_process').exec;
var path = require('path');
var umlParser = require('../bin/classDiagramProcessor');
var fs = require('fs');
var waggly = require('wsvg');
var _ = require('lodash');

describe("'classDiagramProcessor'", function() {
    
    var testClassInput = "// Cool Class Diagram \n" +
        "[ICustomer|+name;+email|]^-.-[Customer] \n" +
        "[Customer]<>-orders*>[Order] \n" +
        "[Order]++-0..*>[LineItem] \n" +
        "[Order]-[note:Aggregate root.]";
    
    describe("'recordName'", function() {
        assert.strictEqual(umlParser.recordName('ICustomer|+name;+email|'), 'ICustomer');
        assert.strictEqual(umlParser.recordName('ICustomer'), 'ICustomer');
        assert.strictEqual(umlParser.recordName('<<Interface>>;ICustomer'), '<<Interface>>;ICustomer');
    });
        
    describe("'prepareLabel'", function() {
        it('should prepare input labels properly', function () {
            assert.strictEqual(umlParser.prepareLabel('ICustomer|+name;+email|'), 
                'ICustomer\\n|+name\\n+email\\n|\\n');
            assert.strictEqual(umlParser.prepareLabel('<<Interface>>;ICustomer|+name;+email|'), 
                '\\<\\<Interface\\>\\>\\nICustomer\\n|+name\\n+email\\n|\\n');
            assert.strictEqual(
                umlParser.prepareLabel('ICustomer|+email|+method(List<String> foo)'),
                'ICustomer\\n|+email\\n|+method(List\\<String\\>\\ foo)\\n');
        });
        it('should prepare input labels properly', function () {
            assert.strictEqual(umlParser.prepareLabel('ICustomer|+email|+method(List<String> foo)', 'TD'),
                '{ ICustomer\\n|+email\\n|+method(List\\<String\\>\\ foo)\\n }');
        });
    });

    describe("'toDotModel'", function() {
        var expected = 'digraph G {\n' +
        '  graph [ ranksep = 1, rankdir = LR ];\n' +
        '  "A0" [ shape = record, height = 0.5, fontsize = 10, margin = "0.20, 0.05", label = "ICustomer\\n|+name\\n+email\\n|\\n" ];\n'+
        '}\n';
        assert.equal(expected ,umlParser.toDotModel([{type: 'record', content: {background: '', text: 'ICustomer|+name;+email|'}}]));
    });
    
    
    describe('reading a dot-file and producing svg-class outputs', function() {
        it('reading a real dot-file', function() {
            fs.readFile('test/testFixture1.wuml', {encoding: 'utf-8'}, function(err, inputData) {
                umlParser.processString(inputData, function (outputData) {
                    fs.readFile('test/expectedResult1.dot', {encoding: 'utf-8'}, function(err, expectedData) {
                        assert.deepEqual(outputData, expectedData);
                    });
                });
            });
        });
        it('using the convenience-function for reading the input file', function() {
            umlParser.processFile('test/testFixture1.wuml', function(data) {
                fs.readFile('test/expectedResult1.dot', {encoding: 'utf-8'}, function(err, expectedData) {
                    assert.deepEqual(data, expectedData);
                });
            });
        });
        it('reading another real dot-file', function() {
            fs.readFile('test/testFixture2.wuml', {encoding: 'utf-8'}, function(err, inputData) {
                umlParser.processString(inputData, function (outputData) {
                    fs.readFile('test/expectedResult2.dot', {encoding: 'utf-8'}, function(err, expectedData) {
                        assert.deepEqual(outputData, expectedData);
                    });
                });
            });
        });
    });
    
    describe('End-Goal', function() {
        it('Hack the planet', function () {
            umlParser.processString(testClassInput, function(outputString) {
                fs.writeFile('test.dot', outputString, function(err) {
                    exec('dot -Tsvg test.dot', function(err, stdout, stderr) {
                        waggly.create({ waggly: true, font_family: 'Dadhand'}, function (done) {
                            fs.writeFile('result.svg', done);
                        }).transformString(stdout);
                    });
                });    
            });
            
        });
    });
});
