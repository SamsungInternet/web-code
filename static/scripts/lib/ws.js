/* global require, Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import {smartOpen} from './files';

var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
var ws = new WebSocket((isLocal ? 'ws://' : 'wss://') + location.host);
ws.binaryType = 'arraybuffer';

var promises = new Map();

var handshakeResolver;
var handshakePromise = new Promise(function (resolve) {
	handshakeResolver = resolve;
})

ws.addEventListener('message', function m(e) {
	if (typeof e.data === 'string') {
		var result = JSON.parse(e.data);
		var cmd = result[0];
		var promiseResolver = promises.get(result[1]);
		var data = result[2];
		if (promiseResolver) {
			promises.delete(result[1]);

			if (data.error) {
				return promiseResolver[1](Error(data.error));
			} else {
				return promiseResolver[0](data.result);
			}
		}
		if (cmd === 'HANDSHAKE') {
			handshakeResolver(data);
		}
	}
});

function remoteCmd(cmd, data) {
	var id = performance.now() + '_' + Math.random();
	ws.send(JSON.stringify([
		cmd,
		id,
		data
	]));
	return new Promise(function (resolve, reject) {
		promises.set(id, [resolve, reject]);
	});
}

// Connection opened
var wsPromise = new Promise(function (resolve) {
	ws.addEventListener('open', function firstOpen() {
		ws.removeEventListener('open', firstOpen);
		resolve(ws);
	});
})
.then(function (ws) {
	return remoteCmd('GET_ENV', 'HOME')
	.then(function (result) {
		process.env.HOME = result;
		return ws;
	});
})
.then(function () {
	return handshakePromise
});

export {
	ws,
	wsPromise,
	remoteCmd
};