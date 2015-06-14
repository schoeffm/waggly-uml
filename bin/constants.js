'use strict';

var SEPARATOR = ':';

module.exports.NODE_TYPE_PRECISION_ACTOR = 'actor' + SEPARATOR;

module.exports.NODE_TYPE_RECORD = 'record';
module.exports.NODE_TYPE_NOTE = 'note';
module.exports.NODE_TYPE_ELLIPSE = 'ellipse';
module.exports.NODE_TYPE_CLUSTER = 'cluster';
module.exports.NODE_TYPE_EDGE = 'edge';

module.exports.NODE_ADD_INFO_BACKGROUND = 'bg' + SEPARATOR;
module.exports.NODE_ADD_INFO_LINK = 'link' + SEPARATOR;

module.exports.is = function(actual, expected) { return actual === expected};