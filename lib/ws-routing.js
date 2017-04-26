/* eslint-env es6 */
'use strict';

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
							children.unshift({
								name: '..',
								isDir: true,
								path: item.dirName,
								dirName: nodePath.resolve(nodePath.join(item.dirName, '..')),
								mime: 'directory'
							});
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

module.exports = function (message) {
	const [cmd, id, data] = JSON.parse(message);
	const ws = this;
	let promise;
	switch (cmd) {
		case 'STAT': promise = stat(data); break;
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