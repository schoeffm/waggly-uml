'use strict';

var _ = require('lodash');
var util = require('util');
var graphviz = require('graphviz');
var parser = require('./parser');
var fs = require('fs');

var recordName = function(label) {
    return _.trim(label.split('|')[0]);
};

var collectObjects = function(tokenList) {
    var nodeLookupCache = {};
    for (var i = 0; i < tokenList.length; i++) {
        var token = tokenList[i];
        if (token.type === 'record') {
            if (nodeLookupCache[recordName(token.content.text)]) {
                continue;
            }
            nodeLookupCache[recordName(token.content.text)] = _.merge(token, {uid: 'Rec' + i});
        }   }
    return nodeLookupCache;
};

var collectMessages = function(tokenList, nodeLookupCache) {
    var messageLookupList = {};
    for (var i = 0; i < tokenList.length; i++) {
        var token = tokenList[i];
        if (token.type === 'edge' && tokenList[i - 1] && tokenList[i + 1]) {
            var text = token.content.left.text || token.content.right.text;
            var leftObject = tokenList[i - 1];
            var rightObject = tokenList[i + 1];
            messageLookupList['Lin' + i] = _.merge(token,
                {
                    text: text,
                    uid1: nodeLookupCache[recordName(leftObject.content.text)].uid,
                    uid2: nodeLookupCache[recordName(rightObject.content.text)].uid
                });
        }   }
    return messageLookupList;
};

var mapMessageType = function(value) {
    var type = 'message'; 
    // if (value.text === 'create') { type = 'cmessage'; }
    
    if (type === 'message') {
        type = (value.content.style === 'dashed') ? 'return_message' : 'message';
    }
    
    return type;
};

var toPicModel = function(tokenList) {
    var picLines= [];

    var objectLookupCache = collectObjects(tokenList);
    var messageLookupCache = collectMessages(tokenList, objectLookupCache);

    // start the diagram by including the sequence.pic
    picLines.push('.PS');
    picLines.push(util.format('copy "%s";', __dirname + "/sequence.pic"));
    picLines.push('underline=0;');
    //picLines.push('spacing=0.2;');
    //picLines.push('maxpsht=8;');
    //picLines.push('maxpswid=6;');
    //picLines.push('boxwid = 4;');
    //picLines.push('boxht = 01;');
    // picLines.push('movewid = 0.25;');
    
    // first - add all (unique) objects to the diagram 
    _.forEach(objectLookupCache, function(value, key) {
        picLines.push(util.format('object(%s,"%s",%d);', value.uid, key, 20));
    });
    picLines.push('step();');
    
    // after the step - activate all added objects
    _.forEach(objectLookupCache, function(value) {
        picLines.push(util.format('active(%s);', value.uid));
    });
    
    // now place all messages between our objects
    _.forEach(messageLookupCache, function(value, key) {
        var messageType = mapMessageType(value);
        var left_to_right = value.content.right.type === 'vee';
        picLines.push(util.format('%s(%s,%s,"%s");', messageType , 
            (left_to_right) ? value.uid1 : value.uid2,
            (left_to_right) ? value.uid2 : value.uid1,
            value.text));
    });

    picLines.push('step();');
    // finally, after adding an additional step, complete the swime-lines 
    _.forEach(objectLookupCache, function(value) {
        picLines.push(util.format('complete(%s);', value.uid));
    });
    
    picLines.push('step();');
    
    picLines.push('.PE');
    return picLines.join('\n');
};

/**
 * @param input a string representing the uml-syntax
 * @param callback which gets called when the transformation is done
 */
var processString = function(input, callback) {
    if (input === undefined) { throw new Error("You must provide an 'input'-string in order to be of any value"); }
    if (callback === undefined) { throw new Error("You must provide a 'callback' in order to process the transformed result"); }

    callback(toPicModel(parser.toDocumentModel(input)));
};

/**
 * @param filePath path to the uml-input-file to be transformed (convenience-method for processString())
 * @param callback which gets called when the transformation is done
 */
var processFile = function(filePath, callback) {
    if (filePath === undefined) { throw new Error("You must provide a 'filePath' in order to be of any value"); }
    if (callback === undefined) { throw new Error("You must provide a 'callback' in order to process the transformed result"); }

    fs.readFile(filePath, {encoding: 'utf-8'}, function(err, data) {
        callback(toPicModel(parser.toDocumentModel(data)));
    });
};

module.exports.processString = processString;
module.exports.processFile = processFile;

// only exported for tests
if (process.env.exportForTesting) {
    module.exports.toPicModel = toPicModel;
    module.exports.collectMessages = collectMessages;
    module.exports.collectObjects = collectObjects;
}