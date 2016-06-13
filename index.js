
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

app.post('/webhook', function (req, res) {
    var data = req.body;

    // Make sure this is a page subscription
    if (data.object == 'page') {
        // Iterate over each entry
        // There may be multiple if batched
        data.entry.forEach(function(pageEntry) {
            var pageID = pageEntry.id;
            var timeOfEvent = pageEntry.time;

            // Iterate over each messaging event
            pageEntry.messaging.forEach(function(messagingEvent) {
                if (messagingEvent.optin) {
                    //receivedAuthentication(messagingEvent);
                    res.json(messagingEvent);
                } else if (messagingEvent.message) {
                    //receivedMessage(messagingEvent);
                    res.json(messagingEvent);
                } else if (messagingEvent.delivery) {
                    //receivedDeliveryConfirmation(messagingEvent);
                    res.json(messagingEvent);
                } else if (messagingEvent.postback) {
                    //receivedPostback(messagingEvent);
                    res.json(messagingEvent);
                } else {
                    console.log("Webhook received unknown messagingEvent: ", messagingEvent);
                }
            });
        });

        // Assume all went well.
        //
        // You must send back a 200, within 20 seconds, to let us know you've
        // successfully received the callback. Otherwise, the request will time out.
        res.sendStatus(200);
    }
});

app.listen(port, function() {
    console.log('Our app is running on http://localhost:' + port);
});