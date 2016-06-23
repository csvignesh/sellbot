var request = require("request");

module.exports = {
    getPriceReco: function(title, caty, condition, cb) {
        request({
            url: 'http://seewiw.ebay.com/swiw/priceguide',
            qs: {
                title: title,
                caty: caty,
                cond: condition && condition.indexOf('new') > 0 ? 1000 : 3000
            }
        }, function (err, response, body) {
            if (err) {
                console.error(err);
                cb(err);
            } else if (!err && response.statusCode == 200) {
                cb(JSON.parse(body));
            }
        });
    }
};
