var express = require('express');
var https = require('https');
var http = require('http');
var app = express();

http.createServer(app).listen(80);
https.createServer(app).listen(443);

app.listen = function() {
    var server = http.createServer(this);
    return server.listen.apply(server, arguments);
};

app.get('/', function (req, res) {
    res.send('GET request to homepage');
});