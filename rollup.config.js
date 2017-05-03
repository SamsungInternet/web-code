// rollup.config.js
import { rollup } from 'rollup';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import builtins from 'rollup-plugin-node-builtins';

export default {
	entry: 'static/scripts/main.js',
	dest: 'static/scripts/bundle.js',
	format: 'iife',
	sourceMap: 'inline',
	intro: '(function () {\nvar define = false;var global={};\n',
	outro: '}());',
	plugins: [
		resolve({
			module: true, // Default: true
			jsnext: true,	// Default: false
			main: true,	// Default: true
			browser: true,
		}),
		builtins(),
		commonjs()
	]
};