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

var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
var ws = new WebSocket((isLocal ? 'ws://' : 'wss://') + location.host);
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
				return promiseResolver[0](data.result);
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

/* global require, Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

function fsProxy() {
	var args = Array.from(arguments);
	var cmd = args.shift();

	function execute() {
		var args = Array.from(arguments);
		return remoteCmd('FS_PROXY', {
			cmd: cmd,
			arguments: args
		});
	}

	if (args.length === 0) return execute;
	return execute.apply(null, args);
}

var fs = {};

[
	'stat',
	'readFile',
	'writeFile'
].forEach(function (cmd) {
	fs[cmd] = fsProxy(cmd);
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
	fs.writeFile(data.path, tab.editor.getValue())
	.then(function () {
		tab.editor.webCodeState.savedAlternativeVersionId = altId;
		tab.editor.webCodeState.functions.checkForChanges();
	});
}

function closeOpenTab() {
	var tab = tabController.getOpenTab();
	if (tab) tabController.closeTab(tab);
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
		this.closeEl.setAttribute('aria-label', 'Close Tab ' + data.name);
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
			if (e.button === 1) {
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
	return remoteCmd('GET_PATH_INFO', path)
		.then(function (data) {
			if (data.isFile) {
				return remoteCmd('GET_PATH_INFO', data.dirName);
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

		return Promise.all([fs.readFile(data.path, 'utf8'), monacoPromise])
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

window.addEventListener('resize', function () {
	var tab = tabController.getOpenTab();
	if (tab) tab.editor.layout();
});

setUpSideBar();

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyJsaWIvZGIuanMiLCJsaWIvd3MuanMiLCJsaWIvZnMtcHJveHkuanMiLCJsaWIvc3RhdGUuanMiLCJsaWIvdGFiLWNvbnRyb2xsZXIuanMiLCJsaWIvbW9uYWNvLmpzIiwibGliL29wZW4tZmlsZS1kaWFsb2cuanMiLCJsaWIvZmlsZXMuanMiLCJsaWIvc2lkZS1iYXIuanMiLCJtYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCByZXF1aXJlLCBQcm9taXNlLCBQb3VjaERCICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG52YXIgZGIgPSBuZXcgUG91Y2hEQignd2ViLWNvZGUnLCB7fSk7XG5mdW5jdGlvbiB1cGRhdGVEQkRvYyhfaWQsIG9iaikge1xuXG5cdHVwZGF0ZURCRG9jLnByb21pc2UgPSB1cGRhdGVEQkRvYy5wcm9taXNlIHx8IFByb21pc2UucmVzb2x2ZSgpO1xuXG5cdC8qIHVwZGF0ZSBsYXN0IG9wZW4gZm9sZGVyIGluIGRiICovXG5cdHJldHVybiB1cGRhdGVEQkRvYy5wcm9taXNlID0gdXBkYXRlREJEb2MucHJvbWlzZVxuXHRcdC50aGVuKGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiBkYi5nZXQoX2lkKVxuXHRcdH0pXG5cdFx0LmNhdGNoKGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRpZiAoZS5zdGF0dXMgPT09IDQwNCkge1xuXHRcdFx0XHRyZXR1cm4geyBfaWQ6IF9pZCB9XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH0pXG5cdFx0LnRoZW4oZnVuY3Rpb24gKGRvYykge1xuXHRcdFx0T2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdFx0ZG9jW2tleV0gPSBvYmpba2V5XTtcblx0XHRcdH0pO1xuXHRcdFx0ZGIucHV0KGRvYyk7XG5cdFx0fSk7XG59XG5cbmV4cG9ydCB7IGRiLCB1cGRhdGVEQkRvYyB9OyIsIi8qIGdsb2JhbCByZXF1aXJlLCBNYXAsIFNldCwgUHJvbWlzZSAqL1xuLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuLyogZXNsaW50LWVudiBlczYgKi9cblxudmFyIGlzTG9jYWwgPSBsb2NhdGlvbi5ob3N0bmFtZSA9PT0gJ2xvY2FsaG9zdCcgfHwgbG9jYXRpb24uaG9zdG5hbWUgPT09ICcxMjcuMC4wLjEnO1xudmFyIHdzID0gbmV3IFdlYlNvY2tldCgoaXNMb2NhbCA/ICd3czovLycgOiAnd3NzOi8vJykgKyBsb2NhdGlvbi5ob3N0KTtcbndzLmJpbmFyeVR5cGUgPSAnYXJyYXlidWZmZXInO1xuXG52YXIgcHJvbWlzZXMgPSBuZXcgTWFwKCk7XG5cbndzLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiBtKGUpIHtcblx0aWYgKHR5cGVvZiBlLmRhdGEgPT09ICdzdHJpbmcnKSB7XG5cdFx0dmFyIHJlc3VsdCA9IEpTT04ucGFyc2UoZS5kYXRhKTtcblx0XHR2YXIgcHJvbWlzZVJlc29sdmVyID0gcHJvbWlzZXMuZ2V0KHJlc3VsdFsxXSk7XG5cdFx0dmFyIGRhdGEgPSByZXN1bHRbMl07XG5cdFx0aWYgKHByb21pc2VSZXNvbHZlcikge1xuXHRcdFx0cHJvbWlzZXMuZGVsZXRlKHJlc3VsdFsxXSk7XG5cblx0XHRcdGlmIChkYXRhLmVycm9yKSB7XG5cdFx0XHRcdHJldHVybiBwcm9taXNlUmVzb2x2ZXJbMV0oRXJyb3IoZGF0YS5lcnJvcikpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHByb21pc2VSZXNvbHZlclswXShkYXRhLnJlc3VsdCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcblxuZnVuY3Rpb24gcmVtb3RlQ21kKGNtZCwgZGF0YSkge1xuXHR2YXIgaWQgPSBwZXJmb3JtYW5jZS5ub3coKSArICdfJyArIE1hdGgucmFuZG9tKCk7XG5cdHdzLnNlbmQoSlNPTi5zdHJpbmdpZnkoW1xuXHRcdGNtZCxcblx0XHRpZCxcblx0XHRkYXRhXG5cdF0pKTtcblx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0XHRwcm9taXNlcy5zZXQoaWQsIFtyZXNvbHZlLCByZWplY3RdKTtcblx0fSk7XG59XG5cbi8vIENvbm5lY3Rpb24gb3BlbmVkXG52YXIgd3NQcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcblx0d3MuYWRkRXZlbnRMaXN0ZW5lcignb3BlbicsIGZ1bmN0aW9uIGZpcnN0T3BlbigpIHtcblx0XHR3cy5yZW1vdmVFdmVudExpc3RlbmVyKCdvcGVuJywgZmlyc3RPcGVuKTtcblx0XHRyZXNvbHZlKHdzKTtcblx0fSk7XG59KTtcblxuZXhwb3J0IHtcblx0d3MsXG5cdHdzUHJvbWlzZSxcblx0cmVtb3RlQ21kXG59OyIsIi8qIGdsb2JhbCByZXF1aXJlLCBNYXAsIFNldCwgUHJvbWlzZSAqL1xuLyogZXNsaW50IG5vLXZhcjogMCwgbm8tY29uc29sZTogMCAqL1xuLyogZXNsaW50LWVudiBlczYgKi9cblxuaW1wb3J0IHtcblx0cmVtb3RlQ21kXG59IGZyb20gJy4vd3MnO1xuXG5mdW5jdGlvbiBmc1Byb3h5KCkge1xuXHR2YXIgYXJncyA9IEFycmF5LmZyb20oYXJndW1lbnRzKTtcblx0dmFyIGNtZCA9IGFyZ3Muc2hpZnQoKTtcblxuXHRmdW5jdGlvbiBleGVjdXRlKCkge1xuXHRcdHZhciBhcmdzID0gQXJyYXkuZnJvbShhcmd1bWVudHMpO1xuXHRcdHJldHVybiByZW1vdGVDbWQoJ0ZTX1BST1hZJywge1xuXHRcdFx0Y21kOiBjbWQsXG5cdFx0XHRhcmd1bWVudHM6IGFyZ3Ncblx0XHR9KTtcblx0fVxuXG5cdGlmIChhcmdzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGV4ZWN1dGU7XG5cdHJldHVybiBleGVjdXRlLmFwcGx5KG51bGwsIGFyZ3MpO1xufVxuXG52YXIgZnMgPSB7fTtcblxuW1xuXHQnc3RhdCcsXG5cdCdyZWFkRmlsZScsXG5cdCd3cml0ZUZpbGUnXG5dLmZvckVhY2goZnVuY3Rpb24gKGNtZCkge1xuXHRmc1tjbWRdID0gZnNQcm94eShjbWQpO1xufSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZzOyIsImV4cG9ydCBkZWZhdWx0IHtcblx0Y3VycmVudGx5T3BlblBhdGg6IG51bGwgLy8gbnVsbCBvciBzdHJpbmdcbn07IiwiLyogZ2xvYmFsIHJlcXVpcmUsIE1hcCwgU2V0LCBQcm9taXNlICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG5pbXBvcnQgeyByZW5kZXJGaWxlTGlzdCB9IGZyb20gJy4vZmlsZXMnO1xuaW1wb3J0IHN0YXRlIGZyb20gJy4vc3RhdGUnO1xuaW1wb3J0IHsgdXBkYXRlREJEb2MgfSBmcm9tICcuL2RiJztcbmltcG9ydCBmcyBmcm9tICcuL2ZzLXByb3h5JztcblxuZnVuY3Rpb24gc2F2ZU9wZW5UYWIoKSB7XG5cdHZhciB0YWIgPSB0YWJDb250cm9sbGVyLmdldE9wZW5UYWIoKTtcblx0dmFyIGRhdGE7XG5cdGlmICh0YWIgJiYgdGFiLmVkaXRvcikge1xuXHRcdGRhdGEgPSB0YWIuZGF0YTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm47XG5cdH1cblx0dmFyIGFsdElkID0gdGFiLmVkaXRvci5tb2RlbC5nZXRBbHRlcm5hdGl2ZVZlcnNpb25JZCgpO1xuXHRmcy53cml0ZUZpbGUoZGF0YS5wYXRoLCB0YWIuZWRpdG9yLmdldFZhbHVlKCkpXG5cdC50aGVuKGZ1bmN0aW9uICgpIHtcblx0XHR0YWIuZWRpdG9yLndlYkNvZGVTdGF0ZS5zYXZlZEFsdGVybmF0aXZlVmVyc2lvbklkID0gYWx0SWQ7XG5cdFx0dGFiLmVkaXRvci53ZWJDb2RlU3RhdGUuZnVuY3Rpb25zLmNoZWNrRm9yQ2hhbmdlcygpO1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gY2xvc2VPcGVuVGFiKCkge1xuXHR2YXIgdGFiID0gdGFiQ29udHJvbGxlci5nZXRPcGVuVGFiKCk7XG5cdGlmICh0YWIpIHRhYkNvbnRyb2xsZXIuY2xvc2VUYWIodGFiKTtcbn1cblxudmFyIHRhYkNvbnRyb2xsZXIgPSAoZnVuY3Rpb24gc2V0VXBUYWJzKCkge1xuXHR2YXIgY3VycmVudGx5T3BlbkZpbGVzRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjY3VycmVudGx5LW9wZW4tZmlsZXMnKTtcblx0dmFyIGNvbnRhaW5lckVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRhaW5lcicpO1xuXHR2YXIgdGFic0VsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RhYnMnKTtcblxuXHRmdW5jdGlvbiB1cGRhdGVPcGVuRmlsZUVsKCkge1xuXHRcdHJlbmRlckZpbGVMaXN0KGN1cnJlbnRseU9wZW5GaWxlc0VsLCB7IGNoaWxkcmVuOiBBcnJheS5mcm9tKHRhYkNvbnRyb2xsZXIuY3VycmVudGx5T3BlbkZpbGVzTWFwLmtleXMoKSkgfSk7XG5cdH1cblxuXHRmdW5jdGlvbiBUYWIoZGF0YSkge1xuXHRcdHRoaXMuZGF0YSA9IGRhdGE7XG5cdFx0dGhpcy5lbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcblx0XHR0aGlzLmVsLmNsYXNzTGlzdC5hZGQoJ3RhYicpO1xuXHRcdHRoaXMuZWwuY2xhc3NMaXN0LmFkZCgnaGFzLWljb24nKTtcblx0XHR0aGlzLmVsLmRhdGFzZXQubWltZSA9IGRhdGEubWltZTtcblx0XHR0aGlzLmVsLmRhdGFzZXQubmFtZSA9IGRhdGEubmFtZTtcblx0XHR0aGlzLmVsLmRhdGFzZXQuc2l6ZSA9IGRhdGEuc2l6ZTtcblx0XHR0aGlzLmVsLnRleHRDb250ZW50ID0gZGF0YS5uYW1lO1xuXHRcdHRoaXMuZWwudGFiSW5kZXggPSAxO1xuXHRcdHRhYnNFbC5hcHBlbmRDaGlsZCh0aGlzLmVsKTtcblxuXHRcdHRoaXMuZWwud2ViQ29kZVRhYiA9IHRoaXM7XG5cblx0XHR0aGlzLmNvbnRlbnRFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuY29udGVudEVsLmNsYXNzTGlzdC5hZGQoJ3RhYi1jb250ZW50Jyk7XG5cdFx0Y29udGFpbmVyRWwuYXBwZW5kQ2hpbGQodGhpcy5jb250ZW50RWwpO1xuXG5cdFx0dGhpcy5jbG9zZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG5cdFx0dGhpcy5jbG9zZUVsLmNsYXNzTGlzdC5hZGQoJ3RhYl9jbG9zZScpO1xuXHRcdHRoaXMuY2xvc2VFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQ2xvc2UgVGFiICcgKyBkYXRhLm5hbWUpO1xuXHRcdHRoaXMuZWwuYXBwZW5kQ2hpbGQodGhpcy5jbG9zZUVsKTtcblx0XHR0aGlzLmNsb3NlRWwudGFiSW5kZXggPSAxO1xuXG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdHRoaXMuY2xvc2VFbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcblx0XHRcdHRhYkNvbnRyb2xsZXIuY2xvc2VUYWIoc2VsZik7XG5cdFx0fSk7XG5cdH1cblxuXHRUYWIucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy5lbC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuZWwpO1xuXHRcdHRoaXMuY29udGVudEVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5jb250ZW50RWwpO1xuXHR9XG5cblx0ZnVuY3Rpb24gVGFiQ29udHJvbGxlcigpIHtcblx0XHR0aGlzLmN1cnJlbnRseU9wZW5GaWxlc01hcCA9IG5ldyBNYXAoKTtcblx0fVxuXG5cdFRhYkNvbnRyb2xsZXIucHJvdG90eXBlLmhhc1RhYiA9IGZ1bmN0aW9uIChkYXRhKSB7XG5cdFx0cmV0dXJuIHRoaXMuY3VycmVudGx5T3BlbkZpbGVzTWFwLmhhcyhkYXRhKTtcblx0fVxuXG5cdFRhYkNvbnRyb2xsZXIucHJvdG90eXBlLmdldE9wZW5UYWIgPSBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHRoaXMuZm9jdXNlZFRhYjtcblx0fVxuXG5cdFRhYkNvbnRyb2xsZXIucHJvdG90eXBlLm5ld1RhYiA9IGZ1bmN0aW9uIChkYXRhKSB7XG5cdFx0dmFyIHRhYiA9IG5ldyBUYWIoZGF0YSk7XG5cdFx0dGhpcy5jdXJyZW50bHlPcGVuRmlsZXNNYXAuc2V0KGRhdGEsIHRhYik7XG5cdFx0dXBkYXRlT3BlbkZpbGVFbCgpO1xuXHRcdHRoaXMuZm9jdXNUYWIodGFiKTtcblx0XHR0aGlzLnN0b3JlT3BlblRhYnMoKTtcblx0XHRyZXR1cm4gdGFiO1xuXHR9XG5cblx0VGFiQ29udHJvbGxlci5wcm90b3R5cGUuZm9jdXNUYWIgPSBmdW5jdGlvbiAoZGF0YSkge1xuXHRcdHZhciBmb2N1c2VkVGFiID0gZGF0YS5jb25zdHJ1Y3RvciA9PT0gVGFiID8gZGF0YSA6IHRoaXMuY3VycmVudGx5T3BlbkZpbGVzTWFwLmdldChkYXRhKTtcblx0XHR0aGlzLmZvY3VzZWRUYWIgPSBmb2N1c2VkVGFiO1xuXHRcdEFycmF5LmZyb20odGhpcy5jdXJyZW50bHlPcGVuRmlsZXNNYXAudmFsdWVzKCkpLmZvckVhY2goZnVuY3Rpb24gKHRhYikge1xuXHRcdFx0dGFiLmNvbnRlbnRFbC5jbGFzc0xpc3QudG9nZ2xlKCdoYXMtZm9jdXMnLCB0YWIgPT09IGZvY3VzZWRUYWIpO1xuXHRcdFx0dGFiLmVsLmNsYXNzTGlzdC50b2dnbGUoJ2hhcy1mb2N1cycsIHRhYiA9PT0gZm9jdXNlZFRhYik7XG5cdFx0fSk7XG5cdFx0aWYgKGZvY3VzZWRUYWIuZWRpdG9yKSBmb2N1c2VkVGFiLmVkaXRvci5sYXlvdXQoKTtcblx0fVxuXG5cdFRhYkNvbnRyb2xsZXIucHJvdG90eXBlLmNsb3NlVGFiID0gZnVuY3Rpb24gKGRhdGEpIHtcblx0XHR2YXIgdGFiID0gZGF0YS5jb25zdHJ1Y3RvciA9PT0gVGFiID8gZGF0YSA6IHRoaXMuY3VycmVudGx5T3BlbkZpbGVzTWFwLmdldChkYXRhKTtcblx0XHR2YXIgdGFiU3RhdGUgPSBBcnJheS5mcm9tKHRoaXMuY3VycmVudGx5T3BlbkZpbGVzTWFwLnZhbHVlcygpKTtcblx0XHR2YXIgdGFiSW5kZXggPSB0YWJTdGF0ZS5pbmRleE9mKHRhYik7XG5cdFx0dmFyIG5leHRUYWIgPSB0YWJTdGF0ZVtNYXRoLm1heCgwLCB0YWJJbmRleCAtIDEpXTtcblx0XHR0aGlzLmN1cnJlbnRseU9wZW5GaWxlc01hcC5kZWxldGUodGFiLmRhdGEpO1xuXHRcdHRhYi5kZXN0cm95KCk7XG5cdFx0dXBkYXRlT3BlbkZpbGVFbCgpO1xuXHRcdHRoaXMuc3RvcmVPcGVuVGFicygpO1xuXHRcdGlmICh0aGlzLmZvY3VzZWRUYWIgPT09IHRhYiAmJiBuZXh0VGFiKSB7XG5cdFx0XHR0aGlzLmZvY3VzVGFiKG5leHRUYWIpO1xuXHRcdH1cblx0fVxuXG5cdFRhYkNvbnRyb2xsZXIucHJvdG90eXBlLnN0b3JlT3BlblRhYnMgPSBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKCFzdGF0ZS5jdXJyZW50bHlPcGVuZWRQYXRoKSByZXR1cm47XG5cdFx0dXBkYXRlREJEb2MoJ09QRU5fVEFCU19GT1JfJyArIHN0YXRlLmN1cnJlbnRseU9wZW5lZFBhdGgsIHtcblx0XHRcdG9wZW5fdGFiczogQXJyYXkuZnJvbSh0aGlzLmN1cnJlbnRseU9wZW5GaWxlc01hcC5rZXlzKCkpXG5cdFx0fSlcblx0XHQuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coZXJyKTtcblx0XHR9KTtcblx0fVxuXG5cdHZhciB0YWJDb250cm9sbGVyID0gbmV3IFRhYkNvbnRyb2xsZXIoKTtcblxuXHR0YWJzRWwuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIGZ1bmN0aW9uIChlKSB7XG5cdFx0aWYgKGUudGFyZ2V0Lm1hdGNoZXMoJy50YWInKSkge1xuXHRcdFx0aWYgKGUuYnV0dG9uID09PSAwKSB7XG5cdFx0XHRcdHRhYkNvbnRyb2xsZXIuZm9jdXNUYWIoZS50YXJnZXQud2ViQ29kZVRhYik7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZS5idXR0b24gPT09IDEpIHtcblx0XHRcdFx0dGFiQ29udHJvbGxlci5jbG9zZVRhYihlLnRhcmdldC53ZWJDb2RlVGFiKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdGN1cnJlbnRseU9wZW5GaWxlc0VsLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBmdW5jdGlvbiAoZSkge1xuXHRcdGlmIChlLnRhcmdldC5kYXRhKSB7XG5cdFx0XHRpZiAoZS5idXR0b24gPT09IDApIHtcblx0XHRcdFx0dGFiQ29udHJvbGxlci5mb2N1c1RhYihlLnRhcmdldC5kYXRhKTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmJ1dHRvbiA9PT0gMSkge1xuXHRcdFx0XHR0YWJDb250cm9sbGVyLmNsb3NlVGFiKGUudGFyZ2V0LmRhdGEpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0cmV0dXJuIHRhYkNvbnRyb2xsZXI7XG59KCkpO1xuXG5leHBvcnQge1xuXHRzYXZlT3BlblRhYixcblx0Y2xvc2VPcGVuVGFiLFxuXHR0YWJDb250cm9sbGVyXG59OyIsIi8qIGdsb2JhbCByZXF1aXJlLCBtb25hY28sIE1hcCwgU2V0LCBQcm9taXNlICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG5pbXBvcnQgeyBzYXZlT3BlblRhYiwgY2xvc2VPcGVuVGFiIH0gZnJvbSAnLi90YWItY29udHJvbGxlcic7XG5pbXBvcnQgeyBwcm9tcHRGb3JPcGVuIH0gZnJvbSAnLi9maWxlcyc7XG5cbnJlcXVpcmUuY29uZmlnKHsgcGF0aHM6IHsgJ3ZzJzogJ3ZzJyB9IH0pO1xuXG52YXIgbW9uYWNvUHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG5cdHJlcXVpcmUoWyd2cy9lZGl0b3IvZWRpdG9yLm1haW4nXSwgcmVzb2x2ZSk7XG59KTtcblxuZnVuY3Rpb24gZ2V0TW9uYWNvTGFuZ3VhZ2VGcm9tTWltZXMobWltZSkge1xuXHRyZXR1cm4gKG1vbmFjby5sYW5ndWFnZXMuZ2V0TGFuZ3VhZ2VzKCkuZmlsdGVyKGZ1bmN0aW9uIChsYW5ndWFnZU9iaikge1xuXHRcdHJldHVybiBsYW5ndWFnZU9iai5taW1ldHlwZXMgJiYgbGFuZ3VhZ2VPYmoubWltZXR5cGVzLmluY2x1ZGVzKG1pbWUpO1xuXHR9KVswXSB8fCB7fSlbJ2lkJ107XG59XG5cbmZ1bmN0aW9uIGdldE1vbmFjb0xhbmd1YWdlRnJvbUV4dGVuc2lvbnMoZXh0ZW5zaW9uKSB7XG5cdHJldHVybiAobW9uYWNvLmxhbmd1YWdlcy5nZXRMYW5ndWFnZXMoKS5maWx0ZXIoZnVuY3Rpb24gKGxhbmd1YWdlT2JqKSB7XG5cdFx0cmV0dXJuIGxhbmd1YWdlT2JqLmV4dGVuc2lvbnMgJiYgbGFuZ3VhZ2VPYmouZXh0ZW5zaW9ucy5pbmNsdWRlcyhleHRlbnNpb24pO1xuXHR9KVswXSB8fCB7fSlbJ2lkJ107XG59XG5cbmZ1bmN0aW9uIHNlbGVjdE5leHRFbCgpIHtcblx0Y29uc29sZS5sb2coJ1NUVUIgQkxVUiBFRElUT1IsIE5FWFQgRUwnKTtcbn1cblxuZnVuY3Rpb24gc2VsZWN0UHJldmlvdXNFbCgpIHtcblx0Y29uc29sZS5sb2coJ1NUVUIgQkxVUiBFRElUT1IsIFBSRVZJT1VTIEVMJyk7XG59XG5cbmZ1bmN0aW9uIG5leHRUYWIoKSB7XG5cdGNvbnNvbGUubG9nKCdGT0NVUyBORVhUIFRBQicpO1xufVxuXG5mdW5jdGlvbiBwcmV2aW91c1RhYigpIHtcblx0Y29uc29sZS5sb2coJ0ZPQ1VTIFBSRVZJT1VTIFRBQicpO1xufVxuXG5mdW5jdGlvbiBhZGRCaW5kaW5ncyhlZGl0b3IsIHRhYikge1xuXHRlZGl0b3IuYWRkQ29tbWFuZChtb25hY28uS2V5TW9kLkN0cmxDbWQgfCBtb25hY28uS2V5Q29kZS5LRVlfUywgc2F2ZU9wZW5UYWIpO1xuXHRlZGl0b3IuYWRkQ29tbWFuZChtb25hY28uS2V5TW9kLkN0cmxDbWQgfCBtb25hY28uS2V5Q29kZS5LRVlfTywgcHJvbXB0Rm9yT3Blbik7XG5cdGVkaXRvci5hZGRDb21tYW5kKG1vbmFjby5LZXlDb2RlLktFWV9XIHwgbW9uYWNvLktleU1vZC5DdHJsQ21kLCBjbG9zZU9wZW5UYWIpO1xuXHRlZGl0b3IuYWRkQ29tbWFuZChtb25hY28uS2V5Q29kZS5GNiwgc2VsZWN0TmV4dEVsKTtcblx0ZWRpdG9yLmFkZENvbW1hbmQobW9uYWNvLktleUNvZGUuRjYgfCBtb25hY28uS2V5TW9kLlNoaWZ0LCBzZWxlY3RQcmV2aW91c0VsKTtcblx0ZWRpdG9yLmFkZENvbW1hbmQobW9uYWNvLktleUNvZGUuVGFiIHwgbW9uYWNvLktleU1vZC5DdHJsQ21kLCBuZXh0VGFiKTtcblx0ZWRpdG9yLmFkZENvbW1hbmQobW9uYWNvLktleUNvZGUuVGFiIHwgbW9uYWNvLktleU1vZC5TaGlmdCB8IG1vbmFjby5LZXlNb2QuQ3RybENtZCwgcHJldmlvdXNUYWIpO1xuXHRlZGl0b3IuYWRkQ29tbWFuZChtb25hY28uS2V5Q29kZS5LRVlfUCB8IG1vbmFjby5LZXlNb2QuU2hpZnQgfCBtb25hY28uS2V5TW9kLkN0cmxDbWQsIGZ1bmN0aW9uIG9wZW5Db21tYW5kUGFsZXR0ZSgpIHtcblx0XHRlZGl0b3IudHJpZ2dlcignYW55U3RyaW5nJywgJ2VkaXRvci5hY3Rpb24ucXVpY2tDb21tYW5kJyk7XG5cdH0pO1xuXG5cdGVkaXRvci53ZWJDb2RlU3RhdGUgPSB7fTtcblx0ZWRpdG9yLndlYkNvZGVTdGF0ZS5zYXZlZEFsdGVybmF0aXZlVmVyc2lvbklkID0gZWRpdG9yLm1vZGVsLmdldEFsdGVybmF0aXZlVmVyc2lvbklkKCk7XG5cdGVkaXRvci53ZWJDb2RlU3RhdGUudGFiID0gdGFiO1xuXG5cdGVkaXRvci53ZWJDb2RlU3RhdGUuZnVuY3Rpb25zID0ge1xuXHRcdGNoZWNrRm9yQ2hhbmdlczogZnVuY3Rpb24gY2hlY2tGb3JDaGFuZ2VzKCkge1xuXHRcdFx0dmFyIGhhc0NoYW5nZXMgPSBlZGl0b3Iud2ViQ29kZVN0YXRlLnNhdmVkQWx0ZXJuYXRpdmVWZXJzaW9uSWQgIT09IGVkaXRvci5tb2RlbC5nZXRBbHRlcm5hdGl2ZVZlcnNpb25JZCgpO1xuXHRcdFx0ZWRpdG9yLndlYkNvZGVTdGF0ZS5oYXNDaGFuZ2VzID0gaGFzQ2hhbmdlcztcblx0XHRcdHRhYi5lbC5jbGFzc0xpc3QudG9nZ2xlKCdoYXMtY2hhbmdlcycsIGhhc0NoYW5nZXMpO1xuXHRcdH1cblx0fVxuXG5cdGVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudChlZGl0b3Iud2ViQ29kZVN0YXRlLmZ1bmN0aW9ucy5jaGVja0ZvckNoYW5nZXMpO1xuXG5cbn1cblxuZXhwb3J0IHsgbW9uYWNvUHJvbWlzZSwgZ2V0TW9uYWNvTGFuZ3VhZ2VGcm9tRXh0ZW5zaW9ucywgZ2V0TW9uYWNvTGFuZ3VhZ2VGcm9tTWltZXMsIGFkZEJpbmRpbmdzIH07XG4iLCIvKiBnbG9iYWwgcmVxdWlyZSwgTWFwLCBTZXQsIFByb21pc2UgKi9cbi8qIGVzbGludCBuby12YXI6IDAsIG5vLWNvbnNvbGU6IDAgKi9cbi8qIGVzbGludC1lbnYgZXM2ICovXG5cbmltcG9ydCB7IHBvcHVsYXRlRmlsZUxpc3QgfSBmcm9tICcuL2ZpbGVzJztcblxudmFyIGhpZ2hsaWdodGVkRWw7XG52YXIgY3VycmVudFBhdGg7XG52YXIgcmVzb2x2ZXI7XG52YXIgcmVqZWN0ZXI7XG5cbmZ1bmN0aW9uIG9wZW5GaWxlRGlhbG9nKHBhdGgpIHtcblxuXHRyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdGlmIChvcGVuRmlsZURpYWxvZy5vcGVuID09PSB1bmRlZmluZWQpIG9wZW5GaWxlRGlhbG9nLm9wZW4gPSBmYWxzZTtcblx0XHRpZiAob3BlbkZpbGVEaWFsb2cub3BlbiA9PT0gdHJ1ZSkge1xuXHRcdFx0dGhyb3cgRXJyb3IoJ0RpYWxvZyBhbHJlYWR5IG9wZW4gZm9yIGFub3RoZXIgdGFzay4nKTtcblx0XHR9XG5cdFx0cGF0aCA9IHBhdGggfHwgJy8nO1xuXHRcdGN1cnJlbnRQYXRoID0gcGF0aDtcblx0XHRvcGVuRmlsZURpYWxvZy5lbC5jbGFzc0xpc3QucmVtb3ZlKCdjbG9zZWQnKTtcblx0XHRyZXNvbHZlciA9IHJlc29sdmU7XG5cdFx0cmVqZWN0ZXIgPSByZWplY3Q7XG5cdFx0b3BlbkZpbGVEaWFsb2cuY3VycmVudFBhdGhFbC52YWx1ZSA9IGN1cnJlbnRQYXRoO1xuXG5cdFx0cG9wdWxhdGVGaWxlTGlzdChvcGVuRmlsZURpYWxvZy5maWxlbGlzdExlZnQsIHBhdGgsIHtcblx0XHRcdG5lc3RlZDogZmFsc2Vcblx0XHR9KVxuXHRcdFx0LmNhdGNoKGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGUpO1xuXHRcdFx0XHRyZXR1cm4gcG9wdWxhdGVGaWxlTGlzdChvcGVuRmlsZURpYWxvZy5maWxlbGlzdExlZnQsICcvJywge1xuXHRcdFx0bmVzdGVkOiBmYWxzZVxuXHRcdH0pXG5cdFx0XHR9KTtcblx0fSk7XG59XG5cbmZ1bmN0aW9uIGhpZ2hsaWdodChlKSB7XG5cdGlmIChlLnRhcmdldC50YWdOYW1lID09PSAnTEknKSB7XG5cdFx0aWYgKGhpZ2hsaWdodGVkRWwpIHtcblx0XHRcdGhpZ2hsaWdodGVkRWwuY2xhc3NMaXN0LnJlbW92ZSgnaGFzLWhpZ2hsaWdodCcpO1xuXHRcdH1cblx0XHRoaWdobGlnaHRlZEVsID0gZS50YXJnZXQ7XG5cdFx0aGlnaGxpZ2h0ZWRFbC5jbGFzc0xpc3QuYWRkKCdoYXMtaGlnaGxpZ2h0Jyk7XG5cblx0XHRjdXJyZW50UGF0aCA9IGUudGFyZ2V0LmRhdGEucGF0aDtcblx0XHRvcGVuRmlsZURpYWxvZy5jdXJyZW50UGF0aEVsLnZhbHVlID0gY3VycmVudFBhdGg7XG5cblx0XHRpZiAoZS50YXJnZXQuZGF0YSAmJiBlLnRhcmdldC5kYXRhLmlzRGlyKSB7XG5cdFx0XHRpZiAoZS5jdXJyZW50VGFyZ2V0ID09PSBvcGVuRmlsZURpYWxvZy5maWxlbGlzdExlZnQpIHtcblx0XHRcdFx0aWYgKGUudGFyZ2V0LmRhdGEubmFtZSA9PT0gJy4uJykge1xuXHRcdFx0XHRcdHBvcHVsYXRlRmlsZUxpc3Qob3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0LCBlLnRhcmdldC5kYXRhLnBhdGgsIHtcblx0XHRcdFx0XHRcdG5lc3RlZDogZmFsc2Vcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRvcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0LmlubmVySFRNTCA9ICcnO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHBvcHVsYXRlRmlsZUxpc3Qob3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RSaWdodCwgZS50YXJnZXQuZGF0YS5wYXRoLCB7XG5cdFx0XHRcdFx0XHRuZXN0ZWQ6IGZhbHNlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChlLmN1cnJlbnRUYXJnZXQgPT09IG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0UmlnaHQpIHtcblx0XHRcdFx0cG9wdWxhdGVGaWxlTGlzdChvcGVuRmlsZURpYWxvZy5maWxlbGlzdExlZnQsIGUudGFyZ2V0LmRhdGEuZGlyTmFtZSwge1xuXHRcdFx0XHRcdG5lc3RlZDogZmFsc2Vcblx0XHRcdFx0fSlcblx0XHRcdFx0XHQudGhlbihmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRbXS5zbGljZS5jYWxsKG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0TGVmdC5jaGlsZHJlbikuZm9yRWFjaChmdW5jdGlvbiAoZWwpIHtcblx0XHRcdFx0XHRcdFx0aWYgKGVsLmRhdGEucGF0aCA9PT0gY3VycmVudFBhdGgpIHtcblx0XHRcdFx0XHRcdFx0XHRoaWdobGlnaHRlZEVsID0gZS50YXJnZXQ7XG5cdFx0XHRcdFx0XHRcdFx0aGlnaGxpZ2h0ZWRFbC5jbGFzc0xpc3QuYWRkKCdoYXMtaGlnaGxpZ2h0Jyk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRwb3B1bGF0ZUZpbGVMaXN0KG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0UmlnaHQsIGUudGFyZ2V0LmRhdGEucGF0aCwge1xuXHRcdFx0XHRcdG5lc3RlZDogZmFsc2Vcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIG9uZGJsY2xpY2soZSkge1xuXHRoaWdobGlnaHQoZSk7XG5cdGlmIChlLnRhcmdldC5kYXRhICYmIGUudGFyZ2V0LmRhdGEuaXNEaXIpIHJldHVybjtcblx0b3BlbihlLnRhcmdldC5kYXRhKTtcbn1cblxuZnVuY3Rpb24gb3BlbihkYXRhKSB7XG5cdG9wZW5GaWxlRGlhbG9nLmVsLmNsYXNzTGlzdC5hZGQoJ2Nsb3NlZCcpO1xuXHRyZXNvbHZlcihkYXRhKTtcblx0cmVzb2x2ZXIgPSB1bmRlZmluZWQ7XG5cdHJlamVjdGVyID0gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBjYW5jZWwoKSB7XG5cdG9wZW5GaWxlRGlhbG9nLmVsLmNsYXNzTGlzdC5hZGQoJ2Nsb3NlZCcpO1xuXHRyZWplY3RlcignVXNlciBjYW5jZWxlZCcpO1xuXHRyZXNvbHZlciA9IHVuZGVmaW5lZDtcblx0cmVqZWN0ZXIgPSB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIG9ua2V5ZG93bihlKSB7XG5cdGlmIChldmVudC5rZXlDb2RlID09PSAxMykgb25kYmxjbGljayhlKTtcbn1cblxub3BlbkZpbGVEaWFsb2cuZWwgPSBvcGVuRmlsZURpYWxvZy5lbCB8fCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZmlsZS1vcGVuLXdpZGdldCcpO1xub3BlbkZpbGVEaWFsb2cuY3VycmVudFBhdGhFbCA9IG9wZW5GaWxlRGlhbG9nLmN1cnJlbnRQYXRoRWwgfHwgb3BlbkZpbGVEaWFsb2cuZWwucXVlcnlTZWxlY3RvcignaW5wdXRbbmFtZT1cImN1cnJlbnQtcGF0aFwiXScpO1xub3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0ID0gb3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0IHx8IG9wZW5GaWxlRGlhbG9nLmVsLnF1ZXJ5U2VsZWN0b3IoJy5maWxlbGlzdDpmaXJzdC1jaGlsZCcpO1xub3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RSaWdodCA9IG9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0UmlnaHQgfHwgb3BlbkZpbGVEaWFsb2cuZWwucXVlcnlTZWxlY3RvcignLmZpbGVsaXN0Om5vdCg6Zmlyc3QtY2hpbGQpJyk7XG5vcGVuRmlsZURpYWxvZy5vcGVuQnV0dG9uID0gb3BlbkZpbGVEaWFsb2cub3BlbkJ1dHRvbiB8fCBvcGVuRmlsZURpYWxvZy5lbC5xdWVyeVNlbGVjdG9yKCcjZmlsZS1vcGVuLW9wZW4nKTtcbm9wZW5GaWxlRGlhbG9nLmNhbmNlbEJ1dHRvbiA9IG9wZW5GaWxlRGlhbG9nLmNhbmNlbEJ1dHRvbiB8fCBvcGVuRmlsZURpYWxvZy5lbC5xdWVyeVNlbGVjdG9yKCcjZmlsZS1vcGVuLWNhbmNlbCcpO1xub3BlbkZpbGVEaWFsb2cudXBEaXJCdXR0b24gPSBvcGVuRmlsZURpYWxvZy51cERpckJ1dHRvbiB8fCBvcGVuRmlsZURpYWxvZy5lbC5xdWVyeVNlbGVjdG9yKCdidXR0b25bZGF0YS1hY3Rpb249XCJ1cC1kaXJcIl0nKTtcblxub3BlbkZpbGVEaWFsb2cuZmlsZWxpc3RMZWZ0LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgaGlnaGxpZ2h0KTtcbm9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0UmlnaHQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBoaWdobGlnaHQpO1xuXG5vcGVuRmlsZURpYWxvZy5maWxlbGlzdExlZnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIG9ua2V5ZG93bik7XG5vcGVuRmlsZURpYWxvZy5maWxlbGlzdFJpZ2h0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBvbmtleWRvd24pO1xuXG5vcGVuRmlsZURpYWxvZy5maWxlbGlzdExlZnQuYWRkRXZlbnRMaXN0ZW5lcignZGJsY2xpY2snLCBvbmRibGNsaWNrKTtcbm9wZW5GaWxlRGlhbG9nLmZpbGVsaXN0UmlnaHQuYWRkRXZlbnRMaXN0ZW5lcignZGJsY2xpY2snLCBvbmRibGNsaWNrKTtcbm9wZW5GaWxlRGlhbG9nLm9wZW5CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG5cdG9wZW4oaGlnaGxpZ2h0ZWRFbC5kYXRhKTtcbn0pO1xub3BlbkZpbGVEaWFsb2cuY2FuY2VsQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xuXHRjYW5jZWwoKTtcbn0pO1xub3BlbkZpbGVEaWFsb2cudXBEaXJCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG5cdGNvbnNvbGUubG9nKCdTVFVCIEdPIFVQIERJUicpO1xufSk7XG5cbmV4cG9ydCBkZWZhdWx0IG9wZW5GaWxlRGlhbG9nOyIsIi8qIGdsb2JhbCByZXF1aXJlLCBNYXAsIFNldCwgUHJvbWlzZSwgbW9uYWNvICovXG4vKiBlc2xpbnQgbm8tdmFyOiAwLCBuby1jb25zb2xlOiAwICovXG4vKiBlc2xpbnQtZW52IGVzNiAqL1xuXG5pbXBvcnQge1xuXHRyZW1vdGVDbWRcbn0gZnJvbSAnLi93cyc7XG5cbmltcG9ydCBmcyBmcm9tICcuL2ZzLXByb3h5JztcblxuaW1wb3J0IHN0YXRlIGZyb20gJy4vc3RhdGUnO1xuaW1wb3J0IHsgZGIsIHVwZGF0ZURCRG9jIH0gZnJvbSAnLi9kYic7XG5pbXBvcnQgeyB0YWJDb250cm9sbGVyIH0gZnJvbSAnLi90YWItY29udHJvbGxlcic7XG5pbXBvcnQgeyBtb25hY29Qcm9taXNlLCBnZXRNb25hY29MYW5ndWFnZUZyb21FeHRlbnNpb25zLCBnZXRNb25hY29MYW5ndWFnZUZyb21NaW1lcywgYWRkQmluZGluZ3MgfSBmcm9tICcuL21vbmFjbyc7XG5pbXBvcnQgb3BlbkZpbGVEaWFsb2cgZnJvbSAnLi9vcGVuLWZpbGUtZGlhbG9nJztcblxuLy8gTWFwIHRvIHByZXZlbnQgZHVwbGljYXRlIGRhdGEgb2JqZWN0cyBmb3IgZWFjaCBmaWxlXG52YXIgcGF0aFRvRGF0YU1hcCA9IG5ldyBNYXAoKTtcblxuZnVuY3Rpb24gcmVuZGVyRmlsZUxpc3QoZWwsIGRhdGEsIG9wdGlvbnMpIHtcblxuXHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblx0dmFyIHVzZU9wdGlvbnMgPSB7XG5cdFx0aGlkZURvdEZpbGVzOiAob3B0aW9ucy5oaWRlRG90RmlsZXMgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuaGlkZURvdEZpbGVzIDogdHJ1ZSksXG5cdFx0bmVzdGVkOiAob3B0aW9ucy5uZXN0ZWQgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubmVzdGVkIDogdHJ1ZSksXG5cdFx0bmVzdGluZ0xpbWl0OiAob3B0aW9ucy5uZXN0aW5nTGltaXQgfHwgNSkgLSAxXG5cdH1cblx0aWYgKG9wdGlvbnMubmVzdGluZ0xpbWl0ID09PSAwKSByZXR1cm47XG5cblx0ZWwuaW5uZXJIVE1MID0gJyc7XG5cdGVsLmRhdGEgPSBkYXRhO1xuXG5cdHZhciBzb3J0ZWREYXRhID0gQXJyYXkuZnJvbShkYXRhLmNoaWxkcmVuKVxuXHRcdC5maWx0ZXIoZnVuY3Rpb24gKGRhdHVtKSB7XG5cblx0XHRcdC8vIFdoZXRoZXIgdG8gaGlkZSBkb3RmaWxlc1xuXHRcdFx0aWYgKGRhdHVtLm5hbWUgIT09ICcuLicgJiYgdXNlT3B0aW9ucy5oaWRlRG90RmlsZXMgIT09IGZhbHNlKSB7XG5cdFx0XHRcdHJldHVybiBkYXR1bS5uYW1lWzBdICE9PSAnLic7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9KVxuXHRcdC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG5cdFx0XHRpZiAoYS5uYW1lID09PSAnLi4nKSB7XG5cdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdH1cblx0XHRcdGlmIChiLm5hbWUgPT09ICcuLicpIHtcblx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdChhLmlzRGlyID09PSBiLmlzRGlyKSAmJlxuXHRcdFx0XHQoYS5pc0ZpbGUgPT09IGIuaXNGaWxlKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiAoW2EubmFtZSwgYi5uYW1lXS5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGEudG9Mb3dlckNhc2UoKS5sb2NhbGVDb21wYXJlKGIudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRcdH0pWzBdID09PSBhLm5hbWUgPyAtMSA6IDEpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGEuaXNEaXIpIHJldHVybiAtMTtcblx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRzb3J0ZWREYXRhLm1hcChmdW5jdGlvbiAoZGF0dW0pIHtcblx0XHRcdHZhciBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XG5cdFx0XHRsaS5jbGFzc0xpc3QuYWRkKCdoYXMtaWNvbicpO1xuXHRcdFx0bGkuZGF0YXNldC5taW1lID0gZGF0dW0ubWltZTtcblx0XHRcdGxpLmRhdGFzZXQubmFtZSA9IGRhdHVtLm5hbWU7XG5cdFx0XHRsaS5kYXRhc2V0LnNpemUgPSBkYXR1bS5zaXplO1xuXHRcdFx0bGkudGV4dENvbnRlbnQgPSBkYXR1bS5uYW1lO1xuXHRcdFx0bGkudGFiSW5kZXggPSAxO1xuXHRcdFx0bGkuZGF0YSA9IGRhdHVtO1xuXHRcdFx0ZWwuYXBwZW5kQ2hpbGQobGkpO1xuXG5cdFx0XHRpZiAoZGF0dW0uaXNEaXIgJiYgdXNlT3B0aW9ucy5uZXN0ZWQgIT09IGZhbHNlKSB7XG5cdFx0XHRcdHZhciBuZXdGaWxlTGlzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3VsJyk7XG5cdFx0XHRcdG5ld0ZpbGVMaXN0LmNsYXNzTGlzdC5hZGQoJ2ZpbGVsaXN0Jyk7XG5cdFx0XHRcdGxpLmFwcGVuZENoaWxkKG5ld0ZpbGVMaXN0KTtcblx0XHRcdFx0aWYgKGRhdHVtLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0cmVuZGVyRmlsZUxpc3QobmV3RmlsZUxpc3QsIGRhdHVtLCB1c2VPcHRpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xufVxuXG5mdW5jdGlvbiBwb3B1bGF0ZUZpbGVMaXN0KGVsLCBwYXRoLCBvcHRpb25zKSB7XG5cdGVsLnBhdGggPSBwYXRoO1xuXHRyZXR1cm4gcmVtb3RlQ21kKCdHRVRfUEFUSF9JTkZPJywgcGF0aClcblx0XHQudGhlbihmdW5jdGlvbiAoZGF0YSkge1xuXHRcdFx0aWYgKGRhdGEuaXNGaWxlKSB7XG5cdFx0XHRcdHJldHVybiByZW1vdGVDbWQoJ0dFVF9QQVRIX0lORk8nLCBkYXRhLmRpck5hbWUpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0fSlcblx0XHQudGhlbihmdW5jdGlvbiAoZGF0YSkge1xuXHRcdFx0ZGF0YSA9IGRlZHVwKGRhdGEpO1xuXHRcdFx0cmVuZGVyRmlsZUxpc3QoZWwsIGRhdGEsIG9wdGlvbnMpO1xuXHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0fSk7XG59XG5cblxuZnVuY3Rpb24gZGVkdXAoZGF0YSkge1xuXG5cdHZhciBuZXdDaGlsZHJlbjtcblx0dmFyIG9sZENoaWxkcmVuO1xuXG5cdC8vIFRoYXQgd2F5IGlmIGFueSBvZiB0aGVzZSBjaGFuZ2UgdGhlbiB0aGUgZmlsZSBpcyB1cGRhdGVkXG5cdHZhciBrZXkgPSBKU09OLnN0cmluZ2lmeSh7XG5cdFx0cGF0aDogZGF0YS5wYXRoLFxuXHRcdGlzRGlyOiBkYXRhLmlzRGlyLFxuXHRcdGlzRmlsZTogZGF0YS5pc0ZpbGUsXG5cdFx0bWltZTogZGF0YS5taW1lXG5cdH0pO1xuXG5cdGlmIChkYXRhLmNoaWxkcmVuKSBuZXdDaGlsZHJlbiA9IGRhdGEuY2hpbGRyZW47XG5cblx0Ly8gZW5zdXJlIHRoYXQgZGF0YSBvYmplY3RzIGFyZSBub3QgZHVwbGljYXRlZC5cblx0aWYgKHBhdGhUb0RhdGFNYXAuaGFzKGtleSkpIHtcblx0XHRkYXRhID0gcGF0aFRvRGF0YU1hcC5nZXQoa2V5KTtcblx0XHRvbGRDaGlsZHJlbiA9IGRhdGEuY2hpbGRyZW47XG5cdH0gZWxzZSB7XG5cdFx0cGF0aFRvRGF0YU1hcC5zZXQoa2V5LCBkYXRhKTtcblx0fVxuXG5cdGlmIChkYXRhLmlzRGlyKSB7XG5cblx0XHRpZiAoIW9sZENoaWxkcmVuICYmICFuZXdDaGlsZHJlbikge1xuXHRcdFx0Ly8gZG8gbm90aGluZywgd2UgaGF2ZSBubyBjaGlsZHJlbiBhbmQgd2UgbmVlZCB0byBhZGQgbm8gY2hpbGRyZW5cblx0XHRcdHJldHVybiBkYXRhO1xuXHRcdH1cblxuXHRcdGlmICghb2xkQ2hpbGRyZW4gJiYgbmV3Q2hpbGRyZW4pIHtcblx0XHRcdC8vIG5vIFNldCBwcmVzZW50IHRoZW4gY3JlYXRlIG9uZSB0byBiZSBwcmVhcmVkIGluIHRoZSBuZXh0IG9uZVxuXHRcdFx0ZGF0YS5jaGlsZHJlbiA9IG5ldyBTZXQoKTtcblx0XHRcdG9sZENoaWxkcmVuID0gZGF0YS5jaGlsZHJlbjtcblx0XHR9XG5cblx0XHRpZiAob2xkQ2hpbGRyZW4gJiYgbmV3Q2hpbGRyZW4pIHtcblx0XHRcdC8vIFNldCBpcyBwcmVzZW50IHNvIHBvcHVsYXRlIGl0XG5cblx0XHRcdG5ld0NoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGNoaWxkRGF0YSkge1xuXHRcdFx0XHRvbGRDaGlsZHJlbi5hZGQoZGVkdXAoY2hpbGREYXRhKSk7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBkYXRhO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBkYXRhO1xufVxuXG5mdW5jdGlvbiBvcGVuUGF0aChkYXRhKSB7XG5cdGlmIChkYXRhLmlzRGlyKSB7XG5cblx0XHRpZiAoc3RhdGUuY3VycmVudGx5T3BlbmVkUGF0aCAhPT0gZGF0YS5wYXRoKSB7XG5cdFx0XHQvLyBUT0RPOiBjbG9zZSBhbGwgdGFic1xuXG5cdFx0XHQvLyBUaGVuIG9wZW4gdGhlIHNhdmVkIHRhYnMgZnJvbSBsYXN0IHRpbWVcblx0XHRcdGRiLmdldCgnT1BFTl9UQUJTX0ZPUl8nICsgZGF0YS5wYXRoKS50aGVuKGZ1bmN0aW9uICh0YWJzKSB7XG5cdFx0XHRcdHRhYnMub3Blbl90YWJzLmZvckVhY2gob3BlbkZpbGUpO1xuXHRcdFx0fSkuY2F0Y2goZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coZSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRzdGF0ZS5jdXJyZW50bHlPcGVuZWRQYXRoID0gZGF0YS5wYXRoO1xuXG5cdFx0dmFyIGZpbGVsaXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpcmVjdG9yeScpO1xuXHRcdHBvcHVsYXRlRmlsZUxpc3QoZmlsZWxpc3QsIGRhdGEucGF0aCwge1xuXHRcdFx0aGlkZURvdEZpbGVzOiB0cnVlXG5cdFx0fSk7XG5cblx0XHR1cGRhdGVEQkRvYygnSU5JVF9TVEFURScsIHtcblx0XHRcdHByZXZpb3VzX3BhdGg6IHsgcGF0aDogZGF0YS5wYXRoLCBpc0RpcjogdHJ1ZSB9XG5cdFx0fSlcblx0XHQuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuXHRcdFx0Y29uc29sZS5sb2coZXJyKTtcblx0XHR9KTtcblxuXHR9XG5cdGlmIChkYXRhLmlzRmlsZSkge1xuXHRcdG9wZW5GaWxlKGRhdGEpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIG9wZW5GaWxlKGRhdGEpIHtcblxuXHRkYXRhID0gZGVkdXAoZGF0YSk7XG5cblx0aWYgKHRhYkNvbnRyb2xsZXIuaGFzVGFiKGRhdGEpKSB7XG5cdFx0dGFiQ29udHJvbGxlci5mb2N1c1RhYihkYXRhKTtcblx0fSBlbHNlIHtcblx0XHR2YXIgbmV3VGFiID0gdGFiQ29udHJvbGxlci5uZXdUYWIoZGF0YSk7XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwoW2ZzLnJlYWRGaWxlKGRhdGEucGF0aCwgJ3V0ZjgnKSwgbW9uYWNvUHJvbWlzZV0pXG5cdFx0XHQudGhlbihmdW5jdGlvbiAoYXJyKSB7XG5cdFx0XHRcdHJldHVybiBhcnJbMF07XG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24gKGZpbGVDb250ZW50cykge1xuXHRcdFx0XHR2YXIgbGFuZ3VhZ2UgPSBnZXRNb25hY29MYW5ndWFnZUZyb21NaW1lcyhkYXRhLm1pbWUpIHx8IGdldE1vbmFjb0xhbmd1YWdlRnJvbUV4dGVuc2lvbnMoZGF0YS5leHRlbnNpb24pO1xuXHRcdFx0XHRuZXdUYWIuZWRpdG9yID0gbW9uYWNvLmVkaXRvci5jcmVhdGUobmV3VGFiLmNvbnRlbnRFbCwge1xuXHRcdFx0XHRcdHZhbHVlOiBmaWxlQ29udGVudHMsXG5cdFx0XHRcdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRhZGRCaW5kaW5ncyhuZXdUYWIuZWRpdG9yLCBuZXdUYWIpO1xuXHRcdFx0fSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gcHJvbXB0Rm9yT3BlbigpIHtcblx0b3BlbkZpbGVEaWFsb2coc3RhdGUuY3VycmVudGx5T3BlbmVkUGF0aCB8fCAnLycpLnRoZW4ob3BlblBhdGgpO1xufVxuXG5leHBvcnQge1xuXHRkZWR1cCxcblx0cG9wdWxhdGVGaWxlTGlzdCxcblx0cmVuZGVyRmlsZUxpc3QsXG5cdG9wZW5GaWxlLFxuXHRvcGVuUGF0aCxcblx0cHJvbXB0Rm9yT3BlblxufTsiLCIvKiBnbG9iYWwgcmVxdWlyZSwgTWFwLCBTZXQsIFByb21pc2UgKi9cbi8qIGVzbGludCBuby12YXI6IDAsIG5vLWNvbnNvbGU6IDAgKi9cbi8qIGVzbGludC1lbnYgZXM2ICovXG5cbmltcG9ydCB7IHBvcHVsYXRlRmlsZUxpc3QsIG9wZW5GaWxlIH0gZnJvbSAnLi9maWxlcyc7XG5cbmZ1bmN0aW9uIHNldFVwU2lkZUJhcigpIHtcblxuXHRmdW5jdGlvbiBleHBhbmREaXIoZWwsIGRhdGEpIHtcblx0XHR2YXIgZmlsZWxpc3RFbCA9IGVsLnF1ZXJ5U2VsZWN0b3IoJy5maWxlbGlzdCcpO1xuXHRcdGlmIChmaWxlbGlzdEVsLmNoaWxkcmVuLmxlbmd0aCkge1xuXHRcdFx0ZmlsZWxpc3RFbC5pbm5lckhUTUwgPSAnJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cG9wdWxhdGVGaWxlTGlzdChmaWxlbGlzdEVsLCBkYXRhLnBhdGgsIHtcblx0XHRcdFx0aGlkZURvdEZpbGVzOiB0cnVlXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHR2YXIgZGlyZWN0b3J5RWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZGlyZWN0b3J5Jyk7XG5cblx0ZnVuY3Rpb24gb25jbGljayhlKSB7XG5cdFx0aWYgKGUudGFyZ2V0LnRhZ05hbWUgPT09ICdMSScpIHtcblx0XHRcdGlmIChlLnRhcmdldC5kYXRhLmlzRmlsZSkgb3BlbkZpbGUoZS50YXJnZXQuZGF0YSk7XG5cdFx0XHRpZiAoZS50YXJnZXQuZGF0YS5pc0RpcikgZXhwYW5kRGlyKGUudGFyZ2V0LCBlLnRhcmdldC5kYXRhKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBvbmtleWRvd24oZSkge1xuXHRcdGlmIChldmVudC5rZXlDb2RlID09PSAxMykgb25jbGljayhlKTtcblx0fVxuXG5cdGRpcmVjdG9yeUVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgb25jbGljayk7XG5cdGRpcmVjdG9yeUVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBvbmtleWRvd24pO1xuXG59O1xuXG5leHBvcnQgeyBzZXRVcFNpZGVCYXIgfTsiLCIvKiBnbG9iYWwgcmVxdWlyZSwgTWFwLCBTZXQsIFByb21pc2UgKi9cbi8qIGVzbGludCBuby12YXI6IDAsIG5vLWNvbnNvbGU6IDAgKi9cbi8qIGVzbGludC1lbnYgZXM2ICovXG5cbmltcG9ydCB7IGRiIH0gZnJvbSAnLi9saWIvZGInO1xuaW1wb3J0IHsgd3NQcm9taXNlIH0gZnJvbSAnLi9saWIvd3MnO1xuaW1wb3J0IHsgb3BlblBhdGgsIHByb21wdEZvck9wZW4gfSBmcm9tICcuL2xpYi9maWxlcyc7XG5pbXBvcnQgeyBzYXZlT3BlblRhYiwgdGFiQ29udHJvbGxlciB9IGZyb20gJy4vbGliL3RhYi1jb250cm9sbGVyJztcbmltcG9ydCB7IHNldFVwU2lkZUJhciB9IGZyb20gJy4vbGliL3NpZGUtYmFyJztcblxuZnVuY3Rpb24gaW5pdCgpIHtcblxuXHRkYi5nZXQoJ0lOSVRfU1RBVEUnKVxuXHRcdC50aGVuKGZ1bmN0aW9uIChkb2MpIHtcblx0XHRcdGlmIChkb2MucHJldmlvdXNfcGF0aCkge1xuXHRcdFx0XHRyZXR1cm4gb3BlblBhdGgoZG9jLnByZXZpb3VzX3BhdGgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHByb21wdEZvck9wZW4oKTtcblx0XHRcdH1cblx0XHR9KVxuXHRcdC5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG5cdFx0XHRwcm9tcHRGb3JPcGVuKCk7XG5cdFx0XHRjb25zb2xlLmxvZyhlcnIpO1xuXHRcdH0pO1xufVxuXG53c1Byb21pc2UudGhlbihpbml0KTtcblxuKGZ1bmN0aW9uIHNldFVwVG9vbEJhcigpIHtcblx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYnV0dG9uW2RhdGEtYWN0aW9uPVwib3Blbi1maWxlXCJdJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBwcm9tcHRGb3JPcGVuKTtcblx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYnV0dG9uW2RhdGEtYWN0aW9uPVwic2F2ZS1maWxlXCJdJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBzYXZlT3BlblRhYik7XG59KCkpO1xuXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgZnVuY3Rpb24gKCkge1xuXHR2YXIgdGFiID0gdGFiQ29udHJvbGxlci5nZXRPcGVuVGFiKCk7XG5cdGlmICh0YWIpIHRhYi5lZGl0b3IubGF5b3V0KCk7XG59KTtcblxuc2V0VXBTaWRlQmFyKCk7Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBOzs7O0FBSUEsSUFBSSxFQUFFLEdBQUcsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3JDLFNBQVMsV0FBVyxDQUFDLEdBQUcsRUFB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
