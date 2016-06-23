var request = require("request");

module.exports = {
    getAspectDetails: function(title, caty, cb) {
        request('http://seewiw.ebay.com/s/bot/smac', function (err, response, body) {
            if (err) {
                console.error('upload failed:');
                cb(err);
            } else if (!error && response.statusCode == 200) {
                console.log(body);
            }
        });
    }
};
