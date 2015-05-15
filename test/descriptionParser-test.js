'use strict';

var assert = require("assert");
var exec = require('child_process').exec;
var path = require('path');
var umlParser = require('../bin/descriptionParser');
var fs = require('fs');
var waggly = require('wsvg');
var _ = require('lodash');

describe("'descriptionParser'", function() {
    
    var testClassInput = "// Cool Class Diagram \n" +
        "[ICustomer|+name;+email|]^-.-[Customer] \n" +
        "[Customer]<>-orders*>[Order] \n" +
        "[Order]++-0..*>[LineItem] \n" +
        "[Order]-[note:Aggregate root.]";
    
    describe('When given an input-string, the tokenizer ...', function() {
        it ('should extract 13 tokens from the given input', function() {
            assert.strictEqual(umlParser.tokenize(testClassInput).length, 13);
        });
        it ('should place the tokens on expected positions based on the input-order', function() {
            assert.strictEqual(umlParser.tokenize(testClassInput)[1], "[ICustomer|+name;+email|]");
            assert.strictEqual(umlParser.tokenize(testClassInput)[2], "^-.-");
            assert.strictEqual(umlParser.tokenize(testClassInput)[3], "[Customer]");
            assert.strictEqual(umlParser.tokenize(testClassInput)[12], "[note:Aggregate root.]");
        });
        it ('should not produce any empty tokens', function() {
            for (var token in umlParser.tokenize(testClassInput)) {
                assert(!_.isEmpty(token));
            }
        });
    });

    describe('When given a token, the is*-methods ...', function() {
        it('should detect a note-token - with mixed capitalization', function () {
            assert.strictEqual(umlParser.isNote('[NOtE:'), true);
        });
        it('should detect a note-token - all lower case', function () {
            assert.strictEqual(umlParser.isNote('[note:'), true);
        });
        it('should detect a note-token - not matching', function () {
            assert.strictEqual(umlParser.isNote('[  note:'), false);
        });
        it('should detect a normal class-token', function () {
            assert.strictEqual(umlParser.isClass('[class]'), true);
        });
        it('should detect an empty class-token', function () {
            assert.strictEqual(umlParser.isClass('[]'), true);
        });
        it('should detect a cluster', function () {
            assert.strictEqual(umlParser.isCluster('[class[]]'), true);
        });
        it('should not detect a class-token that has leading spaces', function () {
            assert.strictEqual(umlParser.isClass('  [ Text]'), false);
        });
        it('should not detect a class-token if it does not end with ]', function () {
            assert.strictEqual(umlParser.isClass('[ Text] '), false);
        });
        it('should not detect a class-token when it does not start with [', function () {
            assert.strictEqual(umlParser.isClass('-  ['), false);
        });
        it('should detect an edge-token', function () {
            assert.strictEqual(umlParser.isEdge('-'), true);
        });
        it('should detect a class-token', function () {
            assert.strictEqual(umlParser.isEdge('--.-'), true);
        });
        it('should detect a class-token', function () {
            assert.strictEqual(umlParser.isEdge('^8i-'), true);
        });
        it('should not detect a class-token if there is no - sign', function () {
            assert.strictEqual(umlParser.isEdge('^8i'), false);
        });
    });

    describe('When processing a class or a note', function() {
        it('the background should be "cornsilk"', function () {
            assert.strictEqual(umlParser.determineBackgroundColor('[note: This is a damn long text {bg:cornsilk}]'), 'cornsilk');
        });
    });
    
    describe('When processing a token ', function() {
        it('notes should only contain a text and a one background-color (the second will be ignored)', function () {
            assert.deepEqual(
                umlParser.processNote('[note: This is a damn long text {bg:green}{bg:yellow}]').content,
                { background: 'yellow', text: 'This is a damn long text {bg:green}'});
        });
        
        it('notes should only contain a text and a background-color', function () {
            assert.deepEqual(
                umlParser.processNote('[note: This is a damn long text {bg:green}]').content,
                { background: 'green', text: 'This is a damn long text'});
        });
        
        it('notes should only contain a text', function () {
            assert.deepEqual(
                umlParser.processNote('[note: This is a damn long text]').content, 
                {background: '', text: 'This is a damn long text'});
        });
        
        it('notes should be of type "note"', function () {
            assert.strictEqual(umlParser.processNote('[note: This is a damn long text]').type, 'note');
        });
    });
    
    describe('When processing a class token ', function() {
        it('classes should be of type', function () {
            assert.strictEqual(umlParser.processClass('[This is a Class]').type, 'record');
        });
    });

    describe('When processing a cluster token ', function() {
        it('cluster should be of type cluster', function () {
            assert.strictEqual(umlParser.processCluster('[This is a Cluster [Node1] [Node2] {bg:green}]').type, 'cluster');
        });
        
        it('cluster should be detected properly', function () {
            assert.deepEqual(umlParser.processCluster('[This is a Cluster [Node1] [Node2] {bg:green}]').content,
                {
                    background: "green",
                    nodeNames: [ "Node1", "Node2" ],
                    text: "This is a Cluster"
                }
            );
        });
    });

    describe('When processing an edge token', function() {
        var odiamondEdge = '<>-orders*<>';
        var diamondEdge = '++magnitude-0..*>';
        var emptyEdge = '^-.-^';
        it('edges should be of type edge', function () {
            assert.strictEqual(umlParser.processEdge(odiamondEdge).type, 'edge');
            assert.strictEqual(umlParser.processEdge(diamondEdge).type, 'edge');
            assert.strictEqual(umlParser.processEdge(emptyEdge).type, 'edge');
        });
        it('edges with left odiamond, should be recognized', function () {
            assert.strictEqual('odiamond', umlParser.processEdge(odiamondEdge).content.left.type);
        });
        it('edges with right odiamond, should be recognized', function () {
            assert.strictEqual('odiamond', umlParser.processEdge(odiamondEdge).content.right.type);
        });
        it('edges with right text, should be recognized and text should be extracted', function () {
            assert.strictEqual('orders*', umlParser.processEdge(odiamondEdge).content.right.text);
            assert.strictEqual('', umlParser.processEdge(odiamondEdge).content.left.text);
        });
        it('edges with left diamond, should be recognized', function () {
            assert.strictEqual('diamond', umlParser.processEdge(diamondEdge).content.left.type);
        });
        it('edges with left text, should be recognized and text should be extracted', function () {
            assert.strictEqual('magnitude', umlParser.processEdge(diamondEdge).content.left.text);
            assert.strictEqual('0..*', umlParser.processEdge(diamondEdge).content.right.text);
        });
        it('edges with right vee, should be recognized', function () {
            assert.strictEqual('vee', umlParser.processEdge(diamondEdge).content.right.type);
        });
        it('edges with left empty, should be recognized', function () {
            assert.strictEqual('empty', umlParser.processEdge(emptyEdge).content.left.type);
        });
        it('edges with right empty, should be recognized', function () {
            assert.strictEqual('empty', umlParser.processEdge(emptyEdge).content.right.type);
        });
        it('edges with no text should only contain empty texts', function () {
            assert.strictEqual('', umlParser.processEdge(emptyEdge).content.left.text);
            assert.strictEqual('', umlParser.processEdge(emptyEdge).content.right.text);
        });
    });
    
    describe('reading a dot-file and producing svg-class outputs', function() {
       it('reading a real dot-file', function() {
           fs.readFile('test/testFixture1.wuml', {encoding: 'utf-8'}, function(err, data) {
               fs.readFile('test/expectedResult1.dot', {encoding: 'utf-8'}, function(err, expectedData) {
                   assert.deepEqual(umlParser.process(data), expectedData);
               });
           });
       });
        it('reading another real dot-file', function() {
            fs.readFile('test/testFixture2.wuml', {encoding: 'utf-8'}, function(err, data) {
                fs.readFile('test/expectedResult2.dot', {encoding: 'utf-8'}, function(err, expectedData) {
                    assert.deepEqual(umlParser.process(data), expectedData);        
                });
            });
        });
    });
    
    describe('End-Goal', function() {
        it('Hack the planet', function () {
            fs.writeFile('test.dot', umlParser.process(testClassInput), function(err) {
                exec('dot -Tsvg test.dot', function(err, stdout, stderr) {
                    waggly.create({ waggly: true, font_family: 'Dadhand'}, function (done) { 
                        fs.writeFile('result.svg', done);
                    }).transformString(stdout);
                });
            });
        });
    });
});
