/* eslint-env es6 */

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const path = require('path');

app.use(bodyParser.json({}));

function errorRes(str, res) {
	res.json(500, {
		error: str
	});
}

app.use('/imageproxy', function (req,res) {
	const path = decodeURIComponent(req.query.url);
	res.sendFile(path);
});

app.use(fileUpload());

app.post('/upload', function(req, res) {
	if (!req.files) {
		return res.status(400).send('No files were uploaded.');
	}
	let uploadFile = req.files['uploadFile[]'];
	if (uploadFile.constructor !== Array) uploadFile = [uploadFile];
	Promise.all(uploadFile.map(function (file) {
		return new Promise(function (resolve) {
			console.log('Uploaded', path.join(req.body.path, file.name));
			file.mv(path.join(req.body.path, file.name), function(err) {
				if (err) console.log(err);
				resolve();
			});
		});
	})).then(function () {
		res.send('File uploaded!');
	});
});

module.exports = app;