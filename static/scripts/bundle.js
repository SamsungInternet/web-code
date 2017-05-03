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

	function updateOpenFileEl() {
		renderFileList(currentlyOpenFilesEl, { children: Array.from(tabController.currentlyOpenFilesMap.keys()) });
	}

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

		var self = this;
		this.closeEl.addEventListener('click', function () {
			tabController.closeTab(self);
		});
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
		updateOpenFileEl();
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

	TabController.prototype.closeTab = function (data) {
		var tab = data.constructor === Tab ? data : this.currentlyOpenFilesMap.get(data);
		var tabState = Array.from(this.currentlyOpenFilesMap.values());
		var tabIndex = tabState.indexOf(tab);
		var nextTab = tabState[Math.max(0, tabIndex - 1)];
		this.currentlyOpenFilesMap.delete(tab.data);
		tab.destroy();
		updateOpenFileEl();
		this.storeOpenTabs();
		if (this.focusedTab === tab && nextTab) {
			this.focusTab(nextTab);
		}
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

	tabsEl.addEventListener('mouseup', function (e) {
		if (e.target.matches('.tab')) {
			if (e.button === 0) {
				tabController.focusTab(e.target.webCodeTab);
			}
			if (e.button === 2) {
				tabController.closeTab(e.target.webCodeTab);
			}
		}
	});

	currentlyOpenFilesEl.addEventListener('mouseup', function (e) {
		if (e.target.data) {
			if (e.button === 0) {
				tabController.focusTab(e.target.data);
			}
			if (e.button === 1) {
				tabController.closeTab(e.target.data);
			}
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

function selectNextEl() {
	console.log('STUB BLUR EDITOR, NEXT EL');
}

function selectPreviousEl() {
	console.log('STUB BLUR EDITOR, PREVIOUS EL');
}

function nextTab() {
	console.log('FOCUS NEXT TAB');
}

function previousTab() {
	console.log('FOCUS PREVIOUS TAB');
}

function addBindings(editor, tab) {
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, saveOpenTab);
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_O, promptForOpen);
	editor.addCommand(monaco.KeyCode.KEY_W | monaco.KeyMod.CtrlCmd, closeOpenTab);
	editor.addCommand(monaco.KeyCode.F6, selectNextEl);
	editor.addCommand(monaco.KeyCode.F6 | monaco.KeyMod.Shift, selectPreviousEl);
	editor.addCommand(monaco.KeyCode.Tab | monaco.KeyMod.CtrlCmd, nextTab);
	editor.addCommand(monaco.KeyCode.Tab | monaco.KeyMod.Shift | monaco.KeyMod.CtrlCmd, previousTab);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyJsaWIvZGIuanMiLCJsaWIvd3MuanMiLCJsaWIvc3RhdGUuanMiLCJsaWIvdGFiLWNvbnRyb2xsZXIuanMiLCJsaWIvbW9uYWNvLmpzIiwibGliL29wZW4tZmlsZS1kaWFsb2cuanMiLCJsaWIvZmlsZXMuanMiLCJsaWIvc2lkZS1iYXIuanMiLCJtYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCByZXF1aXJlLCBQcm9taXNlLCBQb3VjaERCICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG52YXIgZGIgPSBuZXcgUG91Y2hEQignd2ViLWNvZGUnLCB7fSk7XG5mdW5jdGlvbiB1cGRhdGVEQkRvYyhfaWQsIG9iaikge1xuXG5cdHVwZGF0ZURCRG9jLnByb21pc2UgPSB1cGRhdGVEQkRvYy5wcm9taXNlIHx8IFByb21pc2UucmVzb2x2ZSgpO1xuXG5cdC8qIHVwZGF0ZSBsYXN0IG9wZW4gZm9sZGVyIGluIGRiICovXG5cdHJldHVybiB1cGRhdGVEQkRvYy5wcm9taXNlID0gdXBkYXRlREJEb2MucHJvbWlzZVxuXHRcdC50aGVuKGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiBkYi5nZXQoX2lkKVxuXHRcdH0pXG5cdFx0LmNhdGNoKGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRpZiAoZS5zdGF0dXMgPT09IDQwNCkge1xuXHRcdFx0XHRyZXR1cm4geyBfaWQ6IF9pZCB9XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH0pXG5cdFx0LnRoZW4oZnVuY3Rpb24gKGRvYykge1xuXHRcdFx0T2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdFx0ZG9jW2tleV0gPSBvYmpba2V5XTtcblx0XHRcdH0pO1xuXHRcdFx0ZGIucHV0KGRvYyk7XG5cdFx0fSk7XG59XG5cbmV4cG9ydCB7IGRiLCB1cGRhdGVEQkRvYyB9OyIsIi8qIGdsb2JhbCByZXF1aXJlLCBNYXAsIFNldCwgUHJvbWlzZSAqL1xuLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuLyogZXNsaW50LWVudiBlczYgKi9cblxudmFyIHdzID0gbmV3IFdlYlNvY2tldCgobG9jYXRpb24uaG9zdG5hbWUgPT09ICdsb2NhbGhvc3QnID8gJ3dzOi8vJyA6ICd3c3M6Ly8nKSArIGxvY2F0aW9uLmhvc3QpO1xud3MuYmluYXJ5VHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cbnZhciBwcm9taXNlcyA9IG5ldyBNYXAoKTtcblxud3MuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIG0oZSkge1xuXHRpZiAodHlwZW9mIGUuZGF0YSA9PT0gJ3N0cmluZycpIHtcblx0XHR2YXIgcmVzdWx0ID0gSlNPTi5wYXJzZShlLmRhdGEpO1xuXHRcdHZhciBwcm9taXNlUmVzb2x2ZXIgPSBwcm9taXNlcy5nZXQocmVzdWx0WzFdKTtcblx0XHR2YXIgZGF0YSA9IHJlc3VsdFsyXTtcblx0XHRpZiAocHJvbWlzZVJlc29sdmVyKSB7XG5cdFx0XHRwcm9taXNlcy5kZWxldGUocmVzdWx0WzFdKTtcblxuXHRcdFx0aWYgKGRhdGEuZXJyb3IpIHtcblx0XHRcdFx0cmV0dXJuIHByb21pc2VSZXNvbHZlclsxXShFcnJvcihkYXRhLmVycm9yKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gcHJvbWlzZVJlc29sdmVyWzBdKGRhdGEpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbmZ1bmN0aW9uIHJlbW90ZUNtZChjbWQsIGRhdGEpIHtcblx0dmFyIGlkID0gcGVyZm9ybWFuY2Uubm93KCkgKyAnXycgKyBNYXRoLnJhbmRvbSgpO1xuXHR3cy5zZW5kKEpTT04uc3RyaW5naWZ5KFtcblx0XHRjbWQsXG5cdFx0aWQsXG5cdFx0ZGF0YVxuXHRdKSk7XG5cdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0cHJvbWlzZXMuc2V0KGlkLCBbcmVzb2x2ZSwgcmVqZWN0XSk7XG5cdH0pO1xufVxuXG4vLyBDb25uZWN0aW9uIG9wZW5lZFxudmFyIHdzUHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG5cdHdzLmFkZEV2ZW50TGlzdGVuZXIoJ29wZW4nLCBmdW5jdGlvbiBmaXJzdE9wZW4oKSB7XG5cdFx0d3MucmVtb3ZlRXZlbnRMaXN0ZW5lcignb3BlbicsIGZpcnN0T3Blbik7XG5cdFx0cmVzb2x2ZSh3cyk7XG5cdH0pO1xufSk7XG5cbmV4cG9ydCB7XG5cdHdzLFxuXHR3c1Byb21pc2UsXG5cdHJlbW90ZUNtZFxufTsiLCJleHBvcnQgZGVmYXVsdCB7XG5cdGN1cnJlbnRseU9wZW5QYXRoOiBudWxsIC8vIG51bGwgb3Igc3RyaW5nXG59OyIsIi8qIGdsb2JhbCByZXF1aXJlLCBNYXAsIFNldCwgUHJvbWlzZSAqL1xuLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuLyogZXNsaW50LWVudiBlczYgKi9cblxuaW1wb3J0IHsgcmVtb3RlQ21kIH0gZnJvbSAnLi93cyc7XG5pbXBvcnQgeyByZW5kZXJGaWxlTGlzdCB9IGZyb20gJy4vZmlsZXMnO1xuaW1wb3J0IHN0YXRlIGZyb20gJy4vc3RhdGUnO1xuaW1wb3J0IHsgdXBkYXRlREJEb2MgfSBmcm9tICcuL2RiJztcblxuZnVuY3Rpb24gc2F2ZU9wZW5UYWIoKSB7XG5cdHZhciB0YWIgPSB0YWJDb250cm9sbGVyLmdldE9wZW5UYWIoKTtcblx0dmFyIGRhdGE7XG5cdGlmICh0YWIgJiYgdGFiLmVkaXRvcikge1xuXHRcdGRhdGEgPSB0YWIuZGF0YTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm47XG5cdH1cblx0dmFyIGFsdElkID0gdGFiLmVkaXRvci5tb2RlbC5nZXRBbHRlcm5hdGl2ZVZlcnNpb25JZCgpO1xuXHRyZW1vdGVDbWQoJ1NBVkUnLCB7XG5cdFx0cGF0aDogZGF0YS5wYXRoLFxuXHRcdGNvbnRlbnQ6IHRhYi5lZGl0b3IuZ2V0VmFsdWUoKVxuXHR9KS50aGVuKGZ1bmN0aW9uICgpIHtcblx0XHR0YWIuZWRpdG9yLndlYkNvZGVTdGF0ZS5zYXZlZEFsdGVybmF0aXZlVmVyc2lvbklkID0gYWx0SWQ7XG5cdFx0dGFiLmVkaXRvci53ZWJDb2RlU3RhdGUuZnVuY3Rpb25zLmNoZWNrRm9yQ2hhbmdlcygpO1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gY2xvc2VPcGVuVGFiKCkge1xuXHR2YXIgdGFiID0gdGFiQ29udHJvbGxlci5nZXRPcGVuVGFiKCk7XG5cdHZhciBkYXRhO1xuXHRpZiAodGFiKSB7XG5cdFx0ZGF0YSA9IHRhYi5kYXRhO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybjtcblx0fVxuXHRjb25zb2xlLmxvZyhkYXRhKTtcbn1cblxuXG52YXIgdGFiQ29udHJvbGxlciA9IChmdW5jdGlvbiBzZXRVcFRhYnMoKSB7XG5cdHZhciBjdXJyZW50bHlPcGVuRmlsZXNFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNjdXJyZW50bHktb3Blbi1maWxlcycpO1xuXHR2YXIgY29udGFpbmVyRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udGFpbmVyJyk7XG5cdHZhciB0YWJzRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdGFicycpO1xuXG5cdGZ1bmN0aW9uIHVwZGF0ZU9wZW5GaWxlRWwoKSB7XG5cdFx0cmVuZGVyRmlsZUxpc3QoY3VycmVudGx5T3BlbkZpbGVzRWwsIHsgY2hpbGRyZW46IEFycmF5LmZyb20odGFiQ29udHJvbGxlci5jdXJyZW50bHlPcGVuRmlsZXNNYXAua2V5cygpKSB9KTtcblx0fVxuXG5cdGZ1bmN0aW9uIFRhYihkYXRhKSB7XG5cdFx0dGhpcy5kYXRhID0gZGF0YTtcblx0XHR0aGlzLmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuXHRcdHRoaXMuZWwuY2xhc3NMaXN0LmFkZCgndGFiJyk7XG5cdFx0dGhpcy5lbC5jbGFzc0xpc3QuYWRkKCdoYXMtaWNvbicpO1xuXHRcdHRoaXMuZWwuZGF0YXNldC5taW1lID0gZGF0YS5taW1lO1xuXHRcdHRoaXMuZWwuZGF0YXNldC5uYW1lID0gZGF0YS5uYW1lO1xuXHRcdHRoaXMuZWwuZGF0YXNldC5zaXplID0gZGF0YS5zaXplO1xuXHRcdHRoaXMuZWwudGV4dENvbnRlbnQgPSBkYXRhLm5hbWU7XG5cdFx0dGhpcy5lbC50YWJJbmRleCA9IDE7XG5cdFx0dGFic0VsLmFwcGVuZENoaWxkKHRoaXMuZWwpO1xuXG5cdFx0dGhpcy5lbC53ZWJDb2RlVGFiID0gdGhpcztcblxuXHRcdHRoaXMuY29udGVudEVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5jb250ZW50RWwuY2xhc3NMaXN0LmFkZCgndGFiLWNvbnRlbnQnKTtcblx0XHRjb250YWluZXJFbC5hcHBlbmRDaGlsZCh0aGlzLmNvbnRlbnRFbCk7XG5cblx0XHR0aGlzLmNsb3NlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcblx0XHR0aGlzLmNsb3NlRWwuY2xhc3NMaXN0LmFkZCgndGFiX2Nsb3NlJyk7XG5cdFx0dGhpcy5lbC5hcHBlbmRDaGlsZCh0aGlzLmNsb3NlRWwpO1xuXHRcdHRoaXMuY2xvc2VFbC50YWJJbmRleCA9IDE7XG5cblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0dGhpcy5jbG9zZUVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0dGFiQ29udHJvbGxlci5jbG9zZVRhYihzZWxmKTtcblx0XHR9KTtcblx0fVxuXG5cdFRhYi5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLmVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5lbCk7XG5cdFx0dGhpcy5jb250ZW50RWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmNvbnRlbnRFbCk7XG5cdH1cblxuXHRmdW5jdGlvbiBUYWJDb250cm9sbGVyKCkge1xuXHRcdHRoaXMuY3VycmVudGx5T3BlbkZpbGVzTWFwID0gbmV3IE1hcCgpO1xuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUuaGFzVGFiID0gZnVuY3Rpb24gKGRhdGEpIHtcblx0XHRyZXR1cm4gdGhpcy5jdXJyZW50bHlPcGVuRmlsZXNNYXAuaGFzKGRhdGEpO1xuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUuZ2V0T3BlblRhYiA9IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGhpcy5mb2N1c2VkVGFiO1xuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUubmV3VGFiID0gZnVuY3Rpb24gKGRhdGEpIHtcblx0XHR2YXIgdGFiID0gbmV3IFRhYihkYXRhKTtcblx0XHR0aGlzLmN1cnJlbnRseU9wZW5GaWxlc01hcC5zZXQoZGF0YSwgdGFiKTtcblx0XHR1cGRhdGVPcGVuRmlsZUVsKCk7XG5cdFx0dGhpcy5mb2N1c1RhYih0YWIpO1xuXHRcdHRoaXMuc3RvcmVPcGVuVGFicygpO1xuXHRcdHJldHVybiB0YWI7XG5cdH1cblxuXHRUYWJDb250cm9sbGVyLnByb3RvdHlwZS5mb2N1c1RhYiA9IGZ1bmN0aW9uIChkYXRhKSB7XG5cdFx0dmFyIGZvY3VzZWRUYWIgPSBkYXRhLmNvbnN0cnVjdG9yID09PSBUYWIgPyBkYXRhIDogdGhpcy5jdXJyZW50bHlPcGVuRmlsZXNNYXAuZ2V0KGRhdGEpO1xuXHRcdHRoaXMuZm9jdXNlZFRhYiA9IGZvY3VzZWRUYWI7XG5cdFx0QXJyYXkuZnJvbSh0aGlzLmN1cnJlbnRseU9wZW5GaWxlc01hcC52YWx1ZXMoKSkuZm9yRWFjaChmdW5jdGlvbiAodGFiKSB7XG5cdFx0XHR0YWIuY29udGVudEVsLmNsYXNzTGlzdC50b2dnbGUoJ2hhcy1mb2N1cycsIHRhYiA9PT0gZm9jdXNlZFRhYik7XG5cdFx0XHR0YWIuZWwuY2xhc3NMaXN0LnRvZ2dsZSgnaGFzLWZvY3VzJywgdGFiID09PSBmb2N1c2VkVGFiKTtcblx0XHR9KTtcblx0XHRpZiAoZm9jdXNlZFRhYi5lZGl0b3IpIGZvY3VzZWRUYWIuZWRpdG9yLmxheW91dCgpO1xuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUuY2xvc2VUYWIgPSBmdW5jdGlvbiAoZGF0YSkge1xuXHRcdHZhciB0YWIgPSBkYXRhLmNvbnN0cnVjdG9yID09PSBUYWIgPyBkYXRhIDogdGhpcy5jdXJyZW50bHlPcGVuRmlsZXNNYXAuZ2V0KGRhdGEpO1xuXHRcdHZhciB0YWJTdGF0ZSA9IEFycmF5LmZyb20odGhpcy5jdXJyZW50bHlPcGVuRmlsZXNNYXAudmFsdWVzKCkpO1xuXHRcdHZhciB0YWJJbmRleCA9IHRhYlN0YXRlLmluZGV4T2YodGFiKTtcblx0XHR2YXIgbmV4dFRhYiA9IHRhYlN0YXRlW01hdGgubWF4KDAsIHRhYkluZGV4IC0gMSldO1xuXHRcdHRoaXMuY3VycmVudGx5T3BlbkZpbGVzTWFwLmRlbGV0ZSh0YWIuZGF0YSk7XG5cdFx0dGFiLmRlc3Ryb3koKTtcblx0XHR1cGRhdGVPcGVuRmlsZUVsKCk7XG5cdFx0dGhpcy5zdG9yZU9wZW5UYWJzKCk7XG5cdFx0aWYgKHRoaXMuZm9jdXNlZFRhYiA9PT0gdGFiICYmIG5leHRUYWIpIHtcblx0XHRcdHRoaXMuZm9jdXNUYWIobmV4dFRhYik7XG5cdFx0fVxuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUuc3RvcmVPcGVuVGFicyA9IGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoIXN0YXRlLmN1cnJlbnRseU9wZW5lZFBhdGgpIHJldHVybjtcblx0XHR1cGRhdGVEQkRvYygnT1BFTl9UQUJTX0ZPUl8nICsgc3RhdGUuY3VycmVudGx5T3BlbmVkUGF0aCwge1xuXHRcdFx0b3Blbl90YWJzOiBBcnJheS5mcm9tKHRoaXMuY3VycmVudGx5T3BlbkZpbGVzTWFwLmtleXMoKSlcblx0XHR9KVxuXHRcdC5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhlcnIpO1xuXHRcdH0pO1xuXHR9XG5cblx0dmFyIHRhYkNvbnRyb2xsZXIgPSBuZXcgVGFiQ29udHJvbGxlcigpO1xuXG5cdHRhYnNFbC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgZnVuY3Rpb24gKGUpIHtcblx0XHRpZiAoZS50YXJnZXQubWF0Y2hlcygnLnRhYicpKSB7XG5cdFx0XHRpZiAoZS5idXR0b24gPT09IDApIHtcblx0XHRcdFx0dGFiQ29udHJvbGxlci5mb2N1c1RhYihlLnRhcmdldC53ZWJDb2RlVGFiKTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmJ1dHRvbiA9PT0gMikge1xuXHRcdFx0XHR0YWJDb250cm9sbGVyLmNsb3NlVGFiKGUudGFyZ2V0LndlYkNvZGVUYWIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0Y3VycmVudGx5T3BlbkZpbGVzRWwuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIGZ1bmN0aW9uIChlKSB7XG5cdFx0aWYgKGUudGFyZ2V0LmRhdGEpIHtcblx0XHRcdGlmIChlLmJ1dHRvbiA9PT0gMCkge1xuXHRcdFx0XHR0YWJDb250cm9sbGVyLmZvY3VzVGFiKGUudGFyZ2V0LmRhdGEpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuYnV0dG9uID09PSAxKSB7XG5cdFx0XHRcdHRhYkNvbnRyb2xsZXIuY2xvc2VUYWIoZS50YXJnZXQuZGF0YSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHRyZXR1cm4gdGFiQ29udHJvbGxlcjtcbn0oKSk7XG5cbmV4cG9ydCB7XG5cdHNhdmVPcGVuVGFiLFxuXHRjbG9zZU9wZW5UYWIsXG5cdHRhYkNvbnRyb2xsZXJcbn07IiwiLyogZ2xvYmFsIHJlcXVpcmUsIG1vbmFjbywgTWFwLCBTZXQsIFByb21pc2UgKi9cbi8qIGVzbGludCBuby12YXI6IDAsIG5vLWNvbnNvbGU6IDAgKi9cbi8qIGVzbGludC1lbnYgZXM2ICovXG5cbmltcG9ydCB7IHNhdmVPcGVuVGFiLCBjbG9zZU9wZW5UYWIgfSBmcm9tICcuL3RhYi1jb250cm9sbGVyJztcbmltcG9ydCB7IHByb21wdEZvck9wZW4gfSBmcm9tICcuL2ZpbGVzJztcblxucmVxdWlyZS5jb25maWcoeyBwYXRoczogeyAndnMnOiAndnMnIH0gfSk7XG5cbnZhciBtb25hY29Qcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcblx0cmVxdWlyZShbJ3ZzL2VkaXRvci9lZGl0b3IubWFpbiddLCByZXNvbHZlKTtcbn0pO1xuXG5mdW5jdGlvbiBnZXRNb25hY29MYW5ndWFnZUZyb21NaW1lcyhtaW1lKSB7XG5cdHJldHVybiAobW9uYWNvLmxhbmd1YWdlcy5nZXRMYW5ndWFnZXMoKS5maWx0ZXIoZnVuY3Rpb24gKGxhbmd1YWdlT2JqKSB7XG5cdFx0cmV0dXJuIGxhbmd1YWdlT2JqLm1pbWV0eXBlcyAmJiBsYW5ndWFnZU9iai5taW1ldHlwZXMuaW5jbHVkZXMobWltZSk7XG5cdH0pWzBdIHx8IHt9KVsnaWQnXTtcbn1cblxuZnVuY3Rpb24gZ2V0TW9uYWNvTGFuZ3VhZ2VGcm9tRXh0ZW5zaW9ucyhleHRlbnNpb24pIHtcblx0cmV0dXJuIChtb25hY28ubGFuZ3VhZ2VzLmdldExhbmd1YWdlcygpLmZpbHRlcihmdW5jdGlvbiAobGFuZ3VhZ2VPYmopIHtcblx0XHRyZXR1cm4gbGFuZ3VhZ2VPYmouZXh0ZW5zaW9ucyAmJiBsYW5ndWFnZU9iai5leHRlbnNpb25zLmluY2x1ZGVzKGV4dGVuc2lvbik7XG5cdH0pWzBdIHx8IHt9KVsnaWQnXTtcbn1cblxuZnVuY3Rpb24gc2VsZWN0TmV4dEVsKCkge1xuXHRjb25zb2xlLmxvZygnU1RVQiBCTFVSIEVESVRPUiwgTkVYVCBFTCcpO1xufVxuXG5mdW5jdGlvbiBzZWxlY3RQcmV2aW91c0VsKCkge1xuXHRjb25zb2xlLmxvZygnU1RVQiBCTFVSIEVESVRPUiwgUFJFVklPVVMgRUwnKTtcbn1cblxuZnVuY3Rpb24gbmV4dFRhYigpIHtcblx0Y29uc29sZS5sb2coJ0ZPQ1VTIE5FWFQgVEFCJyk7XG59XG5cbmZ1bmN0aW9uIHByZXZpb3VzVGFiKCkge1xuXHRjb25zb2xlLmxvZygnRk9DVVMgUFJFVklPVVMgVEFCJyk7XG59XG5cbmZ1bmN0aW9uIGFkZEJpbmRpbmdzKGVkaXRvciwgdGFiKSB7XG5cdGVkaXRvci5hZGRDb21tYW5kKG1vbmFjby5LZXlNb2QuQ3RybENtZCB8IG1vbmFjby5LZXlDb2RlLktFWV9TLCBzYXZlT3BlblRhYik7XG5cdGVkaXRvci5hZGRDb21tYW5kKG1vbmFjby5LZXlNb2QuQ3RybENtZCB8IG1vbmFjby5LZXlDb2RlLktFWV9PLCBwcm9tcHRGb3JPcGVuKTtcblx0ZWRpdG9yLmFkZENvbW1hbmQobW9uYWNvLktleUNvZGUuS0VZX1cgfCBtb25hY28uS2V5TW9kLkN0cmxDbWQsIGNsb3NlT3BlblRhYik7XG5cdGVkaXRvci5hZGRDb21tYW5kKG1vbmFjby5LZXlDb2RlLkY2LCBzZWxlY3ROZXh0RWwpO1xuXHRlZGl0b3IuYWRkQ29tbWFuZChtb25hY28uS2V5Q29kZS5GNiB8IG1vbmFjby5LZXlNb2QuU2hpZnQsIHNlbGVjdFByZXZpb3VzRWwpO1xuXHRlZGl0b3IuYWRkQ29tbWFuZChtb25hY28uS2V5Q29kZS5UYWIgfCBtb25hY28uS2V5TW9kLkN0cmxDbWQsIG5leHRUYWIpO1xuXHRlZGl0b3IuYWRkQ29tbWFuZChtb25hY28uS2V5Q29kZS5UYWIgfCBtb25hY28uS2V5TW9kLlNoaWZ0IHwgbW9uYWNvLktleU1vZC5DdHJsQ21kLCBwcmV2aW91c1RhYik7XG5cdGVkaXRvci5hZGRDb21tYW5kKG1vbmFjby5LZXlDb2RlLktFWV9QIHwgbW9uYWNvLktleU1vZC5TaGlmdCB8IG1vbmFjby5LZXlNb2QuQ3RybENtZCwgZnVuY3Rpb24gb3BlbkNvbW1hbmRQYWxldHRlKCkge1xuXHRcdGVkaXRvci50cmlnZ2VyKCdhbnlTdHJpbmcnLCAnZWRpdG9yLmFjdGlvbi5xdWlja0NvbW1hbmQnKTtcblx0fSk7XG5cblx0ZWRpdG9yLndlYkNvZGVTdGF0ZSA9IHt9O1xuXHRlZGl0b3Iud2ViQ29kZVN0YXRlLnNhdmVkQWx0ZXJuYXRpdmVWZXJzaW9uSWQgPSBlZGl0b3IubW9kZWwuZ2V0QWx0ZXJuYXRpdmVWZXJzaW9uSWQoKTtcblx0ZWRpdG9yLndlYkNvZGVTdGF0ZS50YWIgPSB0YWI7XG5cblx0ZWRpdG9yLndlYkNvZGVTdGF0ZS5mdW5jdGlvbnMgPSB7XG5cdFx0Y2hlY2tGb3JDaGFuZ2VzOiBmdW5jdGlvbiBjaGVja0ZvckNoYW5nZXMoKSB7XG5cdFx0XHR2YXIgaGFzQ2hhbmdlcyA9IGVkaXRvci53ZWJDb2RlU3RhdGUuc2F2ZWRBbHRlcm5hdGl2ZVZlcnNpb25JZCAhPT0gZWRpdG9yLm1vZGVsLmdldEFsdGVybmF0aXZlVmVyc2lvbklkKCk7XG5cdFx0XHRlZGl0b3Iud2ViQ29kZVN0YXRlLmhhc0NoYW5nZXMgPSBoYXNDaGFuZ2VzO1xuXHRcdFx0dGFiLmVsLmNsYXNzTGlzdC50b2dnbGUoJ2hhcy1jaGFuZ2VzJywgaGFzQ2hhbmdlcyk7XG5cdFx0fVxuXHR9XG5cblx0ZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KGVkaXRvci53ZWJDb2RlU3RhdGUuZnVuY3Rpb25zLmNoZWNrRm9yQ2hhbmdlcyk7XG5cblxufVxuXG5leHBvcnQgeyBtb25hY29Qcm9taXNlLCBnZXRNb25hY29MYW5ndWFnZUZyb21FeHRlbnNpb25zLCBnZXRNb25hY29MYW5ndWFnZUZyb21NaW1lcywgYWRkQmluZGluZ3MgfTtcbiIsIi8qIGdsb2JhbCByZXF1aXJlLCBNYXAsIFNldCwgUHJvbWlzZSAqL1xuLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuLyogZXNsaW50LWVudiBlczYgKi9cblxuaW1wb3J0IHsgcG9wdWxhdGVGaWxlTGlzdCB9IGZyb20gJy4vZmlsZXMnO1xuXG52YXIgaGlnaGxpZ2h0ZWRFbDtcbnZhciBjdXJyZW50UGF0aDtcbnZhciByZXNvbHZlcjtcbnZhciByZWplY3RlcjtcblxuZnVuY3Rpb24gb3BlbkZpbGVEaWFsb2cocGF0aCkge1xuXG5cdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0aWYgKG9wZW5GaWxlRGlhbG9nLm9wZW4gPT09IHVuZGVmaW5lZCkgb3BlbkZpbGVEaWFsb2cub3BlbiA9IGZhbHNlO1xuXHRcdGlmIChvcGVuRmlsZURpYWxvZy5vcGVuID09PSB0cnVlKSB7XG5cdFx0XHR0aHJvdyBFcnJvcignRGlhbG9nIGFscmVhZHkgb3BlbiBmb3IgYW5vdGhlciB0YXNrLicpO1xuXHRcdH1cblx0XHRwYXRoID0gcGF0aCB8fCAnLyc7XG5cdFx0Y3VycmVudFBhdGggPSBwYXRoO1xuXHRcdG9wZW5GaWxlRGlhbG9nLmVsLmNsYXNzTGlzdC5yZW1vdmUoJ2Nsb3NlZCcpO1xuXHRcdHJlc29sdmVyID0gcmVzb2x2ZTtcblx0XHRyZWplY3RlciA9IHJlamVjdDtcblx0XHRvcGVuRmlsZURpYWxvZy5jdXJyZW50UGF0aEVsLnZhbHVlID0gY3VycmVudFBhdGg7XG5cblx0XHRwb3B1bGF0ZUZpbGVMaXN0KG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdCwgcGF0aCwge1xuXHRcdFx0bmVzdGVkOiBmYWxzZVxuXHRcdH0pXG5cdFx0XHQuY2F0Y2goZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coZSk7XG5cdFx0XHRcdHJldHVybiBwb3B1bGF0ZUZpbGVMaXN0KG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdCwgJy8nLCB7XG5cdFx0XHRuZXN0ZWQ6IGZhbHNlXG5cdFx0fSlcblx0XHRcdH0pO1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gaGlnaGxpZ2h0KGUpIHtcblx0aWYgKGUudGFyZ2V0LnRhZ05hbWUgPT09ICdMSScpIHtcblx0XHRpZiAoaGlnaGxpZ2h0ZWRFbCkge1xuXHRcdFx0aGlnaGxpZ2h0ZWRFbC5jbGFzc0xpc3QucmVtb3ZlKCdoYXMtaGlnaGxpZ2h0Jyk7XG5cdFx0fVxuXHRcdGhpZ2hsaWdodGVkRWwgPSBlLnRhcmdldDtcblx0XHRoaWdobGlnaHRlZEVsLmNsYXNzTGlzdC5hZGQoJ2hhcy1oaWdobGlnaHQnKTtcblxuXHRcdGN1cnJlbnRQYXRoID0gZS50YXJnZXQuZGF0YS5wYXRoO1xuXHRcdG9wZW5GaWxlRGlhbG9nLmN1cnJlbnRQYXRoRWwudmFsdWUgPSBjdXJyZW50UGF0aDtcblxuXHRcdGlmIChlLnRhcmdldC5kYXRhICYmIGUudGFyZ2V0LmRhdGEuaXNEaXIpIHtcblx0XHRcdGlmIChlLmN1cnJlbnRUYXJnZXQgPT09IG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdCkge1xuXHRcdFx0XHRpZiAoZS50YXJnZXQuZGF0YS5uYW1lID09PSAnLi4nKSB7XG5cdFx0XHRcdFx0cG9wdWxhdGVGaWxlTGlzdChvcGVuRmlsZURpYWxvZy5maWxlbGlzdExlZnQsIGUudGFyZ2V0LmRhdGEucGF0aCwge1xuXHRcdFx0XHRcdFx0bmVzdGVkOiBmYWxzZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0UmlnaHQuaW5uZXJIVE1MID0gJyc7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cG9wdWxhdGVGaWxlTGlzdChvcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0LCBlLnRhcmdldC5kYXRhLnBhdGgsIHtcblx0XHRcdFx0XHRcdG5lc3RlZDogZmFsc2Vcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGUuY3VycmVudFRhcmdldCA9PT0gb3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RSaWdodCkge1xuXHRcdFx0XHRwb3B1bGF0ZUZpbGVMaXN0KG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdCwgZS50YXJnZXQuZGF0YS5kaXJOYW1lLCB7XG5cdFx0XHRcdFx0bmVzdGVkOiBmYWxzZVxuXHRcdFx0XHR9KVxuXHRcdFx0XHRcdC50aGVuKGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdFtdLnNsaWNlLmNhbGwob3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0LmNoaWxkcmVuKS5mb3JFYWNoKGZ1bmN0aW9uIChlbCkge1xuXHRcdFx0XHRcdFx0XHRpZiAoZWwuZGF0YS5wYXRoID09PSBjdXJyZW50UGF0aCkge1xuXHRcdFx0XHRcdFx0XHRcdGhpZ2hsaWdodGVkRWwgPSBlLnRhcmdldDtcblx0XHRcdFx0XHRcdFx0XHRoaWdobGlnaHRlZEVsLmNsYXNzTGlzdC5hZGQoJ2hhcy1oaWdobGlnaHQnKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdHBvcHVsYXRlRmlsZUxpc3Qob3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RSaWdodCwgZS50YXJnZXQuZGF0YS5wYXRoLCB7XG5cdFx0XHRcdFx0bmVzdGVkOiBmYWxzZVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gb25kYmxjbGljayhlKSB7XG5cdGhpZ2hsaWdodChlKTtcblx0aWYgKGUudGFyZ2V0LmRhdGEgJiYgZS50YXJnZXQuZGF0YS5pc0RpcikgcmV0dXJuO1xuXHRvcGVuKGUudGFyZ2V0LmRhdGEpO1xufVxuXG5mdW5jdGlvbiBvcGVuKGRhdGEpIHtcblx0b3BlbkZpbGVEaWFsb2cuZWwuY2xhc3NMaXN0LmFkZCgnY2xvc2VkJyk7XG5cdHJlc29sdmVyKGRhdGEpO1xuXHRyZXNvbHZlciA9IHVuZGVmaW5lZDtcblx0cmVqZWN0ZXIgPSB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGNhbmNlbCgpIHtcblx0b3BlbkZpbGVEaWFsb2cuZWwuY2xhc3NMaXN0LmFkZCgnY2xvc2VkJyk7XG5cdHJlamVjdGVyKCdVc2VyIGNhbmNlbGVkJyk7XG5cdHJlc29sdmVyID0gdW5kZWZpbmVkO1xuXHRyZWplY3RlciA9IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gb25rZXlkb3duKGUpIHtcblx0aWYgKGV2ZW50LmtleUNvZGUgPT09IDEzKSBvbmRibGNsaWNrKGUpO1xufVxuXG5vcGVuRmlsZURpYWxvZy5lbCA9IG9wZW5GaWxlRGlhbG9nLmVsIHx8IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNmaWxlLW9wZW4td2lkZ2V0Jyk7XG5vcGVuRmlsZURpYWxvZy5jdXJyZW50UGF0aEVsID0gb3BlbkZpbGVEaWFsb2cuY3VycmVudFBhdGhFbCB8fCBvcGVuRmlsZURpYWxvZy5lbC5xdWVyeVNlbGVjdG9yKCdpbnB1dFtuYW1lPVwiY3VycmVudC1wYXRoXCJdJyk7XG5vcGVuRmlsZURpYWxvZy5maWxlbGlzdExlZnQgPSBvcGVuRmlsZURpYWxvZy5maWxlbGlzdExlZnQgfHwgb3BlbkZpbGVEaWFsb2cuZWwucXVlcnlTZWxlY3RvcignLmZpbGVsaXN0OmZpcnN0LWNoaWxkJyk7XG5vcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0ID0gb3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RSaWdodCB8fCBvcGVuRmlsZURpYWxvZy5lbC5xdWVyeVNlbGVjdG9yKCcuZmlsZWxpc3Q6bm90KDpmaXJzdC1jaGlsZCknKTtcbm9wZW5GaWxlRGlhbG9nLm9wZW5CdXR0b24gPSBvcGVuRmlsZURpYWxvZy5vcGVuQnV0dG9uIHx8IG9wZW5GaWxlRGlhbG9nLmVsLnF1ZXJ5U2VsZWN0b3IoJyNmaWxlLW9wZW4tb3BlbicpO1xub3BlbkZpbGVEaWFsb2cuY2FuY2VsQnV0dG9uID0gb3BlbkZpbGVEaWFsb2cuY2FuY2VsQnV0dG9uIHx8IG9wZW5GaWxlRGlhbG9nLmVsLnF1ZXJ5U2VsZWN0b3IoJyNmaWxlLW9wZW4tY2FuY2VsJyk7XG5vcGVuRmlsZURpYWxvZy51cERpckJ1dHRvbiA9IG9wZW5GaWxlRGlhbG9nLnVwRGlyQnV0dG9uIHx8IG9wZW5GaWxlRGlhbG9nLmVsLnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbltkYXRhLWFjdGlvbj1cInVwLWRpclwiXScpO1xuXG5vcGVuRmlsZURpYWxvZy5maWxlbGlzdExlZnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBoaWdobGlnaHQpO1xub3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RSaWdodC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGhpZ2hsaWdodCk7XG5cbm9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgb25rZXlkb3duKTtcbm9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0UmlnaHQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIG9ua2V5ZG93bik7XG5cbm9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdC5hZGRFdmVudExpc3RlbmVyKCdkYmxjbGljaycsIG9uZGJsY2xpY2spO1xub3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RSaWdodC5hZGRFdmVudExpc3RlbmVyKCdkYmxjbGljaycsIG9uZGJsY2xpY2spO1xub3BlbkZpbGVEaWFsb2cub3BlbkJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcblx0b3BlbihoaWdobGlnaHRlZEVsLmRhdGEpO1xufSk7XG5vcGVuRmlsZURpYWxvZy5jYW5jZWxCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG5cdGNhbmNlbCgpO1xufSk7XG5vcGVuRmlsZURpYWxvZy51cERpckJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcblx0Y29uc29sZS5sb2coJ1NUVUIgR08gVVAgRElSJyk7XG59KTtcblxuZXhwb3J0IGRlZmF1bHQgb3BlbkZpbGVEaWFsb2c7IiwiLyogZ2xvYmFsIHJlcXVpcmUsIE1hcCwgU2V0LCBQcm9taXNlLCBtb25hY28gKi9cbi8qIGVzbGludCBuby12YXI6IDAsIG5vLWNvbnNvbGU6IDAgKi9cbi8qIGVzbGludC1lbnYgZXM2ICovXG5cbmltcG9ydCB7XG5cdHJlbW90ZUNtZFxufSBmcm9tICcuL3dzJztcblxuaW1wb3J0IHN0YXRlIGZyb20gJy4vc3RhdGUnO1xuaW1wb3J0IHsgZGIsIHVwZGF0ZURCRG9jIH0gZnJvbSAnLi9kYic7XG5pbXBvcnQgeyB0YWJDb250cm9sbGVyIH0gZnJvbSAnLi90YWItY29udHJvbGxlcic7XG5pbXBvcnQgeyBtb25hY29Qcm9taXNlLCBnZXRNb25hY29MYW5ndWFnZUZyb21FeHRlbnNpb25zLCBnZXRNb25hY29MYW5ndWFnZUZyb21NaW1lcywgYWRkQmluZGluZ3MgfSBmcm9tICcuL21vbmFjbyc7XG5pbXBvcnQgb3BlbkZpbGVEaWFsb2cgZnJvbSAnLi9vcGVuLWZpbGUtZGlhbG9nJztcblxuLy8gTWFwIHRvIHByZXZlbnQgZHVwbGljYXRlIGRhdGEgb2JqZWN0cyBmb3IgZWFjaCBmaWxlXG52YXIgcGF0aFRvRGF0YU1hcCA9IG5ldyBNYXAoKTtcblxuZnVuY3Rpb24gcmVuZGVyRmlsZUxpc3QoZWwsIGRhdGEsIG9wdGlvbnMpIHtcblxuXHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblx0dmFyIHVzZU9wdGlvbnMgPSB7XG5cdFx0aGlkZURvdEZpbGVzOiAob3B0aW9ucy5oaWRlRG90RmlsZXMgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuaGlkZURvdEZpbGVzIDogdHJ1ZSksXG5cdFx0bmVzdGVkOiAob3B0aW9ucy5uZXN0ZWQgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubmVzdGVkIDogdHJ1ZSksXG5cdFx0bmVzdGluZ0xpbWl0OiAob3B0aW9ucy5uZXN0aW5nTGltaXQgfHwgNSkgLSAxXG5cdH1cblx0aWYgKG9wdGlvbnMubmVzdGluZ0xpbWl0ID09PSAwKSByZXR1cm47XG5cblx0ZWwuaW5uZXJIVE1MID0gJyc7XG5cdGVsLmRhdGEgPSBkYXRhO1xuXG5cdHZhciBzb3J0ZWREYXRhID0gQXJyYXkuZnJvbShkYXRhLmNoaWxkcmVuKVxuXHRcdC5maWx0ZXIoZnVuY3Rpb24gKGRhdHVtKSB7XG5cblx0XHRcdC8vIFdoZXRoZXIgdG8gaGlkZSBkb3RmaWxlc1xuXHRcdFx0aWYgKGRhdHVtLm5hbWUgIT09ICcuLicgJiYgdXNlT3B0aW9ucy5oaWRlRG90RmlsZXMgIT09IGZhbHNlKSB7XG5cdFx0XHRcdHJldHVybiBkYXR1bS5uYW1lWzBdICE9PSAnLic7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9KVxuXHRcdC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG5cdFx0XHRpZiAoYS5uYW1lID09PSAnLi4nKSB7XG5cdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdH1cblx0XHRcdGlmIChiLm5hbWUgPT09ICcuLicpIHtcblx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdChhLmlzRGlyID09PSBiLmlzRGlyKSAmJlxuXHRcdFx0XHQoYS5pc0ZpbGUgPT09IGIuaXNGaWxlKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiAoW2EubmFtZSwgYi5uYW1lXS5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGEudG9Mb3dlckNhc2UoKS5sb2NhbGVDb21wYXJlKGIudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRcdH0pWzBdID09PSBhLm5hbWUgPyAtMSA6IDEpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGEuaXNEaXIpIHJldHVybiAtMTtcblx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRzb3J0ZWREYXRhLm1hcChmdW5jdGlvbiAoZGF0dW0pIHtcblx0XHRcdHZhciBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XG5cdFx0XHRsaS5jbGFzc0xpc3QuYWRkKCdoYXMtaWNvbicpO1xuXHRcdFx0bGkuZGF0YXNldC5taW1lID0gZGF0dW0ubWltZTtcblx0XHRcdGxpLmRhdGFzZXQubmFtZSA9IGRhdHVtLm5hbWU7XG5cdFx0XHRsaS5kYXRhc2V0LnNpemUgPSBkYXR1bS5zaXplO1xuXHRcdFx0bGkudGV4dENvbnRlbnQgPSBkYXR1bS5uYW1lO1xuXHRcdFx0bGkudGFiSW5kZXggPSAxO1xuXHRcdFx0bGkuZGF0YSA9IGRhdHVtO1xuXHRcdFx0ZWwuYXBwZW5kQ2hpbGQobGkpO1xuXG5cdFx0XHRpZiAoZGF0dW0uaXNEaXIgJiYgdXNlT3B0aW9ucy5uZXN0ZWQgIT09IGZhbHNlKSB7XG5cdFx0XHRcdHZhciBuZXdGaWxlTGlzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3VsJyk7XG5cdFx0XHRcdG5ld0ZpbGVMaXN0LmNsYXNzTGlzdC5hZGQoJ2ZpbGVsaXN0Jyk7XG5cdFx0XHRcdGxpLmFwcGVuZENoaWxkKG5ld0ZpbGVMaXN0KTtcblx0XHRcdFx0aWYgKGRhdHVtLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0cmVuZGVyRmlsZUxpc3QobmV3RmlsZUxpc3QsIGRhdHVtLCB1c2VPcHRpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xufVxuXG5mdW5jdGlvbiBwb3B1bGF0ZUZpbGVMaXN0KGVsLCBwYXRoLCBvcHRpb25zKSB7XG5cdGVsLnBhdGggPSBwYXRoO1xuXHRyZXR1cm4gcmVtb3RlQ21kKCdTVEFUJywgcGF0aClcblx0XHQudGhlbihmdW5jdGlvbiAoZGF0YSkge1xuXHRcdFx0aWYgKGRhdGEuaXNGaWxlKSB7XG5cdFx0XHRcdHJldHVybiByZW1vdGVDbWQoJ1NUQVQnLCBkYXRhLmRpck5hbWUpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0fSlcblx0XHQudGhlbihmdW5jdGlvbiAoZGF0YSkge1xuXHRcdFx0ZGF0YSA9IGRlZHVwKGRhdGEpO1xuXHRcdFx0cmVuZGVyRmlsZUxpc3QoZWwsIGRhdGEsIG9wdGlvbnMpO1xuXHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0fSk7XG59XG5cblxuZnVuY3Rpb24gZGVkdXAoZGF0YSkge1xuXG5cdHZhciBuZXdDaGlsZHJlbjtcblx0dmFyIG9sZENoaWxkcmVuO1xuXG5cdC8vIFRoYXQgd2F5IGlmIGFueSBvZiB0aGVzZSBjaGFuZ2UgdGhlbiB0aGUgZmlsZSBpcyB1cGRhdGVkXG5cdHZhciBrZXkgPSBKU09OLnN0cmluZ2lmeSh7XG5cdFx0cGF0aDogZGF0YS5wYXRoLFxuXHRcdGlzRGlyOiBkYXRhLmlzRGlyLFxuXHRcdGlzRmlsZTogZGF0YS5pc0ZpbGUsXG5cdFx0bWltZTogZGF0YS5taW1lXG5cdH0pO1xuXG5cdGlmIChkYXRhLmNoaWxkcmVuKSBuZXdDaGlsZHJlbiA9IGRhdGEuY2hpbGRyZW47XG5cblx0Ly8gZW5zdXJlIHRoYXQgZGF0YSBvYmplY3RzIGFyZSBub3QgZHVwbGljYXRlZC5cblx0aWYgKHBhdGhUb0RhdGFNYXAuaGFzKGtleSkpIHtcblx0XHRkYXRhID0gcGF0aFRvRGF0YU1hcC5nZXQoa2V5KTtcblx0XHRvbGRDaGlsZHJlbiA9IGRhdGEuY2hpbGRyZW47XG5cdH0gZWxzZSB7XG5cdFx0cGF0aFRvRGF0YU1hcC5zZXQoa2V5LCBkYXRhKTtcblx0fVxuXG5cdGlmIChkYXRhLmlzRGlyKSB7XG5cblx0XHRpZiAoIW9sZENoaWxkcmVuICYmICFuZXdDaGlsZHJlbikge1xuXHRcdFx0Ly8gZG8gbm90aGluZywgd2UgaGF2ZSBubyBjaGlsZHJlbiBhbmQgd2UgbmVlZCB0byBhZGQgbm8gY2hpbGRyZW5cblx0XHRcdHJldHVybiBkYXRhO1xuXHRcdH1cblxuXHRcdGlmICghb2xkQ2hpbGRyZW4gJiYgbmV3Q2hpbGRyZW4pIHtcblx0XHRcdC8vIG5vIFNldCBwcmVzZW50IHRoZW4gY3JlYXRlIG9uZSB0byBiZSBwcmVhcmVkIGluIHRoZSBuZXh0IG9uZVxuXHRcdFx0ZGF0YS5jaGlsZHJlbiA9IG5ldyBTZXQoKTtcblx0XHRcdG9sZENoaWxkcmVuID0gZGF0YS5jaGlsZHJlbjtcblx0XHR9XG5cblx0XHRpZiAob2xkQ2hpbGRyZW4gJiYgbmV3Q2hpbGRyZW4pIHtcblx0XHRcdC8vIFNldCBpcyBwcmVzZW50IHNvIHBvcHVsYXRlIGl0XG5cblx0XHRcdG5ld0NoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGNoaWxkRGF0YSkge1xuXHRcdFx0XHRvbGRDaGlsZHJlbi5hZGQoZGVkdXAoY2hpbGREYXRhKSk7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBkYXRhO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBkYXRhO1xufVxuXG5mdW5jdGlvbiBvcGVuUGF0aChkYXRhKSB7XG5cdGlmIChkYXRhLmlzRGlyKSB7XG5cblx0XHRpZiAoc3RhdGUuY3VycmVudGx5T3BlbmVkUGF0aCAhPT0gZGF0YS5wYXRoKSB7XG5cdFx0XHQvLyBUT0RPOiBjbG9zZSBhbGwgdGFic1xuXG5cdFx0XHQvLyBUaGVuIG9wZW4gdGhlIHNhdmVkIHRhYnMgZnJvbSBsYXN0IHRpbWVcblx0XHRcdGRiLmdldCgnT1BFTl9UQUJTX0ZPUl8nICsgZGF0YS5wYXRoKS50aGVuKGZ1bmN0aW9uICh0YWJzKSB7XG5cdFx0XHRcdHRhYnMub3Blbl90YWJzLmZvckVhY2gob3BlbkZpbGUpO1xuXHRcdFx0fSkuY2F0Y2goZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coZSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRzdGF0ZS5jdXJyZW50bHlPcGVuZWRQYXRoID0gZGF0YS5wYXRoO1xuXG5cdFx0dmFyIGZpbGVsaXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpcmVjdG9yeScpO1xuXHRcdHBvcHVsYXRlRmlsZUxpc3QoZmlsZWxpc3QsIGRhdGEucGF0aCwge1xuXHRcdFx0aGlkZURvdEZpbGVzOiB0cnVlXG5cdFx0fSk7XG5cblx0XHR1cGRhdGVEQkRvYygnSU5JVF9TVEFURScsIHtcblx0XHRcdHByZXZpb3VzX3BhdGg6IHsgcGF0aDogZGF0YS5wYXRoLCBpc0RpcjogdHJ1ZSB9XG5cdFx0fSlcblx0XHQuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coZXJyKTtcblx0XHR9KTtcblxuXHR9XG5cdGlmIChkYXRhLmlzRmlsZSkge1xuXHRcdG9wZW5GaWxlKGRhdGEpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIG9wZW5GaWxlKGRhdGEpIHtcblxuXHRkYXRhID0gZGVkdXAoZGF0YSk7XG5cblx0aWYgKHRhYkNvbnRyb2xsZXIuaGFzVGFiKGRhdGEpKSB7XG5cdFx0dGFiQ29udHJvbGxlci5mb2N1c1RhYihkYXRhKTtcblx0fSBlbHNlIHtcblx0XHR2YXIgbmV3VGFiID0gdGFiQ29udHJvbGxlci5uZXdUYWIoZGF0YSk7XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwoW3JlbW90ZUNtZCgnT1BFTicsIGRhdGEucGF0aCksIG1vbmFjb1Byb21pc2VdKVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24gKGFycikge1xuXHRcdFx0XHRyZXR1cm4gYXJyWzBdO1xuXHRcdFx0fSlcblx0XHRcdC50aGVuKGZ1bmN0aW9uIChmaWxlQ29udGVudHMpIHtcblx0XHRcdFx0dmFyIGxhbmd1YWdlID0gZ2V0TW9uYWNvTGFuZ3VhZ2VGcm9tTWltZXMoZGF0YS5taW1lKSB8fCBnZXRNb25hY29MYW5ndWFnZUZyb21FeHRlbnNpb25zKGRhdGEuZXh0ZW5zaW9uKTtcblx0XHRcdFx0bmV3VGFiLmVkaXRvciA9IG1vbmFjby5lZGl0b3IuY3JlYXRlKG5ld1RhYi5jb250ZW50RWwsIHtcblx0XHRcdFx0XHR2YWx1ZTogZmlsZUNvbnRlbnRzLFxuXHRcdFx0XHRcdGxhbmd1YWdlOiBsYW5ndWFnZVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0YWRkQmluZGluZ3MobmV3VGFiLmVkaXRvciwgbmV3VGFiKTtcblx0XHRcdH0pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHByb21wdEZvck9wZW4oKSB7XG5cdG9wZW5GaWxlRGlhbG9nKHN0YXRlLmN1cnJlbnRseU9wZW5lZFBhdGggfHwgJy8nKS50aGVuKG9wZW5QYXRoKTtcbn1cblxuZXhwb3J0IHtcblx0ZGVkdXAsXG5cdHBvcHVsYXRlRmlsZUxpc3QsXG5cdHJlbmRlckZpbGVMaXN0LFxuXHRvcGVuRmlsZSxcblx0b3BlblBhdGgsXG5cdHByb21wdEZvck9wZW5cbn07IiwiLyogZ2xvYmFsIHJlcXVpcmUsIE1hcCwgU2V0LCBQcm9taXNlICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG5pbXBvcnQgeyBwb3B1bGF0ZUZpbGVMaXN0LCBvcGVuRmlsZSB9IGZyb20gJy4vZmlsZXMnO1xuXG5mdW5jdGlvbiBzZXRVcFNpZGVCYXIoKSB7XG5cblx0ZnVuY3Rpb24gZXhwYW5kRGlyKGVsLCBkYXRhKSB7XG5cdFx0dmFyIGZpbGVsaXN0RWwgPSBlbC5xdWVyeVNlbGVjdG9yKCcuZmlsZWxpc3QnKTtcblx0XHRpZiAoZmlsZWxpc3RFbC5jaGlsZHJlbi5sZW5ndGgpIHtcblx0XHRcdGZpbGVsaXN0RWwuaW5uZXJIVE1MID0gJyc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHBvcHVsYXRlRmlsZUxpc3QoZmlsZWxpc3RFbCwgZGF0YS5wYXRoLCB7XG5cdFx0XHRcdGhpZGVEb3RGaWxlczogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0dmFyIGRpcmVjdG9yeUVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2RpcmVjdG9yeScpO1xuXG5cdGZ1bmN0aW9uIG9uY2xpY2soZSkge1xuXHRcdGlmIChlLnRhcmdldC50YWdOYW1lID09PSAnTEknKSB7XG5cdFx0XHRpZiAoZS50YXJnZXQuZGF0YS5pc0ZpbGUpIG9wZW5GaWxlKGUudGFyZ2V0LmRhdGEpO1xuXHRcdFx0aWYgKGUudGFyZ2V0LmRhdGEuaXNEaXIpIGV4cGFuZERpcihlLnRhcmdldCwgZS50YXJnZXQuZGF0YSk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gb25rZXlkb3duKGUpIHtcblx0XHRpZiAoZXZlbnQua2V5Q29kZSA9PT0gMTMpIG9uY2xpY2soZSk7XG5cdH1cblxuXHRkaXJlY3RvcnlFbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIG9uY2xpY2spO1xuXHRkaXJlY3RvcnlFbC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgb25rZXlkb3duKTtcblxufTtcblxuZXhwb3J0IHsgc2V0VXBTaWRlQmFyIH07IiwiLyogZ2xvYmFsIHJlcXVpcmUsIE1hcCwgU2V0LCBQcm9taXNlICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG5pbXBvcnQgeyBkYiB9IGZyb20gJy4vbGliL2RiJztcbmltcG9ydCB7IHdzUHJvbWlzZSB9IGZyb20gJy4vbGliL3dzJztcbmltcG9ydCB7IG9wZW5QYXRoLCBwcm9tcHRGb3JPcGVuIH0gZnJvbSAnLi9saWIvZmlsZXMnO1xuaW1wb3J0IHsgc2F2ZU9wZW5UYWIgfSBmcm9tICcuL2xpYi90YWItY29udHJvbGxlcic7XG5pbXBvcnQgeyBzZXRVcFNpZGVCYXIgfSBmcm9tICcuL2xpYi9zaWRlLWJhcic7XG5cbmZ1bmN0aW9uIGluaXQoKSB7XG5cblx0ZGIuZ2V0KCdJTklUX1NUQVRFJylcblx0XHQudGhlbihmdW5jdGlvbiAoZG9jKSB7XG5cdFx0XHRpZiAoZG9jLnByZXZpb3VzX3BhdGgpIHtcblx0XHRcdFx0cmV0dXJuIG9wZW5QYXRoKGRvYy5wcmV2aW91c19wYXRoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBwcm9tcHRGb3JPcGVuKCk7XG5cdFx0XHR9XG5cdFx0fSlcblx0XHQuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuXHRcdFx0cHJvbXB0Rm9yT3BlbigpO1xuXHRcdFx0Y29uc29sZS5sb2coZXJyKTtcblx0XHR9KTtcbn1cblxud3NQcm9taXNlLnRoZW4oaW5pdCk7XG5cbihmdW5jdGlvbiBzZXRVcFRvb2xCYXIoKSB7XG5cdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbltkYXRhLWFjdGlvbj1cIm9wZW4tZmlsZVwiXScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgcHJvbXB0Rm9yT3Blbik7XG5cdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbltkYXRhLWFjdGlvbj1cInNhdmUtZmlsZVwiXScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgc2F2ZU9wZW5UYWIpO1xufSgpKTtcblxuc2V0VXBTaWRlQmFyKCk7Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBOzs7O0FBSUEsSUFBSSxFQUFFLEdBQUcsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxDQUFD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
