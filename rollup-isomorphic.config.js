// rollup.config.js
import 'rollup'; /* eslint no-unused-vars: 0*/
import * as path from 'path';

export default {
	entry: 'static/scripts/lib/web-code-stats.js',
	dest: 'lib/web-code-stats.compiled.js',
	format: 'cjs',
	sourceMap: 'inline',
	external: [
		path.resolve( './static/scripts/lib/render-file-list.js' ),
		path.resolve( './static/scripts/lib/ws.js' ),
		'path', 'mime'
	],
	intro: `
	/* eslint-disable */
	var isServer = true;
	`,
	plugins: []
};
