'use strict';

var _ = require('lodash');
var fs = require('fs');
var spawn = require('child_process').spawn;
var wagglySvg = require('wsvg');
var im = require('node-imagemagick');
var classProcessor = require('./classDiagramProcessor');
var sequenceProcessor = require('./sequenceDiagramProcessor');
var notSupportedProcessor = require('./notSupportedDiagramProcessor');

var types = {};
types['class'] = classProcessor;
types['sequence'] = sequenceProcessor;
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
    var waggly = config.waggly || false;
    var wagger = wagglySvg.create({
        waggly: waggly,
        font_family: (waggly) ? (config.fontFamily || 'Dadhand') : undefined,
        font_size: (waggly) ? (config.fontSize || 10) : undefined
    }, function(waggledData) {
        handleOutputData(waggledData, config, callback);
    });

    wagger.transformString(svgInputData);
};

var handleOutputData = function(outputData, config, callback) {
    // transformToPNG(outputData);
    console.log(config);
    if (callback) {
        if (config.format !== 'svg') {
            transformToPNG(outputData, function(binaryData) { callback(binaryData); });
        } else {
            callback(outputData);
        }
    } else if (config.output) {
        fs.writeFile(config.output.replace(/png$/, 'svg'), outputData, function (err) {
            if (err) return console.log(err);
            if (config.format && _.endsWith(config.format, 'png')) {
                var rsvg = spawn('rsvg-convert', ['-f', 'png', '-o', config.output.replace(/svg$/, 'png'), config.output.replace(/png$/, 'svg')]);
                rsvg.stdout.on('data', function(output) { console.log(output.toString()); });
                rsvg.stderr.on('data', function(output) { console.log(output.toString()); });
                rsvg.on('close', function(code) {
                    fs.unlink(config.output.replace(/png$/, 'svg'), function(err) {
                        if (err) {
                            console.log("Couldn't remove the temporary file %s - please do this manually",
                                config.output.replace(/png$/, 'svg'))
                        }
                    }); }); }   });
    } else {
        console.log(outputData);
    }
};

var transformToPNG = function (outputData, callback) {
    var conv = im.convert(['svg:-', 'png:-']);

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

    processor.processString(umlAsString, function(output) {
        processUmlOutput(output, config, callback);
    });
};


module.exports.processUmlOutput = processUmlOutput;
module.exports.createDiagram = createDiagram;

if (process.env.exportForTesting) {
    module.exports.handleSVGData = handleSVGData;
    module.exports.handleOutputData = handleOutputData;
    module.exports.transformToPNG = transformToPNG;
}
