'use strict';

var assert = require("assert");
var path = require('path');
var underTest = require('../bin/svg/svgPostProcessor');
var _ = require('lodash');


var testFixture = 
    '<svg width="80pt" height="117pt"' +
    ' viewBox="0.00 0.00 80.00 117.00" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
    '    <g id="graph0" class="graph" transform="scale(1 1) rotate(0) translate(4 113)">' +
    '    <title>G</title>' +
    '    <a xlink:href="http://www.wuml.it" xlink:title="FamMainView">' +
    '       <polygon fill="white" stroke="none" points="-4,4 -4,-113 76,-113 76,4 -4,4"/>' +
    '    </a>' +
    '    <g id="node1" class="node"><title>A0</title>' +
    '    <polygon fill="none" stroke="black" points="0,-0.5 0,-108.5 72,-108.5 72,-0.5 0,-0.5"/>' +
    '    <text text-anchor="middle" x="36" y="-51.5" font-family="Dadhand" font-size="10.00">actor:User</text>' + 
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

describe("'fontInjectionPostProcessor'", function() {
    it('... will inject the Dadhand-font definition if waggly is true', function() {
        var result = underTest.fontInjectionPostProcessor(testFixture, { waggly: true });
        assert(_.contains(result, 'font-family="Dadhand"'));
    });
    it('... for non-waggly stuff nothing will be injected', function() {
        var result = underTest.fontInjectionPostProcessor(testFixture, { waggly: false });
        assert.deepEqual(result, testFixture);
    });    
});

describe("'onClickInjectionPostProcessor'", function() {
    var testFixtureWithoutLink =
        '<svg width="80pt" height="117pt" ' +
        'viewBox="0.00 0.00 80.00 117.00" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '    <g id="graph0" class="graph" transform="scale(1 1) rotate(0) translate(4 113)">' +
        '    <title>G</title>' +
        '    <polygon fill="white" stroke="none" points="-4,4 -4,-113 76,-113 76,4 -4,4"/>' +
        '    <g id="node1" class="node"><title>A0</title>' +
        '    <polygon fill="none" stroke="black" points="0,-0.5 0,-108.5 72,-108.5 72,-0.5 0,-0.5"/>' +
        '    <text text-anchor="middle" x="36" y="-51.5" font-family="Dadhand" font-size="10.00">actor:User</text>' +
        '</g></g>' +
        '</svg>';
    
    it('... will inject a click-listener function on all a-tags', function() {
        var result = underTest.onClickInjectionPostProcessor(testFixture, {});
        assert(_.contains(result, '<a xlink:href="http://www.wuml.it" xlink:title="FamMainView" onclick="wuml.onNavigation(evt);'));
        assert(_.contains(result, 'wuml.onNavigation = function(e) {'));
    });
    
    it("... won't inject any javascript when no link is contained", function() {
        var result = underTest.onClickInjectionPostProcessor(testFixtureWithoutLink, {});
        assert(! _.contains(result, '<a xlink:href="http://www.wuml.it" xlink:title="FamMainView" onclick="wuml.onNavigation(evt);'));
        assert(! _.contains(result, 'wuml.onNavigation = function(e) {'));
    })
});

describe("'encodingReplacementProcessor'", function() {
    var testFixtureWithEncoding = '<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>' +
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' +
        '<svg version="1.1" baseProfile="full" id="body" width="10in" height="10in" ' +
        'viewBox="0 0 1 1" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" ' +
        'xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:ev="http://www.w3.org/2001/xml-events">' +
        '<title>SVG drawing</title>';
    
    it('... will just replace any predefined encoding with UTF-8', function() {
        var result = underTest.encodingReplacementProcessor(testFixtureWithEncoding);
        assert(_.contains(result, 'encoding="UTF-8"'));        
    });

    it('... will do nothing if no encoding was defined', function() {
        var result = underTest.encodingReplacementProcessor(
            testFixtureWithEncoding.replace('encoding="ISO-8859-1"', ''));
        assert(! _.contains(result, 'encoding="UTF-8"'));
    });
});