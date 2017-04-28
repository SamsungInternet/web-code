/* global require, monaco, Map, Promise, PouchDB */
/* eslint no-var: 0, no-console: 0 */
'use strict';

var currentlyOpenedPath = null;

// Map to prevent duplicate data objects for each file
var pathToDataMap = new Map();

require.config({ paths: { 'vs': 'vs' } });

var monacoPromise = new Promise(function (resolve) {
	require(['vs/editor/editor.main'], resolve);
});

function getMonacoLanguageFromMimes(mime) {
	return (monaco.languages.getLanguages().filter(function (languageObj) {
		return languageObj.mimetypes && languageObj.mimetypes.includes(mime);
	})[0] || {})['id'];
}

function getMonacoLanguageFromExtensions(extension) {
	return (monaco.languages.getLanguages().filter(function (languageObj) {
		return languageObj.extensions && languageObj.extensions.includes(extension);
	})[0] || {})['id'];
}

var ws = new WebSocket((location.hostname === 'localhost' ? 'ws://' : 'wss://') + location.host);
ws.binaryType = 'arraybuffer';

var promises = new Map();

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

function init() {

	db.get('INIT_STATE')
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

		if (currentlyOpenedPath !== data.path) {
			// TODO: close all tabs

			// Then open the saved tabs from last time
			db.get('OPEN_TABS_FOR_' + data.path).then(function (tabs) {
				tabs.open_tabs.forEach(openFile);
			}).catch(function (e) {
				console.log(e);
			});
		}

		currentlyOpenedPath = data.path;

		var filelist = document.getElementById('directory');
		populateFileList(filelist, data.path, {
			hideDotFiles: true
		});

		updateDBDoc('INIT_STATE', {
			previous_path: { path: data.path, isDir: true }
		})
		.catch(function (err) {
			console.log(err);
		});

	}
	if (data.isFile) {
		openFile(data);
	}
}

function saveOpenTab() {
	var tab = tabController.getOpenTab();
	var data;
	if (tab) {
		data = tab.data;
	} else {
		return;
	}
	remoteCmd('SAVE', {
		path: data.path,
		content: tab.editor.getValue()
	});
}

function openFile(data) {

	// ensure that data objects are not duplicated.
	if (pathToDataMap.has(data.path)) {
		data = pathToDataMap.get(data.path);
	} else {
		pathToDataMap.set(data.path, data);
	}

	if (tabController.hasTab(data)) {
		tabController.focusTab(data);
	} else {
		var newTab = tabController.newTab(data);

		return Promise.all([remoteCmd('OPEN', data.path), monacoPromise])
			.then(function (arr) {
				return arr[0];
			})
			.then(function (fileContents) {
				var language = getMonacoLanguageFromMimes(data.mime) || getMonacoLanguageFromExtensions(data.extension);
				newTab.editor = monaco.editor.create(newTab.contentEl, {
					value: fileContents,
					language: language
				});
				addKeyBindings(newTab.editor);
			});
	}
}

function promptForOpen() {
	openFileDialog(currentlyOpenedPath, '/').then(openPath);
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
			li.classList.add('has-icon');
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
			if (pathToDataMap.has(data.path)) {
				data = pathToDataMap.get(data.path);
			} else {
				pathToDataMap.set(data.path, data);
			}
			data.children.forEach(function (childData, i) {
				if (pathToDataMap.has(childData.path)) {
					data.children[i] = pathToDataMap.get(childData.path);
				} else {
					pathToDataMap.set(childData.path, childData);
				}
			});
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
	document.querySelector('button[data-action="save-file"]').addEventListener('click', saveOpenTab);
}());

var tabController = (function setUpTabs() {
	var currentlyOpenFilesEl = document.querySelector('#currently-open-files');
	var containerEl = document.getElementById('container');
	var tabsEl = document.querySelector('#tabs');

	function Tab(data) {
		this.data = data;
		this.el = document.createElement('span');
		this.el.classList.add('tab');
		this.el.classList.add('has-icon');
		this.el.dataset.mime = data.mime;
		this.el.dataset.name = data.name;
		this.el.dataset.size = data.size;
		this.el.textContent = data.name;
		this.el.tabIndex = 1;
		tabsEl.appendChild(this.el);

		this.el.webCodeTab = this;

		this.contentEl = document.createElement('div');
		this.contentEl.classList.add('tab-content');
		containerEl.appendChild(this.contentEl);
	}

	Tab.prototype.destroy = function () {
		this.el.parentNode.removeChild(this.el);
		this.contentEl.parentNode.removeChild(this.contentEl);
	}

	function TabController() {
		this.currentlyOpenFilesMap = new Map();
	}

	TabController.prototype.hasTab = function (data) {
		return this.currentlyOpenFilesMap.has(data);
	}

	TabController.prototype.getOpenTab = function () {
		return this.focusedTab;
	}

	TabController.prototype.newTab = function (data) {
		var tab = new Tab(data);
		this.currentlyOpenFilesMap.set(data, tab);
		renderFileList(currentlyOpenFilesEl, { children: Array.from(this.currentlyOpenFilesMap.keys()) });
		this.focusTab(tab);
		this.storeOpenTabs();
		return tab;
	}

	TabController.prototype.focusTab = function (data) {
		var focusedTab = data.constructor === Tab ? data : this.currentlyOpenFilesMap.get(data);
		this.focusedTab = focusedTab;
		Array.from(this.currentlyOpenFilesMap.values()).forEach(function (tab) {
			tab.contentEl.classList.toggle('has-focus', tab === focusedTab);
			tab.el.classList.toggle('has-focus', tab === focusedTab);
		});
		if (focusedTab.editor) focusedTab.editor.layout();
	}

	TabController.prototype.storeOpenTabs = function () {
		if (!currentlyOpenedPath) return;
		updateDBDoc('OPEN_TABS_FOR_' + currentlyOpenedPath, {
			open_tabs: Array.from(this.currentlyOpenFilesMap.keys())
		})
		.catch(function (err) {
			console.log(err);
		});
	}

	var tabController = new TabController();

	tabsEl.addEventListener('click', function (e) {
		if (e.target.matches('.tab')) {
			tabController.focusTab(e.target.webCodeTab);
		}
	});

	currentlyOpenFilesEl.addEventListener('click', function (e) {
		if (e.target.data) {
			tabController.focusTab(e.target.data);
		}
	});

	return tabController;
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

function addKeyBindings(editor) {
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, saveOpenTab);
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_O, promptForOpen);
	editor.addCommand(monaco.KeyCode.KEY_P | monaco.KeyMod.Shift | monaco.KeyMod.CtrlCmd, function openCommandPalette() {
		editor.trigger('anyString', 'editor.action.quickCommand');
	});
}