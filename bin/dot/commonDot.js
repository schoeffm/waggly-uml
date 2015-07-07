'use strict';

var util = require('util');
var _ = require('lodash');
var c = require('./../constants');

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

var _setBackgroundIfDefined = function(node, token) {
    if (token.content.background) {
        node.set('style', 'filled');
        node.set('fillcolor', token.content.background);
    }
};

var edgeHandlers = {
    edgeUsingConfig: function (edgeToken, tokenBefore, tokenAfter, config, g, nodeLookupCache) {
        if (c.is(edgeToken.type, c.NODE_TYPE_EDGE) && tokenBefore && tokenAfter) {
            var leftNode = nodeLookupCache[recordName(tokenBefore.content.text)];
            var rightNode = nodeLookupCache[recordName(tokenAfter.content.text)];
            if (tokenBefore.type === 'cluster') {
                config = _.merge( { ltail : nodeLookupCache[recordName(tokenBefore.content.text)].id }, config );
                leftNode = nodeLookupCache[recordName(tokenBefore.content.nodeNames[0])];
            }
            if (tokenAfter.type === 'cluster') {
                config = _.merge( { lhead: nodeLookupCache[recordName(tokenAfter.content.text)].id }, config );
                rightNode = nodeLookupCache[recordName(tokenAfter.content.nodeNames[0])];
            }

            g.addEdge(leftNode, rightNode, config);
        }
    },
    edge: function (edgeToken, tokenBefore, tokenAfter, g, nodeLookupCache) {
        if (c.is(edgeToken.type, c.NODE_TYPE_EDGE) && tokenBefore && tokenAfter) {
            edgeHandlers.edgeUsingConfig(edgeToken, tokenBefore, tokenAfter,
                {
                    'dir': 'both',
                    'arrowtail': edgeToken.content.left.type,
                    'arrowhead': edgeToken.content.right.type,
                    'label': edgeToken.content.right.text || edgeToken.content.left.text || '',
                    'labeldistance': 2,
                    'fontsize': 10,
                    'style': ((c.is(tokenBefore.type, c.NODE_TYPE_NOTE) || c.is(tokenAfter.type, c.NODE_TYPE_NOTE))
                        ? 'dashed' : edgeToken.content.style)
                }, g, nodeLookupCache);
        }
    }
};

var nodeHandlers = {
    nodeUsingConfig: function(token, config, g, nodeLookupCache) {
        if (nodeLookupCache[recordName(token.content.text)]) { return; }
        var uid = 'A' + _.size(nodeLookupCache);
        var node = g.addNode(uid, config);
        
        _setBackgroundIfDefined(node, token);
        
        nodeLookupCache[recordName(token.content.text)] = node;
    },
    note: function(token, g, nodeLookupCache) {
        if (nodeLookupCache[recordName(token.content.text)]) { return; }
        var uid = 'A' + _.size(nodeLookupCache);
        var node = g.addNode(uid, {
            'shape': (token.type !== 'record' || _.startsWith(token.content.text, c.NODE_TYPE_PRECISION_ACTOR)) ? token.type : 'ellipse',
            'height': (_.startsWith(token.content.text, c.NODE_TYPE_PRECISION_ACTOR) ? 1.5 : 0.8),
            'width': (_.startsWith(token.content.text, c.NODE_TYPE_PRECISION_ACTOR) ? 1 : 1.5),
            'fontsize': 10,
            'margin': "0.20, 0.05",
            label: dotUtils.prepareLabel(token.content.text, g.get('rankdir'))
        });
        
        _setBackgroundIfDefined(node, token);
        
        nodeLookupCache[recordName(token.content.text)] = node;
    },
    
    cluster : function(token, g, nodeLookupCache) {
        var cuid = 'cluster_A' + _.size(nodeLookupCache);
        if (nodeLookupCache[recordName(token.content.text)]) { return; }
        var subGraph = g.addCluster(cuid);
        nodeLookupCache[recordName(token.content.text)] = subGraph;
        subGraph.set('label', token.content.text);
        subGraph.set('fontsize', 10);
        _setBackgroundIfDefined(subGraph, token);
        
        _.forEach(token.content.nodeNames, function (element) {
            if (nodeLookupCache[recordName(element)]) {
                subGraph.addNode(nodeLookupCache[element].id);
            }
        });
    }    
};

module.exports.recordName = recordName;
module.exports.prepareLabel = prepareLabel;
module.exports.nodeHandlers = nodeHandlers;
module.exports.edgeHandlers = edgeHandlers;