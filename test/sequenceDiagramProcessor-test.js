'use strict';

var assert = require("assert");
var exec = require('child_process').exec;
var path = require('path');
var sequenceParser = require('../bin/pic2plot/sequenceDiagramProcessor');
var parser = require('../bin/parser');
var fs = require('fs');
var waggly = require('wsvg');
var _ = require('lodash');

describe("'sequenceDiagramProcessor'", function() {
    
    describe("when processing a given token-list 'collectObjects' should", function() {
        var testTokenList = [
            {type: 'record', content: {background: '', text: 'Patron'}},
            {
                type: 'edge', content: {
                left: {type: "none", text: ''},
                right: {type: "normal", text: "order food"},
                style: 'solid'
            }
            },
            {type: 'record', content: {background: '', text: 'Waiter'}},
            {type: 'record', content: {background: 'green', text: 'Waiter'}},
            {type: 'record', content: {background: 'green', text: 'IsolatedNode'}},
            {type: 'record', content: {background: '', text: 'actor:IsolatedNode'}}
        ];
        
        it('... extract only unique objects', function() {
            assert.equal(_.size(testTokenList), 6);
            assert.equal(_.size(sequenceParser.collectObjects(testTokenList)), 4);            
        });
        
        it('... enhance all recored-tokens with a unique id', function() {
            _.forEach(sequenceParser.collectObjects(testTokenList), function(value, key) {
                assert(value.uid);                
            });
        });
    });

    describe("when processing a given token-list 'collectMessages' should", function() {
        var objectMap4tokenListWithIdenticalMessages;
        
        var testTokenListWithIdenticalMessages = [
            {type: 'record', content: {background: '', text: 'Patron'}},
            {
                type: 'edge', content: {
                left: {type: "none", text: ''},
                right: {type: "normal", text: "order food"},
                style: 'solid'
            }
            },
            {type: 'record', content: {background: '', text: 'Waiter'}},
            {type: 'record', content: {background: 'green', text: 'Waiter'}},
            {
                type: 'edge', content: {
                left: {type: "none", text: 'order food'},
                right: {type: "normal", text: "no matter what's up"},
                style: 'solid'
            }
            },
            {type: 'record', content: {background: 'green', text: 'IsolatedNode'}}
        ];
        
        beforeEach(function(){
            objectMap4tokenListWithIdenticalMessages = 
                sequenceParser.collectObjects(testTokenListWithIdenticalMessages);
        });
        
        it('... collect every message (even if there a duplicates)', function() {
            assert.equal(_.size(sequenceParser.collectMessages(testTokenListWithIdenticalMessages, 
                objectMap4tokenListWithIdenticalMessages)), 2);
        });

        it('... enhance all recored-tokens with a unique id', function() {
            _.forEach(sequenceParser.collectMessages(testTokenListWithIdenticalMessages, 
                objectMap4tokenListWithIdenticalMessages), function(value, key) {
                assert(value.uid1);
                assert(value.uid2);
            });
        });

        it('... get just one text (when in doubt, the left one is ours!', function() {
            assert.strictEqual(sequenceParser.collectMessages(testTokenListWithIdenticalMessages, 
                objectMap4tokenListWithIdenticalMessages)['Lin4'].text, 'order food');
        });
    });
    describe("when created a cache full of objects 'filterPassiveObjects' should", function() {
        var lookupCache = {
            Lin1: { type: 'edge', text: 'create', to: { content: {text: 'passive'}}, content: { left: {}, right: {}, style: 'solid'}},
            Lin2: { type: 'edge', text: 'bar()', to: { content: {text: 'active'}},  content: { left: {}, right: {}, style: 'dashed'}},
            Lin3: { type: 'edge', text: 'foo()', to: { content: {text: 'active'}}, content: { left: {}, right: {}, style: 'solid'}}
        };
        var objectCache = {
            Obj1: { type: 'record', content: {text: 'actor:foo'} }    
        };

        it('... identify all passive objects due to create-messages', function() {
            assert.strictEqual(_.size(sequenceParser.filterPassiveObjects(lookupCache, objectCache)), 2);
            assert.deepEqual(sequenceParser.filterPassiveObjects(lookupCache, objectCache)['passive'], { content: {text: 'passive'}});
        });
    });
    
    describe("when created a cache full of messages 'mapMessageType' should", function() {
        var createMessage = { type: 'edge', text: 'create', uid1: 'Rec0', uid2: 'Rec1', content: { left: {}, right: {}, style: 'solid' } };
        var returnMessage = { type: 'edge', text: 'bar()', uid1: 'Rec0', uid2: 'Rec1', content: { left: {}, right: {}, style: 'dashed' } };
        var normalMessage = { type: 'edge', text: 'foo()', uid1: 'Rec0', uid2: 'Rec1', content: { left: {}, right: {}, style: 'solid' } };
        
        it('... recognize when we got a create-message', function() {
            assert.strictEqual(sequenceParser.mapMessageType(createMessage), 'cmessage');
        });
        
        it('... recognize when we got a return-message', function() {
            assert.strictEqual(sequenceParser.mapMessageType(returnMessage), 'return_message');
        });
        
        it('... recognize when we got a normal-message', function() {
            assert.strictEqual(sequenceParser.mapMessageType(normalMessage), 'message');
        });
    });
    
    describe("'when processing a given token-list 'toPicModel' should", function() {
        
        var testSequenceInput = "// this is a comment \n" +
            "[Patron]-order food>[Waiter] \n" +
            "[Waiter]-create>[Cook] \n" +
            "[Waiter]-.-serve wine>[Patron] \n" +
            "[Cook]<pickup-[Waiter] \n" +
            "[Waiter]-serve food>[Patron] \n" +
            "[Patron]-pay>[Cashier]";
        
        var expectedSequenceOutput = 
            'underline=0;\n' +
            'object(Rec0,"Patron",20);\n' +
            'object(Rec2,"Waiter",20);\n' +
            'pobject(Rec5,"Cook",20);\n' +
            'object(Rec17,"Cashier",20);\n' +
            'step();\n' +
            'active(Rec0);\n' +
            'active(Rec2);\n' +
            'active(Rec17);\n' +
            'message(Rec0,Rec2,"order food");\n' +
            'cmessage(Rec2,Rec5,"Cook");\n' +
            'active(Rec5);\n' +
            'return_message(Rec2,Rec0,"serve wine");\n' +
            'message(Rec2,Rec5,"pickup");\n' +
            'message(Rec2,Rec0,"serve food");\n' +
            'message(Rec0,Rec17,"pay");\n' +
            'step();\n' +
            'complete(Rec0);\n' +
            'complete(Rec2);\n' +
            'complete(Rec5);\n' +
            'complete(Rec17);\n' +
            'step();\n' +
            '.PE'; 
        
        
        it('... create an expected output that is a valid pic-format', function(done) {
            sequenceParser.processString(testSequenceInput, function(transformed) {
                assert(_.endsWith(transformed, expectedSequenceOutput));
                done();
            });
        });
        it('... creates an equal amount of complete/active/object entries', function(done) {
            sequenceParser.processString(testSequenceInput, function(transformed) {
                var result = _.countBy(transformed.split(/\n/), function(element) {
                    return element.substring(0, element.indexOf('('));
                });
                assert(result['object'], 4);
                assert(result['pobject'], 1);
                assert(result['active'], 4);
                assert(result['complete'], 4);
                assert(result['message'], 6);
                done();
            });
        });
    });
});
    
