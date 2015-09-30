var express = require('express');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var jwt = require('jsonwebtoken');
var path = require('path');
var fs = require('fs');
var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();
var uuid = require('node-uuid');

var config = require('./config'); // Load the config
var auth = require('./auth'); // Load some authentication middleware

var db = require('monk')(config.mongoUrl);
var screenshots = db.get('screenshots');

var app = express();
var port = process.env.PORT || config.port;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(morgan('short'));

app.get('/', function(req, res) {
	res.send("Hello!");
});

app.get('/:uuid/:filename', function (req, res) {
	var file = encodeURIComponent(req.params.filename);
	screenshots.find({ origFilename: file, uid: req.params.uuid}, function(err, doc) {
		if(err) {
			res.json({ success: false, message: 'Unable to find image' });
		}
		else {
			if(doc.length > 0) {
				res.sendFile(path.join(__dirname, "uploads/") + doc[0].filename);
			}
			else {
				res.sendFile(path.join(__dirname, "static/") + "notfound.png");
			}
		}
	});
});

// API ROUTES //
var apiRoutes = express.Router(); 

apiRoutes.use('/screenshots', auth.checkToken);
apiRoutes.use('/upload', auth.checkToken);

apiRoutes.post('/auth', function(req, res) {
	if(req.body.userid == config.userKey) {
		var token = jwt.sign({ userid: config.userKey }, config.serverSecret, {
			expiresInMinutes: 720 // 12 hours till expiration
        });

        res.json({
			success: true,
			message: 'Generating token succeeded',
			token: token
        });
	}
});

apiRoutes.get('/screenshots', function(res, res) {
	screenshots.find({}, function (err, doc) {
		if(err) {
			console.log("[/upload] - ERROR: " + err);
		}
		else {
			res.json(doc);
		}
	});
});

apiRoutes.post('/upload', multipartMiddleware, function(req, res) {
	var uniqueId = uuid.v4();
	var newFileName = uniqueId + "-" + req.files.screenFile.originalFilename;

	var currentPath = req.files.screenFile.path;
	var newPath = path.join(__dirname, "uploads/") + newFileName;

	var is = fs.createReadStream(currentPath);
	var os = fs.createWriteStream(newPath);

	is.pipe(os);
	is.on('end',function() {
		// Delete the temp file
	    fs.unlinkSync(currentPath);
	});
	
	var newScreenshot = {
		origFilename: req.files.screenFile.originalFilename,
		filename: newFileName,
		uid: uniqueId,
		uploadDate: new Date()
	}

	screenshots.insert(newScreenshot, function(err, doc) {
		if(err) {
			res.json({ success: false, message: 'Failed to store screenshot'});
		}
		else {
			res.json({ success: true, message: 'Uploaded file', url: "/" + uniqueId + "/" + req.files.screenFile.originalFilename});
		}
	});
});

// Middleware to check for a valid token
var checkToken = function(req, res, next) {
	var token = req.body.token || req.query.token;

	if (token) {
	    jwt.verify(token, config.serverSecret, function(err, decoded) {      
			if (err) {
				return res.json({ success: false, message: 'Failed to authenticate token.' });    
			} else {
	        	req.decoded = decoded;    
				next();
			}
	    });
  	} else {
    	return res.status(403).send({ 
	        success: false, 
	        message: 'No token provided.' 
	    });
	}
}

// Prefix all API routes with /api
app.use('/api', apiRoutes);

app.listen(port);
console.log("Server is running on port " + port);