/* eslint-env es6 */

const fs = require('fs');
const nodePath = require('path');
const mime = require('mime');

function getPathInfo(path, withChildren) {
	return new Promise(function (resolve, reject) {
		path = nodePath.resolve(path);
		const name = nodePath.basename(path);
		const item = { path, name, dirName: nodePath.dirname(path) };
		fs.stat(path, function (err, result) {

			if (err) {
				return reject(err);
			}

			if (result.isFile()) {
				const ext = nodePath.extname(path).toLowerCase();
				item.isFile = true;
				item.size = result.size;  // File size in bytes
				item.extension = ext;
				item.mime = mime.lookup(path);
				return resolve(item);
			} else if (result.isDirectory()) {
				item.isDir = true;
				item.mime = 'directory';
				if (withChildren !== false) {
					fs.readdir(path, function (ex, arr) {
						if (ex) return reject(ex);
						Promise.all(arr.map(function (child) {
							return getPathInfo(nodePath.join(path, child), false);
						})).then(children => {
							item.children = children;
							return resolve(item);
						});
					});
				} else {
					return resolve(item);
				}
			} else {
				return reject(Error('Not a file or folder'));
			}
		});
	});
}

function sanitise(data) {
	if (typeof data === 'object') {
		console.log(data);
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

module.exports = function (message) {
	const [cmd, id, data] = JSON.parse(message);
	const ws = this;
	let promise;
	switch (cmd) {
		case 'GET_PATH_INFO': promise = getPathInfo(data); break;
		case 'FS_PROXY': promise = fsProxy(data); break;
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