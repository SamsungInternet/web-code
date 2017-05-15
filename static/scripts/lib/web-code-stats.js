/* global Map, Set, Promise, fs */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import { resolve as pathResolve, basename, dirname, extname, join } from 'path';
import mime from 'mime';
import renderFileList from './render-file-list.js';

// Map to prevent duplicate data objects for each file
var pathToDataMap = new Map();

var fsFromFn = ['isFile', 'isDirectory', 'isBlockDevice', 'isCharacterDevice', 'isSymbolicLink', 'isFIFO', 'isSocket'];
var fsStatic = [
	'dev',
	'mode',
	'nlink',
	'uid',
	'gid',
	'rdev',
	'blksize',
	'ino',
	'size',
	'blocks',
	'atime',
	'mtime',
	'ctime',
	'birthtime',
	'path'
];
var keys = fsStatic.concat(fsFromFn);


/**
 * Special type of singleton which returns the same object for each path.
 */
export default function Stats (data) {
	if (pathToDataMap.has(data.path)) {
		var existing = pathToDataMap.get(data.path);
		existing.update(data);
		return existing;
	}
	this.fileLists = new Set();
	this.data = {};
	this.update(data);
	pathToDataMap.set(data.path, this);
}

Stats.prototype.update = function update(data) {

    // Rerender file lists
	if (this.fileLists.size) {
		console.log('STUB: UPDATE FILELISTS',this.data.path,Array.from(this.fileLists));
	}

	this.data.name = basename(data.path);
	this.data.dirName = dirname(data.path);
	this.data.extension = extname(data.path).toLowerCase();
	this.data.mime = data.isFile ? mime.lookup(data.path) : 'directory';

	keys.forEach(function (key) {
		this.data[key] = data[key];
	}.bind(this));

	if (this.isDirectory() && !this.children) {
		this.children = [];
		this.childrenPopulated = false;
	}
}

Stats.prototype.toDoc = function toDoc() {
	var out = {
		__webStatDoc: true
	};
	keys.forEach(function (key) {
		out[key] = this.data[key];
	}.bind(this));
	return out;
}

Stats.prototype.updateChildren = function () {
	if(!this.isDirectory()) throw Error('Not a directory');

	var self = this;
	return fs.readdir(self.data.path)
	.then(function (arr) {
		return Promise.all(arr.map(function (child) {
			return Stats.fromPath(join(self.data.path, child));
		}));
	})
	.then(function (statsArray) {
		self.children.splice(0);
		self.children.push.apply(self.children, statsArray);
		return self;  
	});
}

Stats.prototype.destroyFileList = function (el) {
	el.stats = undefined;
	this.fileLists.delete(el);
	el.innerHTML = '';
}

Stats.prototype.renderFileList = function (el, options) {
	el.stats = this;
	this.fileLists.add(el);
	el.dataset.mime = this.data.mime;
	el.dataset.name = this.data.name;
	el.dataset.size = this.data.size;

	renderFileList(el, this.children, options);
}

// add isFile isDirectory etc
fsFromFn.forEach(function (key) {
	Stats.prototype[key] = new Function('return this.data["' + key + '"];');
});

Stats.fromPath = function (path) {
	return fs.stat(path);
}

Stats.fromDoc = function (data) {
	return new Stats(data);
}

Stats.fromNodeStats = function (path, nodeStat) {

	var out = {};

	fsFromFn.forEach(key => out[key] = nodeStat[key]());
	keys.forEach(key => {
		if (typeof nodeStat[key] !== 'function' && typeof nodeStat[key] !== 'object') {
			out[key] = nodeStat[key];
		}
	});

	out.path = pathResolve(path);

	return new Stats(out);
}
