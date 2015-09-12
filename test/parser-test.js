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
        "[Order]-[note:Aggregate root.] \n" +
        "[My Cluster [Order][Customer]]->[Bar]";    

    var testUseCaseInput = "[actor:User]->(Customer)->(Order)";

    describe('When given an input-string, the toDocumentModel ...', function () {
        
        var underTest = parser.create({});
        
        it('should create a corresponding model for the class-input', function () {
            assert.deepEqual(
                underTest.toDocumentModel(testClassInput)[0],
                {type: 'record', content: {link: '', background: '', text: 'ICustomer|+name;+email|'}});
            assert.deepEqual(
                underTest.toDocumentModel(testClassInput)[1],
                { type: 'edge', content: {text: '', left: {type: 'empty', text: ''}, right: {type: 'none', text: ''}, style: 'dashed'}});
            assert.deepEqual(
                underTest.toDocumentModel(testClassInput)[11],
                {type: 'note', content: {link: '',background: '', text: 'Aggregate root.'}});
            assert.deepEqual(
                underTest.toDocumentModel(testClassInput)[12],
                {type: 'cluster', content: {background: '', text: 'My Cluster', nodeNames:['Order','Customer']}});
            assert.deepEqual(
                underTest.toDocumentModel(testClassInput)[13].type, 'edge');
            assert.deepEqual(
                underTest.toDocumentModel(testClassInput)[14],
                {type: 'record', content: {link: '',background: '', text: 'Bar'}});
        });
        it('should create a corresponding model for the sequence-input', function () {
            assert.deepEqual(
                underTest.toDocumentModel(testSequenceInput)[0], 
                { type: 'record', content: { link: '',background: '', text: 'Patron' } });
            assert.deepEqual(
                underTest.toDocumentModel(testSequenceInput)[1],
                { type: 'edge', content: {text: '', left: {type: 'none', text: ''}, right: {type: 'normal', text: 'order food'}, style: 'solid'}});
        });
    });
    
    describe('When given an input-string, the tokenizer ...', function () {
        
        var delimiterConfig = { startNodeSigns: ['[', '('], endNodeSigns: [']', ')']}
        
        it('should extract 18 (6 edges + 12 nodes) tokens for our test-sequence diagram ', function () {
            assert.strictEqual(parser.tokenize(testSequenceInput, delimiterConfig).length, 18);
        });
        
        it('should extract 5 (3 nodes + 2 edges) tokens for our test-useCase diagram ', function () {
            assert.strictEqual(parser.tokenize(testUseCaseInput, delimiterConfig).length, 5);
        });
        
        it('should extract 13 (1 comment + 5 edges + 10 nodes) tokens from our class-diagram input', function () {
            assert.strictEqual(parser.tokenize(testClassInput, delimiterConfig).length, 16);
        });
        
        it('should place the tokens on expected positions based on the input-order', function () {
            assert.strictEqual(parser.tokenize(testClassInput, delimiterConfig)[1], "[ICustomer|+name;+email|]");
            assert.strictEqual(parser.tokenize(testClassInput, delimiterConfig)[2], "^-.-");
            assert.strictEqual(parser.tokenize(testClassInput, delimiterConfig)[3], "[Customer]");
            assert.strictEqual(parser.tokenize(testClassInput, delimiterConfig)[12], "[note:Aggregate root.]");
        });
        
        it('should not produce any empty tokens', function () {
            for (var token in parser.tokenize(testClassInput, delimiterConfig)) {
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
        it('should detect a normal ellipse-token', function () {
            assert.strictEqual(parser.isEllipse('(class)'), true);
        });
        it('should detect an empty ellipse-token', function () {
            assert.strictEqual(parser.isEllipse('()'), true);
        });
        it('should not detect a ellipse-token that has leading spaces', function () {
            assert.strictEqual(parser.isEllipse('  ( Text)'), false);
        });
        it('should not detect a ellipse-token if it does not end with )', function () {
            assert.strictEqual(parser.isEllipse('( Text) '), false);
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
            it('should extract the class\' background as "cornsilk"', function () {
                assert.strictEqual(parser.determineBackgroundColor('[note: This is a damn long text {bg:cornsilk}]'),
                    'cornsilk');
            });
            it('should extract the ellipses background as "cornsilk"', function() {
                assert.strictEqual(parser.determineBackgroundColor('(This is a damn long text {bg:cornsilk})'),
                    'cornsilk');
            });
        });
        
        describe('determineLink - should extract the link from:', function() {
            it('from node with exact definition', function() {
                assert.strictEqual(parser.determineLink('[note: This is a damn long text {link:http://www.google.de}]'), 
                'http://www.google.de')                
            });
            it('definition with leading and trailing spaces', function() {
                assert.strictEqual(parser.determineLink('[note: This is a damn long text {  link:http://www.google.de  }]'),
                    'http://www.google.de')
            });
            it('definition with other definitions like background-color', function() {
                assert.strictEqual(parser.determineLink('[note: This is a damn long text {  link:http://www.google.de , bg:cornsilk }]'),
                    'http://www.google.de')
            });
            it('definition with other definitions like background-color all without whitespaces', function() {
                assert.strictEqual(parser.determineLink('[note: This is a damn long text {link:http://www.google.de;bg:cornsilk}]'),
                    'http://www.google.de')
            });
        });

        describe('collectUntil - which ...', function() {
            
            var edgeSignDelimiter = '-';
            var testToken = 'This_should_Be a test ----Something in Between---I am_useless--And something at the End';
            
            it('should extract the text at the beginning of an edge until the first edge sign -', function() {
                assert.strictEqual(parser.collectUntil(testToken, edgeSignDelimiter, parser.LookAt.START), 'This_should_Be a test ');                    
            });
            it('should extract the text at the beginning (since this is the default) of an edge until configured delimiter', function() {
                assert.strictEqual(parser.collectUntil(testToken, '_'), 'This');
            });
            it('should extract the text at the end of an edge', function() {
                assert.strictEqual(parser.collectUntil(testToken, edgeSignDelimiter, parser.LookAt.END), 'And something at the End');
            });
            it('should eagerly extract the text in between the delimiter', function() {
                assert.strictEqual(parser.collectUntil(testToken, edgeSignDelimiter, parser.LookAt.BETWEEN), 
                    'Something in Between---I am_useless');
            });
            it('should extract the text in between the delimiter', function() {
                assert.strictEqual(parser.collectUntil('_This is a Test_', '_', parser.LookAt.BETWEEN),
                    'This is a Test');
            });
            it('should extract nothing if there is nothing to be extracted', function() {
                assert.strictEqual(parser.collectUntil('Foo----Bar', '-', parser.LookAt.BETWEEN),'');
                assert.strictEqual(parser.collectUntil('Foo----Bar', '-', parser.LookAt.START),'Foo');
                assert.strictEqual(parser.collectUntil('Foo----Bar', '-', parser.LookAt.END),'Bar');
            })
        });
        
        describe('processNote - which ...', function() {
            it('should recognize notes with only one containing text and a background-color (the last one will be picked)', function () {
                assert.deepEqual(
                    parser.processNote('[note: This is a damn long text {bg:green}{link:http://www.golem.de; bg:yellow}]').content,
                    {link: 'http://www.golem.de',background: 'green', text: 'This is a damn long text'});
            });

            it('should recognize a regular note containing text and bg-infos', function () {
                assert.deepEqual(
                    parser.processNote('[note: This is a damn long text {bg:green}]').content,
                    {link: '',background: 'green', text: 'This is a damn long text'});
            });

            it('should recognize a text-only note (without background)', function () {
                assert.deepEqual(
                    parser.processNote('[note: This is a damn long text]').content,
                    {link: '',background: '', text: 'This is a damn long text'});
            });

            it('should create model-entries of type "note"', function () {
                assert.strictEqual(parser.processNote('[note: This is a damn long text]').type, 'note');
            });
        });
        describe('processEllipse - which ...', function() {
            it('should create model-entries of type "ellipse"', function() {
                assert.strictEqual(parser.processEllipse('(This is a Ellipse)').type, 'ellipse');                
            });
            it('should extract the contained text', function() {
                assert.strictEqual(parser.processEllipse('(This is a Ellipse)').content.text, 'This is a Ellipse');
            });
            it('should extract background definitions', function() {
                assert.strictEqual(parser.processEllipse('(This is a Ellipse {bg:green})').content.background, "green");
            });
        });
        describe('processClass - which ...', function() {
            it('should create model-entries of type "record"', function () {
                assert.strictEqual(parser.processClass('[This is a Class]').type, 'record');
            });
            it('should extract the contained text', function() {
                assert.strictEqual(parser.processClass('[This is |a Class]').content.text, 'This is |a Class');
            });
            it('should extract background definitions', function() {
                assert.strictEqual(parser.processClass('(This is a Class {bg:green})').content.background, "green");
            });
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