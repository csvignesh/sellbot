var http = require('http');
var express = require("express");

var app = express();

app.set('port', process.env.PORT || 3000);
app.use(express.logger());

app.get('/', function(request, response) {
    console.log('[support dash] processing get request')
    response.send('Hello World 2!');
});

app.listen(process.env.PORT, function () {
    console.log('***** exp listening on port: ' + process.env.PORT);
});