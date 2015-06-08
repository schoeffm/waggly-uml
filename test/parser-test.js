'use strict';

var assert = require("assert");
var exec = require('child_process').exec;
var path = require('path');
var parser = require('../bin/parser');
var fs = require('fs');
var _ = require('lodash');

describe("'parser'", function() {
    
    var testSequenceInput = "[Patron]-order food>[Waiter] \n" +
        "[Waiter]-order food>[Cook] \n" +
        "[Waiter]-serve wine>[Patron] \n" +
        "[Cook]pi-ckup>[Waiter] \n" +
        "[Waiter]-serve food>[Patron] \n" +
        "[Patron]-pay>[Cashier]";
    
    var testClassInput = "// Cool Class Diagram \n" +
        "[ICustomer|+name;+email|]^-.-[Customer] \n" +
        "[Customer]<>-orders*>[Order] \n" +
        "[Order]++-0..*>[LineItem] \n" +
        "[Order]-[note:Aggregate root.]";

    describe('When given an input-string, the toDocumentModel ...', function () {
        it('should create a corresponding model for the class-input', function () {
            assert.deepEqual(
                parser.toDocumentModel(testClassInput)[0],
                {type: 'record', content: {background: '', text: 'ICustomer|+name;+email|'}});
            assert.deepEqual(
                parser.toDocumentModel(testClassInput)[1],
                { type: 'edge', content: {left: {type: 'empty', text: ''}, right: {type: 'none', text: ''}, style: 'dashed'}});
            assert.deepEqual(
                parser.toDocumentModel(testClassInput)[11],
                {type: 'note', content: {background: '', text: 'Aggregate root.'}});
        });
        it('should create a corresponding model for the sequence-input', function () {
            assert.deepEqual(
                parser.toDocumentModel(testSequenceInput)[0], 
                { type: 'record', content: { background: '', text: 'Patron' } });
            assert.deepEqual(
                parser.toDocumentModel(testSequenceInput)[1],
                { type: 'edge', content: {left: {type: 'none', text: ''}, right: {type: 'normal', text: 'order food'}, style: 'solid'}});
        });
    });
    
    describe('When given an input-string, the tokenizer ...', function () {
        it('should extract 18 tokens for our test-sequence diagram ', function () {
            assert.strictEqual(parser.tokenize(testSequenceInput).length, 18);
        });
        
        it('should extract 13 tokens from our class-diagram input', function () {
            assert.strictEqual(parser.tokenize(testClassInput).length, 13);
        });
        
        it('should place the tokens on expected positions based on the input-order', function () {
            assert.strictEqual(parser.tokenize(testClassInput)[1], "[ICustomer|+name;+email|]");
            assert.strictEqual(parser.tokenize(testClassInput)[2], "^-.-");
            assert.strictEqual(parser.tokenize(testClassInput)[3], "[Customer]");
            assert.strictEqual(parser.tokenize(testClassInput)[12], "[note:Aggregate root.]");
        });
        
        it('should not produce any empty tokens', function () {
            for (var token in parser.tokenize(testClassInput)) {
                assert(!_.isEmpty(token));
            }
        });
    });


    describe('When given a token, the paresrs is*-methods ...', function() {
        
        it('should detect a note-token - with mixed capitalization', function () {
            assert.strictEqual(parser.isNote('[NOtE:'), true);
        });
        it('should detect a note-token - all lower case', function () {
            assert.strictEqual(parser.isNote('[note:'), true);
        });
        it('should detect a note-token - not matching', function () {
            assert.strictEqual(parser.isNote('[  note:'), false);
        });
        it('should detect a normal class-token', function () {
            assert.strictEqual(parser.isClass('[class]'), true);
        });
        it('should detect an empty class-token', function () {
            assert.strictEqual(parser.isClass('[]'), true);
        });
        it('should detect a cluster', function () {
            assert.strictEqual(parser.isCluster('[class[]]'), true);
        });
        it('should not detect a class-token that has leading spaces', function () {
            assert.strictEqual(parser.isClass('  [ Text]'), false);
        });
        it('should not detect a class-token if it does not end with ]', function () {
            assert.strictEqual(parser.isClass('[ Text] '), false);
        });
        it('should not detect a class-token when it does not start with [', function () {
            assert.strictEqual(parser.isClass('-  ['), false);
        });
        it('should detect an edge-token', function () {
            assert.strictEqual(parser.isEdge('-'), true);
        });
        it('should detect a class-token', function () {
            assert.strictEqual(parser.isEdge('--.-'), true);
        });
        it('should detect a class-token', function () {
            assert.strictEqual(parser.isEdge('^8i-'), true);
        });
        it('should not detect a class-token if there is no - sign', function () {
            assert.strictEqual(parser.isEdge('^8i'), false);
        });
    });


    describe('When processing a nodes, we make use of a bunch of auxiliary functions, like ...', function() {
        describe('determineBackgroundColor - which ...', function() {
            it('should extract the background as "cornsilk"', function () {
                assert.strictEqual(parser.determineBackgroundColor(
                        '[note: This is a damn long text {bg:cornsilk}]'),
                    'cornsilk');
            });
        });
        describe('processNote - which ...', function() {
            it('should recognize notes with only one containing text and a background-color (the second will be ignored)', function () {
                assert.deepEqual(
                    parser.processNote('[note: This is a damn long text {bg:green}{bg:yellow}]').content,
                    {background: 'yellow', text: 'This is a damn long text {bg:green}'});
            });

            it('should recognize a regular note containing text and bg-infos', function () {
                assert.deepEqual(
                    parser.processNote('[note: This is a damn long text {bg:green}]').content,
                    {background: 'green', text: 'This is a damn long text'});
            });

            it('should recognize a text-only note (without background)', function () {
                assert.deepEqual(
                    parser.processNote('[note: This is a damn long text]').content,
                    {background: '', text: 'This is a damn long text'});
            });

            it('should create model-entries of type "note"', function () {
                assert.strictEqual(parser.processNote('[note: This is a damn long text]').type, 'note');
            });
        });
        
        describe('processClass - which ...', function() {
            it('should create model-entries of type "record"', function () {
                assert.strictEqual(parser.processClass('[This is a Class]').type, 'record');
            });
            // TODO
        });

        describe('processCluster - which ...', function() {
            it('should create model-entries of type "cluster"', function () {
                assert.strictEqual(parser.processCluster('[This is a Cluster [Node1] [Node2] {bg:green}]').type, 'cluster');
            });

            it('should recognize a 2-node containing cluster with background-definition', function () {
                assert.deepEqual(parser.processCluster('[This is a Cluster [Node1] [Node2] {bg:green}]').content,
                    {
                        background: "green",
                        nodeNames: [ "Node1", "Node2" ],
                        text: "This is a Cluster"
                    }
                );
            });
            // TODO
        });

        describe('processEdge - which ...', function() {
            var odiamondEdge = '<>-orders*<>';
            var diamondEdge = '++magnitude-0..*>';
            var emptyEdge = '^-.-^';
            
            it('should create model-entries of type "edge"', function () {
                assert.strictEqual(parser.processEdge(odiamondEdge).type, 'edge');
                assert.strictEqual(parser.processEdge(diamondEdge).type, 'edge');
                assert.strictEqual(parser.processEdge(emptyEdge).type, 'edge');
            });
            it('edges with left odiamond, should be recognized', function () {
                assert.strictEqual('odiamond', parser.processEdge(odiamondEdge).content.left.type);
            });
            it('edges with right odiamond, should be recognized', function () {
                assert.strictEqual('odiamond', parser.processEdge(odiamondEdge).content.right.type);
            });
            it('edges with right text, should be recognized and text should be extracted', function () {
                assert.strictEqual('orders*', parser.processEdge(odiamondEdge).content.right.text);
                assert.strictEqual('', parser.processEdge(odiamondEdge).content.left.text);
            });
            it('edges with left diamond, should be recognized', function () {
                assert.strictEqual('diamond', parser.processEdge(diamondEdge).content.left.type);
            });
            it('edges with left text, should be recognized and text should be extracted', function () {
                assert.strictEqual('magnitude', parser.processEdge(diamondEdge).content.left.text);
                assert.strictEqual('0..*', parser.processEdge(diamondEdge).content.right.text);
            });
            it('edges with right normal, should be recognized', function () {
                assert.strictEqual('normal', parser.processEdge(diamondEdge).content.right.type);
            });
            it('edges with left empty, should be recognized', function () {
                assert.strictEqual('empty', parser.processEdge(emptyEdge).content.left.type);
            });
            it('edges with right empty, should be recognized', function () {
                assert.strictEqual('empty', parser.processEdge(emptyEdge).content.right.type);
            });
            it('edges with no text should only contain empty texts', function () {
                assert.strictEqual('', parser.processEdge(emptyEdge).content.left.text);
                assert.strictEqual('', parser.processEdge(emptyEdge).content.right.text);
            });
        });
    });
});