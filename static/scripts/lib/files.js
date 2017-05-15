/* global Map, Set, Promise, monaco */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import fs from './fs-proxy';
import Stats from './web-code-stats.js';
import state from './state';
import { db, updateDBDoc } from './db';
import { tabController } from './tab-controller';
import { monacoPromise, getMonacoLanguageFromExtensions, getMonacoLanguageFromMimes, addBindings, monacoSettings } from './monaco';
import openFileDialog from './open-file-dialog';
import { remoteCmd } from './ws';

function populateFileList(el, path, options) {
	el.path = path;
	return Stats.fromPath(path)
		.then(function (stats) {
			if (stats.isFile()) {
				return Stats.fromPath(stats.data.dirName);
			}
			return stats;
		})
		.then(function (stats) {
			return stats.updateChildren();
		})
		.then(function (stats) {

			// Teardown old file list
			if (el.stats) {
				el.stats.destroyFileList(el);
			}

			// set up new one
			stats.renderFileList(el, options);
			return stats;
		});
}

function destroyFileList(el) {
	if (el.stats) {
		el.stats.destroyFileList(el);
	}
}

function openPath(stats) {
	if (stats.isDirectory()) {

		if (state.currentlyOpenedPath !== stats.data.path) {
			tabController.closeAll();

			// Let server know
			remoteCmd('CLIENT', {
				cmd: 'watchPath',
				arguments: [stats.data.path]
			});

			// Then open the saved tabs from last time
			db.get('OPEN_TABS_FOR_' + stats.data.path).then(function (tabs) {
				Promise.all(tabs.open_tabs.map(function (obj) {
					if (!obj.path) return null;
					return Stats.fromPath(obj.path)
					.catch(function (e) {
						console.log(e.message);
						return null;
					});
				})).then(function (statsArray) {
					statsArray.filter(function (a) {
						return a !== null;
					}).forEach(function (stats) {
						openFile(stats);
					});
				});
			}).catch(function (e) {
				console.log(e);
			});
		}

		state.currentlyOpenedPath = stats.data.path;

		var filelist = document.getElementById('directory');
		populateFileList(filelist, stats.data.path, {
			hideDotFiles: true
		})
		.catch(function (e) {
			throw e;	
		});

		updateDBDoc('INIT_STATE', {
			previous_path: { path: stats.data.path }
		})
		.catch(function (err) {
			console.log(err);
		});

	}
	if (stats.isFile()) {
		openFile(stats);
	}
}

function openFile(stats) {

	if (tabController.hasTab(stats)) {
		tabController.focusTab(stats);
	} else {
		var newTab = tabController.newTab(stats);
		tabController.focusTab(newTab);

		return Promise.all([fs.readFile(stats.data.path, 'utf8'), monacoPromise])
			.then(function (arr) {
				return arr[0];
			})
			.then(function (fileContents) {
				var language = getMonacoLanguageFromMimes(stats.data.mime) || getMonacoLanguageFromExtensions(stats.data.extension);
				newTab.editor = monaco.editor.create(newTab.contentEl, monacoSettings({
					value: fileContents,
					language: language
				}));
				addBindings(newTab.editor, newTab);
			})
			.catch(function (e) {
				console.log(e.message);	
			});
	}
}

function promptForOpen() {
	return openFileDialog(state.currentlyOpenedPath || process.env.HOME || '/').then(openPath);
}

function smartOpen(path) {
	console.log('Trying to open, ' + path);
	fs.stat(path)
	.then(function (result) {
		if (result.isDirectory()) {
			return Stats.fromPath(path).then(function (stats) {openPath(stats)});
		}
		if (result.isFile()) {
			return Stats.fromPath(path).then(function (stats) {openFile(stats)});
		}
	});
}

export {
	populateFileList,
	openFile,
	openPath,
	promptForOpen,
	smartOpen,
	destroyFileList
};