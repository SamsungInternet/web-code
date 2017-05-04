/* global require, Map, Set, Promise, monaco */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import {resolve as pathResolve, basename, dirname, extname, join as pathJoin} from 'path';
import mime from 'mime';

import fs from './fs-proxy';

import state from './state';
import { db, updateDBDoc } from './db';
import { tabController } from './tab-controller';
import { monacoPromise, getMonacoLanguageFromExtensions, getMonacoLanguageFromMimes, addBindings } from './monaco';
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

function getPathInfo(path, withChildren) {
	return new Promise(function (resolve, reject) {
		path = pathResolve(path);
		const name = basename(path);
		const item = { path, name, dirName: dirname(path) };
		return fs.stat(path)
		.then(function (result) {
			if (result.isFile()) {
				const ext = extname(path).toLowerCase();
				item.isFile = true;
				item.size = result.size;  // File size in bytes
				item.extension = ext;
				item.mime = mime.lookup(path);
				return resolve(item);
			} else if (result.isDirectory()) {
				item.isDir = true;
				item.mime = 'directory';
				if (withChildren !== false) {
					return fs.readdir(path)
						.then(function (arr) {
							return Promise.all(arr.map(function (child) {
								return getPathInfo(pathJoin(path, child), false);
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

function populateFileList(el, path, options) {
	el.path = path;
	return getPathInfo(path)
		.then(function (data) {
			if (data.isFile) {
				return getPathInfo(data.dirName);
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
	openFileDialog(state.currentlyOpenedPath || process.env.HOME || '/').then(openPath);
}

function smartOpen(path) {
	console.log('Trying to open, path');
	fs.stat(path)
	.then(function (result) {
		if (result.isDirectory()) {
			return getPathInfo(path).then(function (pathData) {openPath(pathData)});
		}
		if (result.isFile()) {
			return getPathInfo(path).then(function (pathData) {openFile(pathData)});
		}
	});
}

export {
	dedup,
	populateFileList,
	renderFileList,
	openFile,
	openPath,
	promptForOpen,
	smartOpen
};