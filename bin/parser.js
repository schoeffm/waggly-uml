'use strict';

var _ = require('lodash');
var util = require('util');

var tokenize = function(umlDescription) {
    var words = [];
    var word = '';
    var shapeDepth = 0;
    var pushNonEmptyWords = function(wordCandidate, list) {
        if (!_.isEmpty(_.trim(wordCandidate))) { list.push(_.trim(wordCandidate)); }
    };
    for (var i = 0; i < umlDescription.length; i++) {
        var character = umlDescription[i];
        if (character === '[') { shapeDepth += 1; }
        else if (character === ']') { shapeDepth -= 1; }

        if (shapeDepth === 1 && character == '[') {
            pushNonEmptyWords(word, words);
            word = character;
            continue;
        }
        word += character;
        if (shapeDepth === 0 && character == ']') {
            pushNonEmptyWords(word, words);
            word = '';
        }
    }
    if (word) {
        pushNonEmptyWords(word, words);
    }
    return words;
};


var isEdge = function(token) {
    return token.indexOf('-') >= 0;
};
var isNote = function(token) {
    return _.startsWith(token.toLowerCase(), '[note:');
};
var isClass = function(token) {
    return _.startsWith(token, '[') && _.endsWith(token, ']');
};
var isCluster = function(token) {
    var stripped = token.substring(1, token.length);
    return stripped.indexOf('[') >= 0 && stripped.lastIndexOf(']') >= 0
};



var determineBackgroundColor = function(token) {
    var regex = /\{bg:([A-Za-z0-9#]+)?\}\]$/;
    var match = regex.exec(token);
    return (match) ? match[1] : '';
};

var extractText = function(token, start, end) {
    var startIndex = token.indexOf(start) + 1;
    var endIndex = (token.lastIndexOf('{bg') >= 0)
        ? token.lastIndexOf('{bg')
        : token.lastIndexOf(end);
    return _.trim(token.substring(startIndex, endIndex));
};

var processNote = function(noteToken) {
    return {
        type: 'note',
        content: {
            background: determineBackgroundColor(noteToken),
            text: extractText(noteToken, ':',']')
        }
    };
};

var processClass = function(classToken) {
    return {
        type: 'record',
        content: {
            background: determineBackgroundColor(classToken),
            text: extractText(classToken, '[',']')
        }
    };
};

var processCluster = function(clusterTocken) {
    var startIndex = clusterTocken.indexOf('[') + 1;
    var endIndex = clusterTocken.indexOf('[', startIndex);

    var parts = clusterTocken.substring(1,clusterTocken.lenght).split('[');
    var nodes = _.filter(parts, function(element) { return element.indexOf(']') >= 0; });
    var trimmedNodes = _.map(nodes, function(element) {
        var endIndex = element.indexOf(']');
        return element.substring(0,endIndex);
    });

    return {
        type: 'cluster',
        content: {
            background: determineBackgroundColor(clusterTocken),
            text: _.trim(clusterTocken.substring(startIndex, endIndex)),
            nodeNames: trimmedNodes
        }
    };
};

var processEdge = function(edgeToken) {
    var style = (edgeToken.indexOf('-.-') >= 0) ? 'dashed' : 'solid';
    var edges = (edgeToken.indexOf('-.-') >= 0) ? edgeToken.split('-.-') : edgeToken.split('-');

    var left = edges[0];
    var right = edges[1];

    var leftResult;
    var rightResult;

    if (_.startsWith(left, '<>')) { leftResult = { type: 'odiamond', text: left.substring(2,left.length)}; }
    else if (_.startsWith(left, '++')) { leftResult = { type: 'diamond', text: left.substring(2,left.length)}; }
    else if (_.startsWith(left, '+')) { leftResult = { type: 'odiamond', text: left.substring(1,left.length)}; }
    else if (_.startsWith(left, '<') || _.startsWith(left, '>')) { leftResult = { type: 'normal', text: left.substring(1,left.length)}; }
    else if (_.startsWith(left, '^')) { leftResult = { type: 'empty', text: left.substring(1,left.length)}; }
    else { leftResult = { type: 'none', text: left }; }

    if (_.endsWith(right, '<>')) { rightResult = { type: 'odiamond', text: right.substring(0,right.length - 2)}; }
    else if (_.endsWith(right, '++')) { rightResult = { type: 'diamond', text: right.substring(0,right.length - 2)}; }
    else if (_.endsWith(right, '+')) { rightResult = { type: 'odiamond', text: right.substring(0,right.length - 1)}; }
    else if (_.endsWith(right, '<') || _.endsWith(right, '>')) { rightResult = { type: 'normal', text: right.substring(0,right.length - 1)}; }
    else if (_.endsWith(right, '^')) { rightResult = { type: 'empty', text: right.substring(0,right.length - 1)}; }
    else { rightResult = { type: 'none', text: right }; }

    return { type: 'edge', content: { left: leftResult, right: rightResult, style: style } }
};

var toDocumentModel = function(input) {
    var tokenList = tokenize(input);
    
    var dotTokens = [];
    for (var i = 0; i < tokenList.length; i++) {
        var token = tokenList[i];
        if (_.startsWith(token, '//')) {
            continue;                               // skip comments
        } else if (isNote(token)) {
            dotTokens.push(processNote(token));    // process notes
        } else if (isCluster(token)) {
            dotTokens.push(processCluster(token)); // process cluster
        } else if (isClass(token)) {
            dotTokens.push(processClass(token));   // process classes
        } else if (isEdge(token)) {
            dotTokens.push(processEdge(token));    // process edges
        }
    }
    return dotTokens;
};

module.exports.toDocumentModel = toDocumentModel;

if (process.env.exportForTesting) {     // only export these things for testing
    module.exports.tokenize = tokenize;
    
    module.exports.determineBackgroundColor = determineBackgroundColor;
    
    module.exports.isNote = isNote;
    module.exports.isClass = isClass;
    module.exports.isEdge = isEdge;
    module.exports.isCluster = isCluster;
    
    module.exports.processNote = processNote;
    module.exports.processClass = processClass;
    module.exports.processCluster = processCluster;
    module.exports.processEdge = processEdge;
}