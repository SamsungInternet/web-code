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
	if (tab && tab.editor) {
		data = tab.data;
	} else {
		return;
	}
	var altId = tab.editor.model.getAlternativeVersionId();
	remoteCmd('SAVE', {
		path: data.path,
		content: tab.editor.getValue()
	}).then(function () {
		tab.editor.webCodeState.savedAlternativeVersionId = altId;
		tab.editor.webCodeState.functions.checkForChanges();
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
		this.el = document.createElement('a');
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

		this.closeEl = document.createElement('button');
		this.closeEl.classList.add('tab_close');
		this.el.appendChild(this.closeEl);
		this.closeEl.tabIndex = 1;

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

function addBindings(editor, tab) {
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, saveOpenTab);
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_O, promptForOpen);
	editor.addCommand(monaco.KeyCode.KEY_W | monaco.KeyMod.CtrlCmd, closeOpenTab);
	editor.addCommand(monaco.KeyCode.KEY_P | monaco.KeyMod.Shift | monaco.KeyMod.CtrlCmd, function openCommandPalette() {
		editor.trigger('anyString', 'editor.action.quickCommand');
	});

	editor.webCodeState = {};
	editor.webCodeState.savedAlternativeVersionId = editor.model.getAlternativeVersionId();
	editor.webCodeState.tab = tab;

	editor.webCodeState.functions = {
		checkForChanges: function checkForChanges() {
			var hasChanges = editor.webCodeState.savedAlternativeVersionId !== editor.model.getAlternativeVersionId();
			editor.webCodeState.hasChanges = hasChanges;
			tab.el.classList.toggle('has-changes', hasChanges);
		}
	};

	editor.onDidChangeModelContent(editor.webCodeState.functions.checkForChanges);


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
	el.data = data;

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
				addBindings(newTab.editor, newTab);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyJsaWIvZGIuanMiLCJsaWIvd3MuanMiLCJsaWIvc3RhdGUuanMiLCJsaWIvdGFiLWNvbnRyb2xsZXIuanMiLCJsaWIvbW9uYWNvLmpzIiwibGliL29wZW4tZmlsZS1kaWFsb2cuanMiLCJsaWIvZmlsZXMuanMiLCJsaWIvc2lkZS1iYXIuanMiLCJtYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCByZXF1aXJlLCBQcm9taXNlLCBQb3VjaERCICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG52YXIgZGIgPSBuZXcgUG91Y2hEQignd2ViLWNvZGUnLCB7fSk7XG5mdW5jdGlvbiB1cGRhdGVEQkRvYyhfaWQsIG9iaikge1xuXG5cdHVwZGF0ZURCRG9jLnByb21pc2UgPSB1cGRhdGVEQkRvYy5wcm9taXNlIHx8IFByb21pc2UucmVzb2x2ZSgpO1xuXG5cdC8qIHVwZGF0ZSBsYXN0IG9wZW4gZm9sZGVyIGluIGRiICovXG5cdHJldHVybiB1cGRhdGVEQkRvYy5wcm9taXNlID0gdXBkYXRlREJEb2MucHJvbWlzZVxuXHRcdC50aGVuKGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiBkYi5nZXQoX2lkKVxuXHRcdH0pXG5cdFx0LmNhdGNoKGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRpZiAoZS5zdGF0dXMgPT09IDQwNCkge1xuXHRcdFx0XHRyZXR1cm4geyBfaWQ6IF9pZCB9XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH0pXG5cdFx0LnRoZW4oZnVuY3Rpb24gKGRvYykge1xuXHRcdFx0T2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdFx0ZG9jW2tleV0gPSBvYmpba2V5XTtcblx0XHRcdH0pO1xuXHRcdFx0ZGIucHV0KGRvYyk7XG5cdFx0fSk7XG59XG5cbmV4cG9ydCB7IGRiLCB1cGRhdGVEQkRvYyB9OyIsIi8qIGdsb2JhbCByZXF1aXJlLCBNYXAsIFNldCwgUHJvbWlzZSAqL1xuLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuLyogZXNsaW50LWVudiBlczYgKi9cblxudmFyIHdzID0gbmV3IFdlYlNvY2tldCgobG9jYXRpb24uaG9zdG5hbWUgPT09ICdsb2NhbGhvc3QnID8gJ3dzOi8vJyA6ICd3c3M6Ly8nKSArIGxvY2F0aW9uLmhvc3QpO1xud3MuYmluYXJ5VHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cbnZhciBwcm9taXNlcyA9IG5ldyBNYXAoKTtcblxud3MuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIG0oZSkge1xuXHRpZiAodHlwZW9mIGUuZGF0YSA9PT0gJ3N0cmluZycpIHtcblx0XHR2YXIgcmVzdWx0ID0gSlNPTi5wYXJzZShlLmRhdGEpO1xuXHRcdHZhciBwcm9taXNlUmVzb2x2ZXIgPSBwcm9taXNlcy5nZXQocmVzdWx0WzFdKTtcblx0XHR2YXIgZGF0YSA9IHJlc3VsdFsyXTtcblx0XHRpZiAocHJvbWlzZVJlc29sdmVyKSB7XG5cdFx0XHRwcm9taXNlcy5kZWxldGUocmVzdWx0WzFdKTtcblxuXHRcdFx0aWYgKGRhdGEuZXJyb3IpIHtcblx0XHRcdFx0cmV0dXJuIHByb21pc2VSZXNvbHZlclsxXShFcnJvcihkYXRhLmVycm9yKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gcHJvbWlzZVJlc29sdmVyWzBdKGRhdGEpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbmZ1bmN0aW9uIHJlbW90ZUNtZChjbWQsIGRhdGEpIHtcblx0dmFyIGlkID0gcGVyZm9ybWFuY2Uubm93KCkgKyAnXycgKyBNYXRoLnJhbmRvbSgpO1xuXHR3cy5zZW5kKEpTT04uc3RyaW5naWZ5KFtcblx0XHRjbWQsXG5cdFx0aWQsXG5cdFx0ZGF0YVxuXHRdKSk7XG5cdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0cHJvbWlzZXMuc2V0KGlkLCBbcmVzb2x2ZSwgcmVqZWN0XSk7XG5cdH0pO1xufVxuXG4vLyBDb25uZWN0aW9uIG9wZW5lZFxudmFyIHdzUHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG5cdHdzLmFkZEV2ZW50TGlzdGVuZXIoJ29wZW4nLCBmdW5jdGlvbiBmaXJzdE9wZW4oKSB7XG5cdFx0d3MucmVtb3ZlRXZlbnRMaXN0ZW5lcignb3BlbicsIGZpcnN0T3Blbik7XG5cdFx0cmVzb2x2ZSh3cyk7XG5cdH0pO1xufSk7XG5cbmV4cG9ydCB7XG5cdHdzLFxuXHR3c1Byb21pc2UsXG5cdHJlbW90ZUNtZFxufTsiLCJleHBvcnQgZGVmYXVsdCB7XG5cdGN1cnJlbnRseU9wZW5QYXRoOiBudWxsIC8vIG51bGwgb3Igc3RyaW5nXG59OyIsIi8qIGdsb2JhbCByZXF1aXJlLCBNYXAsIFNldCwgUHJvbWlzZSAqL1xuLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuLyogZXNsaW50LWVudiBlczYgKi9cblxuaW1wb3J0IHsgcmVtb3RlQ21kIH0gZnJvbSAnLi93cyc7XG5pbXBvcnQgeyByZW5kZXJGaWxlTGlzdCB9IGZyb20gJy4vZmlsZXMnO1xuaW1wb3J0IHN0YXRlIGZyb20gJy4vc3RhdGUnO1xuaW1wb3J0IHsgdXBkYXRlREJEb2MgfSBmcm9tICcuL2RiJztcblxuZnVuY3Rpb24gc2F2ZU9wZW5UYWIoKSB7XG5cdHZhciB0YWIgPSB0YWJDb250cm9sbGVyLmdldE9wZW5UYWIoKTtcblx0dmFyIGRhdGE7XG5cdGlmICh0YWIgJiYgdGFiLmVkaXRvcikge1xuXHRcdGRhdGEgPSB0YWIuZGF0YTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm47XG5cdH1cblx0dmFyIGFsdElkID0gdGFiLmVkaXRvci5tb2RlbC5nZXRBbHRlcm5hdGl2ZVZlcnNpb25JZCgpO1xuXHRyZW1vdGVDbWQoJ1NBVkUnLCB7XG5cdFx0cGF0aDogZGF0YS5wYXRoLFxuXHRcdGNvbnRlbnQ6IHRhYi5lZGl0b3IuZ2V0VmFsdWUoKVxuXHR9KS50aGVuKGZ1bmN0aW9uICgpIHtcblx0XHR0YWIuZWRpdG9yLndlYkNvZGVTdGF0ZS5zYXZlZEFsdGVybmF0aXZlVmVyc2lvbklkID0gYWx0SWQ7XG5cdFx0dGFiLmVkaXRvci53ZWJDb2RlU3RhdGUuZnVuY3Rpb25zLmNoZWNrRm9yQ2hhbmdlcygpO1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gY2xvc2VPcGVuVGFiKCkge1xuXHR2YXIgdGFiID0gdGFiQ29udHJvbGxlci5nZXRPcGVuVGFiKCk7XG5cdHZhciBkYXRhO1xuXHRpZiAodGFiKSB7XG5cdFx0ZGF0YSA9IHRhYi5kYXRhO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybjtcblx0fVxuXHRjb25zb2xlLmxvZyhkYXRhKTtcbn1cblxuXG52YXIgdGFiQ29udHJvbGxlciA9IChmdW5jdGlvbiBzZXRVcFRhYnMoKSB7XG5cdHZhciBjdXJyZW50bHlPcGVuRmlsZXNFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNjdXJyZW50bHktb3Blbi1maWxlcycpO1xuXHR2YXIgY29udGFpbmVyRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udGFpbmVyJyk7XG5cdHZhciB0YWJzRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdGFicycpO1xuXG5cdGZ1bmN0aW9uIFRhYihkYXRhKSB7XG5cdFx0dGhpcy5kYXRhID0gZGF0YTtcblx0XHR0aGlzLmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuXHRcdHRoaXMuZWwuY2xhc3NMaXN0LmFkZCgndGFiJyk7XG5cdFx0dGhpcy5lbC5jbGFzc0xpc3QuYWRkKCdoYXMtaWNvbicpO1xuXHRcdHRoaXMuZWwuZGF0YXNldC5taW1lID0gZGF0YS5taW1lO1xuXHRcdHRoaXMuZWwuZGF0YXNldC5uYW1lID0gZGF0YS5uYW1lO1xuXHRcdHRoaXMuZWwuZGF0YXNldC5zaXplID0gZGF0YS5zaXplO1xuXHRcdHRoaXMuZWwudGV4dENvbnRlbnQgPSBkYXRhLm5hbWU7XG5cdFx0dGhpcy5lbC50YWJJbmRleCA9IDE7XG5cdFx0dGFic0VsLmFwcGVuZENoaWxkKHRoaXMuZWwpO1xuXG5cdFx0dGhpcy5lbC53ZWJDb2RlVGFiID0gdGhpcztcblxuXHRcdHRoaXMuY29udGVudEVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5jb250ZW50RWwuY2xhc3NMaXN0LmFkZCgndGFiLWNvbnRlbnQnKTtcblx0XHRjb250YWluZXJFbC5hcHBlbmRDaGlsZCh0aGlzLmNvbnRlbnRFbCk7XG5cblx0XHR0aGlzLmNsb3NlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcblx0XHR0aGlzLmNsb3NlRWwuY2xhc3NMaXN0LmFkZCgndGFiX2Nsb3NlJyk7XG5cdFx0dGhpcy5lbC5hcHBlbmRDaGlsZCh0aGlzLmNsb3NlRWwpO1xuXHRcdHRoaXMuY2xvc2VFbC50YWJJbmRleCA9IDE7XG5cblx0fVxuXG5cdFRhYi5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLmVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5lbCk7XG5cdFx0dGhpcy5jb250ZW50RWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmNvbnRlbnRFbCk7XG5cdH1cblxuXHRmdW5jdGlvbiBUYWJDb250cm9sbGVyKCkge1xuXHRcdHRoaXMuY3VycmVudGx5T3BlbkZpbGVzTWFwID0gbmV3IE1hcCgpO1xuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUuaGFzVGFiID0gZnVuY3Rpb24gKGRhdGEpIHtcblx0XHRyZXR1cm4gdGhpcy5jdXJyZW50bHlPcGVuRmlsZXNNYXAuaGFzKGRhdGEpO1xuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUuZ2V0T3BlblRhYiA9IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGhpcy5mb2N1c2VkVGFiO1xuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUubmV3VGFiID0gZnVuY3Rpb24gKGRhdGEpIHtcblx0XHR2YXIgdGFiID0gbmV3IFRhYihkYXRhKTtcblx0XHR0aGlzLmN1cnJlbnRseU9wZW5GaWxlc01hcC5zZXQoZGF0YSwgdGFiKTtcblx0XHRyZW5kZXJGaWxlTGlzdChjdXJyZW50bHlPcGVuRmlsZXNFbCwgeyBjaGlsZHJlbjogQXJyYXkuZnJvbSh0aGlzLmN1cnJlbnRseU9wZW5GaWxlc01hcC5rZXlzKCkpIH0pO1xuXHRcdHRoaXMuZm9jdXNUYWIodGFiKTtcblx0XHR0aGlzLnN0b3JlT3BlblRhYnMoKTtcblx0XHRyZXR1cm4gdGFiO1xuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUuZm9jdXNUYWIgPSBmdW5jdGlvbiAoZGF0YSkge1xuXHRcdHZhciBmb2N1c2VkVGFiID0gZGF0YS5jb25zdHJ1Y3RvciA9PT0gVGFiID8gZGF0YSA6IHRoaXMuY3VycmVudGx5T3BlbkZpbGVzTWFwLmdldChkYXRhKTtcblx0XHR0aGlzLmZvY3VzZWRUYWIgPSBmb2N1c2VkVGFiO1xuXHRcdEFycmF5LmZyb20odGhpcy5jdXJyZW50bHlPcGVuRmlsZXNNYXAudmFsdWVzKCkpLmZvckVhY2goZnVuY3Rpb24gKHRhYikge1xuXHRcdFx0dGFiLmNvbnRlbnRFbC5jbGFzc0xpc3QudG9nZ2xlKCdoYXMtZm9jdXMnLCB0YWIgPT09IGZvY3VzZWRUYWIpO1xuXHRcdFx0dGFiLmVsLmNsYXNzTGlzdC50b2dnbGUoJ2hhcy1mb2N1cycsIHRhYiA9PT0gZm9jdXNlZFRhYik7XG5cdFx0fSk7XG5cdFx0aWYgKGZvY3VzZWRUYWIuZWRpdG9yKSBmb2N1c2VkVGFiLmVkaXRvci5sYXlvdXQoKTtcblx0fVxuXG5cdFRhYkNvbnRyb2xsZXIucHJvdG90eXBlLnN0b3JlT3BlblRhYnMgPSBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKCFzdGF0ZS5jdXJyZW50bHlPcGVuZWRQYXRoKSByZXR1cm47XG5cdFx0dXBkYXRlREJEb2MoJ09QRU5fVEFCU19GT1JfJyArIHN0YXRlLmN1cnJlbnRseU9wZW5lZFBhdGgsIHtcblx0XHRcdG9wZW5fdGFiczogQXJyYXkuZnJvbSh0aGlzLmN1cnJlbnRseU9wZW5GaWxlc01hcC5rZXlzKCkpXG5cdFx0fSlcblx0XHQuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coZXJyKTtcblx0XHR9KTtcblx0fVxuXG5cdHZhciB0YWJDb250cm9sbGVyID0gbmV3IFRhYkNvbnRyb2xsZXIoKTtcblxuXHR0YWJzRWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoZSkge1xuXHRcdGlmIChlLnRhcmdldC5tYXRjaGVzKCcudGFiJykpIHtcblx0XHRcdHRhYkNvbnRyb2xsZXIuZm9jdXNUYWIoZS50YXJnZXQud2ViQ29kZVRhYik7XG5cdFx0fVxuXHR9KTtcblxuXHRjdXJyZW50bHlPcGVuRmlsZXNFbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uIChlKSB7XG5cdFx0aWYgKGUudGFyZ2V0LmRhdGEpIHtcblx0XHRcdHRhYkNvbnRyb2xsZXIuZm9jdXNUYWIoZS50YXJnZXQuZGF0YSk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZXR1cm4gdGFiQ29udHJvbGxlcjtcbn0oKSk7XG5cbmV4cG9ydCB7XG5cdHNhdmVPcGVuVGFiLFxuXHRjbG9zZU9wZW5UYWIsXG5cdHRhYkNvbnRyb2xsZXJcbn07IiwiLyogZ2xvYmFsIHJlcXVpcmUsIG1vbmFjbywgTWFwLCBTZXQsIFByb21pc2UgKi9cbi8qIGVzbGludCBuby12YXI6IDAsIG5vLWNvbnNvbGU6IDAgKi9cbi8qIGVzbGludC1lbnYgZXM2ICovXG5cbmltcG9ydCB7IHNhdmVPcGVuVGFiLCBjbG9zZU9wZW5UYWIgfSBmcm9tICcuL3RhYi1jb250cm9sbGVyJztcbmltcG9ydCB7IHByb21wdEZvck9wZW4gfSBmcm9tICcuL2ZpbGVzJztcblxucmVxdWlyZS5jb25maWcoeyBwYXRoczogeyAndnMnOiAndnMnIH0gfSk7XG5cbnZhciBtb25hY29Qcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcblx0cmVxdWlyZShbJ3ZzL2VkaXRvci9lZGl0b3IubWFpbiddLCByZXNvbHZlKTtcbn0pO1xuXG5mdW5jdGlvbiBnZXRNb25hY29MYW5ndWFnZUZyb21NaW1lcyhtaW1lKSB7XG5cdHJldHVybiAobW9uYWNvLmxhbmd1YWdlcy5nZXRMYW5ndWFnZXMoKS5maWx0ZXIoZnVuY3Rpb24gKGxhbmd1YWdlT2JqKSB7XG5cdFx0cmV0dXJuIGxhbmd1YWdlT2JqLm1pbWV0eXBlcyAmJiBsYW5ndWFnZU9iai5taW1ldHlwZXMuaW5jbHVkZXMobWltZSk7XG5cdH0pWzBdIHx8IHt9KVsnaWQnXTtcbn1cblxuZnVuY3Rpb24gZ2V0TW9uYWNvTGFuZ3VhZ2VGcm9tRXh0ZW5zaW9ucyhleHRlbnNpb24pIHtcblx0cmV0dXJuIChtb25hY28ubGFuZ3VhZ2VzLmdldExhbmd1YWdlcygpLmZpbHRlcihmdW5jdGlvbiAobGFuZ3VhZ2VPYmopIHtcblx0XHRyZXR1cm4gbGFuZ3VhZ2VPYmouZXh0ZW5zaW9ucyAmJiBsYW5ndWFnZU9iai5leHRlbnNpb25zLmluY2x1ZGVzKGV4dGVuc2lvbik7XG5cdH0pWzBdIHx8IHt9KVsnaWQnXTtcbn1cblxuZnVuY3Rpb24gYWRkQmluZGluZ3MoZWRpdG9yLCB0YWIpIHtcblx0ZWRpdG9yLmFkZENvbW1hbmQobW9uYWNvLktleU1vZC5DdHJsQ21kIHwgbW9uYWNvLktleUNvZGUuS0VZX1MsIHNhdmVPcGVuVGFiKTtcblx0ZWRpdG9yLmFkZENvbW1hbmQobW9uYWNvLktleU1vZC5DdHJsQ21kIHwgbW9uYWNvLktleUNvZGUuS0VZX08sIHByb21wdEZvck9wZW4pO1xuXHRlZGl0b3IuYWRkQ29tbWFuZChtb25hY28uS2V5Q29kZS5LRVlfVyB8IG1vbmFjby5LZXlNb2QuQ3RybENtZCwgY2xvc2VPcGVuVGFiKTtcblx0ZWRpdG9yLmFkZENvbW1hbmQobW9uYWNvLktleUNvZGUuS0VZX1AgfCBtb25hY28uS2V5TW9kLlNoaWZ0IHwgbW9uYWNvLktleU1vZC5DdHJsQ21kLCBmdW5jdGlvbiBvcGVuQ29tbWFuZFBhbGV0dGUoKSB7XG5cdFx0ZWRpdG9yLnRyaWdnZXIoJ2FueVN0cmluZycsICdlZGl0b3IuYWN0aW9uLnF1aWNrQ29tbWFuZCcpO1xuXHR9KTtcblxuXHRlZGl0b3Iud2ViQ29kZVN0YXRlID0ge307XG5cdGVkaXRvci53ZWJDb2RlU3RhdGUuc2F2ZWRBbHRlcm5hdGl2ZVZlcnNpb25JZCA9IGVkaXRvci5tb2RlbC5nZXRBbHRlcm5hdGl2ZVZlcnNpb25JZCgpO1xuXHRlZGl0b3Iud2ViQ29kZVN0YXRlLnRhYiA9IHRhYjtcblxuXHRlZGl0b3Iud2ViQ29kZVN0YXRlLmZ1bmN0aW9ucyA9IHtcblx0XHRjaGVja0ZvckNoYW5nZXM6IGZ1bmN0aW9uIGNoZWNrRm9yQ2hhbmdlcygpIHtcblx0XHRcdHZhciBoYXNDaGFuZ2VzID0gZWRpdG9yLndlYkNvZGVTdGF0ZS5zYXZlZEFsdGVybmF0aXZlVmVyc2lvbklkICE9PSBlZGl0b3IubW9kZWwuZ2V0QWx0ZXJuYXRpdmVWZXJzaW9uSWQoKTtcblx0XHRcdGVkaXRvci53ZWJDb2RlU3RhdGUuaGFzQ2hhbmdlcyA9IGhhc0NoYW5nZXM7XG5cdFx0XHR0YWIuZWwuY2xhc3NMaXN0LnRvZ2dsZSgnaGFzLWNoYW5nZXMnLCBoYXNDaGFuZ2VzKTtcblx0XHR9XG5cdH1cblxuXHRlZGl0b3Iub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQoZWRpdG9yLndlYkNvZGVTdGF0ZS5mdW5jdGlvbnMuY2hlY2tGb3JDaGFuZ2VzKTtcblxuXG59XG5cbmV4cG9ydCB7IG1vbmFjb1Byb21pc2UsIGdldE1vbmFjb0xhbmd1YWdlRnJvbUV4dGVuc2lvbnMsIGdldE1vbmFjb0xhbmd1YWdlRnJvbU1pbWVzLCBhZGRCaW5kaW5ncyB9O1xuIiwiLyogZ2xvYmFsIHJlcXVpcmUsIE1hcCwgU2V0LCBQcm9taXNlICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG5pbXBvcnQgeyBwb3B1bGF0ZUZpbGVMaXN0IH0gZnJvbSAnLi9maWxlcyc7XG5cbnZhciBoaWdobGlnaHRlZEVsO1xudmFyIGN1cnJlbnRQYXRoO1xudmFyIHJlc29sdmVyO1xudmFyIHJlamVjdGVyO1xuXG5mdW5jdGlvbiBvcGVuRmlsZURpYWxvZyhwYXRoKSB7XG5cblx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0XHRpZiAob3BlbkZpbGVEaWFsb2cub3BlbiA9PT0gdW5kZWZpbmVkKSBvcGVuRmlsZURpYWxvZy5vcGVuID0gZmFsc2U7XG5cdFx0aWYgKG9wZW5GaWxlRGlhbG9nLm9wZW4gPT09IHRydWUpIHtcblx0XHRcdHRocm93IEVycm9yKCdEaWFsb2cgYWxyZWFkeSBvcGVuIGZvciBhbm90aGVyIHRhc2suJyk7XG5cdFx0fVxuXHRcdHBhdGggPSBwYXRoIHx8ICcvJztcblx0XHRjdXJyZW50UGF0aCA9IHBhdGg7XG5cdFx0b3BlbkZpbGVEaWFsb2cuZWwuY2xhc3NMaXN0LnJlbW92ZSgnY2xvc2VkJyk7XG5cdFx0cmVzb2x2ZXIgPSByZXNvbHZlO1xuXHRcdHJlamVjdGVyID0gcmVqZWN0O1xuXHRcdG9wZW5GaWxlRGlhbG9nLmN1cnJlbnRQYXRoRWwudmFsdWUgPSBjdXJyZW50UGF0aDtcblxuXHRcdHBvcHVsYXRlRmlsZUxpc3Qob3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0LCBwYXRoLCB7XG5cdFx0XHRuZXN0ZWQ6IGZhbHNlXG5cdFx0fSlcblx0XHRcdC5jYXRjaChmdW5jdGlvbiAoZSkge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhlKTtcblx0XHRcdFx0cmV0dXJuIHBvcHVsYXRlRmlsZUxpc3Qob3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0LCAnLycsIHtcblx0XHRcdG5lc3RlZDogZmFsc2Vcblx0XHR9KVxuXHRcdFx0fSk7XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBoaWdobGlnaHQoZSkge1xuXHRpZiAoZS50YXJnZXQudGFnTmFtZSA9PT0gJ0xJJykge1xuXHRcdGlmIChoaWdobGlnaHRlZEVsKSB7XG5cdFx0XHRoaWdobGlnaHRlZEVsLmNsYXNzTGlzdC5yZW1vdmUoJ2hhcy1oaWdobGlnaHQnKTtcblx0XHR9XG5cdFx0aGlnaGxpZ2h0ZWRFbCA9IGUudGFyZ2V0O1xuXHRcdGhpZ2hsaWdodGVkRWwuY2xhc3NMaXN0LmFkZCgnaGFzLWhpZ2hsaWdodCcpO1xuXG5cdFx0Y3VycmVudFBhdGggPSBlLnRhcmdldC5kYXRhLnBhdGg7XG5cdFx0b3BlbkZpbGVEaWFsb2cuY3VycmVudFBhdGhFbC52YWx1ZSA9IGN1cnJlbnRQYXRoO1xuXG5cdFx0aWYgKGUudGFyZ2V0LmRhdGEgJiYgZS50YXJnZXQuZGF0YS5pc0Rpcikge1xuXHRcdFx0aWYgKGUuY3VycmVudFRhcmdldCA9PT0gb3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0KSB7XG5cdFx0XHRcdGlmIChlLnRhcmdldC5kYXRhLm5hbWUgPT09ICcuLicpIHtcblx0XHRcdFx0XHRwb3B1bGF0ZUZpbGVMaXN0KG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdCwgZS50YXJnZXQuZGF0YS5wYXRoLCB7XG5cdFx0XHRcdFx0XHRuZXN0ZWQ6IGZhbHNlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0b3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RSaWdodC5pbm5lckhUTUwgPSAnJztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwb3B1bGF0ZUZpbGVMaXN0KG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0UmlnaHQsIGUudGFyZ2V0LmRhdGEucGF0aCwge1xuXHRcdFx0XHRcdFx0bmVzdGVkOiBmYWxzZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoZS5jdXJyZW50VGFyZ2V0ID09PSBvcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0KSB7XG5cdFx0XHRcdHBvcHVsYXRlRmlsZUxpc3Qob3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0LCBlLnRhcmdldC5kYXRhLmRpck5hbWUsIHtcblx0XHRcdFx0XHRuZXN0ZWQ6IGZhbHNlXG5cdFx0XHRcdH0pXG5cdFx0XHRcdFx0LnRoZW4oZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0W10uc2xpY2UuY2FsbChvcGVuRmlsZURpYWxvZy5maWxlbGlzdExlZnQuY2hpbGRyZW4pLmZvckVhY2goZnVuY3Rpb24gKGVsKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChlbC5kYXRhLnBhdGggPT09IGN1cnJlbnRQYXRoKSB7XG5cdFx0XHRcdFx0XHRcdFx0aGlnaGxpZ2h0ZWRFbCA9IGUudGFyZ2V0O1xuXHRcdFx0XHRcdFx0XHRcdGhpZ2hsaWdodGVkRWwuY2xhc3NMaXN0LmFkZCgnaGFzLWhpZ2hsaWdodCcpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0cG9wdWxhdGVGaWxlTGlzdChvcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0LCBlLnRhcmdldC5kYXRhLnBhdGgsIHtcblx0XHRcdFx0XHRuZXN0ZWQ6IGZhbHNlXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiBvbmRibGNsaWNrKGUpIHtcblx0aGlnaGxpZ2h0KGUpO1xuXHRpZiAoZS50YXJnZXQuZGF0YSAmJiBlLnRhcmdldC5kYXRhLmlzRGlyKSByZXR1cm47XG5cdG9wZW4oZS50YXJnZXQuZGF0YSk7XG59XG5cbmZ1bmN0aW9uIG9wZW4oZGF0YSkge1xuXHRvcGVuRmlsZURpYWxvZy5lbC5jbGFzc0xpc3QuYWRkKCdjbG9zZWQnKTtcblx0cmVzb2x2ZXIoZGF0YSk7XG5cdHJlc29sdmVyID0gdW5kZWZpbmVkO1xuXHRyZWplY3RlciA9IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gY2FuY2VsKCkge1xuXHRvcGVuRmlsZURpYWxvZy5lbC5jbGFzc0xpc3QuYWRkKCdjbG9zZWQnKTtcblx0cmVqZWN0ZXIoJ1VzZXIgY2FuY2VsZWQnKTtcblx0cmVzb2x2ZXIgPSB1bmRlZmluZWQ7XG5cdHJlamVjdGVyID0gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBvbmtleWRvd24oZSkge1xuXHRpZiAoZXZlbnQua2V5Q29kZSA9PT0gMTMpIG9uZGJsY2xpY2soZSk7XG59XG5cbm9wZW5GaWxlRGlhbG9nLmVsID0gb3BlbkZpbGVEaWFsb2cuZWwgfHwgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2ZpbGUtb3Blbi13aWRnZXQnKTtcbm9wZW5GaWxlRGlhbG9nLmN1cnJlbnRQYXRoRWwgPSBvcGVuRmlsZURpYWxvZy5jdXJyZW50UGF0aEVsIHx8IG9wZW5GaWxlRGlhbG9nLmVsLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W25hbWU9XCJjdXJyZW50LXBhdGhcIl0nKTtcbm9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdCA9IG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdCB8fCBvcGVuRmlsZURpYWxvZy5lbC5xdWVyeVNlbGVjdG9yKCcuZmlsZWxpc3Q6Zmlyc3QtY2hpbGQnKTtcbm9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0UmlnaHQgPSBvcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0IHx8IG9wZW5GaWxlRGlhbG9nLmVsLnF1ZXJ5U2VsZWN0b3IoJy5maWxlbGlzdDpub3QoOmZpcnN0LWNoaWxkKScpO1xub3BlbkZpbGVEaWFsb2cub3BlbkJ1dHRvbiA9IG9wZW5GaWxlRGlhbG9nLm9wZW5CdXR0b24gfHwgb3BlbkZpbGVEaWFsb2cuZWwucXVlcnlTZWxlY3RvcignI2ZpbGUtb3Blbi1vcGVuJyk7XG5vcGVuRmlsZURpYWxvZy5jYW5jZWxCdXR0b24gPSBvcGVuRmlsZURpYWxvZy5jYW5jZWxCdXR0b24gfHwgb3BlbkZpbGVEaWFsb2cuZWwucXVlcnlTZWxlY3RvcignI2ZpbGUtb3Blbi1jYW5jZWwnKTtcbm9wZW5GaWxlRGlhbG9nLnVwRGlyQnV0dG9uID0gb3BlbkZpbGVEaWFsb2cudXBEaXJCdXR0b24gfHwgb3BlbkZpbGVEaWFsb2cuZWwucXVlcnlTZWxlY3RvcignYnV0dG9uW2RhdGEtYWN0aW9uPVwidXAtZGlyXCJdJyk7XG5cbm9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGhpZ2hsaWdodCk7XG5vcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgaGlnaGxpZ2h0KTtcblxub3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBvbmtleWRvd24pO1xub3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RSaWdodC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgb25rZXlkb3duKTtcblxub3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0LmFkZEV2ZW50TGlzdGVuZXIoJ2RibGNsaWNrJywgb25kYmxjbGljayk7XG5vcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0LmFkZEV2ZW50TGlzdGVuZXIoJ2RibGNsaWNrJywgb25kYmxjbGljayk7XG5vcGVuRmlsZURpYWxvZy5vcGVuQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuXHRvcGVuKGhpZ2hsaWdodGVkRWwuZGF0YSk7XG59KTtcbm9wZW5GaWxlRGlhbG9nLmNhbmNlbEJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcblx0Y2FuY2VsKCk7XG59KTtcbm9wZW5GaWxlRGlhbG9nLnVwRGlyQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuXHRjb25zb2xlLmxvZygnU1RVQiBHTyBVUCBESVInKTtcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBvcGVuRmlsZURpYWxvZzsiLCIvKiBnbG9iYWwgcmVxdWlyZSwgTWFwLCBTZXQsIFByb21pc2UsIG1vbmFjbyAqL1xuLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuLyogZXNsaW50LWVudiBlczYgKi9cblxuaW1wb3J0IHtcblx0cmVtb3RlQ21kXG59IGZyb20gJy4vd3MnO1xuXG5pbXBvcnQgc3RhdGUgZnJvbSAnLi9zdGF0ZSc7XG5pbXBvcnQgeyBkYiwgdXBkYXRlREJEb2MgfSBmcm9tICcuL2RiJztcbmltcG9ydCB7IHRhYkNvbnRyb2xsZXIgfSBmcm9tICcuL3RhYi1jb250cm9sbGVyJztcbmltcG9ydCB7IG1vbmFjb1Byb21pc2UsIGdldE1vbmFjb0xhbmd1YWdlRnJvbUV4dGVuc2lvbnMsIGdldE1vbmFjb0xhbmd1YWdlRnJvbU1pbWVzLCBhZGRCaW5kaW5ncyB9IGZyb20gJy4vbW9uYWNvJztcbmltcG9ydCBvcGVuRmlsZURpYWxvZyBmcm9tICcuL29wZW4tZmlsZS1kaWFsb2cnO1xuXG4vLyBNYXAgdG8gcHJldmVudCBkdXBsaWNhdGUgZGF0YSBvYmplY3RzIGZvciBlYWNoIGZpbGVcbnZhciBwYXRoVG9EYXRhTWFwID0gbmV3IE1hcCgpO1xuXG5mdW5jdGlvbiByZW5kZXJGaWxlTGlzdChlbCwgZGF0YSwgb3B0aW9ucykge1xuXG5cdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXHR2YXIgdXNlT3B0aW9ucyA9IHtcblx0XHRoaWRlRG90RmlsZXM6IChvcHRpb25zLmhpZGVEb3RGaWxlcyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5oaWRlRG90RmlsZXMgOiB0cnVlKSxcblx0XHRuZXN0ZWQ6IChvcHRpb25zLm5lc3RlZCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5uZXN0ZWQgOiB0cnVlKSxcblx0XHRuZXN0aW5nTGltaXQ6IChvcHRpb25zLm5lc3RpbmdMaW1pdCB8fCA1KSAtIDFcblx0fVxuXHRpZiAob3B0aW9ucy5uZXN0aW5nTGltaXQgPT09IDApIHJldHVybjtcblxuXHRlbC5pbm5lckhUTUwgPSAnJztcblx0ZWwuZGF0YSA9IGRhdGE7XG5cblx0dmFyIHNvcnRlZERhdGEgPSBBcnJheS5mcm9tKGRhdGEuY2hpbGRyZW4pXG5cdFx0LmZpbHRlcihmdW5jdGlvbiAoZGF0dW0pIHtcblxuXHRcdFx0Ly8gV2hldGhlciB0byBoaWRlIGRvdGZpbGVzXG5cdFx0XHRpZiAoZGF0dW0ubmFtZSAhPT0gJy4uJyAmJiB1c2VPcHRpb25zLmhpZGVEb3RGaWxlcyAhPT0gZmFsc2UpIHtcblx0XHRcdFx0cmV0dXJuIGRhdHVtLm5hbWVbMF0gIT09ICcuJztcblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0pXG5cdFx0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcblx0XHRcdGlmIChhLm5hbWUgPT09ICcuLicpIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGIubmFtZSA9PT0gJy4uJykge1xuXHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdH1cblx0XHRcdGlmIChcblx0XHRcdFx0KGEuaXNEaXIgPT09IGIuaXNEaXIpICYmXG5cdFx0XHRcdChhLmlzRmlsZSA9PT0gYi5pc0ZpbGUpXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIChbYS5uYW1lLCBiLm5hbWVdLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcblx0XHRcdFx0XHRyZXR1cm4gYS50b0xvd2VyQ2FzZSgpLmxvY2FsZUNvbXBhcmUoYi50b0xvd2VyQ2FzZSgpKTtcblx0XHRcdFx0fSlbMF0gPT09IGEubmFtZSA/IC0xIDogMSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoYS5pc0RpcikgcmV0dXJuIC0xO1xuXHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHNvcnRlZERhdGEubWFwKGZ1bmN0aW9uIChkYXR1bSkge1xuXHRcdFx0dmFyIGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcblx0XHRcdGxpLmNsYXNzTGlzdC5hZGQoJ2hhcy1pY29uJyk7XG5cdFx0XHRsaS5kYXRhc2V0Lm1pbWUgPSBkYXR1bS5taW1lO1xuXHRcdFx0bGkuZGF0YXNldC5uYW1lID0gZGF0dW0ubmFtZTtcblx0XHRcdGxpLmRhdGFzZXQuc2l6ZSA9IGRhdHVtLnNpemU7XG5cdFx0XHRsaS50ZXh0Q29udGVudCA9IGRhdHVtLm5hbWU7XG5cdFx0XHRsaS50YWJJbmRleCA9IDE7XG5cdFx0XHRsaS5kYXRhID0gZGF0dW07XG5cdFx0XHRlbC5hcHBlbmRDaGlsZChsaSk7XG5cblx0XHRcdGlmIChkYXR1bS5pc0RpciAmJiB1c2VPcHRpb25zLm5lc3RlZCAhPT0gZmFsc2UpIHtcblx0XHRcdFx0dmFyIG5ld0ZpbGVMaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndWwnKTtcblx0XHRcdFx0bmV3RmlsZUxpc3QuY2xhc3NMaXN0LmFkZCgnZmlsZWxpc3QnKTtcblx0XHRcdFx0bGkuYXBwZW5kQ2hpbGQobmV3RmlsZUxpc3QpO1xuXHRcdFx0XHRpZiAoZGF0dW0uY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRyZW5kZXJGaWxlTGlzdChuZXdGaWxlTGlzdCwgZGF0dW0sIHVzZU9wdGlvbnMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG59XG5cbmZ1bmN0aW9uIHBvcHVsYXRlRmlsZUxpc3QoZWwsIHBhdGgsIG9wdGlvbnMpIHtcblx0ZWwucGF0aCA9IHBhdGg7XG5cdHJldHVybiByZW1vdGVDbWQoJ1NUQVQnLCBwYXRoKVxuXHRcdC50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG5cdFx0XHRpZiAoZGF0YS5pc0ZpbGUpIHtcblx0XHRcdFx0cmV0dXJuIHJlbW90ZUNtZCgnU1RBVCcsIGRhdGEuZGlyTmFtZSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZGF0YTtcblx0XHR9KVxuXHRcdC50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG5cdFx0XHRkYXRhID0gZGVkdXAoZGF0YSk7XG5cdFx0XHRyZW5kZXJGaWxlTGlzdChlbCwgZGF0YSwgb3B0aW9ucyk7XG5cdFx0XHRyZXR1cm4gZGF0YTtcblx0XHR9KTtcbn1cblxuXG5mdW5jdGlvbiBkZWR1cChkYXRhKSB7XG5cblx0dmFyIG5ld0NoaWxkcmVuO1xuXHR2YXIgb2xkQ2hpbGRyZW47XG5cblx0Ly8gVGhhdCB3YXkgaWYgYW55IG9mIHRoZXNlIGNoYW5nZSB0aGVuIHRoZSBmaWxlIGlzIHVwZGF0ZWRcblx0dmFyIGtleSA9IEpTT04uc3RyaW5naWZ5KHtcblx0XHRwYXRoOiBkYXRhLnBhdGgsXG5cdFx0aXNEaXI6IGRhdGEuaXNEaXIsXG5cdFx0aXNGaWxlOiBkYXRhLmlzRmlsZSxcblx0XHRtaW1lOiBkYXRhLm1pbWVcblx0fSk7XG5cblx0aWYgKGRhdGEuY2hpbGRyZW4pIG5ld0NoaWxkcmVuID0gZGF0YS5jaGlsZHJlbjtcblxuXHQvLyBlbnN1cmUgdGhhdCBkYXRhIG9iamVjdHMgYXJlIG5vdCBkdXBsaWNhdGVkLlxuXHRpZiAocGF0aFRvRGF0YU1hcC5oYXMoa2V5KSkge1xuXHRcdGRhdGEgPSBwYXRoVG9EYXRhTWFwLmdldChrZXkpO1xuXHRcdG9sZENoaWxkcmVuID0gZGF0YS5jaGlsZHJlbjtcblx0fSBlbHNlIHtcblx0XHRwYXRoVG9EYXRhTWFwLnNldChrZXksIGRhdGEpO1xuXHR9XG5cblx0aWYgKGRhdGEuaXNEaXIpIHtcblxuXHRcdGlmICghb2xkQ2hpbGRyZW4gJiYgIW5ld0NoaWxkcmVuKSB7XG5cdFx0XHQvLyBkbyBub3RoaW5nLCB3ZSBoYXZlIG5vIGNoaWxkcmVuIGFuZCB3ZSBuZWVkIHRvIGFkZCBubyBjaGlsZHJlblxuXHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0fVxuXG5cdFx0aWYgKCFvbGRDaGlsZHJlbiAmJiBuZXdDaGlsZHJlbikge1xuXHRcdFx0Ly8gbm8gU2V0IHByZXNlbnQgdGhlbiBjcmVhdGUgb25lIHRvIGJlIHByZWFyZWQgaW4gdGhlIG5leHQgb25lXG5cdFx0XHRkYXRhLmNoaWxkcmVuID0gbmV3IFNldCgpO1xuXHRcdFx0b2xkQ2hpbGRyZW4gPSBkYXRhLmNoaWxkcmVuO1xuXHRcdH1cblxuXHRcdGlmIChvbGRDaGlsZHJlbiAmJiBuZXdDaGlsZHJlbikge1xuXHRcdFx0Ly8gU2V0IGlzIHByZXNlbnQgc28gcG9wdWxhdGUgaXRcblxuXHRcdFx0bmV3Q2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbiAoY2hpbGREYXRhKSB7XG5cdFx0XHRcdG9sZENoaWxkcmVuLmFkZChkZWR1cChjaGlsZERhdGEpKTtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGRhdGE7XG59XG5cbmZ1bmN0aW9uIG9wZW5QYXRoKGRhdGEpIHtcblx0aWYgKGRhdGEuaXNEaXIpIHtcblxuXHRcdGlmIChzdGF0ZS5jdXJyZW50bHlPcGVuZWRQYXRoICE9PSBkYXRhLnBhdGgpIHtcblx0XHRcdC8vIFRPRE86IGNsb3NlIGFsbCB0YWJzXG5cblx0XHRcdC8vIFRoZW4gb3BlbiB0aGUgc2F2ZWQgdGFicyBmcm9tIGxhc3QgdGltZVxuXHRcdFx0ZGIuZ2V0KCdPUEVOX1RBQlNfRk9SXycgKyBkYXRhLnBhdGgpLnRoZW4oZnVuY3Rpb24gKHRhYnMpIHtcblx0XHRcdFx0dGFicy5vcGVuX3RhYnMuZm9yRWFjaChvcGVuRmlsZSk7XG5cdFx0XHR9KS5jYXRjaChmdW5jdGlvbiAoZSkge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhlKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHN0YXRlLmN1cnJlbnRseU9wZW5lZFBhdGggPSBkYXRhLnBhdGg7XG5cblx0XHR2YXIgZmlsZWxpc3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlyZWN0b3J5Jyk7XG5cdFx0cG9wdWxhdGVGaWxlTGlzdChmaWxlbGlzdCwgZGF0YS5wYXRoLCB7XG5cdFx0XHRoaWRlRG90RmlsZXM6IHRydWVcblx0XHR9KTtcblxuXHRcdHVwZGF0ZURCRG9jKCdJTklUX1NUQVRFJywge1xuXHRcdFx0cHJldmlvdXNfcGF0aDogeyBwYXRoOiBkYXRhLnBhdGgsIGlzRGlyOiB0cnVlIH1cblx0XHR9KVxuXHRcdC5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhlcnIpO1xuXHRcdH0pO1xuXG5cdH1cblx0aWYgKGRhdGEuaXNGaWxlKSB7XG5cdFx0b3BlbkZpbGUoZGF0YSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gb3BlbkZpbGUoZGF0YSkge1xuXG5cdGRhdGEgPSBkZWR1cChkYXRhKTtcblxuXHRpZiAodGFiQ29udHJvbGxlci5oYXNUYWIoZGF0YSkpIHtcblx0XHR0YWJDb250cm9sbGVyLmZvY3VzVGFiKGRhdGEpO1xuXHR9IGVsc2Uge1xuXHRcdHZhciBuZXdUYWIgPSB0YWJDb250cm9sbGVyLm5ld1RhYihkYXRhKTtcblxuXHRcdHJldHVybiBQcm9taXNlLmFsbChbcmVtb3RlQ21kKCdPUEVOJywgZGF0YS5wYXRoKSwgbW9uYWNvUHJvbWlzZV0pXG5cdFx0XHQudGhlbihmdW5jdGlvbiAoYXJyKSB7XG5cdFx0XHRcdHJldHVybiBhcnJbMF07XG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24gKGZpbGVDb250ZW50cykge1xuXHRcdFx0XHR2YXIgbGFuZ3VhZ2UgPSBnZXRNb25hY29MYW5ndWFnZUZyb21NaW1lcyhkYXRhLm1pbWUpIHx8IGdldE1vbmFjb0xhbmd1YWdlRnJvbUV4dGVuc2lvbnMoZGF0YS5leHRlbnNpb24pO1xuXHRcdFx0XHRuZXdUYWIuZWRpdG9yID0gbW9uYWNvLmVkaXRvci5jcmVhdGUobmV3VGFiLmNvbnRlbnRFbCwge1xuXHRcdFx0XHRcdHZhbHVlOiBmaWxlQ29udGVudHMsXG5cdFx0XHRcdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhZGRCaW5kaW5ncyhuZXdUYWIuZWRpdG9yLCBuZXdUYWIpO1xuXHRcdFx0fSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gcHJvbXB0Rm9yT3BlbigpIHtcblx0b3BlbkZpbGVEaWFsb2coc3RhdGUuY3VycmVudGx5T3BlbmVkUGF0aCB8fCAnLycpLnRoZW4ob3BlblBhdGgpO1xufVxuXG5leHBvcnQge1xuXHRkZWR1cCxcblx0cG9wdWxhdGVGaWxlTGlzdCxcblx0cmVuZGVyRmlsZUxpc3QsXG5cdG9wZW5GaWxlLFxuXHRvcGVuUGF0aCxcblx0cHJvbXB0Rm9yT3BlblxufTsiLCIvKiBnbG9iYWwgcmVxdWlyZSwgTWFwLCBTZXQsIFByb21pc2UgKi9cbi8qIGVzbGludCBuby12YXI6IDAsIG5vLWNvbnNvbGU6IDAgKi9cbi8qIGVzbGludC1lbnYgZXM2ICovXG5cbmltcG9ydCB7IHBvcHVsYXRlRmlsZUxpc3QsIG9wZW5GaWxlIH0gZnJvbSAnLi9maWxlcyc7XG5cbmZ1bmN0aW9uIHNldFVwU2lkZUJhcigpIHtcblxuXHRmdW5jdGlvbiBleHBhbmREaXIoZWwsIGRhdGEpIHtcblx0XHR2YXIgZmlsZWxpc3RFbCA9IGVsLnF1ZXJ5U2VsZWN0b3IoJy5maWxlbGlzdCcpO1xuXHRcdGlmIChmaWxlbGlzdEVsLmNoaWxkcmVuLmxlbmd0aCkge1xuXHRcdFx0ZmlsZWxpc3RFbC5pbm5lckhUTUwgPSAnJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cG9wdWxhdGVGaWxlTGlzdChmaWxlbGlzdEVsLCBkYXRhLnBhdGgsIHtcblx0XHRcdFx0aGlkZURvdEZpbGVzOiB0cnVlXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHR2YXIgZGlyZWN0b3J5RWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZGlyZWN0b3J5Jyk7XG5cblx0ZnVuY3Rpb24gb25jbGljayhlKSB7XG5cdFx0aWYgKGUudGFyZ2V0LnRhZ05hbWUgPT09ICdMSScpIHtcblx0XHRcdGlmIChlLnRhcmdldC5kYXRhLmlzRmlsZSkgb3BlbkZpbGUoZS50YXJnZXQuZGF0YSk7XG5cdFx0XHRpZiAoZS50YXJnZXQuZGF0YS5pc0RpcikgZXhwYW5kRGlyKGUudGFyZ2V0LCBlLnRhcmdldC5kYXRhKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBvbmtleWRvd24oZSkge1xuXHRcdGlmIChldmVudC5rZXlDb2RlID09PSAxMykgb25jbGljayhlKTtcblx0fVxuXG5cdGRpcmVjdG9yeUVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgb25jbGljayk7XG5cdGRpcmVjdG9yeUVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBvbmtleWRvd24pO1xuXG59O1xuXG5leHBvcnQgeyBzZXRVcFNpZGVCYXIgfTsiLCIvKiBnbG9iYWwgcmVxdWlyZSwgTWFwLCBTZXQsIFByb21pc2UgKi9cbi8qIGVzbGludCBuby12YXI6IDAsIG5vLWNvbnNvbGU6IDAgKi9cbi8qIGVzbGludC1lbnYgZXM2ICovXG5cbmltcG9ydCB7IGRiIH0gZnJvbSAnLi9saWIvZGInO1xuaW1wb3J0IHsgd3NQcm9taXNlIH0gZnJvbSAnLi9saWIvd3MnO1xuaW1wb3J0IHsgb3BlblBhdGgsIHByb21wdEZvck9wZW4gfSBmcm9tICcuL2xpYi9maWxlcyc7XG5pbXBvcnQgeyBzYXZlT3BlblRhYiB9IGZyb20gJy4vbGliL3RhYi1jb250cm9sbGVyJztcbmltcG9ydCB7IHNldFVwU2lkZUJhciB9IGZyb20gJy4vbGliL3NpZGUtYmFyJztcblxuZnVuY3Rpb24gaW5pdCgpIHtcblxuXHRkYi5nZXQoJ0lOSVRfU1RBVEUnKVxuXHRcdC50aGVuKGZ1bmN0aW9uIChkb2MpIHtcblx0XHRcdGlmIChkb2MucHJldmlvdXNfcGF0aCkge1xuXHRcdFx0XHRyZXR1cm4gb3BlblBhdGgoZG9jLnByZXZpb3VzX3BhdGgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHByb21wdEZvck9wZW4oKTtcblx0XHRcdH1cblx0XHR9KVxuXHRcdC5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG5cdFx0XHRwcm9tcHRGb3JPcGVuKCk7XG5cdFx0XHRjb25zb2xlLmxvZyhlcnIpO1xuXHRcdH0pO1xufVxuXG53c1Byb21pc2UudGhlbihpbml0KTtcblxuKGZ1bmN0aW9uIHNldFVwVG9vbEJhcigpIHtcblx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYnV0dG9uW2RhdGEtYWN0aW9uPVwib3Blbi1maWxlXCJdJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBwcm9tcHRGb3JPcGVuKTtcblx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYnV0dG9uW2RhdGEtYWN0aW9uPVwic2F2ZS1maWxlXCJdJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBzYXZlT3BlblRhYik7XG59KCkpO1xuXG5zZXRVcFNpZGVCYXIoKTsiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7Ozs7QUFJQSxJQUFJLEVBQUUsR0FBRyxJQUFJLE9BQU8sQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDckMsU0FBUyxXQUFXLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRTs7Q0FFOUIsV0FBVyxDQUFDLE9BQU8sR0FBRyxXQUFXLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQzs7O0NBRy9ELE9BQU8sV0FBVyxDQUFDLE9BQU8sR0FBRyxXQUFXLENBQUMsT0FBTztHQUM5QyxJQUFJLENBQUMsWUFBWTtHQUNqQixPQUFPLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO0dBQ2xCLENBQUM7R0FDRCxLQUFLLENBQUMsVUFBVSxDQUFDLEVBQUU7R0FDbkIsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLEdBQUcsRUFBRTtJQUNyQixPQUFPLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRTtJQUNuQjtHQUNELE1BQU0sQ0FBQyxDQUFDO0dBQ1IsQ0FBQztHQUNELElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRTtHQUNwQixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsRUFBRTtJQUN2QyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3BCLENBQUMsQ0FBQztHQUNILEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7R0FDWixDQUFDLENBQUM7Q0FDSixBQUVEOztBQzVCQTs7OztBQUlBLElBQUksRUFBRSxHQUFHLElBQUksU0FBUyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsS0FBSyxXQUFXLEdBQUcs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
