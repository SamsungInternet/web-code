// rollup.config.js
import 'rollup'; /* eslint no-unused-vars: 0*/
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import builtins from 'rollup-plugin-node-builtins';
import json from 'rollup-plugin-json';

export default {
	entry: 'static/scripts/main.js',
	dest: 'static/scripts/bundle.js',
	format: 'iife',
	sourceMap: 'inline',
	intro: `
	/* eslint-disable */
	var define = false;
	var global={};
	var process = {env: {}};
	var isServer = false;
	`,
	plugins: [
		resolve({
			module: true, // Default: true
			jsnext: true,	// Default: false
			main: true,	// Default: true
			browser: true,
      		extensions: [ '.js', '.json' ],  // Default: ['.js']
		}),
		builtins(),
		commonjs({
      		include: 'node_modules/**',
		}),
		json({
      		include: 'node_modules/**',
		})
	]
};
