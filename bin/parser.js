'use strict';

var _ = require('lodash');
var util = require('util');

/*
 * Takes a word, checks it whether it's empty or not and if it's not an empty word it'll be pushed into 
 * the words-list
 *
 * @param wordCandidate (string)    a possible word
 * @param list (array)              a list the word should be pushed on (if it's non-empty)
 */
var pushNonEmptyWords = function(wordCandidate, list) {
    if (!_.isEmpty(_.trim(wordCandidate))) { list.push(_.trim(wordCandidate)); }
};

/*
 * This method is the first step in analyzing a WUML-input. As the name suggests it tokenizes the input-stream.
 * Every resulting token represents a word in the sense of the model-language.
 *
 * @param umlDescription (string)   the complete uml description as string-input
 * @param delimiterConfig (string)  configuration which determines what character(s) are used in order to slice the
 *                                  input into words
 * @return (array) a list of words - separated by the given configuration
 */
var tokenize = function(umlDescription, delimiterConfig) {
    var words = [];         // collects all non-empty words
    var word = '';          // buffer for the current word we're analyzing
    var shapeDepth = 0;     // shape-depth (we have to handle that for clusters)

    // go through the umlDescription character by character
    for (var i = 0; i < umlDescription.length; i++) {
        var character = umlDescription[i];

        // if the current character is a start-sign - increase shapeDepth by one (and thus start collecting chars)
        if (_.contains(delimiterConfig.startNodeSigns, character)) { shapeDepth += 1; }

        // do the opposite in case we got an end-sign
        else if (_.contains(delimiterConfig.endNodeSigns, character)) { shapeDepth -= 1; }

        // ok - if we're at level one (so we got one start-sign already) and the current sign is indeed this 
        // start-sign - push the current word and start collecting a new one
        if (shapeDepth === 1 && _.contains(delimiterConfig.startNodeSigns, character)) {
            pushNonEmptyWords(word, words);
            word = character;
            continue;
        }

        // append the current character to the current word (actually extending it)
        word += character;

        // in case the current level is zero and we're dealing with the closing-sign lets push the current
        // word and start collecting a new one 
        if (shapeDepth === 0 && _.contains(delimiterConfig.endNodeSigns, character)) {
            pushNonEmptyWords(word, words);
            word = '';
        }
    }

    // just in case there are some signs left, there is a last word that wasn't pushed yet - do it now
    if (word) { pushNonEmptyWords(word, words); }

    // return the list of tokens/words
    return words;
};


var isEllipse = function(token) { return _.startsWith(token, '(') && _.endsWith(token, ')'); };
var isEdge = function(token) { return token.indexOf('-') >= 0; };
var isNote = function(token) { return _.startsWith(token.toLowerCase(), '[note:'); };
var isClass = function(token) { return _.startsWith(token, '[') && _.endsWith(token, ']'); };
var isCluster = function(token) {
    var stripped = token.substring(1, token.length);
    return stripped.indexOf('[') >= 0 && stripped.lastIndexOf(']') >= 0
};


/*
 * Searchs the given token for a substring which looks like that:
 * <pre>
 *  {bg:green}
 * </pre>
 * So the main characteristic is the {@code br:}-prefix enclosed within curly braces.
 *
 * @param token (string) the token to be checked for a background-color definition
 * @return the respective color-definition or an empty string
 */
var determineBackgroundColor = function(token) {
    var regex = /\{bg:([A-Za-z0-9#]+)?\}/;
    var match = regex.exec(token);
    return (match) ? match[1] : '';
};

/**
 * Helper-method in order to extract the text between the given start- and end-delimiters. So if you have a
 * string wrapped between curly braces, give this string as {@code token} and the curly braces as start- and end-
 * signs respectively
 *
 * @param token (string)    to be trimmed (so it contains the text we're interested in)
 * @param start (string)    the start-sign (or substring)
 * @param end (string)      the end-sign (or substring)
 * @return (string) the bare text
 */
var extractText = function(token, start, end) {
    var startIndex = token.indexOf(start) + 1;
    var endIndex = token.lastIndexOf(end);

    var result = token.substring(startIndex, endIndex);
    return _.trim(result.replace(/\{.+\}/,''));
};

/**
 * Processes an ellipsis (so you'll have to make sure it is actually an ellipsis beforehand).
 *
 * @param ellipseToken (string)     a token representing an ellipsis (with all necessary information)
 * @return (object) an ellipsis-representation
 */
var processEllipse = function(ellipseToken) {
    return {
        type: 'ellipse',
        content: {
            background: determineBackgroundColor(ellipseToken),
            text: extractText(ellipseToken, '(',')')
        }
    }; 
};

/**
 * Processes a note
 *
 * @param noteToken (string)    a token representing a note
 * @return (object) a note-object
 */
var processNote = function(noteToken) {
    return {
        type: 'note',
        content: {
            background: determineBackgroundColor(noteToken),
            text: extractText(noteToken, ':',']')
        }
    };
};

/**
 * Processes (and creates) a class
 *
 * @param classtoken (string)   a token representing/containg a class definition
 * @return (object) a class-object
 */
var processClass = function(classToken) {
    return {
        type: 'record',
        content: {
            background: determineBackgroundColor(classToken),
            text: extractText(classToken, '[',']')
        }
    };
};

/**
 * Now, this method processes a cluster - which is kind of a complex beast
 * The resulting object contains (besides the token-type) the cluster-label as well as the complete 
 * cluster-content as string (so you'll have to process it separately)
 *
 * @param clusterToken (string)     a token representaing a cluster
 * @return (object) a fine cluster
 */
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

/**
 * 
 * @param token
 * @param delimiter
 * @param lookAt 
 * @returns {string}
 */
var collectUntil = function(token, delimiter, lookAt) {
    var reverted = (lookAt && lookAt === LookAt.END ) || false;
    var result = '';
    var word = (reverted) ? token.split("").reverse().join("") : token;

    if (lookAt === LookAt.BETWEEN) {
        var regex = new RegExp(delimiter + '([,_:;$!&\\(\\)a-zA-Z0-9 \-]*)' + delimiter, 'g');
        result = word.match(regex);
        return _.trim(result, delimiter);
    } else {
        for (var i = 0; i < word.length; i++) {
            if (word[i] !== delimiter) { result += word[i]; }
            else { break; }
        }
        return (reverted) ? result.split("").reverse().join("") : result;
    }
};
var LookAt = {
    START : 'start',
    END : 'end',
    BETWEEN : 'between'
};

/**
 * This method processes an edge. And since edges can be quite complex this method has to do a bunch of things.
 *
 * @param edgeToken (string)        a token containing all information of an edge
 * @return (object) a complete object-representation of an edge
 */
var processEdge = function(edgeToken) {
    var isDashed = function(edge) { return edge.indexOf('-.-') >= 0; };
    var EDGE_DELIMITER = '-';

    var leftResult;
    var rightResult;

    // take care of the left part of the edge
    if (_.startsWith(edgeToken, '<>')) { leftResult = { 
        type: 'odiamond', text: collectUntil(edgeToken.substring(2), EDGE_DELIMITER)}; 
    } else if (_.startsWith(edgeToken, '++')) { leftResult = { 
        type: 'diamond', text: collectUntil(edgeToken.substring(2), EDGE_DELIMITER)}; 
    } else if (_.startsWith(edgeToken, '+')) { leftResult = { 
        type: 'odiamond', text: collectUntil(edgeToken.substring(1), EDGE_DELIMITER)}; 
    } else if (_.startsWith(edgeToken, '<') || _.startsWith(edgeToken, '>')) { 
        leftResult = { type: 'normal', text: collectUntil(edgeToken.substring(1),EDGE_DELIMITER)}; 
    } else if (_.startsWith(edgeToken, '^')) { leftResult = { 
        type: 'empty', text: collectUntil(edgeToken.substring(1), EDGE_DELIMITER)}; 
    } else { leftResult = { type: 'none', text: collectUntil(edgeToken,EDGE_DELIMITER) }; }

    // now deal with the right part of the edge
    if (_.endsWith(edgeToken, '<>')) { rightResult = { 
        type: 'odiamond', text: collectUntil(edgeToken.substring(0,edgeToken.length - 2), EDGE_DELIMITER, LookAt.END)}; 
    } else if (_.endsWith(edgeToken, '++')) { rightResult = { 
        type: 'diamond', text: collectUntil(edgeToken.substring(0,edgeToken.length - 2), EDGE_DELIMITER, LookAt.END)}; 
    } else if (_.endsWith(edgeToken, '+')) { rightResult = { 
        type: 'odiamond', text: collectUntil(edgeToken.substring(0,edgeToken.length - 1), EDGE_DELIMITER, LookAt.END)}; 
    } else if (_.endsWith(edgeToken, '<') || _.endsWith(edgeToken, '>')) { 
        rightResult = { type: 'normal', text: collectUntil(edgeToken.substring(0,edgeToken.length - 1), EDGE_DELIMITER, LookAt.END)}; 
    } else if (_.endsWith(edgeToken, '^')) { rightResult = { 
        type: 'empty', text: collectUntil(edgeToken.substring(0,edgeToken.length - 1), EDGE_DELIMITER, LookAt.END)}; 
    } else { rightResult = { type: 'none', text: collectUntil(edgeToken, EDGE_DELIMITER, LookAt.END) }; }

    // finally combine everything to a complete edge-representation
    return { 
        type: 'edge', content: {
            text: collectUntil(edgeToken, EDGE_DELIMITER, LookAt.BETWEEN),
            left: leftResult, 
            right: rightResult, 
            style: (isDashed(edgeToken)) ? 'dashed' : 'solid'
    }   }
};

/**
 * The {@link Parser} encapsulates the dot-model-creation process and all necessary sub-parts of processing
 * the input and turning it into a model-representation which allows further transformation
 *
 * @param configuration (object)        a configuration object which contains the exact specification of what the
 *                                      algorithm should use as start- and end-sign respectively when processing the
 *                                      token/words of the input
 */
var Parser = function(configuration) {
    var self = this;
    this.config = configuration;
    
    /**
     * The only public method turns the given input into a object-representation containing all 
     * configured information.
     *
     * @param input (string)        this is the input-wuml string representation
     * @return a list of objects representing the single parts of the given definition
     */
    this.toDocumentModel = function(input) {
        var tokenList = tokenize(input, self.config);

        var objectModel = [];
        for (var i = 0; i < tokenList.length; i++) {
            var token = tokenList[i];
            if (_.startsWith(token, '//')) {
                continue;                                // skip comments
            } else if (isNote(token)) {
                objectModel.push(processNote(token));    // process notes
            } else if (isEllipse(token)) {
                objectModel.push(processEllipse(token)); // process ellipse
            } else if (isCluster(token)) {
                objectModel.push(processCluster(token)); // process cluster
            } else if (isClass(token)) {
                objectModel.push(processClass(token));   // process classes
            } else if (isEdge(token)) {
                objectModel.push(processEdge(token));    // process edges
            }
        }
        return objectModel;
    };
};

/**
 * @param config {
 *      startNodeSigns : ['[', '('],
 *      endNodeSigns : [']', ')'] 
 *  }
 * @returns {Parser}
 */
module.exports.create = function(config) {
    return new Parser({
        startNodeSigns : config.startNodeSigns || ['[', '('],   // default
        endNodeSigns : config.endNodeSigns || [']', ')']        // default
    }, config);                                                 // defaults can be overwritten
};

if (process.env.exportForTesting) {     // only export these things for testing
    module.exports.tokenize = tokenize;
    
    module.exports.determineBackgroundColor = determineBackgroundColor;
    
    module.exports.isNote = isNote;
    module.exports.isClass = isClass;
    module.exports.isEdge = isEdge;
    module.exports.isCluster = isCluster;
    module.exports.isEllipse = isEllipse;
    
    module.exports.processNote = processNote;
    module.exports.processClass = processClass;
    module.exports.processCluster = processCluster;
    module.exports.processEdge = processEdge;
    module.exports.processEllipse = processEllipse;
    
    module.exports.collectUntil = collectUntil;
    module.exports.LookAt = LookAt;
}
