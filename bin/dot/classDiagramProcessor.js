'use strict';

const _ = require('lodash');
const graphviz = require('graphviz');
const parser = require('./../parser').create({
    startNodeSigns : ['[', '('], 
    endNodeSigns : [']', ')'] 
});
const fs = require('fs');
const c = require('./../constants');
const dotUtils = require('./commonDot');


const configTemplate = {
    'height': 0.5,
    'fontsize': 10,
    'margin': "0.20, 0.05"
};

/**
 * Takes the given token-list and turns it into a dot-representation (which is returned as 
 * a string).
 * 
 * @param tokenList representing the wuml-definition - the token should be in order
 * @param config determines some of the dot-relevant configs 
 *      { orientation: '[TD|LR]', splines: '[ortho|spline]'  }
 * @returns {String} as input for dot
 */
const toDotModel = (tokenList, config) => {
    
    const appendNodes = (tokenList, g, nodeLookupCache) => {
        for (let i = 0; i < tokenList.length; i++) {
            const token = tokenList[i];

            if (c.is(token.type, c.NODE_TYPE_CLUSTER)) {
                dotUtils.nodeHandlers.cluster(token, g, nodeLookupCache);
            } else if (_.includes([c.NODE_TYPE_NOTE, c.NODE_TYPE_RECORD], token.type)) {
                dotUtils.nodeHandlers.nodeUsingConfig(token, _.merge(configTemplate, {
                    'shape': token.type,
                    label: dotUtils.prepareLabel(token.content.text, g.get('rankdir'))
                }), g, nodeLookupCache);
            } else if (c.is(token.type, c.NODE_TYPE_ELLIPSE)) {
                dotUtils.nodeHandlers.nodeUsingConfig(token, _.merge(configTemplate, {
                    'shape': 'record',
                    label: dotUtils.prepareLabel(token.content.text, g.get('rankdir'))
                }), g, nodeLookupCache);
    }   }   };     
    
    const appendEdges = (tokenList, g, nodeLookupCache) => {
        for (var j = 0; j < tokenList.length; j++) {
            if (c.is(tokenList[j].type, c.NODE_TYPE_EDGE) && tokenList[j - 1] && tokenList[j + 1]) {
                dotUtils.edgeHandlers.edgeUsingConfig(tokenList[j], tokenList[j - 1], tokenList[j + 1], {
                    'dir': 'both',
                    'arrowtail': tokenList[j].content.left.type,
                    'taillabel': tokenList[j].content.left.text,
                    'arrowhead': tokenList[j].content.right.type,
                    'headlabel': tokenList[j].content.right.text,
                    'label': tokenList[j].content.text,
                    'labeldistance': 2,
                    'fontsize': 10,
                    'style': ((tokenList[j - 1].type === 'note' || tokenList[j + 1].type === 'note') 
                        ? 'dashed' : tokenList[j].content.style)
                }, g, nodeLookupCache);
    }   }   };

    // determine configs as provided by the caller (if given at all)
    const orientation = (config.orientation && _.includes(['TD', 'LR'], config.orientation))
        ? config.orientation
        : ((tokenList.length > 7) ? 'TD' : 'LR');
    const splineType = (config.splines && _.includes(['ortho', 'spline'], config.splines))
        ? config.splines
        : 'spline';

    // this map collects all nodes as we progress through the token-list
    const nodeLookupCache = {};

    // first of all we're createing a new Graph-representation and set some generall configs
    const g = graphviz.digraph("G");
    g.set('compound' , true);
    g.set('ranksep' , 1);
    g.set('rankdir', orientation);
    g.set('splines', splineType);
    
    // now call all appenders - they will enhance the given graph
    _.forEach([appendNodes, appendEdges], function(func) { func(tokenList, g, nodeLookupCache); });
    
    // and return the finished graph in dot-syntax
    return g.to_dot();
};

/**
 * @param input a string representing the uml-syntax
 * @param callback which gets called when the transformation is done
 */
const processString = (input, config, callback) => {
    if (typeof config === 'function' && callback === undefined) {
        callback = config;
        config = {};
    }
    if (input === undefined) { throw new Error("You must provide an 'input'-string in order to be of any value"); }
    if (callback === undefined) { throw new Error("You must provide a 'callback' in order to process the transformed result"); }
    
    callback(toDotModel(parser.toDocumentModel(input), config));
};

/**
 * @param filePath path to the uml-input-file to be transformed (convenience-method for processString())
 * @param callback which gets called when the transformation is done
 */
const processFile = (filePath, config, callback) => {
    if (typeof config === 'function' && callback === undefined) {
        callback = config; 
        config = {};
    }
    if (filePath === undefined) { throw new Error("You must provide a 'filePath' in order to be of any value"); }
    if (callback === undefined) { throw new Error("You must provide a 'callback' in order to process the transformed result"); }
    
    fs.readFile(filePath, {encoding: 'utf-8'}, function(err, data) {
        callback(toDotModel(parser.toDocumentModel(data), config));    
    });
};

module.exports.processString = processString;
module.exports.processFile = processFile;

if (process.env.exportForTesting) {
    module.exports.toDotModel = toDotModel;
}
