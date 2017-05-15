// rollup.config.js
import { rollup } from 'rollup'; /* eslint no-unused-vars: 0*/

export default {
	entry: 'static/scripts/lib/web-code-stats.js',
	dest: 'lib/web-code-stats.compiled.js',
	format: 'cjs',
	sourceMap: 'inline',
	intro: `
	/* eslint-disable */
	var isServer = true;
	`,
	plugins: []
};
