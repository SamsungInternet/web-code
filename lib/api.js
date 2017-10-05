/* eslint-env es6 */

const express = require('express');
const app = express();
const bodyParser = require('body-parser');

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

app.post('/upload', function(req, res) {
	if (!req.files) return res.status(400).send('No files were uploaded.');
	let uploadFile = req.files.uploadFile;
	uploadFile.mv(req.query.path, function(err) {
		if (err) return res.status(500).send(err);
		res.send('File uploaded!');
	});
});

module.exports = app;