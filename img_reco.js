var request = require("request");

module.exports = {
    getCategory: function(imageUrl, cb) {

        var formData = {
            imageUrl: imageUrl
        };

        request.post({url:'http://66.211.186.179:80/api/recognize', formData: formData}, function optionalCallback(err, httpResponse, body) {
            if (err) {
                console.error('upload failed:');
            } else {
                console.log('Upload successful!  Server responded with:', body);
            }
            cb(err || body);
        });
    }
};
