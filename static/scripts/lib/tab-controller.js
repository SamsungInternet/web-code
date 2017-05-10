/* global Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import state from './state.js';
import { updateDBDoc } from './db.js';
import fs from './fs-proxy.js';
import Stats from './web-code-stats.js'

function saveOpenTab() {
	var tab = tabController.getOpenTab();
	var stats;
	if (tab && tab.editor) {
		stats = tab.stats;
	} else {
		return;
	}
	var altId = tab.editor.model.getAlternativeVersionId();
	fs.writeFile(stats.data.path, tab.editor.getValue())
	.then(function () {
		tab.editor.webCodeState.savedAlternativeVersionId = altId;
		tab.editor.webCodeState.functions.checkForChanges();
	});
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
		Stats.renderFileList(currentlyOpenFilesEl, Array.from(tabController.currentlyOpenFilesMap.keys()));
	}

	function Tab(stats) {
		this.stats = stats;
		this.el = document.createElement('a');
		this.el.classList.add('tab');
		this.el.classList.add('has-icon');
		this.el.dataset.mime = stats.data.mime;
		this.el.dataset.name = stats.data.name;
		this.el.dataset.size = stats.data.size;
		this.el.textContent = stats.data.name;
		this.el.tabIndex = 0;
		tabsEl.appendChild(this.el);

		this.el.webCodeTab = this;

		this.contentEl = document.createElement('div');
		this.contentEl.classList.add('tab-content');
		containerEl.appendChild(this.contentEl);

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

	Tab.prototype.destroy = function () {
		this.el.parentNode.removeChild(this.el);
		this.contentEl.parentNode.removeChild(this.contentEl);
	}

	function TabController() {
		this.currentlyOpenFilesMap = new Map();
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
		this.focusTab(tab);
		this.storeOpenTabs();
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

	TabController.prototype.closeTab = function (stats) {
		var tab = stats.constructor === Tab ? stats : this.currentlyOpenFilesMap.get(stats);
		var tabState = Array.from(this.currentlyOpenFilesMap.values());
		var tabIndex = tabState.indexOf(tab);
		var nextTab = tabState[Math.max(0, tabIndex - 1)];
		this.currentlyOpenFilesMap.delete(tab.stats);
		tab.destroy();
		updateOpenFileEl();
		this.storeOpenTabs();
		if (this.focusedTab === tab && nextTab) {
			this.focusTab(nextTab);
		}
	}

	TabController.prototype.storeOpenTabs = function () {
		if (!state.currentlyOpenedPath) return;
		updateDBDoc('OPEN_TABS_FOR_' + state.currentlyOpenedPath, {
			open_tabs: Array.from(this.currentlyOpenFilesMap.keys()).map(function (stats) {
				return stats.toDoc();
			})
		})
		.catch(function (err) {
			console.log(err);
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
		if (e.target.stats) {
			if (e.button === 0) {
				tabController.focusTab(e.target.stats);
			}
			if (e.button === 1) {
				tabController.closeTab(e.target.stats);
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