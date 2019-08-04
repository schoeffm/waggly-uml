'use strict';

const _ = require('lodash');
const fs = require('fs');
const spawn = require('child_process').spawn;
const wagglySvg = require('wsvg');
const im = require('node-imagemagick');
const classProcessor = require('./dot/classDiagramProcessor');
const sequenceProcessor = require('./pic2plot/sequenceDiagramProcessor');
const useCaseProcessor = require('./dot/useCaseDiagramProcessor');
const notSupportedProcessor = require('./notSupportedDiagramProcessor');
const svgPostProcessor = require('./svg/svgPostProcessor');


const types = {};
types['class'] = classProcessor;
types['sequence'] = sequenceProcessor;
types['usecase'] = useCaseProcessor;
types[''] = notSupportedProcessor;


const processUmlOutput = (inputData, config, callback) => {
    let process;
    if (config.type === 'sequence') {
        // convert sequence.png -fuzz 10% -trim result.png
        process = spawn('pic2plot', ['-Tsvg', '-f', '0.0175', '--page-size', 'b']);
    } else {
        process = spawn('dot', ['-Tsvg']);
    }
    const accumulator = [];

    process.stdout.on('data', (outputData) => { accumulator.push(outputData); });

    process.on('close', (exitCode) => {
        if (exitCode === 0 && Buffer.isBuffer(accumulator[0])) {
            const result = Buffer.concat(accumulator)
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

const handleSVGData = (svgInputData, config, callback) => {

    svgInputData = svgPostProcessor.postProcess(svgInputData, config);

    const waggly = config.waggly || false;
    const wagger = wagglySvg.create({
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

const handleOutputData = (outputData, config, callback) => {
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
const toStdOut = (outputData) => { console.log(outputData); };

/*
 * returns a function (based on the given config) which writes the given output-data to a file (which is 
 * configured within' the given config-object).
 */
const toFileCallback = (config) => {
    return function(outputData) {
        fs.writeFile(config.output, outputData, { encoding: (config.format !== 'svg' ? 'binary' : 'utf-8') }, function(err) {
            if (err) throw err;
            console.log('It\'s saved!');                        
}); };  };

const transformTo = (outputData, format, callback) => {
    const destinationFormat = (_.includes(['png', 'jpg'], format)) ? format : 'jpg';
    const conv = im.convert(['-trim', 'svg:-', destinationFormat + ':-']);

    const accumulator = [];
    
    conv.stdout.on('data', function (data) {
        accumulator.push(new Buffer(data, 'binary'));
    });
    conv.stdout.on('end', function () {
        callback(Buffer.concat(accumulator));
    });
    
    conv.stdin.write(outputData);
    conv.stdin.end();
};

const createDiagram = (umlAsString, config, callback) => {
    const cb = (callback === undefined && typeof config === 'function') ? config : callback;
    if (cb === undefined || typeof cb !== 'function') { throw new Error('You have to provide a callback-function'); }

    const processor = (config.type && types[config.type]) ? types[config.type] : classProcessor;

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
