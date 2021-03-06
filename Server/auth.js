var jwt = require('jsonwebtoken');
var config = require('./config');

module.exports = {
	// Middleware to check for a valid token
	checkToken: function(req, res, next) {
		var token = req.body.token || req.query.token || req.headers['x-access-token'];

		if (token) {
			jwt.verify(token, config.serverSecret, function(err, decoded) {      
				if (err) {
					return res.status(403).send({ 
						success: false, 
						message: 'Failed to authenticate token.' 
					});    
				} else {
					req.decoded = decoded;    
					next();
				}
			});
		} else {
			return res.status(403).send({ 
				success: false, 
				message: 'No authentication token provided.' 
			});
		}
	}
}