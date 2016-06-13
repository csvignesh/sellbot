
var express = require('express');
var app = express();

// set the port of our application
// process.env.PORT lets the port be set by Heroku
var port = process.env.PORT || 8080;

// make express look in the public directory for assets (css/js/img)
app.use(express.static(__dirname + '/public'));

// set the home page route
app.get('/', function(req, res) {

    // ejs render automatically looks in the views folder
    res.json({
        success: 1
    });
});

// webhook
app.get('/webhook', function (req, res) {
    if (req.query['hub.verify_token'] === 'this_is_my_token_verify_me') {
        res.send(req.query['hub.challenge']);
    } else {
        res.send('Error, wrong validation token');
    }
});

app.listen(port, function() {
    console.log('Our app is running on http://localhost:' + port);
});