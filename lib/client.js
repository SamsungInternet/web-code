/* eslint-env es6 */
/* eslint no-console: 0 */
const chokidar = require('chokidar');
const p = require('path');
const EventEmitter = require('events');
const Stats = require('./web-code-stats.compiled.js');

class Client extends EventEmitter {
	constructor() {
    	super();
	}
	watchPath(path) {
		this.path = path;
		const watchPath = p.join(path);

		const self = this;

		if (this.watcher) this.watcher.close();
		this.watcher = chokidar.watch(watchPath, {
			ignorePermissionErrors: true,
			alwaysStat: true,
			ignoreInitial: true,
			depth: 0
		});
		function handleChanges(name, fileName, nodeStats) {
			if (!fileName) {
				return function (fileName, nodeStats) {
					handleChanges(name, fileName, nodeStats);
				}
			} else {
				if (nodeStats) {
					self.emit(name, Stats.fromNodeStats(fileName, nodeStats));
				} else {
					self.emit(name, {path: fileName});
				}
			}
		}

		//curried functions
		this.watcher.on('change', handleChanges('change'));
		this.watcher.on('add', handleChanges('add'));
		this.watcher.on('unlink', handleChanges('unlink'));
		this.watcher.on('addDir', handleChanges('addDir'));
		this.watcher.on('unlinkDir', handleChanges('unlinkDir'));
	}
	destroy() {
		if (this.watcher) this.watcher.close();
	}
}

module.exports = Client;