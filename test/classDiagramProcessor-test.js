'use strict';

var assert = require("assert");
var exec = require('child_process').exec;
var path = require('path');
var classParser = require('../bin/dot/classDiagramProcessor');
var fs = require('fs');
var waggly = require('wsvg');
var _ = require('lodash');

describe("'classDiagramProcessor'", function() {
    
    var testClassInput = "// Cool Class Diagram \n" +
        "[ICustomer|+name;+email|]^-.-[Customer] \n" +
        "[Customer]<>-orders*>[Order] \n" +
        "[Order]++-0..*>[LineItem] \n" +
        "[Order]-[note:Aggregate root.] \n" +
        "[My Cluster [Order][Customer]{bg:green}]->[Foo[LineItem]]";
    
    describe("'toDotModel'", function() {
        
        var modelDefinition = [{type: 'record', content: {background: '', text: 'ICustomer|+name;+email|'}}];
        var expectedDotModel = 'digraph G {\n' +
        '  graph [ compound = true, ranksep = 1, rankdir = LR, splines = \"spline\" ];\n' +
        '  "A0" [ height = 0.5, fontsize = 10, margin = "0.20, 0.05", shape = record, label = "ICustomer\\n|+name\\n+email\\n|\\n" ];\n'+
        '}\n';
        
        it('Dot-Model will be created based on the given input', function() {
            assert.equal(expectedDotModel ,classParser.toDotModel(modelDefinition,{}));
        });
        
        it('when given an orientation this one will be used instead of the default one', function() {
            // given
            var expected = 'digraph G {\n' +
                '  graph [ compound = true, ranksep = 1, rankdir = TD, splines = \"spline\" ];\n' +
                '  "A0" [ height = 0.5, fontsize = 10, margin = "0.20, 0.05", shape = record, label = "{ ICustomer\\n|+name\\n+email\\n|\\n }" ];\n'+
                '}\n';
            
            // when
            var result = classParser.toDotModel(modelDefinition, { orientation: 'TD', spline: 'ortho' });
            
            // then
            assert.equal(expected, result);
        });

        it('in case of not-supported config-entries defaults will be taken', function() {
            // when
            var result = classParser.toDotModel(modelDefinition, { orientation: 'TLDR', spline: 'foo' });

            // then
            assert.equal(expectedDotModel, result);
        });
    });
    
    
    describe('reading a dot-file and producing svg-class outputs', function() {
        it('reading a real dot-file', function() {
            fs.readFile('test/testFixture1.wuml', {encoding: 'utf-8'}, function(err, inputData) {
                classParser.processString(inputData, function (outputData) {
                    fs.readFile('test/expectedResult1.dot', {encoding: 'utf-8'}, function(err, expectedData) {
                        assert.deepEqual(outputData, expectedData);
                    });
                });
            });
        });
        it('using the convenience-function for reading the input file', function() {
            classParser.processFile('test/testFixture1.wuml', function(data) {
                fs.readFile('test/expectedResult1.dot', {encoding: 'utf-8'}, function(err, expectedData) {
                    assert.deepEqual(data, expectedData);
                });
            });
        });
        it('reading another real dot-file', function() {
            fs.readFile('test/testFixture2.wuml', {encoding: 'utf-8'}, function(err, inputData) {
                classParser.processString(inputData, function (outputData) {
                    fs.readFile('test/expectedResult2.dot', {encoding: 'utf-8'}, function(err, expectedData) {
                        assert.deepEqual(outputData, expectedData);
                    });
                });
            });
        });
    });
    
    describe('End-Goal', function() {
        it('foo', function(done) {
            classParser.processString(testClassInput, function(outputString) {
                console.log(outputString);
                done();
            });
        });
        
        it('Hack the planet', function () {
            classParser.processString(testClassInput, function(outputString) {
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
