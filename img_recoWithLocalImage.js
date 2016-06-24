var request = require("request");
var http = require('http');
var convert = require('netpbm').convert;
var fs = require('fs');

module.exports = {
    getCategory: function(imageUrl, cb) {

//        var imageUrl = "https://scontent.xx.fbcdn.net/v/t34.0-12/13511488_10205178056450797_2085471750_n.jpg?_nc_ad=z-m&oh=38c8f00607f6446a16f677a909f4c398&oe=576E8EAE"

        var download = function(uri, filename, callback){
            request.head(uri, function(err, res, body){
                request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
            });
        };

        download(imageUrl, 'downloadedImage.jpg', function(){
            console.log('done');

            var formData = {
                imageData: fs.createReadStream("./downloadedImage.jpg")
                //imageData: "@./downloadedImage.png"
            };

            request.post({url:'http://ai-vision-2116658668.us-west-1.elb.amazonaws.com/recognize', formData: formData}, function optionalCallback(err, httpResponse, body) {
                if (err) {
                    console.error('upload failed:');
                    //cb(err);
                } else {
                    //console.log('Upload successful!  Server responded with');
                    var data = JSON.parse(body);
                    var catys = [];
                    data.imageEntities.entities.forEach((suggestedCaty) => {
                        catys.push(suggestedCaty);
                    });
                    console.log('Upload successful!  Server responded with' + JSON.stringify(catys));
                    //cb(catys);
                }
            });
        });
    }
};
