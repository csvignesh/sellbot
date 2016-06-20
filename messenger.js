'use strict';

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_PAGE_ID=your_page_id FB_PAGE_TOKEN=your_page_token FB_VERIFY_TOKEN=verify_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/fb` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require('body-parser');
const express = require('express');
const request = require('request');

// When not cloning the `node-wit` repo, replace the `require` like so:
// const Wit = require('node-wit').Wit;
const Wit = require('./wit').Wit;

// Webserver parameter
const PORT = process.env.PORT || 8445;

// Wit.ai parameters
const WIT_TOKEN = 'B6BL22M6SNSZ6Y5JQKCMREO247SJMEVU';

const FB_PAGE_TOKEN = 'EAAHoZA5SlIM0BAHcKCGKHCTI8k7tdrbzxyjzGyByDWaX6debipBPwRFBvvnveZAcgJvRS09Hbn213GvhaeIa4WVCoAEtRJrrGjLP3QsrqzE7AwZASm10O7NlWz3ZB7FUthcgZBSIMX91p1jdiTZBZBdZBQDe3XXE8DZBRPrJeeBQcAQZDZD';
if (!FB_PAGE_TOKEN) {
    throw new Error('missing FB_PAGE_TOKEN');
}
const FB_VERIFY_TOKEN = 'this_is_my_token_verify_me';

// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference
const fbReq = request.defaults({
    uri: 'https://graph.facebook.com/me/messages',
    method: 'POST',
    json: true,
    qs: { access_token: FB_PAGE_TOKEN },
    headers: {'Content-Type': 'application/json'},
});

const fbMessage = (recipientId, msg, cb) => {
    const opts = {
        form: {
            recipient: {
                id: recipientId,
            },
            message: {
                text: msg,
            },
        },
    };
    fbReq(opts, (err, resp, data) => {
        if (cb) {
            cb(err || data.error && data.error.message, data);
        }
    });
};

// See the Webhook reference
// https://developers.facebook.com/docs/messenger-platform/webhook-reference
const getFirstMessagingEntry = (body) => {
    const val = body.object == 'page' &&
            body.entry &&
            Array.isArray(body.entry) &&
            body.entry.length > 0 &&
            body.entry[0] &&
            body.entry[0].messaging &&
            Array.isArray(body.entry[0].messaging) &&
            body.entry[0].messaging.length > 0 &&
            body.entry[0].messaging[0]
        ;
    return val || null;
};

// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
    let sessionId;
    // Let's see if we already have a session for the user fbid
    Object.keys(sessions).forEach(k => {
        if (sessions[k].fbid === fbid) {
            // Yep, got it!
            sessionId = k;
        }
    });
    if (!sessionId) {
        // No session found for user fbid, let's create a new one
        sessionId = new Date().toISOString();
        sessions[sessionId] = {fbid: fbid, context: {}};
    }
    return sessionId;
};

// Our bot actions
const actions = {
    say(sessionId, context, message, cb) {
        // Our bot has something to say!
        // Let's retrieve the Facebook user whose session belongs to
        const recipientId = sessions[sessionId].fbid;
        if (recipientId) {
            // Yay, we found our recipient!
            // Let's forward our bot response to her.
            fbMessage(recipientId, message, (err, data) => {
                if (err) {
                    console.log(
                        'Oops! An error occurred while forwarding the response to',
                        recipientId,
                        ':',
                        err
                    );
                }

                // Let's give the wheel back to our bot
                cb();
            });
        } else {
            console.log('Oops! Couldn\'t find user for session:', sessionId);
            // Giving the wheel back to our bot
            cb();
        }
    },
    merge(sessionId, context, entities, message, cb) {
        cb(context);
    },
    error(sessionId, context, error) {
        console.log(error.message);
    },
    // You should implement your custom actions here
    // See https://wit.ai/docs/quickstart
};

// Setting up our bot
const wit = new Wit(WIT_TOKEN, actions);

// Starting our webserver and putting it all together
const app = express();
app.set('port', PORT);
app.listen(app.get('port'));
app.use(bodyParser.json());

// Webhook setup
app.get('/fb', (req, res) => {
    if (!FB_VERIFY_TOKEN) {
        throw new Error('missing FB_VERIFY_TOKEN');
    }
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    } else {
        res.sendStatus(400);
    }
});

app.get('/test', (req, res) => {
    res.json({
        status: '200'
    });
});

function receivedAuthentication(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfAuth = event.timestamp;

    // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
    // The developer can set this to an arbitrary value to associate the
    // authentication callback with the 'Send to Messenger' click event. This is
    // a way to do account linking when the user clicks the 'Send to Messenger'
    // plugin.
    var passThroughParam = event.optin.ref;

    console.log("Received authentication for user %d and page %d with pass " +
        "through param '%s' at %d", senderID, recipientID, passThroughParam,
        timeOfAuth);

    // When an authentication is received, we'll send a message back to the sender
    // to let them know it was successful.
    sendTextMessage(senderID, "Authentication successful");
}

function sendTextMessage(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText
        }
    };

    callSendAPI(messageData);
}

function receivedMessage(event) {
    var senderID = event.sender.id;
    var message = event.message;

    // You may get a text or attachment but not both
    var messageText = message.text;

    sendTextMessage(senderID, messageText);
}

function callSendAPI(messageData) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: PAGE_ACCESS_TOKEN },
        method: 'POST',
        json: messageData

    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            console.log("Successfully sent generic message with id %s to recipient %s",
                messageId, recipientId);
        } else {
            console.error("Unable to send message.");
            console.error(response);
            console.error(error);
        }
    });
}

// Message handler
app.post('/webhook', (req, res) => {
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
                if (messagingEvent.message) {
                    receivedMessage(messagingEvent);
                } else if (messagingEvent.optin) {
                    receivedAuthentication(messagingEvent);
                }
            });
        });

        // Assume all went well.
        //
        // You must send back a 200, within 20 seconds, to let us know you've
        // successfully received the callback. Otherwise, the request will time out.
        res.sendStatus(200);
    }

    return;


    // Parsing the Messenger API response
    const messaging = getFirstMessagingEntry(req.body);
    if (messaging && messaging.message) {
        // Yay! We got a new message!

        // We retrieve the Facebook user ID of the sender
        const sender = messaging.sender.id;

        // We retrieve the user's current session, or create one if it doesn't exist
        // This is needed for our bot to figure out the conversation history
        const sessionId = findOrCreateSession(sender);

        // We retrieve the message content
        const msg = messaging.message.text;
        const atts = messaging.message.attachments;

        if (atts) {
            // We received an attachment

            // Let's reply with an automatic message
            fbMessage(
                sender,
                'Sorry I can only process text messages for now.'
            );
        } else if (msg) {
            // We received a text message

            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do
            wit.runActions(
                sessionId, // the user's current session
                msg, // the user's message
                sessions[sessionId].context, // the user's current session state
                (error, context) => {
                    if (error) {
                        console.log('Oops! Got an error from Wit:', error);
                    } else {
                        // Our bot did everything it has to do.
                        // Now it's waiting for further messages to proceed.
                        console.log('Waiting for further messages.');

                        // Based on the session state, you might want to reset the session.
                        // This depends heavily on the business logic of your bot.
                        // Example:
                        // if (context['done']) {
                        //   delete sessions[sessionId];
                        // }

                        // Updating the user's current session state
                        sessions[sessionId].context = context;
                        res.json(context);
                    }
                }
            );
        }
    }
});
