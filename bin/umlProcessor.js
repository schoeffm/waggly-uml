'use strict';

var _ = require('lodash');
var fs = require('fs');
var spawn = require('child_process').spawn;
var wagglySvg = require('wsvg');
var im = require('node-imagemagick');
var classProcessor = require('./dot/classDiagramProcessor');
var sequenceProcessor = require('./pic2plot/sequenceDiagramProcessor');
var useCaseProcessor = require('./dot/useCaseDiagramProcessor');
var notSupportedProcessor = require('./notSupportedDiagramProcessor');
var svgPostProcessor = require('./svg/svgPostProcessor');


var types = {};
types['class'] = classProcessor;
types['sequence'] = sequenceProcessor;
types['usecase'] = useCaseProcessor;
types[''] = notSupportedProcessor;


var processUmlOutput = function (inputData, config, callback) {
    var process;
    if (config.type === 'sequence') {
        // convert sequence.png -fuzz 10% -trim result.png
        process = spawn('pic2plot', ['-Tsvg', '-f', '0.0175', '--page-size', 'b']);
    } else {
        process = spawn('dot', ['-Tsvg']);
    }
    var accumulator = [];

    process.stdout.on('data', function (outputData) { accumulator.push(outputData); });

    process.on('close', function (exitCode) {
        if (exitCode === 0 && Buffer.isBuffer(accumulator[0])) {
            var result = Buffer.concat(accumulator)
                .toString('UTF-8')
                .replace(/(g id="content" transform="translate)(\(.*?\))/gm, '$1(0.05,0.05)'); // sequence-diagram stuff

            handleSVGData(result, config, callback); // handle the result 
        } else {
            console.error("SVG-creation wasn't successful - exitCode " + exitCode);
        }
    });
    process.stderr.on('data', function (error) { console.error(error.toString()); });
    process.stdin.write(inputData, function () { process.stdin.end(); });
};

var handleSVGData = function(svgInputData, config, callback) {

    svgInputData = svgPostProcessor.postProcess(svgInputData, config);

    var waggly = config.waggly || false;
    var wagger = wagglySvg.create({
        waggly: waggly,
        wag_interval: (config.wagInterval || undefined),
        wag_size: (config.wagSize || undefined),
        font_family: (waggly) ? (config.fontFamily || 'Dadhand') : undefined,
        font_size: (waggly) ? (config.fontSize || 10) : undefined
    }, function(waggledData) {
        handleOutputData(waggledData, config, callback);
    });

    wagger.transformString(svgInputData);
};

var handleOutputData = function(outputData, config, callback) {
    callback = callback || ((config.output) ? toFileCallback(config) : toStdOut);
    
    if (config.format !== 'svg') {
        transformTo(outputData, config.format, function(binaryData) { callback(binaryData); });
    } else {
        callback(outputData);
    }
    
};

/*
 * just logs everything to the console - no matter if it's binary or not
 */
var toStdOut = function(outputData) { console.log(outputData); };

/*
 * returns a function (based on the given config) which writes the given output-data to a file (which is 
 * configured within' the given config-object).
 */
var toFileCallback = function(config) {
    return function(outputData) {
        fs.writeFile(config.output, outputData, { encoding: (config.format !== 'svg' ? 'binary' : 'utf-8') }, function(err) {
            if (err) throw err;
            console.log('It\'s saved!');                        
}); };  };

var transformTo = function (outputData, format, callback) {
    var destinationFormat = (_.includes(['png', 'jpg'], format)) ? format : 'jpg';
    var conv = im.convert(['-trim', 'svg:-', destinationFormat + ':-']);

    var accumulator = [];
    
    conv.stdout.on('data', function (data) {
        accumulator.push(new Buffer(data, 'binary'));
    });
    conv.stdout.on('end', function () {
        callback(Buffer.concat(accumulator));
    });
    
    conv.stdin.write(outputData);
    conv.stdin.end();
};

var createDiagram = function(umlAsString, config, callback) {
    var cb = (callback === undefined && typeof config === 'function') ? config : callback;
    if (cb === undefined || typeof cb !== 'function') { throw new Error('You have to provide a callback-function'); }

    var processor = (config.type && types[config.type]) ? types[config.type] : classProcessor;

    processor.processString(umlAsString, config, function(output) {
        processUmlOutput(output, config, callback);
    });
};


module.exports.processUmlOutput = processUmlOutput;
module.exports.createDiagram = createDiagram;

if (process.env.exportForTesting) {
    module.exports.handleSVGData = handleSVGData;
    module.exports.handleOutputData = handleOutputData;
    module.exports.transformTo = transformTo;
}
