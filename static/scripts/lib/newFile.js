/* global Map, Set, Promise, monaco */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import { tabController } from './tab-controller.js';
import { monacoPromise, monacoSettings, addBindings } from './monaco.js';
import BufferFile from './buffer-file.js';

// Until they are saved new files are kept in a buffer
// Saved on changes to the db when saved to disk they are removed from the DB
function newFile() {
	var tab;

	var bf = new BufferFile ({
		name: 'New File',
		icon: 'buffer',
		id: Date.now() + '__' + 'New File'
	});
	
	bf.valuePromise
	.then(function () {
		tab = tabController.newTab(bf);
		return monacoPromise;
	})
	.then(function () {
		tab.editor = monaco.editor.create(tab.contentEl, monacoSettings());
		addBindings(tab.editor, tab);
		tabController.focusTab(tab);
	})
	.catch(function (e) {
		console.log(e.message);	
	});
}


// Add a special tab for taking notes.
// The idea of the scratch is that it is always present
// 
// Different directories haave their own scratch
//
// Saving it makes a new file but launches a new empty scratch
function setUpScratch() {
	var tab = tabController.newTab(new BufferFile ({
		name: 'Scratchpad',
		icon: 'buffer'
	}));

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

export {
	newFile,
	setUpScratch
}