var request = require("request");

module.exports = {
    getCategory: function(imageUrl, cb) {

        var formData = {
            imageUrl: imageUrl
        };

        request.post({url:'http://66.211.186.179:80/api/recognize', formData: formData}, function optionalCallback(err, httpResponse, body) {
            if (err) {
                return console.error('upload failed:', err);
            }
            console.log('Upload successful!  Server responded with:', body);
            cb(err || body);
        });
    }
};
