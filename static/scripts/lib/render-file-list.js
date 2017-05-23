/* global Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import Stats from './web-code-stats.js';
import BufferFile from './buffer-file.js';

function renderFileList(el, array, options) {

	options = options || {};
	var useOptions = {
		hideDotFiles: (options.hideDotFiles !== undefined ? options.hideDotFiles : true),
		nested: (options.nested !== undefined ? options.nested : true),
		nestingLimit: (options.nestingLimit || 5) - 1,
		sort: options.sort === false ? false : true
	}
	if (options.nestingLimit === 0) return;

	var sortedData = !useOptions.sort ? array : Array.from(array)
		.filter(function (stats) {

			// Whether to hide dotfiles
			if (stats.data.name !== '..' && useOptions.hideDotFiles !== false) {
				return stats.data.name[0] !== '.';
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
				(a.isDirectory() === b.isDirectory()) &&
				(a.isFile() === b.isFile())
			) {
				return ([a.data.name, b.data.name].sort(function (a, b) {
					return a.toLowerCase().localeCompare(b.toLowerCase());
				})[0] === a.data.name ? -1 : 1);
			} else {
				if (a.isDirectory()) return -1;
				return 1;
			}
		});

	sortedData.map(function (stats) {

		var li = document.createElement('li');
		li.classList.add('has-icon');
		li.tabIndex = 0;
		li.tabKey = stats;

		if (stats.constructor === Stats) {
			li.dataset.mime = stats.data.mime;
			li.dataset.name = stats.data.name;
			li.dataset.size = stats.data.size;
			li.textContent = stats.data.name;
			li.stats = stats;

			if (stats.isDirectory() && useOptions.nested !== false) {
				var newFileList = document.createElement('ul');
				newFileList.classList.add('filelist');
				li.appendChild(newFileList);
				if (stats.expanded && stats.children) {
					stats.renderFileList(newFileList, useOptions);
				}
			}
		} else if (stats.constructor === BufferFile) {
			li.dataset.name = stats.data.name;
			li.textContent = stats.data.name;
			if (stats.data.icon) {
				li.classList.add('has-icon');
				li.dataset.icon = stats.icon;
			}
			if (stats.data.mime) {
				li.dataset.mime = stats.mime;
			}
		}

		el.appendChild(li);
	});


}

export default renderFileList;