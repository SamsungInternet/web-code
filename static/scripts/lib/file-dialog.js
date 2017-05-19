/* global Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

/* NEEDS REFACTORING */

import { populateFileList, destroyFileList } from './files';
import Stats from './web-code-stats';
import { resolve, join } from 'path';

var highlightedEl;
var currentPath;
var resolver;
var rejecter;

function fileDialog(options) {

	return new Promise(function (resolve, reject) {
		
		var role;
		var path = options.path || process.env.HOME || '/';

		if (fileDialog.open === undefined) fileDialog.open = false;
		if (fileDialog.open === true) {
			throw Error('Dialog already open for another task.');
		}

		fileDialog.el.classList.remove('closed');

		if (typeof options !== 'object') {
			throw Error('Invalid options object')
		}

		if (!options.role) {
			throw Error('Role not defined');
		}

		if (options.role.toLowerCase() === 'open') {
			role = 'open';
			fileDialog.submitButton.textContent = 'Open';
			setTimeout(function () {
				fileDialog.filelistLeft.focus();
			}, 300);
		} else if (options.role.toLowerCase() === 'save as') {
			role = 'save-as';
			fileDialog.submitButton.textContent = 'Save';
			setTimeout(function () {
				fileDialog.filename.focus();
			}, 300);
		} else {
			throw Error('Unrecognised role, ' + options.role);
		}

		if (options.filename) {
			fileDialog.filename.value = options.filename;
		}

		fileDialog.el.dataset.role = role;

		currentPath = path;
		resolver = resolve;
		rejecter = reject;

		fileDialog.currentPathEl.value = currentPath;

		populateFileList(fileDialog.filelistLeft, path, {
			nested: false
		})
		.catch(function (e) {
			console.log(e);
			return populateFileList(fileDialog.filelistLeft, process.env.HOME || '/', {
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

		currentPath = e.target.stats.data.path;


		if (e.target.stats && e.target.stats.isDirectory()) {
			fileDialog.currentPathEl.value = currentPath;
			if (e.currentTarget === fileDialog.filelistLeft) {
				if (e.target.stats.data.name === '..') {
					populateFileList(fileDialog.filelistLeft, e.target.stats.data.path, {
						nested: false
					});
					destroyFileList(fileDialog.filelistRight);
				} else {
					populateFileList(fileDialog.filelistRight, e.target.stats.data.path, {
						nested: false
					});
				}
			}
			if (e.currentTarget === fileDialog.filelistRight) {
				populateFileList(fileDialog.filelistLeft, e.target.stats.data.dirName, {
					nested: false
				})
				.then(function () {
					[].slice.call(fileDialog.filelistLeft.children).forEach(function (el) {
						if (el.stats.data.path === currentPath) {
							highlightedEl = e.target;
							highlightedEl.classList.add('has-highlight');
						}
					});
				});

				populateFileList(fileDialog.filelistRight, e.target.stats.data.path, {
					nested: false
				});
			}
		}

		if (e.target.stats && e.target.stats.isFile()) {
			if (fileDialog.el.dataset.role === 'open') {
				fileDialog.currentPathEl.value = currentPath;
			} else {
				fileDialog.currentPathEl.value = e.target.stats.data.dirName;
			}
			fileDialog.filename.value = e.target.stats.data.name;
		}
	}
}

function ondblclick(e) {
	highlight(e);
	if (e.target.stats && e.target.stats.isDirectory()) return;
	submit(e.target.stats);
}

function submit(stats) {
	if (fileDialog.el.dataset.role === 'open') {
		resolver(stats);
	}
	if (fileDialog.el.dataset.role === 'save-as') {
		resolver(join(stats.isDirectory() ? stats.data.path : stats.data.dirName, fileDialog.filename.value));
	}
	fileDialog.el.classList.add('closed');
	resolver = undefined;
	rejecter = undefined;
}

function cancel() {
	fileDialog.el.classList.add('closed');
	rejecter('User canceled');
	resolver = undefined;
	rejecter = undefined;
}

function onkeydown(e) {
	if (event.keyCode === 13) ondblclick(e);
	e.stopPropagation();
}

function setDialogPath(path) {
	fileDialog.currentPathEl.value = path;
	populateFileList(fileDialog.filelistLeft, path, {
		nested: false
	});
	destroyFileList(fileDialog.filelistRight);
}

fileDialog.el = fileDialog.el || document.querySelector('#file-dialog-widget');
fileDialog.currentPathEl = fileDialog.currentPathEl || fileDialog.el.querySelector('input[name="current-path"]');
fileDialog.filelistLeft = fileDialog.filelistLeft || fileDialog.el.querySelector('.filelist:first-child');
fileDialog.filelistRight = fileDialog.filelistRight || fileDialog.el.querySelector('.filelist:not(:first-child)');
fileDialog.submitButton = fileDialog.submitButton || fileDialog.el.querySelector('#file-dialog-submit');
fileDialog.filename = fileDialog.filename || fileDialog.el.querySelector('#save-file-name');
fileDialog.cancelButton = fileDialog.cancelButton || fileDialog.el.querySelector('#file-dialog-cancel');
fileDialog.upDirButton = fileDialog.upDirButton || fileDialog.el.querySelector('button[data-action="up-dir"]');

fileDialog.el.addEventListener('keydown', function () {
	if (event.keyCode === 13) return Stats.fromPath(fileDialog.currentPathEl.value).then(submit);
});

fileDialog.filelistLeft.addEventListener('click', highlight);
fileDialog.filelistRight.addEventListener('click', highlight);

fileDialog.filelistLeft.addEventListener('keydown', onkeydown);
fileDialog.filelistRight.addEventListener('keydown', onkeydown);

fileDialog.filelistLeft.addEventListener('dblclick', ondblclick);
fileDialog.filelistRight.addEventListener('dblclick', ondblclick);
fileDialog.submitButton.addEventListener('click', function () {
	return Stats.fromPath(fileDialog.currentPathEl.value).then(submit);
});
fileDialog.cancelButton.addEventListener('click', function () {
	cancel();
});
fileDialog.upDirButton.addEventListener('click', function () {
	var path = resolve(join(fileDialog.currentPathEl.value, '/..'));
	setDialogPath(path);
});

export default fileDialog;