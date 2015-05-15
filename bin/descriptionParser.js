'use strict';

var _ = require('lodash');
var util = require('util');
var graphviz = require('graphviz');

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
    else if (_.startsWith(left, '<') || _.startsWith(left, '>')) { leftResult = { type: 'vee', text: left.substring(1,left.length)}; } 
    else if (_.startsWith(left, '^')) { leftResult = { type: 'empty', text: left.substring(1,left.length)}; }
    else { leftResult = { type: 'none', text: left }; }

    if (_.endsWith(right, '<>')) { rightResult = { type: 'odiamond', text: right.substring(0,right.length - 2)}; }
    else if (_.endsWith(right, '++')) { rightResult = { type: 'diamond', text: right.substring(0,right.length - 2)}; }
    else if (_.endsWith(right, '+')) { rightResult = { type: 'odiamond', text: right.substring(0,right.length - 1)}; }
    else if (_.endsWith(right, '<') || _.endsWith(right, '>')) { rightResult = { type: 'vee', text: right.substring(0,right.length - 1)}; } 
    else if (_.endsWith(right, '^')) { rightResult = { type: 'empty', text: right.substring(0,right.length - 1)}; }
    else { rightResult = { type: 'none', text: right }; }

    return { type: 'edge', content: { left: leftResult, right: rightResult, style: style } }
};

var toDocumentModel = function(tokenList) {
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

var escapeLabel = function(label) {
    
};

var recordName = function(label) {
    return _.trim(label.split('|')[0]);
};

var prepareLabel = function(label, orientation) {
    var processedLabel = label;
    if (label.indexOf('|') >= 0) {
        processedLabel = label + "\\n";
        processedLabel = processedLabel.replace(/\|/g, '\\n|');
    }
        
    processedLabel = processedLabel.replace(/;/g, '\\n')
        .replace(/{/g, '\\{')
        .replace(/}/g, '\\}')
        .replace(/;/g, '\\n')
        .replace(/ /g, '\\ ')
        .replace(/</g, '\\<')
        .replace(/>/g, '\\>')
        .replace('\\n\\n', '\\n');

    if (processedLabel.indexOf('|') >= 0 && orientation === 'TD') {
        processedLabel = util.format('{ %s }', processedLabel);
    }
    return processedLabel;
};

var toDotModel = function(tokenList) {
    var orientation = (tokenList.length > 5) ? 'TD': 'LR';
    var nodeMap = {};
    
    var g = graphviz.digraph("G");
    g.set('ranksep' , 1);
    g.set('rankdir', orientation);

    for (var i = 0; i < tokenList.length; i++) {
        var token = tokenList[i];

        if (token.type === 'cluster') {
            var cuid = 'cluster_A' + _.size(nodeMap);
            if (nodeMap[recordName(token.content.text)]) { continue; }
            var subGraph = g.addCluster(cuid);
            nodeMap[recordName(token.content.text)] = subGraph;
            subGraph.set('label', token.content.text);
            subGraph.set('fontsize', 10);

            _.forEach(token.content.nodeNames, function (element) {
                if (nodeMap[recordName(element)]) {
                    subGraph.addNode(nodeMap[element].id);
                }
            });
        } else if (_.contains(['note', 'record'], token.type)) {
            if (nodeMap[recordName(token.content.text)]) { continue; }
            var uid = 'A' + _.size(nodeMap);
            var node = g.addNode(uid, {
                'shape': token.type,
                'height': 0.5,
                'fontsize': 10,
                'margin': "0.20, 0.05",
                label: prepareLabel(token.content.text, orientation)
            });
            if (token.content.background) {
                node.set('style', 'filled');
                node.set('fillcolor', token.content.background);
            }
            nodeMap[recordName(token.content.text)] = node;
        }
    }

    for (var j = 0; j < tokenList.length; j++) {
        var t = tokenList[j];
        if (t.type === 'edge' && tokenList[j-1] && tokenList[j+1]) {
            var leftNode = nodeMap[recordName(tokenList[j-1].content.text)];
            var rightNode = nodeMap[recordName(tokenList[j+1].content.text)];
            var edge = t;

            var e = g.addEdge( leftNode, rightNode,
                {
                    'dir': 'both',
                    'arrowtail': edge.content.left.type,
                    'taillabel': edge.content.left.text,
                    'arrowhead': edge.content.right.type,
                    'headlabel': edge.content.right.text,
                    'labeldistance': 2,
                    'fontsize':10,
                    'style': ((tokenList[j-1].type === 'note' || tokenList[j+1].type === 'note') ? 'dashed' : edge.content.style)
                });
        }
    }
    
    return g.to_dot();
};
/*
var toDotModel = function(tokenList) {
    var orientation = (tokenList.length > 5) ? 'LR' : 'TD';
    
    var nodeMap = {};
    var g = [];
    g.push('digraph G {');
    g.push(util.format('ranksep = %s', 1));
    g.push(util.format('rankdir = %s', orientation));
    
    for (var i = 0; i < tokenList.length; i++) {
        var token = tokenList[i];

        if (token.type === 'cluster') {
            var cluster = token;
            var cuid = 'cluster_A' + _.size(nodeMap);
            if (nodeMap[recordName(cluster.content.text)]) { continue; }
            nodeMap[recordName(cluster.content.text)] = cuid;

            g.push(util.format('subgraph %s {', cuid));
            g.push(util.format('label = "%s"', cluster.content.text));
            g.push(util.format('fontsize = 10'));

            // font-handling???

            _.forEach(cluster.content.nodeNames, function (element) {
                g.push(util.format('%s', nodeMap[element]));
            });
            g.push(util.format('}'));
        } else if (token.type === 'note' || token.type === 'record') {
            if (nodeMap[recordName(token.content.text)]) { continue; }
            var uid = 'A' + _.size(nodeMap);
            nodeMap[recordName(token.content.text)] = uid;

            g.push('node [');
            g.push(util.format('shape = "%s"', token.type));
            g.push(util.format('height = 0.5'));
            g.push(util.format('fontsize = 10'));
            g.push(util.format('margin = "0.20,0.05"'));
            g.push(']');
            g.push(util.format(' %s [', uid));

            var label;
            if (token.content.text.indexOf('|') >= 0) {
                label = token.content.text + "\\n";
                label = label.replace(/\|/g, '\\n|');
            } else {
                label = token.content.text.replace(/;/g, '\\n');
            }
            label = escapeLabel(label);

            if (label.indexOf('|') >= 0 && orientation === 'TD') {
                label = util.format('{ %s }', label);
            }
            g.push(util.format(' label = "%s"', label));
            if (token.content.background) {
                g.push(util.format('style = "filled"'));
                g.push(util.format('fillcolor = "%s"', token.content.background));
            }

            g.push(']');
        }
    }
    
    for (var j = 0; j < tokenList.length; j++) {
        var t= tokenList[j];
        if (t.type === 'edge' && tokenList[j-1] && tokenList[j+1]) {
            var leftNode = tokenList[j-1];
            var rightNode = tokenList[j+1];
            var edge = t;
            
            g.push('edge [');
            g.push(util.format('shape = "%s"', edge.type));
            g.push(util.format('dir = "both"'));
            if (leftNode.type === 'note' || rightNode.type === 'note') {
                g.push('style = "dashed"');
            } else {
                g.push(util.format('style = "%s"', edge.content.style));
            }
            g.push(util.format('arrowtail = "%s"', edge.content.left.type));
            g.push(util.format('taillabel = "%s"', edge.content.left.text));
            g.push(util.format('arrowhead = "%s"', edge.content.right.type));
            g.push(util.format('headlabel = "%s"', edge.content.right.text));
            g.push('labeldistance = 2');
            g.push('fontsize = 10');
            g.push(']');
            g.push(util.format('    %s -> %s',
                nodeMap[recordName(leftNode.content.text)], 
                nodeMap[recordName(rightNode.content.text)]));
        }
    }
    g.push('}');
    
    return g.join('\n');
};
*/
var process = function(input) {
    var tokenList = tokenize(input);
    var documentModel = toDocumentModel(tokenList);
    return toDotModel(documentModel);
};

module.exports.process = process;

    module.exports.tokenize = tokenize;
    module.exports.isNote = isNote;
    module.exports.isClass = isClass;
    module.exports.isEdge = isEdge;
    module.exports.isCluster = isCluster;
    module.exports.processNote = processNote;
    module.exports.processClass = processClass;
    module.exports.processCluster = processCluster;
    module.exports.processEdge = processEdge;
    module.exports.determineBackgroundColor = determineBackgroundColor;