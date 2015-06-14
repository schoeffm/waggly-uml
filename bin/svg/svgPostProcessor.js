'use strict';
var _ = require('lodash');
var xpath = require('xpath');
var dom = require('xmldom').DOMParser;
var fs = require('fs');
var c = require('./../constants');

/**
 * This post-processor will look for subgraphs which represents an actor-placeholder node. This is a node where the
 * containing label contains the prefix 'actor:' and will try to 
 * a) remove that subgraph
 * b) determine its position within the SVG
 * c) place in an actor-SVG subgraph at that position
 * 
 * @param svgInput to be processed
 */
var actorSubstitutionPostProcessor = function(svgInput) {
    /*
     Translation: (0,0) + (-14.84, +27) + (72,-216) = (57.16 -243)
     =>        ORIGIN + SIZE_OF_ACTOR + TRANSLATION_POINT = DESTINATION_COORDINATE
     */
    var actor = {
        xOffset : -14.0,
        yOffset : 27.0,
        content:
            '<g >' +
                '<circle r="9.0363035" cy="9.5186291" cx="14.84535" id="path3402" style="fill:none;stroke:#000000;" />' +
                '<path id="path4210" d="M 14.199905,19.200384 14.199905,43.727488" style="fill:none;stroke:#000000;" />' +
                '<path id="path4212" d="M 13.554455,27.591237 27.754359,23.07308" style="fill:none;stroke:#000000;" />' +
                '<path style="fill:none;stroke:#000000;" d="M 0,23.07308 14.199905,27.591237" id="path4310"/>' +
                '<path id="path4312" d="M 13.685157,41.965708 22.4600554,57.127768" style="fill:none;stroke:#000000;" />' +
                '<path style="fill:none;stroke:#000000;" d="M 5.9397546,57.127768 14.714653,41.965708" id="path4314"/>' +
                '<text text-anchor="middle" x="14.84" y="70" font-family="Times,serif" font-size="10.00"><%= title %></text>' +
            '</g>'
    };

    
    var doc = new dom().parseFromString(svgInput);
    var select = xpath.useNamespaces({"svg": "http://www.w3.org/2000/svg"});
    var actorTemplate = _.template(actor.content);
    
    _.filter(select("//svg:text", doc), function(node) {
        return _.startsWith(node.firstChild.nodeValue, c.NODE_TYPE_PRECISION_ACTOR);        
    }).map(function(textNode) {
        return textNode.parentNode;
    }).forEach(function(actorPlaceholderContainer) {
        var title = select('svg:text/text()', actorPlaceholderContainer)[0];
        var actorPlaceholderNode = select('svg:polygon', actorPlaceholderContainer)[0];
        if (actorPlaceholderNode && actorPlaceholderContainer) {
            var destinationCoordinates = _.map(actorPlaceholderNode.getAttribute('points').split(" "), function(element) {
                var parts = element.split(',');
                return { 
                    x: parseFloat(parts[0]), 
                    y: parseFloat(parts[1]) 
                };
            });
            
            var centerPoint = function(rectangle) {
                return { 
                    x: ((rectangle[2].x - rectangle[0].x)/2 + rectangle[0].x),
                    y: ((rectangle[1].y - rectangle[0].y)/2 + rectangle[0].y) 
                }
            }(destinationCoordinates);
            
            var newNode = new dom().parseFromString(actorTemplate({'title': title.nodeValue.substring(_.size(c.NODE_TYPE_PRECISION_ACTOR))}));
            newNode.documentElement.setAttribute('transform', 'translate(' +
                (centerPoint.x + actor.xOffset) + ' ' + (centerPoint.y - actor.yOffset )+ ')');
            actorPlaceholderContainer.parentNode.replaceChild(newNode, actorPlaceholderContainer);
        }
    });
    return doc.toString();
};

var postProcess = function(svgInput, callback) {
    var svgOutput = svgInput;
    [actorSubstitutionPostProcessor].forEach(function(postProcessor) { svgOutput = postProcessor(svgOutput); });
    return svgOutput;        
};

module.exports.postProcess = postProcess;

if (process.env.exportForTesting) {
    module.exports.actorSubstitutionPostProcessor = actorSubstitutionPostProcessor;
}