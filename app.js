/*
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* jshint node: true, devel: true */
'use strict';

const 
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),  
  request = require('request');

var app = express();

const Wit = require('./wit').Wit;

// Wit.ai parameters
const WIT_TOKEN = 'B6BL22M6SNSZ6Y5JQKCMREO247SJMEVU';

const sessions = {};

app.set('port', process.env.PORT || 5000);
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));

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
      cb();
    } else {
      console.log('Oops! Couldn\'t find user for session:', sessionId);
      cb();
    }
  },
  merge(sessionId, context, entities, message, cb) {
    cb(context);
  },
  error(sessionId, context, err) {
    console.log(err.message);
  },
  ['fetch-topaspect'](sessionId, context, cb) {
    // Here should go the api call, e.g.:
    // context.forecast = apiCall(context.loc)
    context.topAspect = 'Brand';
    cb(context);
  },
  ['fetch-category'](sessionId, context, cb) {
    var smacresponse = {
        categories: [
          {
            categoryPath: [{
              categoryName:'1'
            }, {
              categoryName: '2'
            }, {
              categoryName: '3'
            }]
          }
        ]
    };
    var categories = smacresponse.categories;
    context.cats = categories;
    cb(context);
  },
  ['try-nothing'](sessionId, context, cb) {
    // Here should go the api call, e.g.:
    // context.forecast = apiCall(context.loc)
    context.cateogry = 'Brand';
    cb(context);
  }
};

const wit = new Wit(WIT_TOKEN, actions);

/*
 * Be sure to setup your config values before running this code. You can 
 * set them using environment variables or modifying the config file in /config.
 *
 */

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ? 
  process.env.MESSENGER_APP_SECRET :
  config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
  (process.env.MESSENGER_VALIDATION_TOKEN) :
  config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN)) {
  console.error("Missing config values");
  process.exit(1);
}

/*
 * Use your own validation token. Check that the token used in the Webhook 
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});

app.get('/t', function(req, res) {
  var sessionId = findOrCreateSession(req.query.id);
  runWit(req.query.txt, sessionId, (context) => {
    res.json(context);
  });
});

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

function isAttachmentImage(attachment) {
  return attachment.type === 'image';
}

/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page. 
 * https://developers.facebook.com/docs/messenger-platform/implementation#subscribe_app_pages
 *
 */
app.post('/webhook', function (req, res) {

  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    const messaging = getFirstMessagingEntry(req.body);
    // We retrieve the Facebook user ID of the sender
    const sender = messaging.sender.id;

    // We retrieve the user's current session, or create one if it doesn't exist
    // This is needed for our bot to figure out the conversation history
    const sessionId = findOrCreateSession(sender);

    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          sendWelcomeMessage(sender);
          res.sendStatus(200);
        } else if (messagingEvent.message) {
          if (messagingEvent.message.attachments) {
            var attachment = messagingEvent.message.attachments[0];
            if (isAttachmentImage(attachment)) {
              require('./img_reco').getCategory(attachment.payload.url, (data) => {
                var templates = [];
                var current = 0;
                data.forEach((caty) => {
                  if (current < 3) {
                    templates.push({
                      title: caty.name.split(':').pop(),
                      subtitle: caty.name,
                      buttons: [{
                        "type": "postback",
                        "title": "select",
                        "payload": "CATY_SELECTED_" + caty.leafCategories[0]
                      }]
                    });
                  }
                  current = current + 1;
                });
                console.log(templates);
                sendTextMessage(sender, 'Select category which best describes your item');
                sendCatySelectionTemplates(sender, templates);
                res.sendStatus(200);
              });
            } else {
              sendTextMessage(sender, 'Invalid attachment', sessionId);
              res.sendStatus(200);
            }
          } else {
            if (messagingEvent.message.text.toLowerCase() === 'bot') {
              // reset context to empty
              sessions[sessionId].context = {};
              sendWelcomeMessage(sender);
              res.sendStatus(200);
            } else if (sessions[sessionId].context.leafCaty) {
              if (sessions[sessionId].context.desc) {
                console.log(sessions[sessionId].context.desc, 'nothing to do!!');
                res.sendStatus(200);
              } else {
                //this is the desc usecase
                sessions[sessionId].context.desc = messagingEvent.message.text;
                var desc = sessions[sessionId].context.desc;
                var leafCaty = sessions[sessionId].context.leafCaty;
                require('./attributeExt').getAspectDetails(desc, leafCaty, (aspectData) => {
                  console.log(aspectData);
                  sessions[sessionId].context.aspectsMap = aspectData;
                  sessions[sessionId].context.aspectsNotFilled = Object.keys(aspectData.unselected);
                  showExtractedAspects(sender, sessionId);
                  res.sendStatus(200);
                });
              }
            } else {
              res.sendStatus(200);
                //runWit(messagingEvent.message.text, sessionId, (context) => {
                //  var buttons = [];
                //  var categories = context.cats;
                //  categories.forEach((caty) => {
                //    var path = "";
                //    caty.categoryPath.forEach((catyPathName) => {
                //      path = path ? path + ' > ' : path;
                //      path = path + catyPathName.categoryName;
                //    });
                //
                //    buttons.push({
                //      "type": "postback",
                //      "title": path,
                //      "payload": "CATY_SELECTED"
                //    });
                //  });
                //
                //  sendCatySelection(sender, buttons);
                //  res.sendStatus(200);
                //});
              }
          }
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
          res.sendStatus(200);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent, sessionId);
          res.sendStatus(200);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
          sendImageMessage(sender);
          res.sendStatus(200);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've 
    // successfully received the callback. Otherwise, the request will time out.
  }
});

function sendPriceRecoMessage(title, subtitle, price, senderID) {
  var messageData = {
    recipient: {
      id: senderID
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: title,
            subtitle: subtitle,
            image_url: "http://i.istockimg.com/file_thumbview_approve/40765602/3/stock-illustration-40765602-flat-price-tag-icon.jpg",
            buttons: [{
              type: "postback",
              title: 'Accept',
              payload: "price_reco_accepted_" + price
            }]
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function showExtractedAspects(senderID, sessionId) {
  var aspectToFill = sessions[sessionId].context.aspectsNotFilled.shift();
  var aspectVals = sessions[sessionId].context.aspectsMap.unselected[aspectToFill];
  var buttons = [];

  aspectVals.forEach((val) => {
    if (buttons.length < 3) {
      buttons.push({
        type: "postback",
        title: val,
        payload: "aspect_" + aspectToFill + "_" + val
      });
    }
  });

  console.log(aspectToFill, aspectVals, buttons);

  var messageData = {
    recipient: {
      id: senderID
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: aspectToFill,
            subtitle: "pick item's property",
            buttons: buttons
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
  //sendTextMessage(senderID, '123123');
}

function runWit(msg, sessionId, cb) {
  wit.runActions(
      sessionId, // the user's current session
      msg, // the user's message
      sessions[sessionId].context, // the user's current session state
      (error, context) => {
        if (error) {
          console.log('Oops! Got an error from Wit:', error);
          cb({err: JSON.stringify(error)});
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
          cb(context);
        }
      }
  );
}

/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an 
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to 
 * Messenger" plugin, it is the 'data-ref' field. Read more at 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference#auth
 *
 */
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
  sendTextMessage(senderID, "Auth successful");
}


/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message' 
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference#received_message
 *
 * For this example, we're going to echo any text that we get. If we get some 
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've 
 * created. If we receive a message with an attachment (image, video, audio), 
 * then we'll simply confirm that we've received the attachment.
 * 
 */
function receivedMessage(event, sessionId) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;


  if (messageText) {

    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    switch (messageText) {
      case 'image':
        sendImageMessage(senderID);
        break;

      case 'button':
        sendButtonMessage(senderID);
        break;

      case 'generic':
        sendGenericMessage(senderID);
        break;

      case 'receipt':
        sendReceiptMessage(senderID);
        break;

      default:
        sendTextMessage(senderID, messageText, sessionId);
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}


/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about 
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference#message_delivery
 *
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s", 
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}


/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. Read
 * more at https://developers.facebook.com/docs/messenger-platform/webhook-reference#postback
 * 
 */
function receivedPostback(event, sessionId) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("Received postback");
  console.log(payload);

  if (payload === 'DEVELOPER_DEFINED_PAYLOAD') {
    sendClickPicMsg(senderID);
  } else if (payload === 'CLICK_PIC_SELL') {
    sendTextMessage(senderID, "Send a picture of the item you want to sell");
  } else if (payload.indexOf('CATY_SELECTED_') === 0) {
    var leaf = payload.split(('_')).pop();
    sessions[sessionId].context.leafCaty = leaf;
    sendEnterDescMsg(senderID);
  } else if (payload.indexOf('aspect_') === 0) {
    var payloadSplit = payload.split('_');
    var selectedAspect = payloadSplit.pop();
    sessions[sessionId].context.aspectsMap.selected[payloadSplit.pop()] = selectedAspect;
    if (sessions[sessionId].context.aspectsNotFilled.length > 0) {
      showExtractedAspects(senderID, sessionId);
    } else {
      //recommend price
      var aspects = sessions[sessionId].context.aspectsMap.selected;
      var title = '';
      var condition = '';
      var caty = sessions[sessionId].context.leafCaty;
      Object.keys(aspects).forEach((key) => {
        if (key.toLowerCase() === 'condition') {
          condition = aspects[key];
        } else {
          title = title ? title + ' ' : title;
          title = title + aspects[key];
        }
      });

      console.log(title, caty, condition);
      require('./price_reco').getPriceReco(title, caty, condition, (data) => {
        var title = data.binPrice.shortMessage + data.binPrice.guidanceData.currency;
        var subTitle = data.binPrice.guidanceMessage;
        sendPriceRecoMessage(title, subTitle, data.binPrice.recommendedValue, senderID);
      });
    }
  } else if (payload.indexOf('price_reco_accepted_') === 0) {
    var price = payload.split('_').pop();
    console.log('Price:' + price);
  }else {
      // When a postback is called, we'll send a message back to the sender to
      // let them know it was successful
      sendTextMessage(senderID, "Postback mapping not found");
  }
}

/*
 * Send a message with an using the Send API.
 *
 */
function sendImageMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: "http://cdn.shopify.com/s/files/1/0185/5092/products/persons-0019_small.png?v=1369544043"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a text message using the Send API.
 *
 */
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

/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "This is test text",
          buttons:[{
            type: "web_url",
            url: "https://www.oculus.com/en-us/rift/",
            title: "Open Web URL"
          }, {
            type: "postback",
            title: "Call Postback",
            payload: "Developer defined postback"
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Ebay Selling",
            subtitle: "Ebay Selling bot",
            item_url: "http://i.ebayimg.com/images/g/Kq8AAOSwfC9XOWrg/s-l400.jpg",
            image_url: "http://i.ebayimg.com/images/g/Kq8AAOSwfC9XOWrg/s-l400.jpg",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble"
            }]
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

function sendEnterDescMsg(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Please describe your item briefly",
            subtitle: "eg. Iphone 6s plus space grey, 64gb, at&t with charger and headphones"
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendCatySelectionTemplates(recipientId, templates) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: templates
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendCatySelection(recipientId, buttons) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Confirm item category",
            subtitle: "pick a category",
            "buttons": buttons
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendClickPicMsg(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Send me a picture of your item",
            subtitle: "Or enter a title eg. sell my Samsung Galaxy 6"
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendWelcomeMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [
            {
              "title": "eBay sell bot at your service",
              "item_url": "http://www.ebay.com/sl/sell",
              "image_url": "http://i.imgur.com/hhJyaHA.png",
              "subtitle": "i can help you sell fast",
              "buttons": [
                {
                  "type": "postback",
                  "title": "Start Selling",
                  "payload": "DEVELOPER_DEFINED_PAYLOAD"
                }
              ]
            }
          ]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a receipt message using the Send API.
 *
 */
function sendReceiptMessage(recipientId) {
  // Generate a random receipt ID as the API requires a unique ID
  var receiptId = "order" + Math.floor(Math.random()*1000);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{
      attachment: {
        type: "template",
        payload: {
          template_type: "receipt",
          recipient_name: "Peter Chang",
          order_number: receiptId,
          currency: "USD",
          payment_method: "Visa 1234",        
          timestamp: "1428444852", 
          elements: [{
            title: "Oculus Rift",
            subtitle: "Includes: headset, sensor, remote",
            quantity: 1,
            price: 599.00,
            currency: "USD",
            image_url: "http://messengerdemo.parseapp.com/img/riftsq.png"
          }, {
            title: "Samsung Gear VR",
            subtitle: "Frost White",
            quantity: 1,
            price: 99.99,
            currency: "USD",
            image_url: "http://messengerdemo.parseapp.com/img/gearvrsq.png"
          }],
          address: {
            street_1: "1 Hacker Way",
            street_2: "",
            city: "Menlo Park",
            postal_code: "94025",
            state: "CA",
            country: "US"
          },
          summary: {
            subtotal: 698.99,
            shipping_cost: 20.00,
            total_tax: 57.67,
            total_cost: 626.66
          },
          adjustments: [{
            name: "New Customer Discount",
            amount: -50
          }, {
            name: "$100 Off Coupon",
            amount: -100
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
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
      console.error(response.statusCode);
      console.error(error);
    }
  });  
}

// Start server
// Webhooks must be available via SSL with a certificate signed by a valid 
// certificate authority.
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;

