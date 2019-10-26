/* global Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import { remoteCmd } from './ws.js';
import Stats from './web-code-stats.js'

function fsProxy() {
	var args = Array.from(arguments);
	var cmd = args.shift();

	function execute() {
		var args = Array.from(arguments);
		return remoteCmd('FS_PROXY', {
			cmd: cmd,
			arguments: args
		})
		.then(function (data) {
			if (typeof data !== 'object') return data;
			if (data.__webStatDoc) return Stats.fromDoc(data);
			return data;
		});
	}

	if (args.length === 0) return execute;
	return execute.apply(null, args);
}

var fs = {};

[
	'stat',
	'readFile',
	'writeFile',
	'readdir',
	'mkdir',
	'rename',
	'unlink',
	'rmdir'
].forEach(function (cmd) {
	fs[cmd] = fsProxy(cmd);
});

export default fs;
