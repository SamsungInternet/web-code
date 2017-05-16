/* global Map, Set, Promise, monaco */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import fs from './fs-proxy.js';
import Stats from './web-code-stats.js';
import BufferFile from './buffer-file.js';
import state from './state.js';
import { db, updateDBDoc } from './db.js';
import { tabController } from './tab-controller.js';
import { monacoPromise, getMonacoLanguageFromExtensions, getMonacoLanguageFromMimes, addBindings, monacoSettings } from './monaco.js';
import openFileDialog from './open-file-dialog.js';

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

			// Teardown old file list if one is present
			if (el.stats) {
				el.stats.destroyFileList(el);
			}

			// set up new one
			stats.renderFileList(el, options);

			// Update the filelist from the server
			return stats.updateChildren();
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

			// Then open the saved tabs from last time
			db.get('OPEN_TABS_FOR_' + stats.data.path).then(function (tabs) {
				Promise.all(tabs.open_tabs.map(function (obj) {
					if (obj.__webStatDoc) {
						return Stats.fromPath(obj.path)
						.catch(function (e) {
							console.log(e.message);
							return null;
						});
					}
					if (obj.isBufferFileDoc) {
						return new BufferFile(obj);
					}
					return null;
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

		if (stats.constructor === Stats) return monacoPromise
			.then(function () {
				if (stats.data.mime.match(/^image\//)) {
					var image = document.createElement('img');
					image.src = '/api/imageproxy?url=' + encodeURIComponent(stats.data.path);
					newTab.contentEl.appendChild(image);
					newTab.contentEl.classList.add('image-container');
				} else if (stats.data.mime.match(/^video\//)) {
					var video = document.createElement('video');
					video.src = '/api/imageproxy?url=' + encodeURIComponent(stats.data.path);
					newTab.contentEl.appendChild(video);
					video.controls = true;
					newTab.contentEl.classList.add('image-container');
				} else {
					return fs.readFile(stats.data.path, 'utf8')
					.then(function (fileContents) {
						var language = getMonacoLanguageFromMimes(stats.data.mime) || getMonacoLanguageFromExtensions(stats.data.extension);
						newTab.editor = monaco.editor.create(newTab.contentEl, monacoSettings({
							value: fileContents,
							language: language
						}));
						addBindings(newTab.editor, newTab);
					});
				}
			})
			.catch(function (e) {
				console.log(e.message);	
			});

		if (stats.constructor === BufferFile) {
			Promise.all([monacoPromise, stats.valuePromise]).then(function (arr) {
				return arr[1];
			})
			.then(function (value) {
				var language = getMonacoLanguageFromMimes(stats.data.mime) || getMonacoLanguageFromExtensions(stats.data.extension);
				newTab.editor = monaco.editor.create(newTab.contentEl, monacoSettings({
					value: value,
					language: language
				}));
				addBindings(newTab.editor, newTab);
			});
		}
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


// Saves file and updates versions for changes
function saveTextFileFromEditor(stats, editor) {
	if (stats.constructor === Stats) {
		var altId = editor.model.getAlternativeVersionId();
		fs.writeFile(stats.data.path, editor.getValue())
		.then(function () {
			editor.webCodeState.savedAlternativeVersionId = altId;
			editor.webCodeState.functions.checkForChanges();
		});
	} else if (stats.constructor === BufferFile) {
		console.log('STUB: Save As for:', stats);
	} else {
		throw Error('Not a FileStats or FileBuffer');
	}
}

export {
	populateFileList,
	openFile,
	openPath,
	promptForOpen,
	smartOpen,
	destroyFileList,
	saveTextFileFromEditor
};