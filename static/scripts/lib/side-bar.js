/* global Map, Set, Promise, contextmenu */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import { populateFileList, destroyFileList, openFile } from './files.js';
import { join } from 'path';
import fs from './fs-proxy.js';
import Stats from './web-code-stats.js';
import { displayError } from './errors.js';

function setUpSideBar() {

	function expandDir(el, stats) {
		var filelistEl = el.querySelector('.filelist');
		if (el.stats.expanded === true) {
			el.stats.expanded = false;
			destroyFileList(filelistEl);
		} else {
			el.stats.expanded = true;
			populateFileList(filelistEl, stats.data.path, {
				hideDotFiles: true
			});
		}
	}

	function refreshSideBar() {
		directoryEl.stats.updateChildren();
	}

	var directoryEl = document.querySelector('#directory');

	function onclick(e) {
		if (e.target.tagName === 'LI') {
			if (e.target.stats.isFile()) openFile(e.target.stats);
			if (e.target.stats.isDirectory()) expandDir(e.target, e.target.stats);
		}
	}

	function onkeydown(e) {
		if (event.keyCode === 13) onclick(e);
	}

	var menu = contextmenu([
		{
			label: 'New File',
			onclick: function () {
				lastContextEl = lastContextEl || directoryEl;
				if (lastContextEl.stats) {
					var newFile = prompt('New file name:', 'untitled.txt');
					if (newFile) {
						var newPath = join(lastContextEl.stats.isDirectory() ? lastContextEl.stats.data.path : lastContextEl.stats.data.dirName, newFile);
						fs.writeFile(newPath, '', {
							flag: 'wx'
						})
						.then(function () {
							return Stats.fromPath(newPath)
						})
						.then(function (stats) {
							openFile(stats);	
						})
						.catch(function (e) {
							displayError('FS Error', e.message, 3000);	
						})
						.then(refreshSideBar);
					}
				}
			}
		},
		{
			label: 'New Folder',
			onclick: function () {
				lastContextEl = lastContextEl || directoryEl;
				if (lastContextEl.stats) {
					var newFolder = prompt('New folder name:', 'New Folder');
					if (newFolder) {
						fs.mkdir(join(lastContextEl.stats.isDirectory() ? lastContextEl.stats.data.path : lastContextEl.stats.data.dirName, newFolder)).then(function () {
							console.log('success');
						})
						.catch(function (e) {
							displayError('FS Error', e.message, 3000);	
						})
						.then(refreshSideBar);
					}
				}
			}
		},
		{
			label: 'Rename',
			onclick: function () {
				lastContextEl = lastContextEl || directoryEl;
				if (lastContextEl.stats) {
					var newName = prompt('Rename file:', lastContextEl.stats.data.name);
					if (newName) {
						fs.rename(lastContextEl.stats.data.path, join(lastContextEl.stats.data.dirName, newName)).then(function () {
							console.log('success');
						})
						.catch(function (e) {
							displayError('FS Error', e.message, 3000);	
						})
						.then(refreshSideBar);
					}
				}
			}
		},
		{
			label: 'Delete File',
			onclick: function () {
				lastContextEl = lastContextEl || directoryEl;
				if (lastContextEl.stats) {
					var path = join(lastContextEl.stats.data.path);
					var confirmDel = confirm('Are you sure you want to delete this file?\n' + path);
					if (confirmDel) {
						if (lastContextEl.stats.isFile()) {
							fs.unlink(path).then(function () {
								console.log('success');
							})
							.catch(function (e) {
								displayError('FS Error', e.message, 3000);	
							})
							.then(refreshSideBar);
						}
						if (lastContextEl.stats.isDirectory()) {
							fs.rmdir(path).then(function () {
								console.log('success');
							})
							.catch(function (e) {
								displayError('FS Error', e.message, 3000);	
							})
							.then(refreshSideBar);
						}
					}
				}
			}
		},
	]);

	var lastContextEl;

	function updateContextMenuEl(el) {
		el = el || {};
		if (el.stats) {
			lastContextEl = el;
			menuTitle.textContent = el.stats.data.name;
		} else {
			lastContextEl = null;
			menuTitle.textContent = '';
		}
	}

	directoryEl.addEventListener('contextmenu', function (e) {
		updateContextMenuEl(e.target);
		setTimeout(function () { menu.focus(); }, 0);
	});

	menu.tabIndex = 0;

	menu.addEventListener('keydown', function (e) {
		var children = Array.from(menu.children);
		var cur = menu.querySelector(':focus');
		var index = cur ? children.indexOf(cur) : -1;
		switch (e.keyCode) {
		case 38: // up
			index--;
			if (index < 0) index = children.length - 1;
			break;
		case 40: // down
			index++;
			if (index >= children.length) index = 0;
			break;
		case 13:
			if (cur) cur.click();
			break;
		}
		if (children[index]) children[index].focus();
	})

	Array.from(menu.querySelectorAll('menuitem')).forEach(function (el) {
		el.tabIndex=0;
	});

	contextmenu.attach(directoryEl, menu);

	var menuTitle = document.createElement('h2');
	menuTitle.textContent = 'Directory';
	menu.insertBefore(menuTitle, menu.firstChild);

	window.addEventListener('load', function () {
		var overlay = menu.parentNode;
		overlay.addEventListener('contextmenu', function (e) {
			var display = overlay.style.display;
			overlay.style.display = 'none';
			var node = document.elementFromPoint(e.clientX, e.clientY);
			if (node === directoryEl || directoryEl.contains(node)) {
				updateContextMenuEl(node);
			}
			overlay.style.display = display;
			setTimeout(function () { menu.focus(); }, 0);
		});
	});

	directoryEl.addEventListener('click', onclick);
	directoryEl.addEventListener('keydown', onkeydown);

};

export { setUpSideBar };