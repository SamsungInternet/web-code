/* global require, Map, Set, Promise */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import {
	remoteCmd
} from './ws';

function fsProxy() {
	var args = Array.from(arguments);
	var cmd = args.shift();

	function execute() {
		var args = Array.from(arguments);
		return remoteCmd('FS_PROXY', {
			cmd: cmd,
			arguments: args
		});
	}

	if (args.length === 0) return execute;
	return execute.apply(null, args);
}

var fs = {};

[
	'stat',
	'readFile',
	'writeFile'
].forEach(function (cmd) {
	fs[cmd] = fsProxy(cmd);
});

export default fs;