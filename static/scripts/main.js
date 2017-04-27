/* global require, monaco, Map, Promise, PouchDB */
/* eslint no-var: 0, no-console: 0 */
'use strict';

var editor;

require.config({ paths: { 'vs': 'vs' }});
require(['vs/editor/editor.main'], function() {
	editor = monaco.editor.create(document.getElementById('container'));
});

var ws = new WebSocket((location.hostname === 'localhost' ? 'ws://' : 'wss://') + location.host);
ws.binaryType = 'arraybuffer';

var promises = new Map();

var els = {
	filelist: document.getElementById('directory')
};

var currentlyOpenFilesArr = [];
var directoryStructure = [];

ws.addEventListener('message', function m(e) {
	if (typeof e.data === 'string') {
		var result = JSON.parse(e.data);
		var promiseResolver = promises.get(result[1]);
		var data = result[2];
		if (promiseResolver) {
			promises.delete(result[1]);

			if (data.error) {
				return promiseResolver[1](Error(data.error));
			} else {
				return promiseResolver[0](data);
			}
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
ws.addEventListener('open', function firstOpen() {
	ws.removeEventListener('open', firstOpen);
	init();
});

var db = new PouchDB('web-code', {});

function init() {

	return db.get('INIT_STATE')
		.then(function (doc) {
			if (doc.previous_path) {
				return openPath(doc.previous_path);
			} else {
				return promptForOpen();
			}
		})
		.catch(function (err) {
			promptForOpen();
			console.log(err);
		});

}

function openPath(data) {
	if (data.isDir) {
		populateFileList(els.filelist, data.path, {
			hideDotFiles: true
		})
		.then(function (data) {
			currentlyOpenFilesArr = data;
		});

		/* update last open folder in db */
		db.get('INIT_STATE')
			.catch(function (e) {
				if (e.status === 404) {
					return { _id: 'INIT_STATE' }
				}
				throw e;
			})
			.then(function (doc) {
				doc.previous_path = { path: data.path, isDir: true };
				db.put(doc);
			})
			.catch(function (err) {
				console.log(err);
			});

	}
	if (data.isFile) {
		openFile(data);
	}
}

function openFile(data) {
	return remoteCmd('OPEN', data.path)
		.then(function (data) {
			editor.setValue(data);
		})
}

function promptForOpen() {
	openFileDialog('/').then(openPath);
}

function renderFileList(el, data, options) {

	options = options || {};

	el.innerHTML = '';
	data.children
		.filter(function (datum) {
			if (datum.name !== '..' && options.hideDotFiles !== false) {
				return datum.name[0] !== '.';
			}
			if (options.hideUpDir === true) {
				if (datum.name === '..') {
					return false;
				}
			}
			return false;
		})
		.sort(function (a, b) {
			if (
				(a.isDir === b.isDir) &&
				(a.isFile === b.isFile)
			) {
				return ([a.name, b.name].sort(function (a, b) {
					return a.toLowerCase().localeCompare(b.toLowerCase());
				})[0] === a.name ? -1 : 1);
			} else {
				if (a.isDir) return -1;
				return 1;
			}
		}).map(function (datum) {
			var li = document.createElement('li');
			li.dataset.mime = datum.mime;
			li.dataset.name = datum.name;
			li.dataset.size = datum.size;
			li.textContent = datum.name;
			li.tabIndex = 1;
			li.data = datum;
			el.appendChild(li);

			if (datum.isDir) {
				var newFileList = document.createElement('ul');
				newFileList.classList.add('filelist');
				li.appendChild(newFileList);
				if (datum.children) {
					renderFileList(newFileList, datum);
				}
			}
		});
}

function populateFileList(el, path) {
	el.path = path;
	return remoteCmd('STAT', path)
		.then(function (data) {
			if (data.isFile) {
				return remoteCmd('STAT', data.dirName);
			}
			return data;
		})
		.then(function (data) {
			renderFileList(el, data);
			return data;
		});
}

var openFileDialog = (function () {

	var highlightedEl;
	var currentPath;
	var resolver;
	var rejecter;

	function openFileDialog(path) {

		return new Promise(function (resolve, reject) {
			if (openFileDialog.open === undefined) openFileDialog.open = false;
			if (openFileDialog.open === true) {
				throw Error('Dialog already open for another task.');
			}
			path = path || '/';
			currentPath = path;
			openFileDialog.el.classList.remove('closed');
			resolver = resolve;
			rejecter = reject;

			populateFileList(openFileDialog.filelistLeft, path)
				.catch(function (e) {
					console.log(e);
					return populateFileList(openFileDialog.filelistLeft, '/')
				});
		});
	}

	function highlight(e) {
		if (e.target.tagName === 'LI') {
			if (highlightedEl) {
				highlightedEl.classList.remove('has-highlight');
			}
			highlightedEl = e.target;
			highlightedEl.classList.add('has-highlight');

			currentPath = e.target.data.path;
			openFileDialog.currentPathEl.value = currentPath;

			if (e.target.data && e.target.data.isDir) {
				if (e.currentTarget === openFileDialog.filelistLeft) {
					if (e.target.data.name === '..') {
						populateFileList(openFileDialog.filelistLeft, e.target.data.path);
						openFileDialog.filelistRight.innerHTML = '';
					} else {
						populateFileList(openFileDialog.filelistRight, e.target.data.path);
					}
				}
				if (e.currentTarget === openFileDialog.filelistRight) {
					populateFileList(openFileDialog.filelistLeft, e.target.data.dirName).then(function () {
						[].slice.call(openFileDialog.filelistLeft.children).forEach(function (el) {
							if (el.data.path === currentPath) {
								highlightedEl = e.target;
								highlightedEl.classList.add('has-highlight');
							}
						});
					});
					populateFileList(openFileDialog.filelistRight, e.target.data.path);
				}
			}
		}
	}

	function ondblclick(e) {
		highlight(e);
		if (e.target.data && e.target.data.isDir) return;
		open(e.target.data);
	}

	function open(data) {
		openFileDialog.el.classList.add('closed');
		resolver(data);
		resolver = undefined;
		rejecter = undefined;
	}

	function cancel() {
		openFileDialog.el.classList.add('closed');
		rejecter('User canceled');
		resolver = undefined;
		rejecter = undefined;
	}

	function onkeydown(e) {
		if (event.keyCode === 13) ondblclick(e);
	}

	openFileDialog.el = openFileDialog.el || document.querySelector('#file-open-widget');
	openFileDialog.currentPathEl = openFileDialog.currentPathEl || openFileDialog.el.querySelector('input[name="current-path"]');
	openFileDialog.filelistLeft = openFileDialog.filelistLeft || openFileDialog.el.querySelector('.filelist:first-child');
	openFileDialog.filelistRight = openFileDialog.filelistRight || openFileDialog.el.querySelector('.filelist:not(:first-child)');
	openFileDialog.openButton = openFileDialog.openButton || openFileDialog.el.querySelector('#file-open-open');
	openFileDialog.cancelButton = openFileDialog.cancelButton || openFileDialog.el.querySelector('#file-open-cancel');

	openFileDialog.filelistLeft.addEventListener('click', highlight);
	openFileDialog.filelistRight.addEventListener('click', highlight);

	openFileDialog.filelistLeft.addEventListener('keydown', onkeydown);
	openFileDialog.filelistRight.addEventListener('keydown', onkeydown);

	openFileDialog.filelistLeft.addEventListener('dblclick', ondblclick);
	openFileDialog.filelistRight.addEventListener('dblclick', ondblclick);
	openFileDialog.openButton.addEventListener('click', function () {
		open(highlightedEl.data);
	});
	openFileDialog.cancelButton.addEventListener('click', function () {
		cancel();
	});

	return openFileDialog;
}());

(function setUpToolBar() {
	document.querySelector('button[data-action="open-file"]').addEventListener('click', promptForOpen);
}());


(function setUpSideBar() {

	function expandDir(el, data) {
		var filelistEl = el.querySelector('.filelist');
		if (filelistEl.children.length) {
			filelistEl.innerHTML = '';
		} else {
			populateFileList(filelistEl, data.path, {
				hideDotFiles: true
			})
			.then(function (newChildlist) {
				data.children = newChildlist;
			});
		}
	}

	var directoryEl = document.querySelector('#directory');
	var currentlyOpenFilesEl = document.querySelector('#currently-open-files');

	function onclick(e) {
		if (e.target.tagName === 'LI') {
			if (e.target.data.isFile) openFile(e.target.data);
			if (e.target.data.isDir) expandDir(e.target, e.target.data);
		}
	}

	function onkeydown(e) {
		if (event.keyCode === 13) onclick(e);
	}

	directoryEl.addEventListener('click', onclick);
	directoryEl.addEventListener('keydown', onkeydown);

}());