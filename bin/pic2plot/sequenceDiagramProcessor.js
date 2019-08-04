'use strict';

const _ = require('lodash');
const util = require('util');
const graphviz = require('graphviz');
const parser = require('./../parser').create({startNodeSigns : ['['], endNodeSigns : [']'] });
const fs = require('fs');
const c = require('./../constants');

const recordName = (label) => {
    return _.trim(label.split('|')[0]);
};

const collectObjects = (tokenList) => {
    const nodeLookupCache = {};
    for (let i = 0; i < tokenList.length; i++) {
        const token = tokenList[i];
        if (_.includes([c.NODE_TYPE_RECORD, c.NODE_TYPE_ELLIPSE], token.type)) {
            if (nodeLookupCache[recordName(token.content.text)]) {
                continue;
            }
            nodeLookupCache[recordName(token.content.text)] = _.merge(token, {uid: 'Rec' + i});
    }   }
    return nodeLookupCache;
};

const collectMessages = (tokenList, nodeLookupCache) => {
    const messageLookupList = {};
    for (let i = 0; i < tokenList.length; i++) {
        const token = tokenList[i];
        if (c.is(token.type, c.NODE_TYPE_EDGE) && tokenList[i - 1] && tokenList[i + 1]) {
            const text = token.content.left.text || token.content.right.text;
            const leftObject = tokenList[i - 1];
            const rightObject = tokenList[i + 1];
            messageLookupList['Lin' + i] = _.merge(token,
                {
                    text: text,
                    from: (token.content.right.type === 'normal') ? leftObject : rightObject,
                    to: (token.content.right.type === 'normal') ? rightObject : leftObject,
                    uid1: nodeLookupCache[recordName(leftObject.content.text)].uid,
                    uid2: nodeLookupCache[recordName(rightObject.content.text)].uid
                });
        }   }
    return messageLookupList;
};

const filterPassiveObjects = (messageLookupCache, objectLookupCache) => {
    const result = _.filter(messageLookupCache, (value, key) => value.text === 'create');
    
    const passiveObjects = {};
    
    _.reduce(result, (acc, element, key) => {
        acc[recordName(element.to.content.text)] = element.to;  // the to-object will be created lazily                
    }, passiveObjects);
    
    _.filter(objectLookupCache, (object) => _.startsWith(object.content.text,'actor:' ))
        .forEach((actor) => { passiveObjects[recordName(actor.content.text)] = actor; });
    
    return passiveObjects;
};

const mapMessageType = (value) => {
    let type = 'message';
    if (value.text === 'create') { type = 'cmessage'; }
    else if (value.text === 'destroy') { type = 'dmessage'; }
    
    if (type === 'message') {
        type = (value.content.style === 'dashed') ? 'return_message' : 'message';
    }
    
    return type;
};

const toPicModel = (tokenList) => {
    const picLines= [];

    const objectLookupCache = collectObjects(tokenList);
    const messageLookupCache = collectMessages(tokenList, objectLookupCache);
    const passiveObjects = filterPassiveObjects(messageLookupCache, objectLookupCache);

    // start the diagram by including the sequence.pic
    picLines.push('.PS');
    picLines.push(util.format('copy "%s";', __dirname + "/sequence.pic"));
    picLines.push('underline=0;');
    
    // first - add all (unique) objects to the diagram 
    _.forEach(objectLookupCache, (value, key) => {
        if (_.startsWith(value.content.text, 'actor:')) {
            picLines.push(util.format('%s(%s,"%s",%d);', 'actor', value.uid, key.split(':')[1], 20));
        } else {
            const objectType = (passiveObjects[recordName(value.content.text)]) ? 'pobject' : 'object' ;
            picLines.push(util.format('%s(%s,"%s",%d);', objectType, value.uid, key, 20));
        }
    });
    picLines.push('step();');
    
    // after the step - activate all objects (don't activate placeholder-objects)
    _.forEach(objectLookupCache, (value) => {
        if (! passiveObjects[recordName(value.content.text)]) {
            picLines.push(util.format('active(%s);', value.uid));
        }
    });
    
    // now place all messages between our objects
    _.forEach(messageLookupCache, (value, key) => {
        const messageType = mapMessageType(value);
        if (messageType === 'dmessage') {
            picLines.push(util.format('inactive(%s);', objectLookupCache[recordName(value.to.content.text)].uid));
        }
        picLines.push(util.format('%s(%s,%s,"%s");', messageType , 
            objectLookupCache[recordName(value.from.content.text)].uid,
            objectLookupCache[recordName(value.to.content.text)].uid,
            (messageType === 'cmessage') ? value.to.content.text : value.text));
        
        if (messageType === 'cmessage') {
            picLines.push(util.format('active(%s);', objectLookupCache[recordName(value.to.content.text)].uid));
        }
    });

    picLines.push('step();');
    // finally, after adding an additional step, complete the swime-lines 
    _.forEach(objectLookupCache, (value) => picLines.push(util.format('complete(%s);', value.uid)));
    
    picLines.push('step();');
    
    picLines.push('.PE');
    return picLines.join('\n');
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

    callback(toPicModel(parser.toDocumentModel(input)));
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

    fs.readFile(filePath, {encoding: 'utf-8'}, (err, data) => {
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
    module.exports.mapMessageType = mapMessageType;
    module.exports.filterPassiveObjects = filterPassiveObjects;
}