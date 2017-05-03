/* eslint-env es6 */

const server = require('http').createServer();
const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({ server: server });
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const api = require('./lib/api');
const wsRouting = require('./lib/ws-routing');

app.use(express.static(__dirname + '/static', {
	maxAge: 3600 * 1000 * 24
}));

app.use('/vs/', express.static(__dirname + '/node_modules/monaco-editor/min/vs', {
	maxAge: 3600 * 1000 * 24
}));

app.use('/icons/', express.static(__dirname + '/node_modules/file-icons/fonts', {
	maxAge: 3600 * 1000 * 24
}));

app.use('/api/', api);

wss.on('connection', function connection(ws) {
	ws.on('message', wsRouting);
});

server.on('request', app);
server.listen(port, function () {
	/* eslint no-console: 0 */
	console.log('Open up: http://127.0.0.1:' + server.address().port)
});
