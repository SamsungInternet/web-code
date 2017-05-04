/* eslint-env es6 */

const fs = require('fs');
const fsDataHydrate = ['isFile', 'isDirectory', 'isBlockDevice', 'isCharacterDevice', 'isSymbolicLink', 'isFIFO', 'isSocket'];

function sanitise(data) {
	if (typeof data === 'object' && data.constructor !== Array) {
		if (data.constructor === fs.Stats) {
			const out = {};
			out.__toFn = fsDataHydrate;
			fsDataHydrate.forEach(key => out[key] = data[key]());
			Object.keys(data).forEach(key => {
				if (typeof data[key] !== 'function' && typeof data[key] !== 'object') {
					out[key] = data[key];
				}
			})
			return out;
		}
		throw Error('Not parsable yet');
	}
	return data;
}

// The server bit of FSProxy, may need to simplify output
function fsProxy(data) {
	return new Promise(function (resolve, reject) {
		data.arguments.push(function (err, data) {
			if (err) {
				return reject(err);
			}
			resolve(sanitise(data));
		});
		fs[data.cmd].apply(fs, data.arguments)
	});
}

function fetchEnvVar(name) {
	return Promise.resolve(process.env[name]);
}

module.exports = function (message) {
	const [cmd, id, data] = JSON.parse(message);
	const ws = this;
	let promise;
	switch (cmd) {
		case 'FS_PROXY': promise = fsProxy(data); break;
		case 'GET_ENV': promise = fetchEnvVar(data); break;
		default: promise = Promise.reject(Error('No command ' + cmd));
	}
	promise.then(function (data) {
		ws.send(JSON.stringify([
			cmd,
			id,
			{ result: data }
		]));
	})
	.catch(function (e) {
		ws.send(JSON.stringify([
			cmd,
			id,
			{error: e.message}
		]));
	});
}