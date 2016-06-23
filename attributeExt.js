var request = require("request");

module.exports = {
    getAspectDetails: function(title, caty, cb) {
        request({
            url: 'http://seewiw.ebay.com/s/bot/smac',
            qs: {
                title: title,
                categoryId: caty
            }
        }, function (err, response, body) {
            if (err) {
                console.error(err);
                cb(err);
            } else if (!err && response.statusCode == 200) {
                console.log(body);
            }
        });
    }
};
