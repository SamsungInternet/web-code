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

module.exports = app;