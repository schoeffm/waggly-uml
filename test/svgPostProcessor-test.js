'use strict';

var assert = require("assert");
var path = require('path');
var underTest = require('../bin/svg/svgPostProcessor');
var _ = require('lodash');


var testFixture = 
    '<svg width="80pt" height="117pt"' +
    'viewBox="0.00 0.00 80.00 117.00" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
    '    <g id="graph0" class="graph" transform="scale(1 1) rotate(0) translate(4 113)">' +
    '    <title>G</title>' +
    '    <polygon fill="white" stroke="none" points="-4,4 -4,-113 76,-113 76,4 -4,4"/>' +
    '    <g id="node1" class="node"><title>A0</title>' +
    '    <polygon fill="none" stroke="black" points="0,-0.5 0,-108.5 72,-108.5 72,-0.5 0,-0.5"/>' +
    '    <text text-anchor="middle" x="36" y="-51.5" font-family="Times,serif" font-size="10.00">actor:User</text>' + 
    '</g></g>' +
    '</svg>';


describe("'actorSubstitutionPostProcessor'", function() {
   it('... will translate the substitution to the correct position (22, -81.5)', function() {
       var result = underTest.actorSubstitutionPostProcessor(testFixture);
       assert(_.contains(result, 'g transform="translate(22 -81.5)"'));
   });
    it('... will also place a Text containing the actor label (without prefix)', function() {
        var result = underTest.actorSubstitutionPostProcessor(testFixture);
        assert(_.contains(result, 'font-size="10.00">User</text>'));
    });
});