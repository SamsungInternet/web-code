/* global require, Map, Set, Promise, monaco */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import {
	remoteCmd
} from './ws';

import state from './state';
import { db, updateDBDoc } from './db';
import { tabController } from './tab-controller';
import { monacoPromise, getMonacoLanguageFromExtensions, getMonacoLanguageFromMimes, addKeyBindings } from './monaco';
import openFileDialog from './open-file-dialog';

// Map to prevent duplicate data objects for each file
var pathToDataMap = new Map();

function renderFileList(el, data, options) {

	options = options || {};
	var useOptions = {
		hideDotFiles: (options.hideDotFiles !== undefined ? options.hideDotFiles : true),
		nested: (options.nested !== undefined ? options.nested : true),
		nestingLimit: (options.nestingLimit || 5) - 1
	}
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

export {
	dedup,
	populateFileList,
	renderFileList,
	openFile,
	openPath,
	promptForOpen
};