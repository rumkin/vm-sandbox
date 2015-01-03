var Sandbox = require('../src/sandbox');

var sandbox = new Sandbox({
    cwd : __dirname
});

sandbox.run(__dirname + '/' + process.argv[2] + '.js', function(err, result){
    if (err) {
        console.error('Error:', err.message);
    } else {
        console.log(result);
    }
});


