/* global Map, Set, Promise, isServer */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

var promises = new Map();
import Stats from './web-code-stats.js';
import { dirname } from 'path';

function remoteCmd(cmd, data) {
	var id = performance.now() + '_' + Math.random();
	return wsPromise.then(function (ws) {
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
	});
}

function updateEnv(name) {
	return remoteCmd('GET_ENV', name)
	.then(function (result) {
		if (result) process.env[name] = result;
		return result;
	});
}

var wsPromise = getNewWS();

// Connection opened
function getNewWS() {
	return new Promise(function (resolve) {

		if (isServer) resolve();

		var interval = -1;
		var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
		try {
			var ws = new WebSocket((isLocal ? 'ws://' : 'wss://') + location.host);
		} catch (e) {
			return terminate();
		}
		ws.binaryType = 'arraybuffer';

		var isAlive = true;

		ws.addEventListener('message', function m(e) {
			if (typeof e.data === 'string') {
				if (e.data === '__pong__') {
					isAlive = true;
					return;
				}
				var result = JSON.parse(e.data);
				var cmd = result[0];
				var promiseResolver = promises.get(result[1]);
				var data = result[2];
				if (promiseResolver) {
					promises.delete(result[1]);
					return promiseResolver(data);
				}
				if (cmd === 'HANDSHAKE') {
					resolve(
						Promise.all([
							updateEnv('HOME'),
							updateEnv('DEBUG'),
						])
						.then(Promise.resolve(ws))
					);
				}
				if (cmd === 'FS_CHANGE') {
					console.log('CHANGE', data);
				}
				if (cmd === 'FS_ADD') {
					Stats.fromPath(dirname(data.path)).then(function (stats) {
						stats.updateChildren();
					});
					console.log('ADD', data);
				}
				if (cmd === 'FS_UNLINK') {
					Stats.fromPath(dirname(data.path)).then(function (stats) {
						stats.updateChildren();
					});
					console.log('UNLINK', data);
				}
			}
		});

		ws.addEventListener('close', terminate);

		ws.addEventListener('open', function firstOpen() {

			console.log('Connected to the server...');

			interval = setInterval(function ping() {
				if (isAlive === false) {
					terminate();
				}
				isAlive = false;
				ws.send('__ping__');
			}, 3000);

			ws.removeEventListener('open', firstOpen);
			resolve(ws);
		});

		function terminate() {
			clearInterval(interval);
			wsPromise = new Promise(function (resolve) {
				setTimeout(function () {
					console.log('Trying to get new connection');
					getNewWS().then(function (newWs) {
						resolve(newWs);
					});
				}, 1000);
			});
			return wsPromise;
		}
	});
}

export {
	wsPromise,
	remoteCmd
};