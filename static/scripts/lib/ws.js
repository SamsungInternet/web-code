/* global Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

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
			return promiseResolver(data);
		}
		if (cmd === 'HANDSHAKE') {
			handshakeResolver(data);
		}
		if (cmd === 'FS_CHANGE') {
			console.log('CHANGE', data);
		}
		if (cmd === 'FS_ADD') {
			console.log('ADD', data);
		}
		if (cmd === 'FS_UNLINK') {
			console.log('UNLINK', data);
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
	
	if (process.env.DEBUG) {
		var err = new Error();
		var stack = err.stack;
	}

	return new Promise(function (resolve) {
		promises.set(id, resolve);
	}).then(function (data) {
		if (data.error) {
			if (process.env.DEBUG) {
				console.error(data.error, stack);
			}
			throw Error(data.error);
		}
		return data.result;
	});
}

function updateEnv(name) {
	return remoteCmd('GET_ENV', name)
	.then(function (result) {
		if (result) process.env[name] = result;
		return result;
	});
}

// Connection opened
var wsPromise = new Promise(function (resolve) {
	ws.addEventListener('open', function firstOpen() {
		ws.removeEventListener('open', firstOpen);
		resolve(ws);
	});
})
.then(function () {
	return Promise.all([
		updateEnv('HOME'),
		updateEnv('DEBUG'),
	])
})
.then(function () {
	return handshakePromise
});

export {
	ws,
	wsPromise,
	remoteCmd
};