/* global Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import { populateFileList, destroyFileList, openFile } from './files';

function setUpSideBar() {

	function expandDir(el, stats) {
		var filelistEl = el.querySelector('.filelist');
		if (filelistEl.children.length) {
			destroyFileList(filelistEl);
		} else {
			populateFileList(filelistEl, stats.data.path, {
				hideDotFiles: true
			});
		}
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

	directoryEl.addEventListener('click', onclick);
	directoryEl.addEventListener('keydown', onkeydown);

};

export { setUpSideBar };