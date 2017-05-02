(function () {
'use strict';

/* global require, Promise, PouchDB */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

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

/* global require, Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

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
var wsPromise = new Promise(function (resolve) {
	ws.addEventListener('open', function firstOpen() {
		ws.removeEventListener('open', firstOpen);
		resolve(ws);
	});
});

var state = {
	currentlyOpenPath: null // null or string
};

/* global require, Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

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

function closeOpenTab() {
	var tab = tabController.getOpenTab();
	var data;
	if (tab) {
		data = tab.data;
	} else {
		return;
	}
	console.log(data);
}


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
	};

	function TabController() {
		this.currentlyOpenFilesMap = new Map();
	}

	TabController.prototype.hasTab = function (data) {
		return this.currentlyOpenFilesMap.has(data);
	};

	TabController.prototype.getOpenTab = function () {
		return this.focusedTab;
	};

	TabController.prototype.newTab = function (data) {
		var tab = new Tab(data);
		this.currentlyOpenFilesMap.set(data, tab);
		renderFileList(currentlyOpenFilesEl, { children: Array.from(this.currentlyOpenFilesMap.keys()) });
		this.focusTab(tab);
		this.storeOpenTabs();
		return tab;
	};

	TabController.prototype.focusTab = function (data) {
		var focusedTab = data.constructor === Tab ? data : this.currentlyOpenFilesMap.get(data);
		this.focusedTab = focusedTab;
		Array.from(this.currentlyOpenFilesMap.values()).forEach(function (tab) {
			tab.contentEl.classList.toggle('has-focus', tab === focusedTab);
			tab.el.classList.toggle('has-focus', tab === focusedTab);
		});
		if (focusedTab.editor) focusedTab.editor.layout();
	};

	TabController.prototype.storeOpenTabs = function () {
		if (!state.currentlyOpenedPath) return;
		updateDBDoc('OPEN_TABS_FOR_' + state.currentlyOpenedPath, {
			open_tabs: Array.from(this.currentlyOpenFilesMap.keys())
		})
		.catch(function (err) {
			console.log(err);
		});
	};

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

/* global require, monaco, Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

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

function addKeyBindings(editor) {
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, saveOpenTab);
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_O, promptForOpen);
	editor.addCommand(monaco.KeyCode.KEY_W | monaco.KeyMod.CtrlCmd, closeOpenTab);
	editor.addCommand(monaco.KeyCode.KEY_P | monaco.KeyMod.Shift | monaco.KeyMod.CtrlCmd, function openCommandPalette() {
		editor.trigger('anyString', 'editor.action.quickCommand');
	});
}

/* global require, Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

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
		openFileDialog.currentPathEl.value = currentPath;

		populateFileList(openFileDialog.filelistLeft, path, {
			nested: false
		})
			.catch(function (e) {
				console.log(e);
				return populateFileList(openFileDialog.filelistLeft, '/', {
			nested: false
		})
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
					populateFileList(openFileDialog.filelistLeft, e.target.data.path, {
						nested: false
					});
					openFileDialog.filelistRight.innerHTML = '';
				} else {
					populateFileList(openFileDialog.filelistRight, e.target.data.path, {
						nested: false
					});
				}
			}
			if (e.currentTarget === openFileDialog.filelistRight) {
				populateFileList(openFileDialog.filelistLeft, e.target.data.dirName, {
					nested: false
				})
					.then(function () {
						[].slice.call(openFileDialog.filelistLeft.children).forEach(function (el) {
							if (el.data.path === currentPath) {
								highlightedEl = e.target;
								highlightedEl.classList.add('has-highlight');
							}
						});
					});
				populateFileList(openFileDialog.filelistRight, e.target.data.path, {
					nested: false
				});
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
openFileDialog.upDirButton = openFileDialog.upDirButton || openFileDialog.el.querySelector('button[data-action="up-dir"]');

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
openFileDialog.upDirButton.addEventListener('click', function () {
	console.log('STUB GO UP DIR');
});

/* global require, Map, Set, Promise, monaco */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

// Map to prevent duplicate data objects for each file
var pathToDataMap = new Map();

function renderFileList(el, data, options) {

	options = options || {};
	var useOptions = {
		hideDotFiles: (options.hideDotFiles !== undefined ? options.hideDotFiles : true),
		nested: (options.nested !== undefined ? options.nested : true),
		nestingLimit: (options.nestingLimit || 5) - 1
	};
	if (options.nestingLimit === 0) return;

	el.innerHTML = '';
	var sortedData = Array.from(data.children)
		.filter(function (datum) {

			// Whether to hide dotfiles
			if (datum.name !== '..' && useOptions.hideDotFiles !== false) {
				return datum.name[0] !== '.';
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
		});

		sortedData.map(function (datum) {
			var li = document.createElement('li');
			li.classList.add('has-icon');
			li.dataset.mime = datum.mime;
			li.dataset.name = datum.name;
			li.dataset.size = datum.size;
			li.textContent = datum.name;
			li.tabIndex = 1;
			li.data = datum;
			el.appendChild(li);

			if (datum.isDir && useOptions.nested !== false) {
				var newFileList = document.createElement('ul');
				newFileList.classList.add('filelist');
				li.appendChild(newFileList);
				if (datum.children) {
					renderFileList(newFileList, datum, useOptions);
				}
			}
		});
}

function populateFileList(el, path, options) {
	el.path = path;
	return remoteCmd('STAT', path)
		.then(function (data) {
			if (data.isFile) {
				return remoteCmd('STAT', data.dirName);
			}
			return data;
		})
		.then(function (data) {
			data = dedup(data);
			renderFileList(el, data, options);
			return data;
		});
}


function dedup(data) {

	var newChildren;
	var oldChildren;

	// That way if any of these change then the file is updated
	var key = JSON.stringify({
		path: data.path,
		isDir: data.isDir,
		isFile: data.isFile,
		mime: data.mime
	});

	if (data.children) newChildren = data.children;

	// ensure that data objects are not duplicated.
	if (pathToDataMap.has(key)) {
		data = pathToDataMap.get(key);
		oldChildren = data.children;
	} else {
		pathToDataMap.set(key, data);
	}

	if (data.isDir) {

		if (!oldChildren && !newChildren) {
			// do nothing, we have no children and we need to add no children
			return data;
		}

		if (!oldChildren && newChildren) {
			// no Set present then create one to be preared in the next one
			data.children = new Set();
			oldChildren = data.children;
		}

		if (oldChildren && newChildren) {
			// Set is present so populate it

			newChildren.forEach(function (childData) {
				oldChildren.add(dedup(childData));
			});
			return data;
		}
	}

	return data;
}

function openPath(data) {
	if (data.isDir) {

		if (state.currentlyOpenedPath !== data.path) {
			// TODO: close all tabs

			// Then open the saved tabs from last time
			db.get('OPEN_TABS_FOR_' + data.path).then(function (tabs) {
				tabs.open_tabs.forEach(openFile);
			}).catch(function (e) {
				console.log(e);
			});
		}

		state.currentlyOpenedPath = data.path;

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

function openFile(data) {

	data = dedup(data);

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
	openFileDialog(state.currentlyOpenedPath || '/').then(openPath);
}

/* global require, Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

function setUpSideBar() {

	function expandDir(el, data) {
		var filelistEl = el.querySelector('.filelist');
		if (filelistEl.children.length) {
			filelistEl.innerHTML = '';
		} else {
			populateFileList(filelistEl, data.path, {
				hideDotFiles: true
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

}

/* global require, Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

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

wsPromise.then(init);

(function setUpToolBar() {
	document.querySelector('button[data-action="open-file"]').addEventListener('click', promptForOpen);
	document.querySelector('button[data-action="save-file"]').addEventListener('click', saveOpenTab);
}());

setUpSideBar();

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyJsaWIvZGIuanMiLCJsaWIvd3MuanMiLCJsaWIvc3RhdGUuanMiLCJsaWIvdGFiLWNvbnRyb2xsZXIuanMiLCJsaWIvbW9uYWNvLmpzIiwibGliL29wZW4tZmlsZS1kaWFsb2cuanMiLCJsaWIvZmlsZXMuanMiLCJsaWIvc2lkZS1iYXIuanMiLCJtYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCByZXF1aXJlLCBQcm9taXNlLCBQb3VjaERCICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG52YXIgZGIgPSBuZXcgUG91Y2hEQignd2ViLWNvZGUnLCB7fSk7XG5mdW5jdGlvbiB1cGRhdGVEQkRvYyhfaWQsIG9iaikge1xuXG5cdHVwZGF0ZURCRG9jLnByb21pc2UgPSB1cGRhdGVEQkRvYy5wcm9taXNlIHx8IFByb21pc2UucmVzb2x2ZSgpO1xuXG5cdC8qIHVwZGF0ZSBsYXN0IG9wZW4gZm9sZGVyIGluIGRiICovXG5cdHJldHVybiB1cGRhdGVEQkRvYy5wcm9taXNlID0gdXBkYXRlREJEb2MucHJvbWlzZVxuXHRcdC50aGVuKGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiBkYi5nZXQoX2lkKVxuXHRcdH0pXG5cdFx0LmNhdGNoKGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRpZiAoZS5zdGF0dXMgPT09IDQwNCkge1xuXHRcdFx0XHRyZXR1cm4geyBfaWQ6IF9pZCB9XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH0pXG5cdFx0LnRoZW4oZnVuY3Rpb24gKGRvYykge1xuXHRcdFx0T2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdFx0ZG9jW2tleV0gPSBvYmpba2V5XTtcblx0XHRcdH0pO1xuXHRcdFx0ZGIucHV0KGRvYyk7XG5cdFx0fSk7XG59XG5cbmV4cG9ydCB7IGRiLCB1cGRhdGVEQkRvYyB9OyIsIi8qIGdsb2JhbCByZXF1aXJlLCBNYXAsIFNldCwgUHJvbWlzZSAqL1xuLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuLyogZXNsaW50LWVudiBlczYgKi9cblxudmFyIHdzID0gbmV3IFdlYlNvY2tldCgobG9jYXRpb24uaG9zdG5hbWUgPT09ICdsb2NhbGhvc3QnID8gJ3dzOi8vJyA6ICd3c3M6Ly8nKSArIGxvY2F0aW9uLmhvc3QpO1xud3MuYmluYXJ5VHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cbnZhciBwcm9taXNlcyA9IG5ldyBNYXAoKTtcblxud3MuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIG0oZSkge1xuXHRpZiAodHlwZW9mIGUuZGF0YSA9PT0gJ3N0cmluZycpIHtcblx0XHR2YXIgcmVzdWx0ID0gSlNPTi5wYXJzZShlLmRhdGEpO1xuXHRcdHZhciBwcm9taXNlUmVzb2x2ZXIgPSBwcm9taXNlcy5nZXQocmVzdWx0WzFdKTtcblx0XHR2YXIgZGF0YSA9IHJlc3VsdFsyXTtcblx0XHRpZiAocHJvbWlzZVJlc29sdmVyKSB7XG5cdFx0XHRwcm9taXNlcy5kZWxldGUocmVzdWx0WzFdKTtcblxuXHRcdFx0aWYgKGRhdGEuZXJyb3IpIHtcblx0XHRcdFx0cmV0dXJuIHByb21pc2VSZXNvbHZlclsxXShFcnJvcihkYXRhLmVycm9yKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gcHJvbWlzZVJlc29sdmVyWzBdKGRhdGEpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbmZ1bmN0aW9uIHJlbW90ZUNtZChjbWQsIGRhdGEpIHtcblx0dmFyIGlkID0gcGVyZm9ybWFuY2Uubm93KCkgKyAnXycgKyBNYXRoLnJhbmRvbSgpO1xuXHR3cy5zZW5kKEpTT04uc3RyaW5naWZ5KFtcblx0XHRjbWQsXG5cdFx0aWQsXG5cdFx0ZGF0YVxuXHRdKSk7XG5cdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0cHJvbWlzZXMuc2V0KGlkLCBbcmVzb2x2ZSwgcmVqZWN0XSk7XG5cdH0pO1xufVxuXG4vLyBDb25uZWN0aW9uIG9wZW5lZFxudmFyIHdzUHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG5cdHdzLmFkZEV2ZW50TGlzdGVuZXIoJ29wZW4nLCBmdW5jdGlvbiBmaXJzdE9wZW4oKSB7XG5cdFx0d3MucmVtb3ZlRXZlbnRMaXN0ZW5lcignb3BlbicsIGZpcnN0T3Blbik7XG5cdFx0cmVzb2x2ZSh3cyk7XG5cdH0pO1xufSk7XG5cbmV4cG9ydCB7XG5cdHdzLFxuXHR3c1Byb21pc2UsXG5cdHJlbW90ZUNtZFxufTsiLCJleHBvcnQgZGVmYXVsdCB7XG5cdGN1cnJlbnRseU9wZW5QYXRoOiBudWxsIC8vIG51bGwgb3Igc3RyaW5nXG59OyIsIi8qIGdsb2JhbCByZXF1aXJlLCBNYXAsIFNldCwgUHJvbWlzZSAqL1xuLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuLyogZXNsaW50LWVudiBlczYgKi9cblxuaW1wb3J0IHsgcmVtb3RlQ21kIH0gZnJvbSAnLi93cyc7XG5pbXBvcnQgeyByZW5kZXJGaWxlTGlzdCB9IGZyb20gJy4vZmlsZXMnO1xuaW1wb3J0IHN0YXRlIGZyb20gJy4vc3RhdGUnO1xuaW1wb3J0IHsgdXBkYXRlREJEb2MgfSBmcm9tICcuL2RiJztcblxuZnVuY3Rpb24gc2F2ZU9wZW5UYWIoKSB7XG5cdHZhciB0YWIgPSB0YWJDb250cm9sbGVyLmdldE9wZW5UYWIoKTtcblx0dmFyIGRhdGE7XG5cdGlmICh0YWIpIHtcblx0XHRkYXRhID0gdGFiLmRhdGE7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdHJlbW90ZUNtZCgnU0FWRScsIHtcblx0XHRwYXRoOiBkYXRhLnBhdGgsXG5cdFx0Y29udGVudDogdGFiLmVkaXRvci5nZXRWYWx1ZSgpXG5cdH0pO1xufVxuXG5mdW5jdGlvbiBjbG9zZU9wZW5UYWIoKSB7XG5cdHZhciB0YWIgPSB0YWJDb250cm9sbGVyLmdldE9wZW5UYWIoKTtcblx0dmFyIGRhdGE7XG5cdGlmICh0YWIpIHtcblx0XHRkYXRhID0gdGFiLmRhdGE7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGNvbnNvbGUubG9nKGRhdGEpO1xufVxuXG5cbnZhciB0YWJDb250cm9sbGVyID0gKGZ1bmN0aW9uIHNldFVwVGFicygpIHtcblx0dmFyIGN1cnJlbnRseU9wZW5GaWxlc0VsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2N1cnJlbnRseS1vcGVuLWZpbGVzJyk7XG5cdHZhciBjb250YWluZXJFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb250YWluZXInKTtcblx0dmFyIHRhYnNFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN0YWJzJyk7XG5cblx0ZnVuY3Rpb24gVGFiKGRhdGEpIHtcblx0XHR0aGlzLmRhdGEgPSBkYXRhO1xuXHRcdHRoaXMuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0dGhpcy5lbC5jbGFzc0xpc3QuYWRkKCd0YWInKTtcblx0XHR0aGlzLmVsLmNsYXNzTGlzdC5hZGQoJ2hhcy1pY29uJyk7XG5cdFx0dGhpcy5lbC5kYXRhc2V0Lm1pbWUgPSBkYXRhLm1pbWU7XG5cdFx0dGhpcy5lbC5kYXRhc2V0Lm5hbWUgPSBkYXRhLm5hbWU7XG5cdFx0dGhpcy5lbC5kYXRhc2V0LnNpemUgPSBkYXRhLnNpemU7XG5cdFx0dGhpcy5lbC50ZXh0Q29udGVudCA9IGRhdGEubmFtZTtcblx0XHR0aGlzLmVsLnRhYkluZGV4ID0gMTtcblx0XHR0YWJzRWwuYXBwZW5kQ2hpbGQodGhpcy5lbCk7XG5cblx0XHR0aGlzLmVsLndlYkNvZGVUYWIgPSB0aGlzO1xuXG5cdFx0dGhpcy5jb250ZW50RWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLmNvbnRlbnRFbC5jbGFzc0xpc3QuYWRkKCd0YWItY29udGVudCcpO1xuXHRcdGNvbnRhaW5lckVsLmFwcGVuZENoaWxkKHRoaXMuY29udGVudEVsKTtcblx0fVxuXG5cdFRhYi5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLmVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5lbCk7XG5cdFx0dGhpcy5jb250ZW50RWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmNvbnRlbnRFbCk7XG5cdH1cblxuXHRmdW5jdGlvbiBUYWJDb250cm9sbGVyKCkge1xuXHRcdHRoaXMuY3VycmVudGx5T3BlbkZpbGVzTWFwID0gbmV3IE1hcCgpO1xuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUuaGFzVGFiID0gZnVuY3Rpb24gKGRhdGEpIHtcblx0XHRyZXR1cm4gdGhpcy5jdXJyZW50bHlPcGVuRmlsZXNNYXAuaGFzKGRhdGEpO1xuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUuZ2V0T3BlblRhYiA9IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGhpcy5mb2N1c2VkVGFiO1xuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUubmV3VGFiID0gZnVuY3Rpb24gKGRhdGEpIHtcblx0XHR2YXIgdGFiID0gbmV3IFRhYihkYXRhKTtcblx0XHR0aGlzLmN1cnJlbnRseU9wZW5GaWxlc01hcC5zZXQoZGF0YSwgdGFiKTtcblx0XHRyZW5kZXJGaWxlTGlzdChjdXJyZW50bHlPcGVuRmlsZXNFbCwgeyBjaGlsZHJlbjogQXJyYXkuZnJvbSh0aGlzLmN1cnJlbnRseU9wZW5GaWxlc01hcC5rZXlzKCkpIH0pO1xuXHRcdHRoaXMuZm9jdXNUYWIodGFiKTtcblx0XHR0aGlzLnN0b3JlT3BlblRhYnMoKTtcblx0XHRyZXR1cm4gdGFiO1xuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUuZm9jdXNUYWIgPSBmdW5jdGlvbiAoZGF0YSkge1xuXHRcdHZhciBmb2N1c2VkVGFiID0gZGF0YS5jb25zdHJ1Y3RvciA9PT0gVGFiID8gZGF0YSA6IHRoaXMuY3VycmVudGx5T3BlbkZpbGVzTWFwLmdldChkYXRhKTtcblx0XHR0aGlzLmZvY3VzZWRUYWIgPSBmb2N1c2VkVGFiO1xuXHRcdEFycmF5LmZyb20odGhpcy5jdXJyZW50bHlPcGVuRmlsZXNNYXAudmFsdWVzKCkpLmZvckVhY2goZnVuY3Rpb24gKHRhYikge1xuXHRcdFx0dGFiLmNvbnRlbnRFbC5jbGFzc0xpc3QudG9nZ2xlKCdoYXMtZm9jdXMnLCB0YWIgPT09IGZvY3VzZWRUYWIpO1xuXHRcdFx0dGFiLmVsLmNsYXNzTGlzdC50b2dnbGUoJ2hhcy1mb2N1cycsIHRhYiA9PT0gZm9jdXNlZFRhYik7XG5cdFx0fSk7XG5cdFx0aWYgKGZvY3VzZWRUYWIuZWRpdG9yKSBmb2N1c2VkVGFiLmVkaXRvci5sYXlvdXQoKTtcblx0fVxuXG5cdFRhYkNvbnRyb2xsZXIucHJvdG90eXBlLnN0b3JlT3BlblRhYnMgPSBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKCFzdGF0ZS5jdXJyZW50bHlPcGVuZWRQYXRoKSByZXR1cm47XG5cdFx0dXBkYXRlREJEb2MoJ09QRU5fVEFCU19GT1JfJyArIHN0YXRlLmN1cnJlbnRseU9wZW5lZFBhdGgsIHtcblx0XHRcdG9wZW5fdGFiczogQXJyYXkuZnJvbSh0aGlzLmN1cnJlbnRseU9wZW5GaWxlc01hcC5rZXlzKCkpXG5cdFx0fSlcblx0XHQuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coZXJyKTtcblx0XHR9KTtcblx0fVxuXG5cdHZhciB0YWJDb250cm9sbGVyID0gbmV3IFRhYkNvbnRyb2xsZXIoKTtcblxuXHR0YWJzRWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoZSkge1xuXHRcdGlmIChlLnRhcmdldC5tYXRjaGVzKCcudGFiJykpIHtcblx0XHRcdHRhYkNvbnRyb2xsZXIuZm9jdXNUYWIoZS50YXJnZXQud2ViQ29kZVRhYik7XG5cdFx0fVxuXHR9KTtcblxuXHRjdXJyZW50bHlPcGVuRmlsZXNFbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uIChlKSB7XG5cdFx0aWYgKGUudGFyZ2V0LmRhdGEpIHtcblx0XHRcdHRhYkNvbnRyb2xsZXIuZm9jdXNUYWIoZS50YXJnZXQuZGF0YSk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZXR1cm4gdGFiQ29udHJvbGxlcjtcbn0oKSk7XG5cbmV4cG9ydCB7XG5cdHNhdmVPcGVuVGFiLFxuXHRjbG9zZU9wZW5UYWIsXG5cdHRhYkNvbnRyb2xsZXJcbn07IiwiLyogZ2xvYmFsIHJlcXVpcmUsIG1vbmFjbywgTWFwLCBTZXQsIFByb21pc2UgKi9cbi8qIGVzbGludCBuby12YXI6IDAsIG5vLWNvbnNvbGU6IDAgKi9cbi8qIGVzbGludC1lbnYgZXM2ICovXG5cbmltcG9ydCB7IHNhdmVPcGVuVGFiLCBjbG9zZU9wZW5UYWIgfSBmcm9tICcuL3RhYi1jb250cm9sbGVyJztcbmltcG9ydCB7IHByb21wdEZvck9wZW4gfSBmcm9tICcuL2ZpbGVzJztcblxucmVxdWlyZS5jb25maWcoeyBwYXRoczogeyAndnMnOiAndnMnIH0gfSk7XG5cbnZhciBtb25hY29Qcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcblx0cmVxdWlyZShbJ3ZzL2VkaXRvci9lZGl0b3IubWFpbiddLCByZXNvbHZlKTtcbn0pO1xuXG5mdW5jdGlvbiBnZXRNb25hY29MYW5ndWFnZUZyb21NaW1lcyhtaW1lKSB7XG5cdHJldHVybiAobW9uYWNvLmxhbmd1YWdlcy5nZXRMYW5ndWFnZXMoKS5maWx0ZXIoZnVuY3Rpb24gKGxhbmd1YWdlT2JqKSB7XG5cdFx0cmV0dXJuIGxhbmd1YWdlT2JqLm1pbWV0eXBlcyAmJiBsYW5ndWFnZU9iai5taW1ldHlwZXMuaW5jbHVkZXMobWltZSk7XG5cdH0pWzBdIHx8IHt9KVsnaWQnXTtcbn1cblxuZnVuY3Rpb24gZ2V0TW9uYWNvTGFuZ3VhZ2VGcm9tRXh0ZW5zaW9ucyhleHRlbnNpb24pIHtcblx0cmV0dXJuIChtb25hY28ubGFuZ3VhZ2VzLmdldExhbmd1YWdlcygpLmZpbHRlcihmdW5jdGlvbiAobGFuZ3VhZ2VPYmopIHtcblx0XHRyZXR1cm4gbGFuZ3VhZ2VPYmouZXh0ZW5zaW9ucyAmJiBsYW5ndWFnZU9iai5leHRlbnNpb25zLmluY2x1ZGVzKGV4dGVuc2lvbik7XG5cdH0pWzBdIHx8IHt9KVsnaWQnXTtcbn1cblxuZnVuY3Rpb24gYWRkS2V5QmluZGluZ3MoZWRpdG9yKSB7XG5cdGVkaXRvci5hZGRDb21tYW5kKG1vbmFjby5LZXlNb2QuQ3RybENtZCB8IG1vbmFjby5LZXlDb2RlLktFWV9TLCBzYXZlT3BlblRhYik7XG5cdGVkaXRvci5hZGRDb21tYW5kKG1vbmFjby5LZXlNb2QuQ3RybENtZCB8IG1vbmFjby5LZXlDb2RlLktFWV9PLCBwcm9tcHRGb3JPcGVuKTtcblx0ZWRpdG9yLmFkZENvbW1hbmQobW9uYWNvLktleUNvZGUuS0VZX1cgfCBtb25hY28uS2V5TW9kLkN0cmxDbWQsIGNsb3NlT3BlblRhYik7XG5cdGVkaXRvci5hZGRDb21tYW5kKG1vbmFjby5LZXlDb2RlLktFWV9QIHwgbW9uYWNvLktleU1vZC5TaGlmdCB8IG1vbmFjby5LZXlNb2QuQ3RybENtZCwgZnVuY3Rpb24gb3BlbkNvbW1hbmRQYWxldHRlKCkge1xuXHRcdGVkaXRvci50cmlnZ2VyKCdhbnlTdHJpbmcnLCAnZWRpdG9yLmFjdGlvbi5xdWlja0NvbW1hbmQnKTtcblx0fSk7XG59XG5cbmV4cG9ydCB7IG1vbmFjb1Byb21pc2UsIGdldE1vbmFjb0xhbmd1YWdlRnJvbUV4dGVuc2lvbnMsIGdldE1vbmFjb0xhbmd1YWdlRnJvbU1pbWVzLCBhZGRLZXlCaW5kaW5ncyB9O1xuIiwiLyogZ2xvYmFsIHJlcXVpcmUsIE1hcCwgU2V0LCBQcm9taXNlICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG5pbXBvcnQgeyBwb3B1bGF0ZUZpbGVMaXN0IH0gZnJvbSAnLi9maWxlcyc7XG5cbnZhciBoaWdobGlnaHRlZEVsO1xudmFyIGN1cnJlbnRQYXRoO1xudmFyIHJlc29sdmVyO1xudmFyIHJlamVjdGVyO1xuXG5mdW5jdGlvbiBvcGVuRmlsZURpYWxvZyhwYXRoKSB7XG5cblx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0XHRpZiAob3BlbkZpbGVEaWFsb2cub3BlbiA9PT0gdW5kZWZpbmVkKSBvcGVuRmlsZURpYWxvZy5vcGVuID0gZmFsc2U7XG5cdFx0aWYgKG9wZW5GaWxlRGlhbG9nLm9wZW4gPT09IHRydWUpIHtcblx0XHRcdHRocm93IEVycm9yKCdEaWFsb2cgYWxyZWFkeSBvcGVuIGZvciBhbm90aGVyIHRhc2suJyk7XG5cdFx0fVxuXHRcdHBhdGggPSBwYXRoIHx8ICcvJztcblx0XHRjdXJyZW50UGF0aCA9IHBhdGg7XG5cdFx0b3BlbkZpbGVEaWFsb2cuZWwuY2xhc3NMaXN0LnJlbW92ZSgnY2xvc2VkJyk7XG5cdFx0cmVzb2x2ZXIgPSByZXNvbHZlO1xuXHRcdHJlamVjdGVyID0gcmVqZWN0O1xuXHRcdG9wZW5GaWxlRGlhbG9nLmN1cnJlbnRQYXRoRWwudmFsdWUgPSBjdXJyZW50UGF0aDtcblxuXHRcdHBvcHVsYXRlRmlsZUxpc3Qob3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0LCBwYXRoLCB7XG5cdFx0XHRuZXN0ZWQ6IGZhbHNlXG5cdFx0fSlcblx0XHRcdC5jYXRjaChmdW5jdGlvbiAoZSkge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhlKTtcblx0XHRcdFx0cmV0dXJuIHBvcHVsYXRlRmlsZUxpc3Qob3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0LCAnLycsIHtcblx0XHRcdG5lc3RlZDogZmFsc2Vcblx0XHR9KVxuXHRcdFx0fSk7XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBoaWdobGlnaHQoZSkge1xuXHRpZiAoZS50YXJnZXQudGFnTmFtZSA9PT0gJ0xJJykge1xuXHRcdGlmIChoaWdobGlnaHRlZEVsKSB7XG5cdFx0XHRoaWdobGlnaHRlZEVsLmNsYXNzTGlzdC5yZW1vdmUoJ2hhcy1oaWdobGlnaHQnKTtcblx0XHR9XG5cdFx0aGlnaGxpZ2h0ZWRFbCA9IGUudGFyZ2V0O1xuXHRcdGhpZ2hsaWdodGVkRWwuY2xhc3NMaXN0LmFkZCgnaGFzLWhpZ2hsaWdodCcpO1xuXG5cdFx0Y3VycmVudFBhdGggPSBlLnRhcmdldC5kYXRhLnBhdGg7XG5cdFx0b3BlbkZpbGVEaWFsb2cuY3VycmVudFBhdGhFbC52YWx1ZSA9IGN1cnJlbnRQYXRoO1xuXG5cdFx0aWYgKGUudGFyZ2V0LmRhdGEgJiYgZS50YXJnZXQuZGF0YS5pc0Rpcikge1xuXHRcdFx0aWYgKGUuY3VycmVudFRhcmdldCA9PT0gb3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0KSB7XG5cdFx0XHRcdGlmIChlLnRhcmdldC5kYXRhLm5hbWUgPT09ICcuLicpIHtcblx0XHRcdFx0XHRwb3B1bGF0ZUZpbGVMaXN0KG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdCwgZS50YXJnZXQuZGF0YS5wYXRoLCB7XG5cdFx0XHRcdFx0XHRuZXN0ZWQ6IGZhbHNlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0b3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RSaWdodC5pbm5lckhUTUwgPSAnJztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwb3B1bGF0ZUZpbGVMaXN0KG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0UmlnaHQsIGUudGFyZ2V0LmRhdGEucGF0aCwge1xuXHRcdFx0XHRcdFx0bmVzdGVkOiBmYWxzZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoZS5jdXJyZW50VGFyZ2V0ID09PSBvcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0KSB7XG5cdFx0XHRcdHBvcHVsYXRlRmlsZUxpc3Qob3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0LCBlLnRhcmdldC5kYXRhLmRpck5hbWUsIHtcblx0XHRcdFx0XHRuZXN0ZWQ6IGZhbHNlXG5cdFx0XHRcdH0pXG5cdFx0XHRcdFx0LnRoZW4oZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0W10uc2xpY2UuY2FsbChvcGVuRmlsZURpYWxvZy5maWxlbGlzdExlZnQuY2hpbGRyZW4pLmZvckVhY2goZnVuY3Rpb24gKGVsKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChlbC5kYXRhLnBhdGggPT09IGN1cnJlbnRQYXRoKSB7XG5cdFx0XHRcdFx0XHRcdFx0aGlnaGxpZ2h0ZWRFbCA9IGUudGFyZ2V0O1xuXHRcdFx0XHRcdFx0XHRcdGhpZ2hsaWdodGVkRWwuY2xhc3NMaXN0LmFkZCgnaGFzLWhpZ2hsaWdodCcpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0cG9wdWxhdGVGaWxlTGlzdChvcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0LCBlLnRhcmdldC5kYXRhLnBhdGgsIHtcblx0XHRcdFx0XHRuZXN0ZWQ6IGZhbHNlXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiBvbmRibGNsaWNrKGUpIHtcblx0aGlnaGxpZ2h0KGUpO1xuXHRpZiAoZS50YXJnZXQuZGF0YSAmJiBlLnRhcmdldC5kYXRhLmlzRGlyKSByZXR1cm47XG5cdG9wZW4oZS50YXJnZXQuZGF0YSk7XG59XG5cbmZ1bmN0aW9uIG9wZW4oZGF0YSkge1xuXHRvcGVuRmlsZURpYWxvZy5lbC5jbGFzc0xpc3QuYWRkKCdjbG9zZWQnKTtcblx0cmVzb2x2ZXIoZGF0YSk7XG5cdHJlc29sdmVyID0gdW5kZWZpbmVkO1xuXHRyZWplY3RlciA9IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gY2FuY2VsKCkge1xuXHRvcGVuRmlsZURpYWxvZy5lbC5jbGFzc0xpc3QuYWRkKCdjbG9zZWQnKTtcblx0cmVqZWN0ZXIoJ1VzZXIgY2FuY2VsZWQnKTtcblx0cmVzb2x2ZXIgPSB1bmRlZmluZWQ7XG5cdHJlamVjdGVyID0gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBvbmtleWRvd24oZSkge1xuXHRpZiAoZXZlbnQua2V5Q29kZSA9PT0gMTMpIG9uZGJsY2xpY2soZSk7XG59XG5cbm9wZW5GaWxlRGlhbG9nLmVsID0gb3BlbkZpbGVEaWFsb2cuZWwgfHwgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2ZpbGUtb3Blbi13aWRnZXQnKTtcbm9wZW5GaWxlRGlhbG9nLmN1cnJlbnRQYXRoRWwgPSBvcGVuRmlsZURpYWxvZy5jdXJyZW50UGF0aEVsIHx8IG9wZW5GaWxlRGlhbG9nLmVsLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W25hbWU9XCJjdXJyZW50LXBhdGhcIl0nKTtcbm9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdCA9IG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdCB8fCBvcGVuRmlsZURpYWxvZy5lbC5xdWVyeVNlbGVjdG9yKCcuZmlsZWxpc3Q6Zmlyc3QtY2hpbGQnKTtcbm9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0UmlnaHQgPSBvcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0IHx8IG9wZW5GaWxlRGlhbG9nLmVsLnF1ZXJ5U2VsZWN0b3IoJy5maWxlbGlzdDpub3QoOmZpcnN0LWNoaWxkKScpO1xub3BlbkZpbGVEaWFsb2cub3BlbkJ1dHRvbiA9IG9wZW5GaWxlRGlhbG9nLm9wZW5CdXR0b24gfHwgb3BlbkZpbGVEaWFsb2cuZWwucXVlcnlTZWxlY3RvcignI2ZpbGUtb3Blbi1vcGVuJyk7XG5vcGVuRmlsZURpYWxvZy5jYW5jZWxCdXR0b24gPSBvcGVuRmlsZURpYWxvZy5jYW5jZWxCdXR0b24gfHwgb3BlbkZpbGVEaWFsb2cuZWwucXVlcnlTZWxlY3RvcignI2ZpbGUtb3Blbi1jYW5jZWwnKTtcbm9wZW5GaWxlRGlhbG9nLnVwRGlyQnV0dG9uID0gb3BlbkZpbGVEaWFsb2cudXBEaXJCdXR0b24gfHwgb3BlbkZpbGVEaWFsb2cuZWwucXVlcnlTZWxlY3RvcignYnV0dG9uW2RhdGEtYWN0aW9uPVwidXAtZGlyXCJdJyk7XG5cbm9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGhpZ2hsaWdodCk7XG5vcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgaGlnaGxpZ2h0KTtcblxub3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBvbmtleWRvd24pO1xub3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RSaWdodC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgb25rZXlkb3duKTtcblxub3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0LmFkZEV2ZW50TGlzdGVuZXIoJ2RibGNsaWNrJywgb25kYmxjbGljayk7XG5vcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0LmFkZEV2ZW50TGlzdGVuZXIoJ2RibGNsaWNrJywgb25kYmxjbGljayk7XG5vcGVuRmlsZURpYWxvZy5vcGVuQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuXHRvcGVuKGhpZ2hsaWdodGVkRWwuZGF0YSk7XG59KTtcbm9wZW5GaWxlRGlhbG9nLmNhbmNlbEJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcblx0Y2FuY2VsKCk7XG59KTtcbm9wZW5GaWxlRGlhbG9nLnVwRGlyQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuXHRjb25zb2xlLmxvZygnU1RVQiBHTyBVUCBESVInKTtcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBvcGVuRmlsZURpYWxvZzsiLCIvKiBnbG9iYWwgcmVxdWlyZSwgTWFwLCBTZXQsIFByb21pc2UsIG1vbmFjbyAqL1xuLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuLyogZXNsaW50LWVudiBlczYgKi9cblxuaW1wb3J0IHtcblx0cmVtb3RlQ21kXG59IGZyb20gJy4vd3MnO1xuXG5pbXBvcnQgc3RhdGUgZnJvbSAnLi9zdGF0ZSc7XG5pbXBvcnQgeyBkYiwgdXBkYXRlREJEb2MgfSBmcm9tICcuL2RiJztcbmltcG9ydCB7IHRhYkNvbnRyb2xsZXIgfSBmcm9tICcuL3RhYi1jb250cm9sbGVyJztcbmltcG9ydCB7IG1vbmFjb1Byb21pc2UsIGdldE1vbmFjb0xhbmd1YWdlRnJvbUV4dGVuc2lvbnMsIGdldE1vbmFjb0xhbmd1YWdlRnJvbU1pbWVzLCBhZGRLZXlCaW5kaW5ncyB9IGZyb20gJy4vbW9uYWNvJztcbmltcG9ydCBvcGVuRmlsZURpYWxvZyBmcm9tICcuL29wZW4tZmlsZS1kaWFsb2cnO1xuXG4vLyBNYXAgdG8gcHJldmVudCBkdXBsaWNhdGUgZGF0YSBvYmplY3RzIGZvciBlYWNoIGZpbGVcbnZhciBwYXRoVG9EYXRhTWFwID0gbmV3IE1hcCgpO1xuXG5mdW5jdGlvbiByZW5kZXJGaWxlTGlzdChlbCwgZGF0YSwgb3B0aW9ucykge1xuXG5cdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXHR2YXIgdXNlT3B0aW9ucyA9IHtcblx0XHRoaWRlRG90RmlsZXM6IChvcHRpb25zLmhpZGVEb3RGaWxlcyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5oaWRlRG90RmlsZXMgOiB0cnVlKSxcblx0XHRuZXN0ZWQ6IChvcHRpb25zLm5lc3RlZCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5uZXN0ZWQgOiB0cnVlKSxcblx0XHRuZXN0aW5nTGltaXQ6IChvcHRpb25zLm5lc3RpbmdMaW1pdCB8fCA1KSAtIDFcblx0fVxuXHRpZiAob3B0aW9ucy5uZXN0aW5nTGltaXQgPT09IDApIHJldHVybjtcblxuXHRlbC5pbm5lckhUTUwgPSAnJztcblx0dmFyIHNvcnRlZERhdGEgPSBBcnJheS5mcm9tKGRhdGEuY2hpbGRyZW4pXG5cdFx0LmZpbHRlcihmdW5jdGlvbiAoZGF0dW0pIHtcblxuXHRcdFx0Ly8gV2hldGhlciB0byBoaWRlIGRvdGZpbGVzXG5cdFx0XHRpZiAoZGF0dW0ubmFtZSAhPT0gJy4uJyAmJiB1c2VPcHRpb25zLmhpZGVEb3RGaWxlcyAhPT0gZmFsc2UpIHtcblx0XHRcdFx0cmV0dXJuIGRhdHVtLm5hbWVbMF0gIT09ICcuJztcblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0pXG5cdFx0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcblx0XHRcdGlmIChhLm5hbWUgPT09ICcuLicpIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGIubmFtZSA9PT0gJy4uJykge1xuXHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdH1cblx0XHRcdGlmIChcblx0XHRcdFx0KGEuaXNEaXIgPT09IGIuaXNEaXIpICYmXG5cdFx0XHRcdChhLmlzRmlsZSA9PT0gYi5pc0ZpbGUpXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIChbYS5uYW1lLCBiLm5hbWVdLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcblx0XHRcdFx0XHRyZXR1cm4gYS50b0xvd2VyQ2FzZSgpLmxvY2FsZUNvbXBhcmUoYi50b0xvd2VyQ2FzZSgpKTtcblx0XHRcdFx0fSlbMF0gPT09IGEubmFtZSA/IC0xIDogMSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoYS5pc0RpcikgcmV0dXJuIC0xO1xuXHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHNvcnRlZERhdGEubWFwKGZ1bmN0aW9uIChkYXR1bSkge1xuXHRcdFx0dmFyIGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcblx0XHRcdGxpLmNsYXNzTGlzdC5hZGQoJ2hhcy1pY29uJyk7XG5cdFx0XHRsaS5kYXRhc2V0Lm1pbWUgPSBkYXR1bS5taW1lO1xuXHRcdFx0bGkuZGF0YXNldC5uYW1lID0gZGF0dW0ubmFtZTtcblx0XHRcdGxpLmRhdGFzZXQuc2l6ZSA9IGRhdHVtLnNpemU7XG5cdFx0XHRsaS50ZXh0Q29udGVudCA9IGRhdHVtLm5hbWU7XG5cdFx0XHRsaS50YWJJbmRleCA9IDE7XG5cdFx0XHRsaS5kYXRhID0gZGF0dW07XG5cdFx0XHRlbC5hcHBlbmRDaGlsZChsaSk7XG5cblx0XHRcdGlmIChkYXR1bS5pc0RpciAmJiB1c2VPcHRpb25zLm5lc3RlZCAhPT0gZmFsc2UpIHtcblx0XHRcdFx0dmFyIG5ld0ZpbGVMaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndWwnKTtcblx0XHRcdFx0bmV3RmlsZUxpc3QuY2xhc3NMaXN0LmFkZCgnZmlsZWxpc3QnKTtcblx0XHRcdFx0bGkuYXBwZW5kQ2hpbGQobmV3RmlsZUxpc3QpO1xuXHRcdFx0XHRpZiAoZGF0dW0uY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRyZW5kZXJGaWxlTGlzdChuZXdGaWxlTGlzdCwgZGF0dW0sIHVzZU9wdGlvbnMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG59XG5cbmZ1bmN0aW9uIHBvcHVsYXRlRmlsZUxpc3QoZWwsIHBhdGgsIG9wdGlvbnMpIHtcblx0ZWwucGF0aCA9IHBhdGg7XG5cdHJldHVybiByZW1vdGVDbWQoJ1NUQVQnLCBwYXRoKVxuXHRcdC50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG5cdFx0XHRpZiAoZGF0YS5pc0ZpbGUpIHtcblx0XHRcdFx0cmV0dXJuIHJlbW90ZUNtZCgnU1RBVCcsIGRhdGEuZGlyTmFtZSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZGF0YTtcblx0XHR9KVxuXHRcdC50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG5cdFx0XHRkYXRhID0gZGVkdXAoZGF0YSk7XG5cdFx0XHRyZW5kZXJGaWxlTGlzdChlbCwgZGF0YSwgb3B0aW9ucyk7XG5cdFx0XHRyZXR1cm4gZGF0YTtcblx0XHR9KTtcbn1cblxuXG5mdW5jdGlvbiBkZWR1cChkYXRhKSB7XG5cblx0dmFyIG5ld0NoaWxkcmVuO1xuXHR2YXIgb2xkQ2hpbGRyZW47XG5cblx0Ly8gVGhhdCB3YXkgaWYgYW55IG9mIHRoZXNlIGNoYW5nZSB0aGVuIHRoZSBmaWxlIGlzIHVwZGF0ZWRcblx0dmFyIGtleSA9IEpTT04uc3RyaW5naWZ5KHtcblx0XHRwYXRoOiBkYXRhLnBhdGgsXG5cdFx0aXNEaXI6IGRhdGEuaXNEaXIsXG5cdFx0aXNGaWxlOiBkYXRhLmlzRmlsZSxcblx0XHRtaW1lOiBkYXRhLm1pbWVcblx0fSk7XG5cblx0aWYgKGRhdGEuY2hpbGRyZW4pIG5ld0NoaWxkcmVuID0gZGF0YS5jaGlsZHJlbjtcblxuXHQvLyBlbnN1cmUgdGhhdCBkYXRhIG9iamVjdHMgYXJlIG5vdCBkdXBsaWNhdGVkLlxuXHRpZiAocGF0aFRvRGF0YU1hcC5oYXMoa2V5KSkge1xuXHRcdGRhdGEgPSBwYXRoVG9EYXRhTWFwLmdldChrZXkpO1xuXHRcdG9sZENoaWxkcmVuID0gZGF0YS5jaGlsZHJlbjtcblx0fSBlbHNlIHtcblx0XHRwYXRoVG9EYXRhTWFwLnNldChrZXksIGRhdGEpO1xuXHR9XG5cblx0aWYgKGRhdGEuaXNEaXIpIHtcblxuXHRcdGlmICghb2xkQ2hpbGRyZW4gJiYgIW5ld0NoaWxkcmVuKSB7XG5cdFx0XHQvLyBkbyBub3RoaW5nLCB3ZSBoYXZlIG5vIGNoaWxkcmVuIGFuZCB3ZSBuZWVkIHRvIGFkZCBubyBjaGlsZHJlblxuXHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0fVxuXG5cdFx0aWYgKCFvbGRDaGlsZHJlbiAmJiBuZXdDaGlsZHJlbikge1xuXHRcdFx0Ly8gbm8gU2V0IHByZXNlbnQgdGhlbiBjcmVhdGUgb25lIHRvIGJlIHByZWFyZWQgaW4gdGhlIG5leHQgb25lXG5cdFx0XHRkYXRhLmNoaWxkcmVuID0gbmV3IFNldCgpO1xuXHRcdFx0b2xkQ2hpbGRyZW4gPSBkYXRhLmNoaWxkcmVuO1xuXHRcdH1cblxuXHRcdGlmIChvbGRDaGlsZHJlbiAmJiBuZXdDaGlsZHJlbikge1xuXHRcdFx0Ly8gU2V0IGlzIHByZXNlbnQgc28gcG9wdWxhdGUgaXRcblxuXHRcdFx0bmV3Q2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbiAoY2hpbGREYXRhKSB7XG5cdFx0XHRcdG9sZENoaWxkcmVuLmFkZChkZWR1cChjaGlsZERhdGEpKTtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGRhdGE7XG59XG5cbmZ1bmN0aW9uIG9wZW5QYXRoKGRhdGEpIHtcblx0aWYgKGRhdGEuaXNEaXIpIHtcblxuXHRcdGlmIChzdGF0ZS5jdXJyZW50bHlPcGVuZWRQYXRoICE9PSBkYXRhLnBhdGgpIHtcblx0XHRcdC8vIFRPRE86IGNsb3NlIGFsbCB0YWJzXG5cblx0XHRcdC8vIFRoZW4gb3BlbiB0aGUgc2F2ZWQgdGFicyBmcm9tIGxhc3QgdGltZVxuXHRcdFx0ZGIuZ2V0KCdPUEVOX1RBQlNfRk9SXycgKyBkYXRhLnBhdGgpLnRoZW4oZnVuY3Rpb24gKHRhYnMpIHtcblx0XHRcdFx0dGFicy5vcGVuX3RhYnMuZm9yRWFjaChvcGVuRmlsZSk7XG5cdFx0XHR9KS5jYXRjaChmdW5jdGlvbiAoZSkge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhlKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHN0YXRlLmN1cnJlbnRseU9wZW5lZFBhdGggPSBkYXRhLnBhdGg7XG5cblx0XHR2YXIgZmlsZWxpc3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlyZWN0b3J5Jyk7XG5cdFx0cG9wdWxhdGVGaWxlTGlzdChmaWxlbGlzdCwgZGF0YS5wYXRoLCB7XG5cdFx0XHRoaWRlRG90RmlsZXM6IHRydWVcblx0XHR9KTtcblxuXHRcdHVwZGF0ZURCRG9jKCdJTklUX1NUQVRFJywge1xuXHRcdFx0cHJldmlvdXNfcGF0aDogeyBwYXRoOiBkYXRhLnBhdGgsIGlzRGlyOiB0cnVlIH1cblx0XHR9KVxuXHRcdC5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhlcnIpO1xuXHRcdH0pO1xuXG5cdH1cblx0aWYgKGRhdGEuaXNGaWxlKSB7XG5cdFx0b3BlbkZpbGUoZGF0YSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gb3BlbkZpbGUoZGF0YSkge1xuXG5cdGRhdGEgPSBkZWR1cChkYXRhKTtcblxuXHRpZiAodGFiQ29udHJvbGxlci5oYXNUYWIoZGF0YSkpIHtcblx0XHR0YWJDb250cm9sbGVyLmZvY3VzVGFiKGRhdGEpO1xuXHR9IGVsc2Uge1xuXHRcdHZhciBuZXdUYWIgPSB0YWJDb250cm9sbGVyLm5ld1RhYihkYXRhKTtcblxuXHRcdHJldHVybiBQcm9taXNlLmFsbChbcmVtb3RlQ21kKCdPUEVOJywgZGF0YS5wYXRoKSwgbW9uYWNvUHJvbWlzZV0pXG5cdFx0XHQudGhlbihmdW5jdGlvbiAoYXJyKSB7XG5cdFx0XHRcdHJldHVybiBhcnJbMF07XG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24gKGZpbGVDb250ZW50cykge1xuXHRcdFx0XHR2YXIgbGFuZ3VhZ2UgPSBnZXRNb25hY29MYW5ndWFnZUZyb21NaW1lcyhkYXRhLm1pbWUpIHx8IGdldE1vbmFjb0xhbmd1YWdlRnJvbUV4dGVuc2lvbnMoZGF0YS5leHRlbnNpb24pO1xuXHRcdFx0XHRuZXdUYWIuZWRpdG9yID0gbW9uYWNvLmVkaXRvci5jcmVhdGUobmV3VGFiLmNvbnRlbnRFbCwge1xuXHRcdFx0XHRcdHZhbHVlOiBmaWxlQ29udGVudHMsXG5cdFx0XHRcdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhZGRLZXlCaW5kaW5ncyhuZXdUYWIuZWRpdG9yKTtcblx0XHRcdH0pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHByb21wdEZvck9wZW4oKSB7XG5cdG9wZW5GaWxlRGlhbG9nKHN0YXRlLmN1cnJlbnRseU9wZW5lZFBhdGggfHwgJy8nKS50aGVuKG9wZW5QYXRoKTtcbn1cblxuZXhwb3J0IHtcblx0ZGVkdXAsXG5cdHBvcHVsYXRlRmlsZUxpc3QsXG5cdHJlbmRlckZpbGVMaXN0LFxuXHRvcGVuRmlsZSxcblx0b3BlblBhdGgsXG5cdHByb21wdEZvck9wZW5cbn07IiwiLyogZ2xvYmFsIHJlcXVpcmUsIE1hcCwgU2V0LCBQcm9taXNlICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG5pbXBvcnQgeyBwb3B1bGF0ZUZpbGVMaXN0LCBvcGVuRmlsZSB9IGZyb20gJy4vZmlsZXMnO1xuXG5mdW5jdGlvbiBzZXRVcFNpZGVCYXIoKSB7XG5cblx0ZnVuY3Rpb24gZXhwYW5kRGlyKGVsLCBkYXRhKSB7XG5cdFx0dmFyIGZpbGVsaXN0RWwgPSBlbC5xdWVyeVNlbGVjdG9yKCcuZmlsZWxpc3QnKTtcblx0XHRpZiAoZmlsZWxpc3RFbC5jaGlsZHJlbi5sZW5ndGgpIHtcblx0XHRcdGZpbGVsaXN0RWwuaW5uZXJIVE1MID0gJyc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHBvcHVsYXRlRmlsZUxpc3QoZmlsZWxpc3RFbCwgZGF0YS5wYXRoLCB7XG5cdFx0XHRcdGhpZGVEb3RGaWxlczogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0dmFyIGRpcmVjdG9yeUVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2RpcmVjdG9yeScpO1xuXG5cdGZ1bmN0aW9uIG9uY2xpY2soZSkge1xuXHRcdGlmIChlLnRhcmdldC50YWdOYW1lID09PSAnTEknKSB7XG5cdFx0XHRpZiAoZS50YXJnZXQuZGF0YS5pc0ZpbGUpIG9wZW5GaWxlKGUudGFyZ2V0LmRhdGEpO1xuXHRcdFx0aWYgKGUudGFyZ2V0LmRhdGEuaXNEaXIpIGV4cGFuZERpcihlLnRhcmdldCwgZS50YXJnZXQuZGF0YSk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gb25rZXlkb3duKGUpIHtcblx0XHRpZiAoZXZlbnQua2V5Q29kZSA9PT0gMTMpIG9uY2xpY2soZSk7XG5cdH1cblxuXHRkaXJlY3RvcnlFbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIG9uY2xpY2spO1xuXHRkaXJlY3RvcnlFbC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgb25rZXlkb3duKTtcblxufTtcblxuZXhwb3J0IHsgc2V0VXBTaWRlQmFyIH07IiwiLyogZ2xvYmFsIHJlcXVpcmUsIE1hcCwgU2V0LCBQcm9taXNlICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG5pbXBvcnQgeyBkYiB9IGZyb20gJy4vbGliL2RiJztcbmltcG9ydCB7IHdzUHJvbWlzZSB9IGZyb20gJy4vbGliL3dzJztcbmltcG9ydCB7IG9wZW5QYXRoLCBwcm9tcHRGb3JPcGVuIH0gZnJvbSAnLi9saWIvZmlsZXMnO1xuaW1wb3J0IHsgc2F2ZU9wZW5UYWIgfSBmcm9tICcuL2xpYi90YWItY29udHJvbGxlcic7XG5pbXBvcnQgeyBzZXRVcFNpZGVCYXIgfSBmcm9tICcuL2xpYi9zaWRlLWJhcic7XG5cbmZ1bmN0aW9uIGluaXQoKSB7XG5cblx0ZGIuZ2V0KCdJTklUX1NUQVRFJylcblx0XHQudGhlbihmdW5jdGlvbiAoZG9jKSB7XG5cdFx0XHRpZiAoZG9jLnByZXZpb3VzX3BhdGgpIHtcblx0XHRcdFx0cmV0dXJuIG9wZW5QYXRoKGRvYy5wcmV2aW91c19wYXRoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBwcm9tcHRGb3JPcGVuKCk7XG5cdFx0XHR9XG5cdFx0fSlcblx0XHQuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuXHRcdFx0cHJvbXB0Rm9yT3BlbigpO1xuXHRcdFx0Y29uc29sZS5sb2coZXJyKTtcblx0XHR9KTtcbn1cblxud3NQcm9taXNlLnRoZW4oaW5pdCk7XG5cbihmdW5jdGlvbiBzZXRVcFRvb2xCYXIoKSB7XG5cdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbltkYXRhLWFjdGlvbj1cIm9wZW4tZmlsZVwiXScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgcHJvbXB0Rm9yT3Blbik7XG5cdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbltkYXRhLWFjdGlvbj1cInNhdmUtZmlsZVwiXScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgc2F2ZU9wZW5UYWIp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
