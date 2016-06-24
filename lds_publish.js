var request = require("request");

module.exports = function(data, cb) {
    var formData = {
        "price": data.price,
        "title": data.title,
        "pictureUrl": data.imgUrl,
        "condition": data.aspectsMap.selected.Condition.indexOf('new') > 0 ? 1000 : 3000,
        "category": data.leafCaty,
        "itemSpecific": [],
        "description": data.desc
    };

    delete data.aspectsMap.selected.Condition;

    var keys = Object.keys(data.aspectsMap.selected);

    keys.forEach((aspectName) => {
        formData.itemSpecific.push({
            name: aspectName,
            value: data.aspectsMap.selected[aspectName]
        });
    });

    if(formData.category === '11483') {
        formData.itemSpecific.push({
            name: 'Bottoms Size (Men\'s)',
            value: '28'
        });
    }

console.log(JSON.stringify((formData)));

    request.post({url:'http://seewiw.ebay.com/ldscreate', form: formData}, (err, body) => {
        if (err) {
            console.error('upload failed: 123');
            cb(err);
        } else {
            console.log('Upload successful!  Server responded with');
            cb(body);
        }
    });
};
