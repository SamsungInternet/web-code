/* global monaco, Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import { saveOpenTab, closeOpenTab } from './tab-controller';
import { promptForOpen } from './files';

require.config({ paths: { 'vs': 'vs' } });

var monacoPromise = new Promise(function (resolve) {
	require(['vs/editor/editor.main'], resolve);
});

function getMonacoLanguageFromMimes(mime) {
	return (monaco.languages.getLanguages().filter(function (languageObj) {
		return languageObj.mimetypes && languageObj.mimetypes.includes(mime);
	})[0] || {})['id'];
}

function getMonacoLanguageFromExtensions(extension) {
	return (monaco.languages.getLanguages().filter(function (languageObj) {
		return languageObj.extensions && languageObj.extensions.includes(extension);
	})[0] || {})['id'];
}

function selectNextEl() {
	document.querySelector('a, button, [tabindex]').focus();
}

function selectPreviousEl() {
	document.querySelectorAll('a, button, [tabindex]').focus();
}

function nextTab() {
	console.log('STUB: FOCUS NEXT TAB');
}

function previousTab() {
	console.log('STUB: FOCUS PREVIOUS TAB');
}

function addBindings(editor, tab) {
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, saveOpenTab);
	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_O, promptForOpen);
	editor.addCommand(monaco.KeyCode.KEY_W | monaco.KeyMod.CtrlCmd, closeOpenTab);
	editor.addCommand(monaco.KeyCode.F6, selectNextEl);
	editor.addCommand(monaco.KeyCode.F6 | monaco.KeyMod.Shift, selectPreviousEl);
	editor.addCommand(monaco.KeyCode.Tab | monaco.KeyMod.CtrlCmd, nextTab);
	editor.addCommand(monaco.KeyCode.Tab | monaco.KeyMod.Shift | monaco.KeyMod.CtrlCmd, previousTab);
	editor.addCommand(monaco.KeyCode.KEY_P | monaco.KeyMod.Shift | monaco.KeyMod.CtrlCmd, function openCommandPalette() {
		editor.trigger('anyString', 'editor.action.quickCommand');
	});
	editor.addCommand(monaco.KeyCode.Tab, function() {
		selectNextEl();
	}, 'hasJustTabbedIn')

	editor.webCodeState = {};
	editor.webCodeState.savedAlternativeVersionId = editor.model.getAlternativeVersionId();
	editor.webCodeState.tab = tab;
	editor.webCodeState.hasJustTabbedIn = editor.createContextKey('hasJustTabbedIn', false);

	editor.webCodeState.functions = {
		checkForChanges: function checkForChanges() {
			editor.webCodeState.hasJustTabbedIn.set(false);
			var hasChanges = editor.webCodeState.savedAlternativeVersionId !== editor.model.getAlternativeVersionId();
			editor.webCodeState.hasChanges = hasChanges;
			tab.el.classList.toggle('has-changes', hasChanges);
		}
	}

	editor.onDidChangeModelContent(editor.webCodeState.functions.checkForChanges);
	editor.onDidFocusEditor(function () {
		editor.webCodeState.hasJustTabbedIn.set(true);
	});
	editor.onMouseDown(function () {
		editor.webCodeState.hasJustTabbedIn.set(false);
	});
}

export { monacoPromise, getMonacoLanguageFromExtensions, getMonacoLanguageFromMimes, addBindings };
