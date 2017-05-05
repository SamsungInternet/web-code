/* global Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import { db } from './lib/db';
import { wsPromise } from './lib/ws';
import { openPath, promptForOpen, smartOpen } from './lib/files';
import { saveOpenTab, tabController } from './lib/tab-controller';
import { setUpSideBar } from './lib/side-bar';
import { addScript } from './lib/utils';

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
				return openPath(doc.previous_path);
			} else {
				return promptForOpen();
			}
		})
		.catch(function (err) {
			promptForOpen();
			console.log(err);
		});
});

(function setUpToolBar() {
	document.querySelector('button[data-action="open-file"]').addEventListener('click', promptForOpen);
	document.querySelector('button[data-action="save-file"]').addEventListener('click', saveOpenTab);
}());

window.addEventListener('resize', function () {
	var tab = tabController.getOpenTab();
	if (tab) tab.editor.layout();
});

setUpSideBar();