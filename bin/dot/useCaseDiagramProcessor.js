'use strict';

var _ = require('lodash');
var util = require('util');
var graphviz = require('graphviz');
var parser = require('./../parser').create({startNodeSigns : ['[', '('], endNodeSigns : [']', ')'] });
var fs = require('fs');
var c = require('./../constants');
var dotUtils = require('./commonDot');

var configTemplate = {
    'fontsize': 10,
    'margin': "0.20, 0.05"
};

var toDotModel = function(tokenList) {
    var orientation = (tokenList.length > 5) ? 'LR': 'LR';
    var nodeLookupCache = {};

    var g = graphviz.digraph("G");
    g.set('ranksep' , 1);
    g.set('rankdir', orientation);
    var isActor = function(token) {
        return _.startsWith(token.content.text, c.NODE_TYPE_PRECISION_ACTOR)
    };

    var appendNodes = function(tokenList, g, nodeLookupCache) {
        for (var i = 0; i < tokenList.length; i++) {
            var token = tokenList[i];

            if (c.is(token.type, c.NODE_TYPE_CLUSTER)) {
                dotUtils.nodeHandlers.cluster(token, g, nodeLookupCache);
            } else if (c.is(token.type, c.NODE_TYPE_NOTE)) {
                dotUtils.nodeHandlers.nodeUsingConfig(token, _.merge(configTemplate, {
                    'shape': token.type,
                    'height': 0.5,
                    'width': 0.5,
                    label: dotUtils.prepareLabel(token.content.text, g.get('rankdir'))
                }), g, nodeLookupCache);
            } else if (c.is(token.type, c.NODE_TYPE_ELLIPSE)) {
                dotUtils.nodeHandlers.nodeUsingConfig(token, _.merge(configTemplate, {
                    'shape': token.type,
                    'height': 0.8,
                    'width': 1.5,
                    label: dotUtils.prepareLabel(token.content.text, g.get('rankdir'))
                }), g, nodeLookupCache);
            } else if (c.is(token.type, c.NODE_TYPE_RECORD)) {
                dotUtils.nodeHandlers.nodeUsingConfig(token,_.merge(configTemplate, {
                    'shape': (isActor(token)) ? token.type : 'ellipse',
                    'height': (isActor(token) ? 1.5 : 0.8),
                    'width': (isActor(token) ? 1 : 1.5),
                    label: dotUtils.prepareLabel(token.content.text, g.get('rankdir'))
                }), g, nodeLookupCache);
            }
        }
    };

    var appendEdges = function(tokenList, g, nodeLookupCache) {
        for (var j = 0; j < tokenList.length; j++) {
            dotUtils.edgeHandlers.edge(tokenList[j], tokenList[j - 1], tokenList[j + 1], g, nodeLookupCache);
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
    module.exports.toDotModel = toDotModel;
}
