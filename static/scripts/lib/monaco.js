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
	console.log('STUB BLUR EDITOR, NEXT EL');
}

function selectPreviousEl() {
	console.log('STUB BLUR EDITOR, PREVIOUS EL');
}

function nextTab() {
	console.log('FOCUS NEXT TAB');
}

function previousTab() {
	console.log('FOCUS PREVIOUS TAB');
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

	editor.webCodeState = {};
	editor.webCodeState.savedAlternativeVersionId = editor.model.getAlternativeVersionId();
	editor.webCodeState.tab = tab;

	editor.webCodeState.functions = {
		checkForChanges: function checkForChanges() {
			var hasChanges = editor.webCodeState.savedAlternativeVersionId !== editor.model.getAlternativeVersionId();
			editor.webCodeState.hasChanges = hasChanges;
			tab.el.classList.toggle('has-changes', hasChanges);
		}
	}

	editor.onDidChangeModelContent(editor.webCodeState.functions.checkForChanges);


}

export { monacoPromise, getMonacoLanguageFromExtensions, getMonacoLanguageFromMimes, addBindings };
