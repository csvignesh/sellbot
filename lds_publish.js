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
        var shareUrl = 'http://www.ebay.com/soc/share?du=http://www.ebay.com/itm/{1}&rt=nc&t={2}&spid=2047675&itm={1}&media=http://galleryplus.ebayimg.com/ws/web/{1}_1_0_1/1000x1000.jpg&swd=2&shorten=0';
        if (err) {
            console.error('upload failed: 123');
            cb(err);
        } else {
            console.log('Upload successful!  Server responded with');
            shareUrl.replace(new RegExp('{1}', 'g'), body.itemId);
            shareUrl.replace(new RegExp('{2}', 'g'), formData.title);
            cb(shareUrl);
        }
    });
};
