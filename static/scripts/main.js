/* global Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import { db } from './lib/db.js';
import { wsPromise } from './lib/ws.js';
import { openPath, promptForOpen, smartOpen } from './lib/files.js';
import { saveOpenTab, tabController } from './lib/tab-controller.js';
import { setUpSideBar } from './lib/side-bar.js';
import { addScript } from './lib/utils.js';
import { newFile } from './lib/newFile.js';
import Stats from './lib/web-code-stats.js';
import fs from './lib/fs-proxy';
window.fs = fs;

wsPromise.then(function init() {
	
	console.log('Connected to the server...');

	if (process.env.DEBUG) {
		addScript('/axe/axe.min.js').promise.then(function () {
			window.axe.run(function (err, results) {
				if (err) throw err;
				console.log('a11y violations:', results.violations.length, results.violations);
			});
		});
	}

	// load old state
	return db.get('INIT_STATE')
		.then(function (doc) {
			if (doc.previous_path) {
				return Stats.fromPath(doc.previous_path.path).then(openPath);
			} else {
				return promptForOpen();
			}
		})
		.catch(function (err) {
			console.log(err);
		});
}, function (e) {
	console.log(e);	
});

(function setUpToolBar() {
	document.querySelector('button[data-action="open-file"]').addEventListener('click', promptForOpen);
	document.querySelector('button[data-action="save-file"]').addEventListener('click', saveOpenTab);
	document.querySelector('button[data-action="new-file"]').addEventListener('click', newFile);
}());

window.addEventListener('resize', function () {
	var tab = tabController.getOpenTab();
	if (tab && tab.editor) tab.editor.layout();
});

setUpSideBar();