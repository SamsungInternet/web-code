'use strict';


	/* eslint-disable */
	var isServer = true;
	

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var path = require('path');
var mime = _interopDefault(require('mime'));
var PouchDB = _interopDefault(require('pouchdb-browser'));

/* global Promise, isServer */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

var db = isServer ? null : new PouchDB('web-code', {});
function updateDBDoc(_id, obj) {

	updateDBDoc.promise = updateDBDoc.promise || Promise.resolve();

	/* update last open folder in db */
	return updateDBDoc.promise = updateDBDoc.promise
		.then(function () {
			return db.get(_id)
		})
		.catch(function (e) {
			if (e.status === 404) {
				return { _id: _id }
			}
			throw e;
		})
		.then(function (doc) {
			Object.keys(obj).forEach(function (key) {
				doc[key] = obj[key];
			});
			db.put(doc);
		});
}

/* Like web-code-stats but for storing the file inside and not as a seperate file */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

var idToBufferFileMap = new Map();

var compulsaryAttrs = [
	'name',
	'id',
	'icon'
];

var optionalAttrs = [
	'mime'
];

var keys$1 = compulsaryAttrs.concat(optionalAttrs);

function BufferFile(data) {

	this.data = {};

	compulsaryAttrs.forEach(function (key) {
		if (data[key]) {
			this.data[key] = data[key];
		} else {
			throw Error('Missing Key: ' + key);
		}
	}.bind(this));

	if (idToBufferFileMap.has(data.id)) {
		return idToBufferFileMap.get(data.id);
	}
	idToBufferFileMap.set(data.id, this);

	optionalAttrs.forEach(function (key) {
		if (data[key]) {
			this.data[key] = data[key];
		}
	}.bind(this));

	//  Try fetching from DB
	this.valuePromise = db.get(data.id)
	.catch(function (e) {
		if (e.status === 404) {
			var doc = this.toDoc();
			doc._id = this.data.id;
			doc.value = '';
			return db.put(doc).then(function () {
				return doc;	
			});
		}
		throw e;
	}.bind(this))
	.then(function (doc) {
		this.value = doc.value;
		return doc.value;
	}.bind(this));
}

BufferFile.prototype.update = function update(value) {
	// save doc to disk
	return this.valuePromise = this.valuePromise
	.then(function () {
		return updateDBDoc(this.data.id, {
			value: value
		});
	}.bind(this))
	.then(function () {
		return value;
	});
};

BufferFile.prototype.toDoc = function toDoc() {
	var out = {
		isBufferFileDoc: true
	};
	keys$1.forEach(function (key) {
		out[key] = this.data[key];
	}.bind(this));
	return out;
};

/* global Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

function renderFileList(el, array, options) {

	options = options || {};
	var useOptions = {
		hideDotFiles: (options.hideDotFiles !== undefined ? options.hideDotFiles : true),
		nested: (options.nested !== undefined ? options.nested : true),
		nestingLimit: (options.nestingLimit || 5) - 1,
		sort: options.sort === false ? false : true
	};
	if (options.nestingLimit === 0) return;

	var sortedData = !useOptions.sort ? array : Array.from(array)
		.filter(function (stats) {

			// Whether to hide dotfiles
			if (stats.data.name !== '..' && useOptions.hideDotFiles !== false) {
				return stats.data.name[0] !== '.';
			}
			return true;
		})
		.sort(function (a, b) {
			if (a.name === '..') {
				return -1;
			}
			if (b.name === '..') {
				return 1;
			}
			if (
				(a.isDirectory() === b.isDirectory()) &&
				(a.isFile() === b.isFile())
			) {
				return ([a.data.name, b.data.name].sort(function (a, b) {
					return a.toLowerCase().localeCompare(b.toLowerCase());
				})[0] === a.data.name ? -1 : 1);
			} else {
				if (a.isDirectory()) return -1;
				return 1;
			}
		});

	sortedData.map(function (stats) {

		var li = document.createElement('li');
		li.classList.add('has-icon');
		li.tabIndex = 0;
		li.tabKey = stats;

		if (stats.constructor === Stats) {
			li.dataset.mime = stats.data.mime;
			li.dataset.name = stats.data.name;
			li.dataset.size = stats.data.size;
			li.textContent = stats.data.name;
			li.stats = stats;

			if (stats.isDirectory() && useOptions.nested !== false) {
				var newFileList = document.createElement('ul');
				newFileList.classList.add('filelist');
				li.appendChild(newFileList);
				if (stats.expanded && stats.children) {
					stats.renderFileList(newFileList, useOptions);
				}
			}
		} else if (stats.constructor === BufferFile) {
			li.dataset.name = stats.data.name;
			li.textContent = stats.data.name;
			if (stats.data.icon) {
				li.classList.add('has-icon');
				li.dataset.icon = stats.icon;
			}
			if (stats.data.mime) {
				li.dataset.mime = stats.mime;
			}
		}

		el.appendChild(li);
	});


}

/* eslint no-var: 0, no-console: 0 */

function displayError(type, text, timeout) {

	var errorEl = document.getElementById('errors');

	var li = document.createElement('li');

	var textEl = document.createElement('span');
	textEl.classList.add('error-text');
	textEl.textContent = text;

	var typeEl = document.createElement('span');
	typeEl.classList.add('error-type');
	typeEl.textContent = type;

	li.appendChild(typeEl);
	li.appendChild(textEl);

	if (timeout) {
		setTimeout(function () {
			errorEl.removeChild(li);
		}, timeout);
	}

	errorEl.appendChild(li);
	return li;
}

function removeError(el) {
	var errorEl = document.getElementById('errors');
	errorEl.removeChild(el);
}

/* global Map, Set, Promise, isServer */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

var promises = new Map();
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

		return new Promise(function (resolve$$1) {
			promises.set(id, resolve$$1);
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
var errorMsg;

// Connection opened
function getNewWS() {
	return new Promise(function (resolve$$1) {

		if (isServer) resolve$$1();

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
					resolve$$1(
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
					Stats.fromPath(path.dirname(data.path)).then(function (stats) {
						stats.updateChildren();
					});
					console.log('ADD', data);
				}
				if (cmd === 'FS_UNLINK') {
					Stats.fromPath(path.dirname(data.path)).then(function (stats) {
						stats.updateChildren();
					});
					console.log('UNLINK', data);
				}
			}
		});

		ws.addEventListener('close', terminate);

		ws.addEventListener('open', function firstOpen() {

			console.log('Connected to the server...');

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
			resolve$$1(ws);
		});

		function terminate() {
			clearInterval(interval);
			wsPromise = new Promise(function (resolve$$1) {
				if (!errorMsg) errorMsg = displayError('Connection', 'Lost server connection.');
				setTimeout(function () {
					console.log('Trying to get new connection');
					getNewWS().then(function (newWs) {
						resolve$$1(newWs);
					});
				}, 1000);
			});
			return wsPromise;
		}
	});
}

/* global Map, Set, Promise, fs, isServer */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

// Map to prevent duplicate data objects for each file
var pathToDataMap = new Map();

var fsFromFn = ['isFile', 'isDirectory', 'isBlockDevice', 'isCharacterDevice', 'isSymbolicLink', 'isFIFO', 'isSocket'];
var fsStatic = [
	'dev',
	'mode',
	'nlink',
	'uid',
	'gid',
	'rdev',
	'blksize',
	'ino',
	'size',
	'blocks',
	'atime',
	'mtime',
	'ctime',
	'birthtime',
	'path'
];
var keys = fsStatic.concat(fsFromFn);


/**
 * Special type of singleton which returns the same object for each path.
 */
function Stats (data) {
	if (pathToDataMap.has(data.path)) {
		var existing = pathToDataMap.get(data.path);
		existing.update(data);
		return existing;
	}
	this.fileLists = new Set();
	this.data = {};
	this.update(data);
	pathToDataMap.set(data.path, this);
}

Stats.prototype.update = function update(data) {

	var self = this;

	this.data.name = path.basename(data.path);
	this.data.dirName = path.dirname(data.path);
	this.data.extension = path.extname(data.path).toLowerCase();
	this.data.mime = data.isFile ? mime.lookup(data.path) : 'directory';

	keys.forEach(function (key) {
		this.data[key] = data[key];
	}.bind(this));

	if (this.isDirectory() && !this.children) {
		this.children = [];
		this.childrenPopulated = false;
	}

    // Rerender file lists
	if (this.fileLists.size) {
		Array.from(this.fileLists).forEach(function (filelistEl) {
			filelistEl.innerHTML = '';
			self.renderFileList(filelistEl, filelistEl.filelistOptions);
		});
	}
};

Stats.prototype.toDoc = function toDoc() {
	var out = {
		__webStatDoc: true
	};
	keys.forEach(function (key) {
		out[key] = this.data[key];
	}.bind(this));
	return out;
};

Stats.prototype.updateChildren = function () {
	if(!this.isDirectory()) throw Error('Not a directory');

	var self = this;
	return fs.readdir(self.data.path)
	.then(function (arr) {
		return Promise.all(arr.map(function (child) {
			return Stats.fromPath(path.join(self.data.path, child));
		}));
	})
	.then(function (statsArray) {
		self.children.splice(0);
		self.children.push.apply(self.children, statsArray);

		// Let server know	
		if (!isServer) remoteCmd('CLIENT', {
			cmd: 'watchPath',
			arguments: [self.data.path]
		});

		self.update(self.data);

		return self;  
	});
};

Stats.prototype.destroyFileList = function (el) {
	el.stats = undefined;
	this.fileLists.delete(el);
	el.innerHTML = '';
};

Stats.prototype.renderFileList = function (el, options) {

	el.filelistOptions = options;

	el.stats = this;
	this.fileLists.add(el);
	el.dataset.mime = this.data.mime;
	el.dataset.name = this.data.name;
	el.dataset.size = this.data.size;

	renderFileList(el, this.children, options);
};

// add isFile isDirectory etc
fsFromFn.forEach(function (key) {
	Stats.prototype[key] = new Function('return this.data["' + key + '"];');
});

Stats.fromPath = function (path$$1) {
	return fs.stat(path$$1);
};

Stats.fromDoc = function (data) {
	return new Stats(data);
};

Stats.fromNodeStats = function (path$$1, nodeStat) {

	var out = {};

	fsFromFn.forEach(key => out[key] = nodeStat[key]());
	keys.forEach(key => {
		if (typeof nodeStat[key] !== 'function' && typeof nodeStat[key] !== 'object') {
			out[key] = nodeStat[key];
		}
	});

	out.path = path.resolve(path$$1);

	return new Stats(out);
};

module.exports = Stats;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViLWNvZGUtc3RhdHMuY29tcGlsZWQuanMiLCJzb3VyY2VzIjpbIi4uL3N0YXRpYy9zY3JpcHRzL2xpYi9kYi5qcyIsIi4uL3N0YXRpYy9zY3JpcHRzL2xpYi9idWZmZXItZmlsZS5qcyIsIi4uL3N0YXRpYy9zY3JpcHRzL2xpYi9yZW5kZXItZmlsZS1saXN0LmpzIiwiLi4vc3RhdGljL3NjcmlwdHMvbGliL2Vycm9ycy5qcyIsIi4uL3N0YXRpYy9zY3JpcHRzL2xpYi93cy5qcyIsIi4uL3N0YXRpYy9zY3JpcHRzL2xpYi93ZWItY29kZS1zdGF0cy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiBnbG9iYWwgUHJvbWlzZSwgaXNTZXJ2ZXIgKi9cbi8qIGVzbGludCBuby12YXI6IDAsIG5vLWNvbnNvbGU6IDAgKi9cbi8qIGVzbGludC1lbnYgZXM2ICovXG5cbmltcG9ydCBQb3VjaERCIGZyb20gJ3BvdWNoZGItYnJvd3Nlcic7XG52YXIgZGIgPSBpc1NlcnZlciA/IG51bGwgOiBuZXcgUG91Y2hEQignd2ViLWNvZGUnLCB7fSk7XG5mdW5jdGlvbiB1cGRhdGVEQkRvYyhfaWQsIG9iaikge1xuXG5cdHVwZGF0ZURCRG9jLnByb21pc2UgPSB1cGRhdGVEQkRvYy5wcm9taXNlIHx8IFByb21pc2UucmVzb2x2ZSgpO1xuXG5cdC8qIHVwZGF0ZSBsYXN0IG9wZW4gZm9sZGVyIGluIGRiICovXG5cdHJldHVybiB1cGRhdGVEQkRvYy5wcm9taXNlID0gdXBkYXRlREJEb2MucHJvbWlzZVxuXHRcdC50aGVuKGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiBkYi5nZXQoX2lkKVxuXHRcdH0pXG5cdFx0LmNhdGNoKGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRpZiAoZS5zdGF0dXMgPT09IDQwNCkge1xuXHRcdFx0XHRyZXR1cm4geyBfaWQ6IF9pZCB9XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH0pXG5cdFx0LnRoZW4oZnVuY3Rpb24gKGRvYykge1xuXHRcdFx0T2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdFx0ZG9jW2tleV0gPSBvYmpba2V5XTtcblx0XHRcdH0pO1xuXHRcdFx0ZGIucHV0KGRvYyk7XG5cdFx0fSk7XG59XG5cbmV4cG9ydCB7IGRiLCB1cGRhdGVEQkRvYyB9OyIsIi8qIExpa2Ugd2ViLWNvZGUtc3RhdHMgYnV0IGZvciBzdG9yaW5nIHRoZSBmaWxlIGluc2lkZSBhbmQgbm90IGFzIGEgc2VwZXJhdGUgZmlsZSAqL1xuLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuLyogZXNsaW50LWVudiBlczYgKi9cblxuaW1wb3J0IHt1cGRhdGVEQkRvYywgZGJ9IGZyb20gJy4vZGIuanMnO1xuXG52YXIgaWRUb0J1ZmZlckZpbGVNYXAgPSBuZXcgTWFwKCk7XG5cbnZhciBjb21wdWxzYXJ5QXR0cnMgPSBbXG5cdCduYW1lJyxcblx0J2lkJyxcblx0J2ljb24nXG5dO1xuXG52YXIgb3B0aW9uYWxBdHRycyA9IFtcblx0J21pbWUnXG5dXG5cbnZhciBrZXlzID0gY29tcHVsc2FyeUF0dHJzLmNvbmNhdChvcHRpb25hbEF0dHJzKTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gQnVmZmVyRmlsZShkYXRhKSB7XG5cblx0dGhpcy5kYXRhID0ge307XG5cblx0Y29tcHVsc2FyeUF0dHJzLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuXHRcdGlmIChkYXRhW2tleV0pIHtcblx0XHRcdHRoaXMuZGF0YVtrZXldID0gZGF0YVtrZXldO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBFcnJvcignTWlzc2luZyBLZXk6ICcgKyBrZXkpO1xuXHRcdH1cblx0fS5iaW5kKHRoaXMpKTtcblxuXHRpZiAoaWRUb0J1ZmZlckZpbGVNYXAuaGFzKGRhdGEuaWQpKSB7XG5cdFx0cmV0dXJuIGlkVG9CdWZmZXJGaWxlTWFwLmdldChkYXRhLmlkKTtcblx0fVxuXHRpZFRvQnVmZmVyRmlsZU1hcC5zZXQoZGF0YS5pZCwgdGhpcylcblxuXHRvcHRpb25hbEF0dHJzLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuXHRcdGlmIChkYXRhW2tleV0pIHtcblx0XHRcdHRoaXMuZGF0YVtrZXldID0gZGF0YVtrZXldO1xuXHRcdH1cblx0fS5iaW5kKHRoaXMpKTtcblxuXHQvLyAgVHJ5IGZldGNoaW5nIGZyb20gREJcblx0dGhpcy52YWx1ZVByb21pc2UgPSBkYi5nZXQoZGF0YS5pZClcblx0LmNhdGNoKGZ1bmN0aW9uIChlKSB7XG5cdFx0aWYgKGUuc3RhdHVzID09PSA0MDQpIHtcblx0XHRcdHZhciBkb2MgPSB0aGlzLnRvRG9jKCk7XG5cdFx0XHRkb2MuX2lkID0gdGhpcy5kYXRhLmlkO1xuXHRcdFx0ZG9jLnZhbHVlID0gJyc7XG5cdFx0XHRyZXR1cm4gZGIucHV0KGRvYykudGhlbihmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBkb2M7XHRcblx0XHRcdH0pO1xuXHRcdH1cblx0XHR0aHJvdyBlO1xuXHR9LmJpbmQodGhpcykpXG5cdC50aGVuKGZ1bmN0aW9uIChkb2MpIHtcblx0XHR0aGlzLnZhbHVlID0gZG9jLnZhbHVlO1xuXHRcdHJldHVybiBkb2MudmFsdWU7XG5cdH0uYmluZCh0aGlzKSk7XG59XG5cbkJ1ZmZlckZpbGUucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIHVwZGF0ZSh2YWx1ZSkge1xuXHQvLyBzYXZlIGRvYyB0byBkaXNrXG5cdHJldHVybiB0aGlzLnZhbHVlUHJvbWlzZSA9IHRoaXMudmFsdWVQcm9taXNlXG5cdC50aGVuKGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdXBkYXRlREJEb2ModGhpcy5kYXRhLmlkLCB7XG5cdFx0XHR2YWx1ZTogdmFsdWVcblx0XHR9KTtcblx0fS5iaW5kKHRoaXMpKVxuXHQudGhlbihmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9KTtcbn1cblxuQnVmZmVyRmlsZS5wcm90b3R5cGUudG9Eb2MgPSBmdW5jdGlvbiB0b0RvYygpIHtcblx0dmFyIG91dCA9IHtcblx0XHRpc0J1ZmZlckZpbGVEb2M6IHRydWVcblx0fTtcblx0a2V5cy5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRvdXRba2V5XSA9IHRoaXMuZGF0YVtrZXldO1xuXHR9LmJpbmQodGhpcykpO1xuXHRyZXR1cm4gb3V0O1xufSIsIi8qIGdsb2JhbCBNYXAsIFNldCwgUHJvbWlzZSAqL1xuLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuLyogZXNsaW50LWVudiBlczYgKi9cblxuaW1wb3J0IFN0YXRzIGZyb20gJy4vd2ViLWNvZGUtc3RhdHMuanMnO1xuaW1wb3J0IEJ1ZmZlckZpbGUgZnJvbSAnLi9idWZmZXItZmlsZS5qcyc7XG5cbmZ1bmN0aW9uIHJlbmRlckZpbGVMaXN0KGVsLCBhcnJheSwgb3B0aW9ucykge1xuXG5cdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXHR2YXIgdXNlT3B0aW9ucyA9IHtcblx0XHRoaWRlRG90RmlsZXM6IChvcHRpb25zLmhpZGVEb3RGaWxlcyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5oaWRlRG90RmlsZXMgOiB0cnVlKSxcblx0XHRuZXN0ZWQ6IChvcHRpb25zLm5lc3RlZCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5uZXN0ZWQgOiB0cnVlKSxcblx0XHRuZXN0aW5nTGltaXQ6IChvcHRpb25zLm5lc3RpbmdMaW1pdCB8fCA1KSAtIDEsXG5cdFx0c29ydDogb3B0aW9ucy5zb3J0ID09PSBmYWxzZSA/IGZhbHNlIDogdHJ1ZVxuXHR9XG5cdGlmIChvcHRpb25zLm5lc3RpbmdMaW1pdCA9PT0gMCkgcmV0dXJuO1xuXG5cdHZhciBzb3J0ZWREYXRhID0gIXVzZU9wdGlvbnMuc29ydCA/IGFycmF5IDogQXJyYXkuZnJvbShhcnJheSlcblx0XHQuZmlsdGVyKGZ1bmN0aW9uIChzdGF0cykge1xuXG5cdFx0XHQvLyBXaGV0aGVyIHRvIGhpZGUgZG90ZmlsZXNcblx0XHRcdGlmIChzdGF0cy5kYXRhLm5hbWUgIT09ICcuLicgJiYgdXNlT3B0aW9ucy5oaWRlRG90RmlsZXMgIT09IGZhbHNlKSB7XG5cdFx0XHRcdHJldHVybiBzdGF0cy5kYXRhLm5hbWVbMF0gIT09ICcuJztcblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0pXG5cdFx0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcblx0XHRcdGlmIChhLm5hbWUgPT09ICcuLicpIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGIubmFtZSA9PT0gJy4uJykge1xuXHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdH1cblx0XHRcdGlmIChcblx0XHRcdFx0KGEuaXNEaXJlY3RvcnkoKSA9PT0gYi5pc0RpcmVjdG9yeSgpKSAmJlxuXHRcdFx0XHQoYS5pc0ZpbGUoKSA9PT0gYi5pc0ZpbGUoKSlcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm4gKFthLmRhdGEubmFtZSwgYi5kYXRhLm5hbWVdLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcblx0XHRcdFx0XHRyZXR1cm4gYS50b0xvd2VyQ2FzZSgpLmxvY2FsZUNvbXBhcmUoYi50b0xvd2VyQ2FzZSgpKTtcblx0XHRcdFx0fSlbMF0gPT09IGEuZGF0YS5uYW1lID8gLTEgOiAxKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChhLmlzRGlyZWN0b3J5KCkpIHJldHVybiAtMTtcblx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0c29ydGVkRGF0YS5tYXAoZnVuY3Rpb24gKHN0YXRzKSB7XG5cblx0XHR2YXIgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuXHRcdGxpLmNsYXNzTGlzdC5hZGQoJ2hhcy1pY29uJyk7XG5cdFx0bGkudGFiSW5kZXggPSAwO1xuXHRcdGxpLnRhYktleSA9IHN0YXRzO1xuXG5cdFx0aWYgKHN0YXRzLmNvbnN0cnVjdG9yID09PSBTdGF0cykge1xuXHRcdFx0bGkuZGF0YXNldC5taW1lID0gc3RhdHMuZGF0YS5taW1lO1xuXHRcdFx0bGkuZGF0YXNldC5uYW1lID0gc3RhdHMuZGF0YS5uYW1lO1xuXHRcdFx0bGkuZGF0YXNldC5zaXplID0gc3RhdHMuZGF0YS5zaXplO1xuXHRcdFx0bGkudGV4dENvbnRlbnQgPSBzdGF0cy5kYXRhLm5hbWU7XG5cdFx0XHRsaS5zdGF0cyA9IHN0YXRzO1xuXG5cdFx0XHRpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSAmJiB1c2VPcHRpb25zLm5lc3RlZCAhPT0gZmFsc2UpIHtcblx0XHRcdFx0dmFyIG5ld0ZpbGVMaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndWwnKTtcblx0XHRcdFx0bmV3RmlsZUxpc3QuY2xhc3NMaXN0LmFkZCgnZmlsZWxpc3QnKTtcblx0XHRcdFx0bGkuYXBwZW5kQ2hpbGQobmV3RmlsZUxpc3QpO1xuXHRcdFx0XHRpZiAoc3RhdHMuZXhwYW5kZWQgJiYgc3RhdHMuY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRzdGF0cy5yZW5kZXJGaWxlTGlzdChuZXdGaWxlTGlzdCwgdXNlT3B0aW9ucyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKHN0YXRzLmNvbnN0cnVjdG9yID09PSBCdWZmZXJGaWxlKSB7XG5cdFx0XHRsaS5kYXRhc2V0Lm5hbWUgPSBzdGF0cy5kYXRhLm5hbWU7XG5cdFx0XHRsaS50ZXh0Q29udGVudCA9IHN0YXRzLmRhdGEubmFtZTtcblx0XHRcdGlmIChzdGF0cy5kYXRhLmljb24pIHtcblx0XHRcdFx0bGkuY2xhc3NMaXN0LmFkZCgnaGFzLWljb24nKTtcblx0XHRcdFx0bGkuZGF0YXNldC5pY29uID0gc3RhdHMuaWNvbjtcblx0XHRcdH1cblx0XHRcdGlmIChzdGF0cy5kYXRhLm1pbWUpIHtcblx0XHRcdFx0bGkuZGF0YXNldC5taW1lID0gc3RhdHMubWltZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRlbC5hcHBlbmRDaGlsZChsaSk7XG5cdH0pO1xuXG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgcmVuZGVyRmlsZUxpc3Q7IiwiLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuXG5mdW5jdGlvbiBkaXNwbGF5RXJyb3IodHlwZSwgdGV4dCwgdGltZW91dCkge1xuXG5cdHZhciBlcnJvckVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Vycm9ycycpO1xuXG5cdHZhciBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XG5cblx0dmFyIHRleHRFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0dGV4dEVsLmNsYXNzTGlzdC5hZGQoJ2Vycm9yLXRleHQnKTtcblx0dGV4dEVsLnRleHRDb250ZW50ID0gdGV4dDtcblxuXHR2YXIgdHlwZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHR0eXBlRWwuY2xhc3NMaXN0LmFkZCgnZXJyb3ItdHlwZScpO1xuXHR0eXBlRWwudGV4dENvbnRlbnQgPSB0eXBlO1xuXG5cdGxpLmFwcGVuZENoaWxkKHR5cGVFbCk7XG5cdGxpLmFwcGVuZENoaWxkKHRleHRFbCk7XG5cblx0aWYgKHRpbWVvdXQpIHtcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0XHRcdGVycm9yRWwucmVtb3ZlQ2hpbGQobGkpO1xuXHRcdH0sIHRpbWVvdXQpO1xuXHR9XG5cblx0ZXJyb3JFbC5hcHBlbmRDaGlsZChsaSk7XG5cdHJldHVybiBsaTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRXJyb3IoZWwpIHtcblx0dmFyIGVycm9yRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZXJyb3JzJyk7XG5cdGVycm9yRWwucmVtb3ZlQ2hpbGQoZWwpO1xufVxuXG5leHBvcnQge1xuXHRyZW1vdmVFcnJvcixcblx0ZGlzcGxheUVycm9yXG59XG5cbiIsIi8qIGdsb2JhbCBNYXAsIFNldCwgUHJvbWlzZSwgaXNTZXJ2ZXIgKi9cbi8qIGVzbGludCBuby12YXI6IDAsIG5vLWNvbnNvbGU6IDAgKi9cbi8qIGVzbGludC1lbnYgZXM2ICovXG5cbnZhciBwcm9taXNlcyA9IG5ldyBNYXAoKTtcbmltcG9ydCBTdGF0cyBmcm9tICcuL3dlYi1jb2RlLXN0YXRzLmpzJztcbmltcG9ydCB7IGRpc3BsYXlFcnJvciwgcmVtb3ZlRXJyb3IgfSBmcm9tICcuL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBkaXJuYW1lIH0gZnJvbSAncGF0aCc7XG5cbmZ1bmN0aW9uIHJlbW90ZUNtZChjbWQsIGRhdGEpIHtcblx0dmFyIGlkID0gcGVyZm9ybWFuY2Uubm93KCkgKyAnXycgKyBNYXRoLnJhbmRvbSgpO1xuXHRyZXR1cm4gd3NQcm9taXNlLnRoZW4oZnVuY3Rpb24gKHdzKSB7XG5cdFx0d3Muc2VuZChKU09OLnN0cmluZ2lmeShbXG5cdFx0XHRjbWQsXG5cdFx0XHRpZCxcblx0XHRcdGRhdGFcblx0XHRdKSk7XG5cdFx0XG5cdFx0aWYgKHByb2Nlc3MuZW52LkRFQlVHKSB7XG5cdFx0XHR2YXIgZXJyID0gbmV3IEVycm9yKCk7XG5cdFx0XHR2YXIgc3RhY2sgPSBlcnIuc3RhY2s7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG5cdFx0XHRwcm9taXNlcy5zZXQoaWQsIHJlc29sdmUpO1xuXHRcdH0pLnRoZW4oZnVuY3Rpb24gKGRhdGEpIHtcblx0XHRcdGlmIChkYXRhLmVycm9yKSB7XG5cdFx0XHRcdGlmIChwcm9jZXNzLmVudi5ERUJVRykge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZGF0YS5lcnJvciwgc3RhY2spO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRocm93IEVycm9yKGRhdGEuZXJyb3IpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGRhdGEucmVzdWx0O1xuXHRcdH0pO1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRW52KG5hbWUpIHtcblx0cmV0dXJuIHJlbW90ZUNtZCgnR0VUX0VOVicsIG5hbWUpXG5cdC50aGVuKGZ1bmN0aW9uIChyZXN1bHQpIHtcblx0XHRpZiAocmVzdWx0KSBwcm9jZXNzLmVudltuYW1lXSA9IHJlc3VsdDtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9KTtcbn1cblxudmFyIHdzUHJvbWlzZSA9IGdldE5ld1dTKCk7XG52YXIgZXJyb3JNc2c7XG5cbi8vIENvbm5lY3Rpb24gb3BlbmVkXG5mdW5jdGlvbiBnZXROZXdXUygpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG5cblx0XHRpZiAoaXNTZXJ2ZXIpIHJlc29sdmUoKTtcblxuXHRcdHZhciBpbnRlcnZhbCA9IC0xO1xuXHRcdHZhciBpc0xvY2FsID0gbG9jYXRpb24uaG9zdG5hbWUgPT09ICdsb2NhbGhvc3QnIHx8IGxvY2F0aW9uLmhvc3RuYW1lID09PSAnMTI3LjAuMC4xJztcblx0XHR0cnkge1xuXHRcdFx0dmFyIHdzID0gbmV3IFdlYlNvY2tldCgoaXNMb2NhbCA/ICd3czovLycgOiAnd3NzOi8vJykgKyBsb2NhdGlvbi5ob3N0KTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gdGVybWluYXRlKCk7XG5cdFx0fVxuXHRcdHdzLmJpbmFyeVR5cGUgPSAnYXJyYXlidWZmZXInO1xuXG5cdFx0dmFyIGlzQWxpdmUgPSB0cnVlO1xuXG5cdFx0d3MuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIG0oZSkge1xuXHRcdFx0aWYgKHR5cGVvZiBlLmRhdGEgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGlmIChlLmRhdGEgPT09ICdfX3BvbmdfXycpIHtcblx0XHRcdFx0XHRpc0FsaXZlID0gdHJ1ZTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIHJlc3VsdCA9IEpTT04ucGFyc2UoZS5kYXRhKTtcblx0XHRcdFx0dmFyIGNtZCA9IHJlc3VsdFswXTtcblx0XHRcdFx0dmFyIHByb21pc2VSZXNvbHZlciA9IHByb21pc2VzLmdldChyZXN1bHRbMV0pO1xuXHRcdFx0XHR2YXIgZGF0YSA9IHJlc3VsdFsyXTtcblx0XHRcdFx0aWYgKHByb21pc2VSZXNvbHZlcikge1xuXHRcdFx0XHRcdHByb21pc2VzLmRlbGV0ZShyZXN1bHRbMV0pO1xuXHRcdFx0XHRcdHJldHVybiBwcm9taXNlUmVzb2x2ZXIoZGF0YSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGNtZCA9PT0gJ0hBTkRTSEFLRScpIHtcblx0XHRcdFx0XHRyZXNvbHZlKFxuXHRcdFx0XHRcdFx0UHJvbWlzZS5hbGwoW1xuXHRcdFx0XHRcdFx0XHR1cGRhdGVFbnYoJ0hPTUUnKSxcblx0XHRcdFx0XHRcdFx0dXBkYXRlRW52KCdERUJVRycpLFxuXHRcdFx0XHRcdFx0XSlcblx0XHRcdFx0XHRcdC50aGVuKFByb21pc2UucmVzb2x2ZSh3cykpXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoY21kID09PSAnRlNfQ0hBTkdFJykge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdDSEFOR0UnLCBkYXRhKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoY21kID09PSAnRlNfQUREJykge1xuXHRcdFx0XHRcdFN0YXRzLmZyb21QYXRoKGRpcm5hbWUoZGF0YS5wYXRoKSkudGhlbihmdW5jdGlvbiAoc3RhdHMpIHtcblx0XHRcdFx0XHRcdHN0YXRzLnVwZGF0ZUNoaWxkcmVuKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ0FERCcsIGRhdGEpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChjbWQgPT09ICdGU19VTkxJTksnKSB7XG5cdFx0XHRcdFx0U3RhdHMuZnJvbVBhdGgoZGlybmFtZShkYXRhLnBhdGgpKS50aGVuKGZ1bmN0aW9uIChzdGF0cykge1xuXHRcdFx0XHRcdFx0c3RhdHMudXBkYXRlQ2hpbGRyZW4oKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRjb25zb2xlLmxvZygnVU5MSU5LJywgZGF0YSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHdzLmFkZEV2ZW50TGlzdGVuZXIoJ2Nsb3NlJywgdGVybWluYXRlKTtcblxuXHRcdHdzLmFkZEV2ZW50TGlzdGVuZXIoJ29wZW4nLCBmdW5jdGlvbiBmaXJzdE9wZW4oKSB7XG5cblx0XHRcdGNvbnNvbGUubG9nKCdDb25uZWN0ZWQgdG8gdGhlIHNlcnZlci4uLicpO1xuXG5cdFx0XHRpZiAoZXJyb3JNc2cpIHtcblx0XHRcdFx0cmVtb3ZlRXJyb3IoZXJyb3JNc2cpO1xuXHRcdFx0XHRlcnJvck1zZyA9IG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdGludGVydmFsID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24gcGluZygpIHtcblx0XHRcdFx0aWYgKGlzQWxpdmUgPT09IGZhbHNlKSB7XG5cdFx0XHRcdFx0dGVybWluYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aXNBbGl2ZSA9IGZhbHNlO1xuXHRcdFx0XHR3cy5zZW5kKCdfX3BpbmdfXycpO1xuXHRcdFx0fSwgMzAwMCk7XG5cblx0XHRcdHdzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ29wZW4nLCBmaXJzdE9wZW4pO1xuXHRcdFx0cmVzb2x2ZSh3cyk7XG5cdFx0fSk7XG5cblx0XHRmdW5jdGlvbiB0ZXJtaW5hdGUoKSB7XG5cdFx0XHRjbGVhckludGVydmFsKGludGVydmFsKTtcblx0XHRcdHdzUHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG5cdFx0XHRcdGlmICghZXJyb3JNc2cpIGVycm9yTXNnID0gZGlzcGxheUVycm9yKCdDb25uZWN0aW9uJywgJ0xvc3Qgc2VydmVyIGNvbm5lY3Rpb24uJyk7XG5cdFx0XHRcdHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdUcnlpbmcgdG8gZ2V0IG5ldyBjb25uZWN0aW9uJyk7XG5cdFx0XHRcdFx0Z2V0TmV3V1MoKS50aGVuKGZ1bmN0aW9uIChuZXdXcykge1xuXHRcdFx0XHRcdFx0cmVzb2x2ZShuZXdXcyk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0sIDEwMDApO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gd3NQcm9taXNlO1xuXHRcdH1cblx0fSk7XG59XG5cbmV4cG9ydCB7XG5cdHdzUHJvbWlzZSxcblx0cmVtb3RlQ21kXG59OyIsIi8qIGdsb2JhbCBNYXAsIFNldCwgUHJvbWlzZSwgZnMsIGlzU2VydmVyICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG5pbXBvcnQgeyByZXNvbHZlIGFzIHBhdGhSZXNvbHZlLCBiYXNlbmFtZSwgZGlybmFtZSwgZXh0bmFtZSwgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IG1pbWUgZnJvbSAnbWltZSc7XG5pbXBvcnQgcmVuZGVyRmlsZUxpc3QgZnJvbSAnLi9yZW5kZXItZmlsZS1saXN0LmpzJztcbmltcG9ydCB7IHJlbW90ZUNtZCB9IGZyb20gJy4vd3MuanMnO1xuXG4vLyBNYXAgdG8gcHJldmVudCBkdXBsaWNhdGUgZGF0YSBvYmplY3RzIGZvciBlYWNoIGZpbGVcbnZhciBwYXRoVG9EYXRhTWFwID0gbmV3IE1hcCgpO1xuXG52YXIgZnNGcm9tRm4gPSBbJ2lzRmlsZScsICdpc0RpcmVjdG9yeScsICdpc0Jsb2NrRGV2aWNlJywgJ2lzQ2hhcmFjdGVyRGV2aWNlJywgJ2lzU3ltYm9saWNMaW5rJywgJ2lzRklGTycsICdpc1NvY2tldCddO1xudmFyIGZzU3RhdGljID0gW1xuXHQnZGV2Jyxcblx0J21vZGUnLFxuXHQnbmxpbmsnLFxuXHQndWlkJyxcblx0J2dpZCcsXG5cdCdyZGV2Jyxcblx0J2Jsa3NpemUnLFxuXHQnaW5vJyxcblx0J3NpemUnLFxuXHQnYmxvY2tzJyxcblx0J2F0aW1lJyxcblx0J210aW1lJyxcblx0J2N0aW1lJyxcblx0J2JpcnRodGltZScsXG5cdCdwYXRoJ1xuXTtcbnZhciBrZXlzID0gZnNTdGF0aWMuY29uY2F0KGZzRnJvbUZuKTtcblxuXG4vKipcbiAqIFNwZWNpYWwgdHlwZSBvZiBzaW5nbGV0b24gd2hpY2ggcmV0dXJucyB0aGUgc2FtZSBvYmplY3QgZm9yIGVhY2ggcGF0aC5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gU3RhdHMgKGRhdGEpIHtcblx0aWYgKHBhdGhUb0RhdGFNYXAuaGFzKGRhdGEucGF0aCkpIHtcblx0XHR2YXIgZXhpc3RpbmcgPSBwYXRoVG9EYXRhTWFwLmdldChkYXRhLnBhdGgpO1xuXHRcdGV4aXN0aW5nLnVwZGF0ZShkYXRhKTtcblx0XHRyZXR1cm4gZXhpc3Rpbmc7XG5cdH1cblx0dGhpcy5maWxlTGlzdHMgPSBuZXcgU2V0KCk7XG5cdHRoaXMuZGF0YSA9IHt9O1xuXHR0aGlzLnVwZGF0ZShkYXRhKTtcblx0cGF0aFRvRGF0YU1hcC5zZXQoZGF0YS5wYXRoLCB0aGlzKTtcbn1cblxuU3RhdHMucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIHVwZGF0ZShkYXRhKSB7XG5cblx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdHRoaXMuZGF0YS5uYW1lID0gYmFzZW5hbWUoZGF0YS5wYXRoKTtcblx0dGhpcy5kYXRhLmRpck5hbWUgPSBkaXJuYW1lKGRhdGEucGF0aCk7XG5cdHRoaXMuZGF0YS5leHRlbnNpb24gPSBleHRuYW1lKGRhdGEucGF0aCkudG9Mb3dlckNhc2UoKTtcblx0dGhpcy5kYXRhLm1pbWUgPSBkYXRhLmlzRmlsZSA/IG1pbWUubG9va3VwKGRhdGEucGF0aCkgOiAnZGlyZWN0b3J5JztcblxuXHRrZXlzLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuXHRcdHRoaXMuZGF0YVtrZXldID0gZGF0YVtrZXldO1xuXHR9LmJpbmQodGhpcykpO1xuXG5cdGlmICh0aGlzLmlzRGlyZWN0b3J5KCkgJiYgIXRoaXMuY2hpbGRyZW4pIHtcblx0XHR0aGlzLmNoaWxkcmVuID0gW107XG5cdFx0dGhpcy5jaGlsZHJlblBvcHVsYXRlZCA9IGZhbHNlO1xuXHR9XG5cbiAgICAvLyBSZXJlbmRlciBmaWxlIGxpc3RzXG5cdGlmICh0aGlzLmZpbGVMaXN0cy5zaXplKSB7XG5cdFx0QXJyYXkuZnJvbSh0aGlzLmZpbGVMaXN0cykuZm9yRWFjaChmdW5jdGlvbiAoZmlsZWxpc3RFbCkge1xuXHRcdFx0ZmlsZWxpc3RFbC5pbm5lckhUTUwgPSAnJztcblx0XHRcdHNlbGYucmVuZGVyRmlsZUxpc3QoZmlsZWxpc3RFbCwgZmlsZWxpc3RFbC5maWxlbGlzdE9wdGlvbnMpO1xuXHRcdH0pO1xuXHR9XG59XG5cblN0YXRzLnByb3RvdHlwZS50b0RvYyA9IGZ1bmN0aW9uIHRvRG9jKCkge1xuXHR2YXIgb3V0ID0ge1xuXHRcdF9fd2ViU3RhdERvYzogdHJ1ZVxuXHR9O1xuXHRrZXlzLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuXHRcdG91dFtrZXldID0gdGhpcy5kYXRhW2tleV07XG5cdH0uYmluZCh0aGlzKSk7XG5cdHJldHVybiBvdXQ7XG59XG5cblN0YXRzLnByb3RvdHlwZS51cGRhdGVDaGlsZHJlbiA9IGZ1bmN0aW9uICgpIHtcblx0aWYoIXRoaXMuaXNEaXJlY3RvcnkoKSkgdGhyb3cgRXJyb3IoJ05vdCBhIGRpcmVjdG9yeScpO1xuXG5cdHZhciBzZWxmID0gdGhpcztcblx0cmV0dXJuIGZzLnJlYWRkaXIoc2VsZi5kYXRhLnBhdGgpXG5cdC50aGVuKGZ1bmN0aW9uIChhcnIpIHtcblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwoYXJyLm1hcChmdW5jdGlvbiAoY2hpbGQpIHtcblx0XHRcdHJldHVybiBTdGF0cy5mcm9tUGF0aChqb2luKHNlbGYuZGF0YS5wYXRoLCBjaGlsZCkpO1xuXHRcdH0pKTtcblx0fSlcblx0LnRoZW4oZnVuY3Rpb24gKHN0YXRzQXJyYXkpIHtcblx0XHRzZWxmLmNoaWxkcmVuLnNwbGljZSgwKTtcblx0XHRzZWxmLmNoaWxkcmVuLnB1c2guYXBwbHkoc2VsZi5jaGlsZHJlbiwgc3RhdHNBcnJheSk7XG5cblx0XHQvLyBMZXQgc2VydmVyIGtub3dcdFxuXHRcdGlmICghaXNTZXJ2ZXIpIHJlbW90ZUNtZCgnQ0xJRU5UJywge1xuXHRcdFx0Y21kOiAnd2F0Y2hQYXRoJyxcblx0XHRcdGFyZ3VtZW50czogW3NlbGYuZGF0YS5wYXRoXVxuXHRcdH0pO1xuXG5cdFx0c2VsZi51cGRhdGUoc2VsZi5kYXRhKTtcblxuXHRcdHJldHVybiBzZWxmOyAgXG5cdH0pO1xufVxuXG5TdGF0cy5wcm90b3R5cGUuZGVzdHJveUZpbGVMaXN0ID0gZnVuY3Rpb24gKGVsKSB7XG5cdGVsLnN0YXRzID0gdW5kZWZpbmVkO1xuXHR0aGlzLmZpbGVMaXN0cy5kZWxldGUoZWwpO1xuXHRlbC5pbm5lckhUTUwgPSAnJztcbn1cblxuU3RhdHMucHJvdG90eXBlLnJlbmRlckZpbGVMaXN0ID0gZnVuY3Rpb24gKGVsLCBvcHRpb25zKSB7XG5cblx0ZWwuZmlsZWxpc3RPcHRpb25zID0gb3B0aW9ucztcblxuXHRlbC5zdGF0cyA9IHRoaXM7XG5cdHRoaXMuZmlsZUxpc3RzLmFkZChlbCk7XG5cdGVsLmRhdGFzZXQubWltZSA9IHRoaXMuZGF0YS5taW1lO1xuXHRlbC5kYXRhc2V0Lm5hbWUgPSB0aGlzLmRhdGEubmFtZTtcblx0ZWwuZGF0YXNldC5zaXplID0gdGhpcy5kYXRhLnNpemU7XG5cblx0cmVuZGVyRmlsZUxpc3QoZWwsIHRoaXMuY2hpbGRyZW4sIG9wdGlvbnMpO1xufVxuXG4vLyBhZGQgaXNGaWxlIGlzRGlyZWN0b3J5IGV0Y1xuZnNGcm9tRm4uZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG5cdFN0YXRzLnByb3RvdHlwZVtrZXldID0gbmV3IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcy5kYXRhW1wiJyArIGtleSArICdcIl07Jyk7XG59KTtcblxuU3RhdHMuZnJvbVBhdGggPSBmdW5jdGlvbiAocGF0aCkge1xuXHRyZXR1cm4gZnMuc3RhdChwYXRoKTtcbn1cblxuU3RhdHMuZnJvbURvYyA9IGZ1bmN0aW9uIChkYXRhKSB7XG5cdHJldHVybiBuZXcgU3RhdHMoZGF0YSk7XG59XG5cblN0YXRzLmZyb21Ob2RlU3RhdHMgPSBmdW5jdGlvbiAocGF0aCwgbm9kZVN0YXQpIHtcblxuXHR2YXIgb3V0ID0ge307XG5cblx0ZnNGcm9tRm4uZm9yRWFjaChrZXkgPT4gb3V0W2tleV0gPSBub2RlU3RhdFtrZXldKCkpO1xuXHRrZXlzLmZvckVhY2goa2V5ID0+IHtcblx0XHRpZiAodHlwZW9mIG5vZGVTdGF0W2tleV0gIT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIG5vZGVTdGF0W2tleV0gIT09ICdvYmplY3QnKSB7XG5cdFx0XHRvdXRba2V5XSA9IG5vZGVTdGF0W2tleV07XG5cdFx0fVxuXHR9KTtcblxuXHRvdXQucGF0aCA9IHBhdGhSZXNvbHZlKHBhdGgpO1xuXG5cdHJldHVybiBuZXcgU3RhdHMob3V0KTtcbn1cbiJdLCJuYW1lcyI6WyJrZXlzIiwicmVzb2x2ZSIsImRpcm5hbWUiLCJiYXNlbmFtZSIsImV4dG5hbWUiLCJqb2luIiwicGF0aCIsInBhdGhSZXNvbHZlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7QUFJQSxBQUNBLElBQUksRUFBRSxHQUFHLFFBQVEsR0FBRyxJQUFJLEdBQUcsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3ZELFNBQVMsV0FBVyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUU7O0NBRTlCLFdBQVcsQ0FBQyxPQUFPLEdBQUcsV0FBVyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7OztDQUcvRCxPQUFPLFdBQVcsQ0FBQyxPQUFPLEdBQUcsV0FBVyxDQUFDLE9BQU87R0FDOUMsSUFBSSxDQUFDLFlBQVk7R0FDakIsT0FBTyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQztHQUNsQixDQUFDO0dBQ0QsS0FBSyxDQUFDLFVBQVUsQ0FBQyxFQUFFO0dBQ25CLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxHQUFHLEVBQUU7SUFDckIsT0FBTyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUU7SUFDbkI7R0FDRCxNQUFNLENBQUMsQ0FBQztHQUNSLENBQUM7R0FDRCxJQUFJLENBQUMsVUFBVSxHQUFH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
