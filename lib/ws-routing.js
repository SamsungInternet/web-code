/* eslint-env es6 */

const fs = require('fs');
const nodePath = require('path');
const mime = require('mime');

function stat(path, withChildren) {
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
							return stat(nodePath.join(path, child), false);
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

function open(path) {
	path = nodePath.resolve(path);
	return new Promise(function (resolve, reject) {
		fs.stat(path, function (err, result) {
			if (result.isFile()) {
				fs.readFile(path, 'utf8', function (err, data) {
					if (err) reject(err);
					resolve(data);
				});
			} else {
				reject(Error('Not a file'));
			}
		});
	});
}

function save(obj) {
	return new Promise(function (resolve, reject) {
		fs.writeFile(obj.path, obj.content, function (err) {
			if (err) reject(err);
			resolve({});
		});
	});
}

module.exports = function (message) {
	const [cmd, id, data] = JSON.parse(message);
	const ws = this;
	let promise;
	switch (cmd) {
		case 'STAT': promise = stat(data); break;
		case 'OPEN': promise = open(data); break;
		case 'SAVE': promise = save(data); break;
		default: promise = Promise.reject(Error('No command ' + cmd));
	}
	promise.then(function (data) {
		ws.send(JSON.stringify([
			cmd,
			id,
			data
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