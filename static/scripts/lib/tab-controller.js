/* global Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import state from './state.js';
import { updateDBDoc } from './db.js';
import Stats from './web-code-stats.js'
import renderFileList from './render-file-list.js';
import { saveTextFileFromEditor } from './files.js';
import BufferFile from './buffer-file.js';

function saveOpenTab() {
	var tab = tabController.getOpenTab();
	var stats;
	if (tab && tab.editor) {
		stats = tab.stats;
	} else {
		return;
	}
	saveTextFileFromEditor(stats, tab.editor);
}

function closeOpenTab() {
	var tab = tabController.getOpenTab();
	if (tab) tabController.closeTab(tab);
}

var tabController = (function setUpTabs() {
	var currentlyOpenFilesEl = document.querySelector('#currently-open-files');
	var containerEl = document.getElementById('container');
	var tabsEl = document.querySelector('#tabs');

	function updateOpenFileEl() {
		currentlyOpenFilesEl.innerHTML = '';
		renderFileList(currentlyOpenFilesEl, Array.from(tabController.currentlyOpenFilesMap.keys()), {
			sort: false
		});
	}

	function Tab(stats) {

		var addCloseButton = false;

		// It is a reference to a file
		if (stats.constructor === Stats) {
			this.stats = stats;
			this.el = document.createElement('a');
			this.el.classList.add('tab');
			this.el.classList.add('has-icon');
			this.el.dataset.mime = stats.data.mime;
			this.el.dataset.name = stats.data.name;
			this.el.textContent = stats.data.name;
			this.el.tabIndex = 0;
			addCloseButton = true;
		} else if (stats.constructor === BufferFile) {
			this.stats = stats;
			this.el = document.createElement('a');
			this.el.classList.add('tab');
			this.el.dataset.name = stats.data.name;
			this.el.textContent = stats.data.name;
			if (stats.data.icon) {
				this.el.classList.add('has-icon');
				this.el.dataset.icon = stats.data.icon;
			}
			if (stats.data.mime) {
				this.el.dataset.mime = stats.data.mime;
			}
			if (stats.data.hasTabCloseButton !== false) {
				addCloseButton = true;
			}
			this.el.tabIndex = 0;
		}

		if (addCloseButton) {

			this.closeEl = document.createElement('button');
			this.closeEl.classList.add('tab_close');
			this.closeEl.setAttribute('aria-label', 'Close Tab ' + stats.data.name);
			this.el.appendChild(this.closeEl);
			this.closeEl.tabIndex = 0;

			var self = this;
			this.closeEl.addEventListener('click', function () {
				tabController.closeTab(self);
			});
		}

		tabsEl.appendChild(this.el);

		this.el.webCodeTab = this;

		this.contentEl = document.createElement('div');
		this.contentEl.classList.add('tab-content');
		containerEl.appendChild(this.contentEl);
		
	}

	Tab.prototype.destroy = function () {
		this.el.parentNode.removeChild(this.el);
		this.contentEl.parentNode.removeChild(this.contentEl);
	}

	function TabController() {
		this.currentlyOpenFilesMap = new Map();
		this.focusedTab = null;
	}

	TabController.prototype.hasTab = function (stats) {
		return this.currentlyOpenFilesMap.has(stats);
	}

	TabController.prototype.getOpenTab = function () {
		return this.focusedTab;
	}

	TabController.prototype.newTab = function (stats) {
		var tab = new Tab(stats);
		this.currentlyOpenFilesMap.set(stats, tab);
		updateOpenFileEl();
		this.storeOpenTabs();

		if (!this.focusedTab) {
			this.focusTab(tab);
		}

		return tab;
	}

	TabController.prototype.focusTab = function (stats) {
		var focusedTab = stats.constructor === Tab ? stats : this.currentlyOpenFilesMap.get(stats);
		this.focusedTab = focusedTab;
		Array.from(this.currentlyOpenFilesMap.values()).forEach(function (tab) {
			tab.contentEl.classList.toggle('has-focus', tab === focusedTab);
			tab.el.classList.toggle('has-focus', tab === focusedTab);
		});
		if (focusedTab.editor) focusedTab.editor.layout();
	}

	TabController.prototype.getTabFromKey = function (stats) {
		var tab = stats.constructor === Tab ? stats : this.currentlyOpenFilesMap.get(stats);
		return tab;
	}

	TabController.prototype.closeTab = function (stats) {
		var tab = stats.constructor === Tab ? stats : this.currentlyOpenFilesMap.get(stats);
		var tabState = Array.from(this.currentlyOpenFilesMap.values());
		var tabIndex = tabState.indexOf(tab);
		var nextTab = (tabIndex >= 1) ? tabState[tabIndex - 1] : tabState[tabIndex + 1] ;

		this.currentlyOpenFilesMap.delete(tab.stats);
		tab.destroy();
		updateOpenFileEl();
		this.storeOpenTabs();
		if (this.focusedTab === tab && nextTab) {	
			this.focusTab(nextTab);
		}
		if (this.focusedTab === tab) {
			this.focusedTab = null;
		}
		// if (this.currentlyOpenFilesMap.size === 0) {
		// 	newFile();
		// }
	}

	TabController.prototype.closeAll = function () {
		var self=this;
		Array.from(this.currentlyOpenFilesMap.values()).forEach(function (tab) {
			self.closeTab(tab);
		});
	}

	TabController.prototype.storeOpenTabs = function () {
		if (!state.get('currentlyOpenedPath')) return;
		updateDBDoc('OPEN_TABS_FOR_' + state.get('currentlyOpenedPath'), {
			open_tabs: Array.from(this.currentlyOpenFilesMap.keys()).map(function (stats) {
				return stats.toDoc();
			})
		})
		.catch(function (err) {
			console.log(err);
		});
	}

	TabController.prototype.getTabsAsArray = function () {
		return Array.from(tabsEl.children);
	}

	/**
	 * All the elements in the array are moved to the start in the order they appear.
	 */
	TabController.prototype.setOrder= function(arr) {
		var old = new Set(this.getTabsAsArray());
		tabsEl.innerHTML = '';
		arr.forEach(function (el) {
			if (el.constructor === Tab) {
				el = el.el;
			}
			if (old.has(el.el)) {
				tabsEl.appendChild(el);
				old.delete(el);
			}
		});
		Array.from(old).forEach(function (el) {
			tabsEl.appendChild(el);
		});
	}

	var tabController = new TabController();

	tabsEl.addEventListener('mouseup', function (e) {
		if (e.target.matches('.tab')) {
			if (e.button === 0) {
				tabController.focusTab(e.target.webCodeTab);
			}
			if (e.button === 1) {
				tabController.closeTab(e.target.webCodeTab);
			}
		}
	});

	currentlyOpenFilesEl.addEventListener('mouseup', function (e) {
		if (e.target.tabKey) {
			if (e.button === 0) {
				tabController.focusTab(e.target.tabKey);
			}
			if (e.button === 1) {
				tabController.closeTab(e.target.tabKey);
			}
		}
	});

	return tabController;
}());

export {
	saveOpenTab,
	closeOpenTab,
	tabController
};