var express = require('express');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var jwt = require('jsonwebtoken');
var path = require('path');
var fs = require('fs');
var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();
var uuid = require('node-uuid');
var readChunk = require('read-chunk');
var imageType = require('image-type');

var config = require('./config'); // Load the config
var auth = require('./auth'); // Load some authentication middleware

var db = require('monk')(config.mongoUrl);
var screenshots = db.get('screenshots');

var app = express();
var port = process.env.PORT || config.port;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(morgan('short'));

fs.open(path.join(__dirname, "uploads/"),'r',function(err,fd){
	if (err && err.code=='ENOENT') { 
		fs.mkdirSync(path.join(__dirname, "uploads/"));
		console.log("Uploads folder created");
	}
	else {
		console.log("Uploads folder exists");
	}
});

var databaseTest = screenshots.find({});

databaseTest.on('complete', function(err, doc) {
	if(err) {
		console.log("Database connection failed on: " + config.mongoUrl);
		console.log("Quitting...")
		process.exit(1);
	}
	else {
		console.log("Database is connected on: " + config.mongoUrl);
	}
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
			console.log("[/screenshots] - ERROR: " + err);
		}
		else {
			var tmpArr = [];
			for(var i = 0; i < doc.length; i++) {
				var tmpObj = {};
				tmpObj.uniqueId = doc[i]._id;
				tmpObj.uploadDate = doc[i].uploadDate;
				tmpObj.url = "/" + doc[i].uid + "/" + doc[i].origFilename;
				tmpObj.filename = doc[i].origFilename;
				tmpArr.push(tmpObj);
			}
			res.json({ success: true, data: tmpArr});
		}
	});
});

apiRoutes.post('/upload', multipartMiddleware, function(req, res) {
	var buffer = readChunk.sync(req.files.screenFile.path, 0, 12);
	var type = imageType(buffer);

	if(type && (type.ext == 'jpg' || type.ext == 'png') && (type.mime == 'image/png' || type.mime == 'image/jpg')) {
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
			var newScreenshot = {
				origFilename: req.files.screenFile.originalFilename,
				filename: newFileName,
				uid: uniqueId,
				uploadDate: new Date()
			}

			screenshots.insert(newScreenshot, function(err, doc) {
				if(err) {
					res.json({ success: false, message: 'Failed to store screenshot. Database error'});
					console.log("[/upload] - ERROR: " + err);
				}
				else {
					res.json({ success: true, message: 'Uploaded file', url: "/" + uniqueId + "/" + req.files.screenFile.originalFilename});
				}
			});
		});

		is.on('error', function(err) {
			console.log("Error in file I/O: " + err);
			res.json({ success: false, message: 'Failed to store screenshot. File I/O error'});
		});
	}
	else {
		res.json({ success: false, message: 'Unsupported file format'});
		fs.unlinkSync(currentPath);
	}

	
});

// Prefix all API routes with /api
app.use('/api', apiRoutes);

app.get('/', function(req, res) {
	res.send("Hello!");
});

app.get('/:uuid/:filename', function (req, res) {
	var file = encodeURIComponent(req.params.filename);
	screenshots.find({ uid: req.params.uuid}, function(err, doc) {
		if(err) {
			res.sendFile(path.join(__dirname, "static/") + "notfound.png");
			res.status(404);
		}
		else {
			if(doc.length > 0) {
				var filename = path.join(__dirname, "uploads/") + doc[0].filename;
				fs.exists(filename, function(exists) {
					if (exists) {
						res.sendFile(filename);
					} else {
						res.sendFile(path.join(__dirname, "static/") + "notfound.png");
						res.status(404);
					}
				});
			}
			else {
				res.sendFile(path.join(__dirname, "static/") + "notfound.png");
				res.status(404);
			}
		}
	});
});

app.listen(port);
console.log("Server is running on port " + port);