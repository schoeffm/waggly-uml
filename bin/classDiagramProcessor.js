'use strict';

var _ = require('lodash');
var util = require('util');
var graphviz = require('graphviz');
var parser = require('./parser');
var fs = require('fs');

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
    var nodeLookupCache = {};
    
    var g = graphviz.digraph("G");
    g.set('ranksep' , 1);
    g.set('rankdir', orientation);
    
    var appendNodes = function(tokenList, g, nodeLookupCache) {
        for (var i = 0; i < tokenList.length; i++) {
            var token = tokenList[i];

            if (token.type === 'cluster') {
                var cuid = 'cluster_A' + _.size(nodeLookupCache);
                if (nodeLookupCache[recordName(token.content.text)]) { continue; }
                var subGraph = g.addCluster(cuid);
                nodeLookupCache[recordName(token.content.text)] = subGraph;
                subGraph.set('label', token.content.text);
                subGraph.set('fontsize', 10);

                _.forEach(token.content.nodeNames, function (element) {
                    if (nodeLookupCache[recordName(element)]) {
                        subGraph.addNode(nodeLookupCache[element].id);
                    }
                });
            } else if (_.contains(['note', 'record'], token.type)) {
                if (nodeLookupCache[recordName(token.content.text)]) { continue; }
                var uid = 'A' + _.size(nodeLookupCache);
                var node = g.addNode(uid, {
                    'shape': token.type,
                    'height': 0.5,
                    'fontsize': 10,
                    'margin': "0.20, 0.05",
                    label: prepareLabel(token.content.text, g.get('rankdir'))
                });
                if (token.content.background) {
                    node.set('style', 'filled');
                    node.set('fillcolor', token.content.background);
                }
                nodeLookupCache[recordName(token.content.text)] = node;
            }
        }          
    };
    
    var appendEdges = function(tokenList, g, nodeLookupCache) {
        for (var j = 0; j < tokenList.length; j++) {
            var t = tokenList[j];
            if (t.type === 'edge' && tokenList[j - 1] && tokenList[j + 1]) {
                var leftNode = nodeLookupCache[recordName(tokenList[j - 1].content.text)];
                var rightNode = nodeLookupCache[recordName(tokenList[j + 1].content.text)];
                var edge = t;

                var e = g.addEdge(leftNode, rightNode,
                    {
                        'dir': 'both',
                        'arrowtail': edge.content.left.type,
                        'taillabel': edge.content.left.text,
                        'arrowhead': edge.content.right.type,
                        'headlabel': edge.content.right.text,
                        'labeldistance': 2,
                        'fontsize': 10,
                        'style': ((tokenList[j - 1].type === 'note' || tokenList[j + 1].type === 'note') ? 'dashed' : edge.content.style)
                    });
            }
        }
    };
    
    // call all appenders
    _.forEach([appendNodes, appendEdges], function(func) { func(tokenList, g, nodeLookupCache); });
    
    // and return the finished graph in dot-syntax
    return g.to_dot();
};

/**
 * @param input a string representing the uml-syntax
 * @param callback which gets called when the transformation is done
 */
var processString = function(input, callback) {
    if (input === undefined) { throw new Error("You must provide an 'input'-string in order to be of any value"); }
    if (callback === undefined) { throw new Error("You must provide a 'callback' in order to process the transformed result"); }
    
    callback(toDotModel(parser.toDocumentModel(input)));
};

/**
 * @param filePath path to the uml-input-file to be transformed (convenience-method for processString())
 * @param callback which gets called when the transformation is done
 */
var processFile = function(filePath, callback) {
    if (filePath === undefined) { throw new Error("You must provide a 'filePath' in order to be of any value"); }
    if (callback === undefined) { throw new Error("You must provide a 'callback' in order to process the transformed result"); }
    
    fs.readFile(filePath, {encoding: 'utf-8'}, function(err, data) {
        callback(toDotModel(parser.toDocumentModel(data)));    
    });
};

module.exports.processString = processString;
module.exports.processFile = processFile;

if (process.env.exportForTesting) {
    module.exports.prepareLabel = prepareLabel;
    module.exports.recordName = recordName;
    module.exports.toDotModel = toDotModel;
}
