/* global Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

function addScript (url) {
	var p = new Promise(function (resolve, reject) {
		var script = document.createElement('script');
		script.setAttribute('src', url);
		document.head.appendChild(script);
		script.onload = resolve;
		script.onerror = reject;
	});
	function promiseScript () {
		return p;
	};
	promiseScript.promise = p;
	return promiseScript;
}

export {
    addScript
}