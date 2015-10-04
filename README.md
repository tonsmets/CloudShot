# CloudShot
Automated screenshot uploader. Back-end server and Mac OSX client. Written by Ton Smets

## Tools used
This project is made with Node.js and uses a MongoDB database. There are also some node modules used:
```
  "dependencies": {
    "body-parser": "^1.14.1",
    "connect-multiparty": "^2.0.0",
    "express": "^4.13.3",
    "jsonwebtoken": "^5.0.5",
    "monk": "^1.0.1",
    "morgan": "^1.6.1",
    "node-uuid": "^1.4.3"
  }
```

For the Python daemon I used: https://github.com/serverdensity/python-daemon

## Status
This project is still a Work-In-Progress

###To-Do's
- [ ] Check if all screenshots are uploaded on a timed interval (and upload them if not)
- [ ] Check if there is a server connection, else add the screenshots to a queue
- [ ] Write .plist file to make the Python daemon start on boot
- [ ] Think about chaging the watchdog approach with a timed interval check

## Introduction
Okay, to be clear: I wrote this software just because I needed a simple way to share screenshots. The back-end is currently done and I'm busy writing the client. The client will be a daemon that runs in te background. When you take a screenshot, it uploads it to the server and then copies the URL to your clipboard.

## Installation

### Back-end
Installing is as simple as cloning this repo:
```
git clone https://github.com/tonsmets/CloudShot.git
```

A very important step to do, is to rename the file __config.template.js__ to __config.js__. Change the __serverSecret__ to some random string (this is for the token encryption). Next change the __userKey__ to some random string. The __userKey__ is basically the login credential for the client. After that fill in your MongoDB url (and also the credentials if it's secured). For example:
```
module.exports = {
    'serverSecret': 'wn5wnCX6pOwjRtgxf9yA2eWZPp0DESh0', // Used for client token encryption
    'userKey': 'xhHsUQrorfJ6ef1g1F0h76mi1BfQjTgD', // Check if the client has the same key
    'mongoUrl': 'localhost:27017/CloudShot',
    'port': 8080
};
```

Next install the npm modules:
```
npm install
```

And you're ready to go! Now start the app.js:
```
node app.js
```

Optionally you could also change the port that this back-end listens on (default: 8080).


## API Documentation
First, you need to obtain a token to be able to use the API. Obtaining a token is as simple as sending a POST message to `/api/auth` with the following data:
```
{
    "userid":"xhHsUQrorfJ6ef1g1F0h76mi1BfQjTgD"
}
```
The __userid__ you supply here is the userKey you filled in at the config.js file of the back-end.

The reponse will be something like:
```
{
  "success": true,
  "message": "Generating token succeeded",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyaWQiOiJ4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eCIsImlhdCI6MTQ0MzYzOTU2NywiZXhwIjoxNDQzNjgyNzY3fQ.w4cbIrVxKqrZNWwUB2y54-q0A3iSW1gGTz1dR7xkw5Y"
}
```

Store this token. It will be valid for 12 hours. After that, the back-end will return the "invalid token" message when you try to access the API. Make a new POST request to `/api/auth` with your userKey and then you'll receive a new token to use.

To upload an image, set your request headers with the following value to: `x-access-token: <your token here>`. This will send the token you created with every request you make to the server.

Next send a `multipart/form-data` kind of request to `/api/upload` . The HTTP request you send will look like this: (generated from Postman)
```
POST /api/upload HTTP/1.1
Host: localhost:8080
x-access-token: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyaWQiOiJ4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eCIsImlhdCI6MTQ0MzYzNTQ1MSwiZXhwIjoxNDQzNjc4NjUxfQ.HxNQCyL8YM_5nz1zz4DjK-4F2P3jUbaoyDW9Op0JSzQ
Cache-Control: no-cache
Postman-Token: 2dffabe0-26e7-108b-286e-77d1aced3ccc
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

----WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="screenFile"; filename="Schermafbeelding 2015-04-02 om 19.44.46.png"
Content-Type: image/png


----WebKitFormBoundary7MA4YWxkTrZu0gW
```

The API will respond with something like:
```
{
  "success": true,
  "message": "Uploaded file",
  "url": "/102b662a-dbf1-455c-9d7b-b74c5357ffeb/Schermafbeelding%202015-04-02%20om%2019.44.46.png"
}
```

Your upload is done! You can view the image at `<your url>(:<your port>)/102b662a-dbf1-455c-9d7b-b74c5357ffeb/Schermafbeelding%202015-04-02%20om%2019.44.46.png`

## Future additions
I'm going to extend the API routes with routes to:
- Query all images
- Delete images
