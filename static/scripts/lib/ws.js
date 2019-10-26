/* global Map, Set, Promise, isServer */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

var promises = new Map();
import Stats from './web-code-stats.js';
import { displayError, removeError } from './errors.js';
import { dirname } from 'path';
import state from './state.js';
import { openFile, openPath } from './files.js';

function remoteCmd(cmd, data, ws) {
	var id = performance.now() + '_' + Math.random();
	return (ws ? Promise.resolve(ws) : wsPromise).then(function (ws) {
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

function updateEnv(name, ws) {
	return remoteCmd('GET_ENV', name, ws)
	.then(function (result) {
		if (result) process.env[name] = result;
		return result;
	});
}

var wsPromise = getNewWS();
var errorMsg;

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
					Stats.fromPath(data.path).then(function (stats) {
						openPath(stats);
					});
					resolve(
						Promise.all([
							updateEnv('HOME', ws),
							updateEnv('DEBUG', ws),
						])
						.then(function () {
							return ws;
						})
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
				if (cmd === 'OPEN_FILE') {
					Stats.fromPath(data.path).then(function (stats) {
						openFile(stats);
					});
				}
			}
		});

		ws.addEventListener('close', terminate);

		ws.addEventListener('open', function firstOpen() {

			if (errorMsg) {
				removeError(errorMsg);
				errorMsg = null;
			}

			interval = setInterval(function ping() {
				if (isAlive === false) {
					terminate();
				}
				isAlive = false;
				ws.send('__ping__');
			}, 3000);

			ws.removeEventListener('open', firstOpen);
		});

		function terminate() {
			clearInterval(interval);
			wsPromise = new Promise(function (resolve) {
				if (!errorMsg) errorMsg = displayError('Connection', 'Lost server connection.');
				setTimeout(function () {
					console.log('Trying to get new connection');
					getNewWS().then(function (newWs) {
						resolve(newWs);
					});
				}, 1000);
			}).then(function (newWs) {

				// don't return sync otherwise recusrion
				state.sync();
				return newWs;
			});
			return wsPromise;
		}
	});
}

export {
	wsPromise,
	remoteCmd
};
