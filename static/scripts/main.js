/* global Map, Set, Promise, monaco */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import { db } from './lib/db.js';
import { wsPromise } from './lib/ws.js';
import { openPath, promptForOpen, smartOpen } from './lib/files.js';
import { monacoPromise, addBindings, monacoSettings } from './lib/monaco';
import { saveOpenTab, tabController } from './lib/tab-controller.js';
import { setUpSideBar } from './lib/side-bar.js';
import { addScript } from './lib/utils.js';
import Stats from './lib/web-code-stats.js';
import fs from './lib/fs-proxy';
window.fs = fs;

wsPromise.then(function init(handshakeData) {

	if (process.env.DEBUG) {
		addScript('/axe/axe.min.js').promise.then(function () {
			window.axe.run(function (err, results) {
				if (err) throw err;
				console.log('a11y violations:', results.violations.length, results.violations);
			});
		});
	}

	// Open requested directory
	if (handshakeData.path) {
		return smartOpen(handshakeData.path);
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
			return promptForOpen();
		})
		.then(function () {
			setUpScratch();
		});
});

// Add a special tab for taking notes.
function setUpScratch() {
	var tab = tabController.newTab({
		name: 'Scratchpad'
	});

	// Puts new tab at the start rest get moved after it
	tabController.setOrder([
		tab
	]);

	return monacoPromise
			.then(function () {
				tab.editor = monaco.editor.create(tab.contentEl, monacoSettings());
				addBindings(tab.editor, tab);
			})
			.catch(function (e) {
				console.log(e.message);	
			});
}

(function setUpToolBar() {
	document.querySelector('button[data-action="open-file"]').addEventListener('click', promptForOpen);
	document.querySelector('button[data-action="save-file"]').addEventListener('click', saveOpenTab);
}());

window.addEventListener('resize', function () {
	var tab = tabController.getOpenTab();
	if (tab) tab.editor.layout();
});

setUpSideBar();