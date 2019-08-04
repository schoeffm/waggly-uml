'use strict';

const util = require('util');
const _ = require('lodash');
const c = require('./../constants');

const recordName = (label) => _.trim(label.split('|')[0]);

const prepareLabel = (label, orientation) => {
    let processedLabel = label;
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

const _setAttributesIfDefined = (node, token) => {
    node.set('style', 'filled');
    node.set('fillcolor', (token.content.additions && token.content.additions.bg) ? token.content.additions.bg : 'white');
    
    if (token.content.additions && token.content.additions.link) {
        node.set('URL', token.content.additions.link);    
    }
};

const edgeHandlers = {
    edgeUsingConfig: (edgeToken, tokenBefore, tokenAfter, config, g, nodeLookupCache) => {
        if (c.is(edgeToken.type, c.NODE_TYPE_EDGE) && tokenBefore && tokenAfter) {
            let leftNode = nodeLookupCache[recordName(tokenBefore.content.text)];
            let rightNode = nodeLookupCache[recordName(tokenAfter.content.text)];
            
            if (tokenBefore.type === c.NODE_TYPE_CLUSTER) {
                config = _.merge( { ltail : nodeLookupCache[recordName(tokenBefore.content.text)].id }, config );
                leftNode = nodeLookupCache[recordName(tokenBefore.content.nodeNames[0])];
            }
            if (tokenAfter.type === c.NODE_TYPE_CLUSTER) {
                config = _.merge( { lhead: nodeLookupCache[recordName(tokenAfter.content.text)].id }, config );
                rightNode = nodeLookupCache[recordName(tokenAfter.content.nodeNames[0])];
            }

            g.addEdge(leftNode, rightNode, config);
        }
    },
    edge: (edgeToken, tokenBefore, tokenAfter, g, nodeLookupCache) => {
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

const nodeHandlers = {
    nodeUsingConfig: (token, config, g, nodeLookupCache) => {
        if (nodeLookupCache[recordName(token.content.text)]) { return; }
        const uid = 'A' + _.size(nodeLookupCache);
        const node = g.addNode(uid, config);
        
        _setAttributesIfDefined(node, token);
        
        nodeLookupCache[recordName(token.content.text)] = node;
    },
    note: (token, g, nodeLookupCache) => {
        if (nodeLookupCache[recordName(token.content.text)]) { return; }
        const uid = 'A' + _.size(nodeLookupCache);
        const node = g.addNode(uid, {
            'shape': (token.type !== 'record' || _.startsWith(token.content.text, c.NODE_TYPE_PRECISION_ACTOR)) ? token.type : 'ellipse',
            'height': (_.startsWith(token.content.text, c.NODE_TYPE_PRECISION_ACTOR) ? 1.5 : 0.8),
            'width': (_.startsWith(token.content.text, c.NODE_TYPE_PRECISION_ACTOR) ? 1 : 1.5),
            'fontsize': 10,
            'margin': "0.20, 0.05",
            label: dotUtils.prepareLabel(token.content.text, g.get('rankdir'))
        });
        
        _setAttributesIfDefined(node, token);
        
        nodeLookupCache[recordName(token.content.text)] = node;
    },
    
    cluster : (token, g, nodeLookupCache) => {
        const cuid = 'cluster_A' + _.size(nodeLookupCache);
        if (nodeLookupCache[recordName(token.content.text)]) { return; }
        const subGraph = g.addCluster(cuid);
        nodeLookupCache[recordName(token.content.text)] = subGraph;
        subGraph.set('label', token.content.text);
        subGraph.set('fontsize', 10);
        _setAttributesIfDefined(subGraph, token);
        
        _.forEach(token.content.nodeNames, (element) => {
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