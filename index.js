#! /usr/bin/env node
/* eslint-env es6 */

const server = require('http').createServer();
const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({ server: server });
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const api = require('./lib/api');
const wsMessaging = require('./lib/ws-routing');
const nodePath = require('path');
const Client = require('./lib/client');
const lockFile = require('lockfile');
const fs = require('fs');
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
function puts(error, stdout, stderr) { console.log(stdout); console.log(stderr); }

let lastWorkingDir = '';
const args = process.argv.slice(2).join(' ').trim();
const path = args && nodePath.resolve(args);
lastWorkingDir = path || false;
 
lockFile.lock('web-code.lock', {}, function (err) {

	if (err) {

		const data = fs.readFileSync('web-code.lock', 'utf8').split('\n');

		// Process already exists so try to message to it.
		console.log('Process is already running, with pid:', data[0], '!');

		data[1] = lastWorkingDir;

		if (lastWorkingDir) {
			console.log('Trying to open path in new window:', lastWorkingDir);

			fs.writeFileSync('web-code.lock', data.join('\n'));

			execSync('kill -s 13 ' + data[0]);
		}

		return;
	}

	fs.writeFileSync('web-code.lock', process.pid + '\n' + lastWorkingDir);

	app.use(express.static(__dirname + '/static', {
		maxAge: 3600 * 1000 * 24
	}));

	app.use('/vs/', express.static(__dirname + '/node_modules/monaco-editor/min/vs', {
		maxAge: 3600 * 1000 * 24
	}));

	app.use('/icons/', express.static(__dirname + '/node_modules/file-icons/fonts', {
		maxAge: 3600 * 1000 * 24
	}));

	app.use('/axe/', express.static(__dirname + '/node_modules/axe-core/', {
		maxAge: 3600 * 1000 * 24
	}));

	app.use('/fira/', express.static(__dirname + '/node_modules/FiraCode/distr', {
		maxAge: 3600 * 1000 * 24
	}));

	app.use('/api/', api);

	wss.on('connection', function connection(ws) {
		ws.on('message', wsMessaging.wsRouting);

		ws.webCodeClient = new Client();
		ws.webCodeClient.on('change', function (stats) {
			ws.send(JSON.stringify(['FS_CHANGE', null, stats.toDoc()]));
		});
		ws.webCodeClient.on('add', function (stats) {
			ws.send(JSON.stringify(['FS_ADD', null, stats.toDoc()]));
		});
		ws.webCodeClient.on('unlink', function (obj) {
			ws.send(JSON.stringify(['FS_UNLINK', null, obj]));
		});
		ws.webCodeClient.on('addDir', function (stats) {
			ws.send(JSON.stringify(['FS_ADD', null, stats.toDoc()]));
		});
		ws.webCodeClient.on('unlinkDir', function (obj) {
			ws.send(JSON.stringify(['FS_UNLINK', null, obj]));
		});

		ws.send(wsMessaging.wsSendFormat('HANDSHAKE', {
			path: lastWorkingDir || false
		}));
	});

	server.on('request', app);
	server.listen(port, function () {
	/* eslint no-console: 0 */
		console.log('Server running with PID:', process.pid);
		console.log('Open up: http://127.0.0.1:' + server.address().port);
		exec('termux-open-url http://127.0.0.1:' + server.address().port, puts);
	});

	function exit(code) {
		console.log('Terminated with code,', code);
		lockFile.unlockSync('web-code.lock');
	}

	process.on('SIGTERM', function() {
		process.exit();
	});

	process.on('SIGINT', function() {
		process.exit();
	});

	process.on('SIGPIPE', function() {
		const data = fs.readFileSync('web-code.lock', 'utf8').split('\n');
		lastWorkingDir = data[1];
		console.log('Updating working dir to', lastWorkingDir);

		// Opening a new browser tab to that location.
		exec('termux-open-url http://127.0.0.1:' + server.address().port, puts);
	});

	process.on('exit', exit);
});
