'use strict';
var _ = require('lodash');
var xpath = require('xpath');
var dom = require('xmldom').DOMParser;
var fs = require('fs');
var c = require('./../constants');

var fontTemplate = fs.readFileSync(__dirname + '/dadhand_temp.svg').toString();
var select = xpath.useNamespaces({"svg": "http://www.w3.org/2000/svg"});

/**
 * This post-processor will inject the Dadhand font-definition to the very top of the output-svg. By injecting 
 * this definition the SVG is self contained with respect to fonts 
 * 
 * @param svgInput to be enhanced
 * @param config the original configuration as defined by the user
 * @return either the unchanged input or the enhanced version of the given SVG
 */
var fontInjectionPostProcessor = function(svgInput, config) {
    if (config.waggly !== true) { return svgInput; }

    var doc = new dom().parseFromString(svgInput);
    
    _.forEach(select("//svg:text", doc), function(node) {
        node.setAttribute('font-family', 'Dadhand');
    });
    
    // a horrible workaround due to a bug in xmldom which turns attributes into reserved words!!!
    return svgInput.replace('</svg>', fontTemplate+'</svg>');
};

/**
 * This processor, when active, extends all a-tags within the given SVG-input by an
 * 'onclick'-attribute which calls a delegation-script (that is also injected).<br/>
 * The delegation-script is just another indirection which preserves the original 
 * functionality of the contained a-tags when there is no companion script available.
 * So every a-tag calls the delegation-script which checks the existence of a function
 * called <pre>wuml.navigateTo</pre>. If it exists, it will be called (and gets the click
 * event as first parameter), if not nothing happens and the link will be executed.
 * 
 * @param svgInput svgInput to be processed
 */
var onClickInjectionPostProcessor = function(svgInput) {
    
    var delegationScript = '<script type="text/javascript">\n' +
        '// <![CDATA[\n' +
        'var wuml;\n' +
        'if (! wuml) wuml = {}\n' +
        'if (! wuml.onNavigation) {\n' +
            'wuml.onNavigation = function(e) {\n' +
                '// if the companion-script is present we delegate the event to it\n' +
                'if (wuml.navigateTo) {\n' +
                    'e.preventDefault();\n' +
                    'wuml.navigateTo(e);\n' +
                '}   };  }\n' +
        '// ]]>\n' +
        '</script>';
    
    var doc = new dom().parseFromString(svgInput);
    
    // now extend every a-tag with an onclick-attribute that calls our delegation-script
    var augmentedNodes = _.map(select("//svg:a", doc), function(node) {
        node.setAttribute("onclick", "wuml.onNavigation(evt);");
        return node;
    });
    
    // if there is at least one link contained we'll inject our delegation script
    if (! _.isEmpty(augmentedNodes)) {                      
        _.forEach(select("/svg:svg", doc), function(node) { 
            node.appendChild(new dom().parseFromString(delegationScript));
        });
    }
    
    return doc.toString();
};

/**
 * This post-processor will replace all ellipse-elements with 4 arc-paths to imitate that ellipse (but not as perfect
 * as an ellipse, of course).<br/>
 * The implementation is a bit nasty - it will remove the stroke from the original ellipsis and will replace that 
 * with 4 ellipse-arcs - the original one is preserved in order to offer the ability to fill the background (and to
 * preserve future features like links as well).
 * 
 * @param svgInput to be processed
 */
var ellipsisSubstitutionPostProcessor = function(svgInput, config) {
    
    if (config.waggly !== true) { return svgInput; }
    
    var pathTemplate = _.template('<path d="M<%= startX %>,<%= startY %> A<%= radiusX %>,<%= radiusY %> 0 0,0 <%= endX %>,<%= endY %>" style="stroke:black; fill:<%=fill%>;"></path>');
    
    var doc = new dom().parseFromString(svgInput);

    _.forEach(select("//svg:ellipse", doc), function(node) {
        var fill = node.getAttribute('fill');
        var x = parseFloat(node.getAttribute('cx'));
        var y = parseFloat(node.getAttribute('cy'));
        var rx = parseFloat(node.getAttribute('rx'));
        var ry = parseFloat(node.getAttribute('ry'));
        
        var startOffsets = {x: Math.floor(Math.random() * 15) + 5, y: Math.floor(Math.random() * 2) + 2};
        var endOffsets = {x: -1 * Math.floor(Math.random() * 15) + 5, y: 0};
        var rotation = ((Math.floor(Math.random() * 2) === 1) ? 178 : -2)+ Math.floor(Math.random() * 4); 

        // place 4 arcs in order to imitate an ellipsis
        var subgraph = new dom().parseFromString('<g id="' + node.parentNode.getAttribute('id') + '_elli" class="node" transform="rotate('+rotation+','+x+','+y+')">');
        node.parentNode.appendChild(subgraph);
        
        _.forEach(select('//g[@id="' + node.parentNode.getAttribute('id') + '_elli"]', node.parentNode), function(sub) {
            sub.appendChild(new dom().parseFromString(pathTemplate({startX: (x + startOffsets.x), startY: (y-ry-startOffsets.y), radiusX: rx, radiusY: (ry+startOffsets.y), endX: (x-rx), endY: (y), fill:fill})));
            sub.appendChild(new dom().parseFromString(pathTemplate({startX: (x-rx), startY: (y), radiusX: rx, radiusY: ry, endX: x, endY: (y+ry), fill:fill})));
            sub.appendChild(new dom().parseFromString(pathTemplate({startX: x, startY: (y+ry), radiusX: rx, radiusY: ry, endX: (x+rx), endY: y, fill:fill})));
            sub.appendChild(new dom().parseFromString(pathTemplate({startX: (x+rx), startY: y, radiusX: rx, radiusY: ry, endX: (x+endOffsets.x), endY: (y-ry), fill:fill})));// remove the original
        });
        
        //node.parentNode.removeChild(node);
        node.setAttribute('style', 'stroke:none; fill:' + fill); // 'cause of the background keep the original there
    });
    return doc.toString();
};

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
                '<text text-anchor="middle" x="14.84" y="70" font-family="Dadhand" font-size="10.00"><%= title %></text>' +
            '</g>'
    };

    
    var doc = new dom().parseFromString(svgInput);
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

var postProcess = function(svgInput, config) {
    var svgOutput = svgInput;
    [
        actorSubstitutionPostProcessor , 
        ellipsisSubstitutionPostProcessor, 
        onClickInjectionPostProcessor,
        fontInjectionPostProcessor          // this one has to be the last one!!!!!
    ].forEach(function(postProcessor) { svgOutput = postProcessor(svgOutput, config); });
    return svgOutput;        
};

module.exports.postProcess = postProcess;

if (process.env.exportForTesting) {
    module.exports.actorSubstitutionPostProcessor = actorSubstitutionPostProcessor;
    module.exports.ellipsisSubstitutionPostProcessor = ellipsisSubstitutionPostProcessor;
    module.exports.fontInjectionPostProcessor = fontInjectionPostProcessor;
    module.exports.onClickInjectionPostProcessor = onClickInjectionPostProcessor;
}
