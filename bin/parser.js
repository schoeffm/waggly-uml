'use strict';

const _ = require('lodash');

/*
 * Takes a word, checks it whether it's empty or not and if it's not an empty word it'll be pushed into 
 * the words-list
 *
 * @param wordCandidate (string)    a possible word
 * @param list (array)              a list the word should be pushed on (if it's non-empty)
 */
const pushNonEmptyWords = (wordCandidate, list) => {
    const candidate = _.trim(wordCandidate);
    if (!_.isEmpty(candidate)) { list.push(candidate); }
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
const tokenize = (umlDescription, delimiterConfig) => {
    let words = [];             // collects all non-empty words
    let word = '';              // buffer for the current word we're analyzing
    let nodeDefDepth = 0;       // shape-depth (we have to handle that for clusters)
    let withinAddition = false; // marker to recognize when we're within an addition definition
    
    const isStartSign = function(character) { return withinAddition === false && _.includes(delimiterConfig.startNodeSigns, character); };
    const isEndSign = function(character) { return withinAddition === false && _.includes(delimiterConfig.endNodeSigns, character); };
    const isAdditionStartSign = function(character) { return _.includes(delimiterConfig.additionStartSign, character); };
    const isAdditionEndSign = function(character) { return _.includes(delimiterConfig.additionEndSign, character); };

    // go through the umlDescription character by character
    for (let i = 0; i < umlDescription.length; i++) {
        const character = umlDescription[i];

        // if the current character is a start-sign - increase nodeDefDepth by one (and thus start collecting chars)
        if (isStartSign(character)) { nodeDefDepth += 1; }

        // do the opposite in case we got an end-sign
        else if (isEndSign(character)) { nodeDefDepth -= 1; }
        
        // set a marker when we enter or leave an addition definition (which may contain delimiter signs 
        // of embedded definitions - those should not be part of the tokenization)
        if (isAdditionStartSign(character)) { withinAddition = true; }
        else if (isAdditionEndSign(character)) { withinAddition = false; }

        // ok - if we're at level one (so we got one start-sign already) and the current sign is indeed this 
        // start-sign - push the current word and start collecting a new one
        if (nodeDefDepth === 1 && isStartSign(character)) {
            pushNonEmptyWords(word, words);
            word = character;
            continue;
        }

        // append the current character to the current word (actually extending it)
        word += character;

        // in case the current level is zero and we're dealing with the closing-sign lets push the current
        // word and start collecting a new one 
        if (nodeDefDepth === 0 && isEndSign(character)) {
            pushNonEmptyWords(word, words);
            word = '';
        }
    }

    // just in case there are some signs left, there is a last word that wasn't pushed yet - do it now
    if (word) { pushNonEmptyWords(word, words); }

    // return the list of tokens/words
    return words;
};


const isEllipse = (token) => _.startsWith(token, '(') && _.endsWith(token, ')');
const isEdge = (token) => token.indexOf('-') >= 0;
const isNote = (token) => _.startsWith(token.toLowerCase(), '[note:');
const isClass = (token) => _.startsWith(token, '[') && _.endsWith(token, ']');
const isCluster = (token) => {
    if (_.size(token) <= 1) return false;         // you cannot define a cluster with less than one char
    
    const stripped = token.substring(1, token.length - 1).replace(/{.*?}/gi,'');
    
    // const stripped = token.substring(1, token.length - 1);
    return stripped.indexOf('[') >= 0
};

/**
 * Additions are given within curly braces like this.
 * <pre>
 *   {bg:cornsilk; link:http://www.google.de}
 * </pre>
 * and are contained within nodes like classes, notes or ellipses.
 * This method will analyze all contained key-value-pairs ann turns 'em
 * into an array of respective objects.
 * 
 * @param token
 * @returns {Array}
 */
const determineAdditions = (token) => {
    const additions = {};
    const hasAdditions = /\{(.*?)\}/.exec(token);
    if (hasAdditions) {
        hasAdditions[1]
            .split(';')
            .forEach((addition) => {
                const regex = /^(\S+?)\s*?:\s*?(\S+?)$/;
                const match = regex.exec(_.trim(addition));
                if (match) {
                    additions[match[1]] = match[2];
                }  
            });
    }
    return additions;
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
const extractText = (token, start, end) => {
    const startIndex = token.indexOf(start) + 1;
    const endIndex = token.lastIndexOf(end);

    const result = token.substring(startIndex, endIndex);
    return _.trim(result.replace(/\{.+\}/,''));
};

/**
 * Processes an ellipsis (so you'll have to make sure it is actually an ellipsis beforehand).
 *
 * @param ellipseToken (string)     a token representing an ellipsis (with all necessary information)
 * @return (object) an ellipsis-representation
 */
const processEllipse = (ellipseToken) => {
    return {
        type: 'ellipse',
        content: {
            additions : determineAdditions(ellipseToken),
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
const processNote = (noteToken) => {
    return {
        type: 'note',
        content: {
            text: extractText(noteToken, ':',']'),
            additions : determineAdditions(noteToken)
        }
    };
};

/**
 * Processes (and creates) a class
 *
 * @param classtoken (string)   a token representing/containg a class definition
 * @return (object) a class-object
 */
const processClass = (classToken) => {
    return {
        type: 'record',
        content: {
            additions : determineAdditions(classToken),
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
const processCluster = (clusterTocken) => {
    const startIndex = clusterTocken.indexOf('[') + 1;
    const endIndex = clusterTocken.indexOf('[', startIndex);

    const parts = clusterTocken.substring(1,clusterTocken.lenght).split('[');
    const nodes = _.filter(parts, (element) => element.indexOf(']') >= 0);
    const trimmedNodes = _.map(nodes, (element) => {
        const endIndex = element.indexOf(']');
        return element.substring(0,endIndex);
    });

    return {
        type: 'cluster',
        content: {
            additions: determineAdditions(clusterTocken),
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
const collectUntil = (token, delimiter, lookAt) => {
    const reverted = (lookAt && lookAt === LookAt.END ) || false;
    let result = '';
    const word = (reverted) ? token.split("").reverse().join("") : token;

    if (lookAt === LookAt.BETWEEN) {
        const regex = new RegExp(delimiter + '([^\\..*]*)' + delimiter, 'g');
        result = word.match(regex);
        return _.trim(result, delimiter);
    } else {
        for (let i = 0; i < word.length; i++) {
            if (word[i] !== delimiter) { result += word[i]; }
            else { break; }
        }
        return (reverted) ? result.split("").reverse().join("") : result;
    }
};
const LookAt = {
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
const processEdge = (edgeToken) => {
    const isDashed = function(edge) { return edge.indexOf('-.-') >= 0; };
    const EDGE_DELIMITER = '-';

    let leftResult;
    let rightResult;

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
const Parser = function(configuration) {
    const self = this;
    this.config = configuration;
    
    /**
     * The only public method turns the given input into a object-representation containing all 
     * configured information.
     *
     * @param input (string)        this is the input-wuml string representation
     * @return a list of objects representing the single parts of the given definition
     */
    this.toDocumentModel = (input) => {
        const tokenList = tokenize(input, self.config);

        const objectModel = [];
        for (let i = 0; i < tokenList.length; i++) {
            const token = tokenList[i];
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
        endNodeSigns : config.endNodeSigns || [']', ')'],       // default
        additionStartSign : config.additionStartSign || ['{'],  // default
        additionEndSign : config.additionEndSign || ['}']       // default
    }, config);                                                 // defaults can be overwritten
};

if (process.env.exportForTesting) {     // only export these things for testing
    module.exports.tokenize = tokenize;
    
    module.exports.determineAddition = determineAdditions;
    
    module.exports.isNote = isNote;
    module.exports.isClass = isClass;
    module.exports.isEdge = isEdge;
    module.exports.isCluster = isCluster;
    module.exports.isClusterd = isCluster;
    module.exports.isEllipse = isEllipse;
    
    module.exports.processNote = processNote;
    module.exports.processClass = processClass;
    module.exports.processCluster = processCluster;
    module.exports.processEdge = processEdge;
    module.exports.processEllipse = processEllipse;
    
    module.exports.collectUntil = collectUntil;
    module.exports.LookAt = LookAt;
}
