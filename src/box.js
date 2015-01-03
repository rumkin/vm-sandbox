var fs = require('fs');
var path = require('path');
var vm = require('vm');


if (! process.send) {
    console.error('IPC mode only');
    process.exit(1);
}

// Process bindings

process.on('uncaughtError', function(err){
    onError(err);
});

process.on('message', function(message){
    if (!message || typeof message !== 'object') return;

    if (message.type === 'execute') {
        execute(message.args||[]);
    }
});

// Executable source filepath
var filepath = path.resolve(process.cwd(), process.argv[2]);
// Executable function
var executable;
// Code execution wrapper
var execute = function(args) {
    if (typeof executable !== 'function') {
        onError(new Error('Internal error: executable not defined'));
        return;
    }
    try {
        var result = executable.apply(null, args);
    } catch (err) {
        onError(err);
        return;
    }

    process.send({
        type : 'result',
        result : result
    });
};


fs.stat(filepath, function(err, stat){
    if (err) {
        return onError(err);
    }

    if (! stat.isFile()) {
        return onError(new Error('Executable "' + filename + '" is not a file'));
    }

    fs.readFile(filepath, 'utf-8', function(err, content){
        if (err) return onError(err);

        // Create wrapper executable, like node.js do
        var wrapped = '(function(){' + content + '\n});';

        executable = vm.runInThisContext(wrapped, filepath);

        process.send({type:'handshake'});
    });
});


// Helper function
function onError(error) {
    process.send({
        type : 'error',
        error : {
            message : error.message,
            stack : error.stack
        }
    });

    process.exit(1);
}