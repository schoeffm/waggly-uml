'use strict';

var _ = require('lodash');

var notSupportedType = () => { throw new Error("Currently this diagram type is not supported."); };

module.exports.processString = notSupportedType;
module.exports.processFile = notSupportedType;