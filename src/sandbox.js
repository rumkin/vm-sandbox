var EventEmitter = require('events').EventEmitter;
var util = require('util');
var spawn = require('child_process').spawn;
var path = require('path');

module.exports = Sandbox;

/**
 * Javascript executable sandbox.
 * Options object could have `limit`, `stdio` and `initials` properties. If stdio is not passed then subprocess
 * output will be omit.
 * @param {object} options Options object.
 * @constructor
 */
function Sandbox(options) {
    EventEmitter.call(this);
    options = extend({}, this.defaultOptions, options);

    this.cwd = options.cwd;
    this.memoryLimit = options.memoryLimit;
    this.timeLimit = options.timeLimit;
    this.stdio = options.stdio;
    this.initials = options.initials;
    this.timeout = options.timeout;
}

util.inherits(Sandbox, EventEmitter);

/**
 * Sandbox options defaults
 * @type {{limit: string, stdio: null[]}}
 */
Sandbox.prototype.defaultOptions = {
    cwd : process.cwd(),
    memoryLimit : 40,
    timeLimit : Infinity,
    stdio : [null, 1, 2],
    timeout : 1*1000
};

/**
 * Run callback inside sandbox
 * @param {string} filepath Sandbox executable file path.
 * @param {function} callback Result callback.
 */
Sandbox.prototype.run = function(filepath, callback) {
    var self = this;
    var proc = this._createProcess(filepath);
    var isReady = false;
    var hasCaughtError = false;
    var isFinished = false;

    var exit = function() {
        proc.removeAllListeners('exit');
        proc.kill('SIGINT');
    };

    proc.on('error', callback);

    proc.on('exit', function(code){
        if ((! hasCaughtError) && code) {
            return callback(new Error('Unexpected exit with code ' + code));
        }
    });

    proc.on('message', function(message){
        if (! message || typeof message !== 'object') return;
        switch (message.type) {
            case 'handshake':
                isReady = true;
                proc.send({
                    type:'execute'
                });
                break;
            case 'result':
                callback(null, message.result);
                self.emit('result', message.result, filepath);
                exit();
                break;
            case 'error':
                callback(message.error);
                hasCaughtError = true;
                exit();
                break;
        }
    });

    // Catch uninitialized script error
    setTimeout(function(){
        if (! hasCaughtError && isReady === false) {

            exit();
            callback(new Error('Initialization timed out'));
        }
    }, this.timeout);

    // Set execution timeout if it's value less then Infinity
    if (this.timeLimit < Infinity) {
        setTimeout(function(){
            if (! isFinished) {
                exit();
                callback(new Error('Max execution timeout riched'));
            }
        }, this.timeLimit);
    }

    this.emit('started', filepath);
};

/**
 * Create node process with sandbox script to run executable inside it.
 * @param {string} filepath
 * @returns {*}
 */
Sandbox.prototype._createProcess = function(filepath) {
    var proc, options, stdio, args;

    stdio = this.stdio;
    // Force use IPC channel to communicate with process
    if (typeof stdio === 'string' || stdio === null) {
        stdio = [stdio, stdio, stdio, 'ipc'];
    } else {
        stdio = stdio.slice(0,3).concat('ipc');
    }

    options = {
        cwd : this.cwd,
        stdio : stdio
    };

    args = [
        // memory limit
        '--max-old-space-size=' + this.memoryLimit,
        // box script filepath
        __dirname+'/box.js',
        // target file path
        path.resolve(this.cwd, filepath)
    ];

    proc = spawn('node', args, options);
    return proc;
};

// Extend target element with multiple source objects
function extend (target, source) {
    if (! isPlainObject(target)) target = {};
    Array.prototype.slice.call(arguments, 1).forEach(util._extend.bind(null, target));
    return target;
}

// Check if object is PlainObject
function isPlainObject(target) {
    return typeof target === 'object' && target.constructor === Object;
}