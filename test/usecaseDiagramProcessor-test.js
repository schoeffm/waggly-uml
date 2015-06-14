'use strict';

var assert = require("assert");
var exec = require('child_process').exec;
var path = require('path');
var underTest = require('../bin/dot/useCaseDiagramProcessor');
var parser = require('../bin/parser');
var fs = require('fs');
var waggly = require('wsvg');
var _ = require('lodash');


describe("'usecaseDiagramProcessor'", function() {
    
    
    
    describe("toDotModel will ...", function() {
        it("... create note-nodes of 0.5x0.5 size", function() {
            var result = underTest.toDotModel([{type: 'note', content: {text: 'Foo' }}]);
            assert(_.contains(result, 'height = 0.5'));   
            assert(_.contains(result, 'width = 0.5'));   
        });
        it("... create bigger nodes for use cases of 0.8x1.5 size", function() {
            var result = underTest.toDotModel([{type: 'ellipse', content: {text: 'Foo' }}]);
            assert(_.contains(result, 'height = 0.8'));
            assert(_.contains(result, 'width = 1.5'));
        });
        it("... create actor placeholder squares of 1.5x1.0 size", function() {
            var result = underTest.toDotModel([{type: 'record', content: {text: 'actor:Foo' }}]);
            assert(_.contains(result, 'height = 1.5'));
            assert(_.contains(result, 'width = 1'));
        });
        it("... create ellipsis although its a record of size of 1.5x1.0 size", function() {
            var result = underTest.toDotModel([{type: 'record', content: {text: 'Foo' }}]);
            assert(_.contains(result, 'height = 0.8'));
            assert(_.contains(result, 'width = 1.5'));
            assert(_.contains(result, 'shape = ellipse'));
        });
        
        it('... create a diagram where the default-orientation is Left-to-Right', function() {
            var result = underTest.toDotModel([{type: 'record', content: {text: 'actor:Foo' }}]);
            assert(_.contains(result, 'rankdir = LR'));
        });
        
        it('... create labeled edges (where only one label will be interpreted)', function() {
            var result = underTest.toDotModel(
                [{
                    type: 'record', content: {text: 'actor:Foo' }},
                    {type: 'edge', content: { left: {type: "none", text: 'testLabel1'}, right: {type: "none", text: 'testLabel2'}, style: 'solid'}},
                    {type: 'record', content: {text: 'Bar' }}
                ]);
            assert(_.contains(result, 'label = "testLabel2"'))
        });
    });
    
});