/* eslint-env es6 */

const fs = require('fs');
const Stats = require('./web-code-stats.compiled');

function sanitise(data) {
	if (typeof data === 'object' && data.constructor !== Array) {
		if (data.constructor === Stats) {
			return data.toDoc();
		}
		throw Error('Not parsable yet');
	}
	return data;
}

// The server bit of FSProxy, may need to simplify output
function fsProxy(data) {
	return new Promise(function (resolve, reject) {
		data.arguments.push(function (err, out) {
			if (err) {
				return reject(err);
			}

			if (out === undefined) {
				return resolve();
			}

			// convert fs.Stats to local stat which can be serialised
			if (out.constructor === fs.Stats) {

				// The first argument is the path needed when constructing from node
				return resolve(sanitise(Stats.fromNodeStats(data.arguments[0], out)));
			}
			resolve(sanitise(out));
		});
		fs[data.cmd].apply(fs, data.arguments)
	});
}

function fetchEnvVar(name) {
	return Promise.resolve(process.env[name]);
}

function client(client, data) {
	data.arguments = data.arguments || [];
	return new Promise(function (resolve) {
		resolve(client[data.cmd].apply(client, data.arguments));
	});
}

module.exports = {
	wsRouting: function wsRouting(message) {
		if (message === '__ping__') {
			this.send('__pong__');
			return;
		}
		const [cmd, id, data] = JSON.parse(message);
		if(typeof data === "object" &&
			 typeof data.arguments === "object" &&
		 	 data.arguments[0] === false)
			 		return;
		const ws = this;
		let promise;
		switch (cmd) {
		case 'SYNC_STATE':
			ws.editorState = data;
			promise = Promise.resolve();
			break;
		case 'FS_PROXY': promise = fsProxy(data); break;
		case 'GET_ENV': promise = fetchEnvVar(data); break;
		case 'CLIENT': promise = client(this.webCodeClient, data); break;
		default: promise = Promise.reject(Error('No command ' + cmd));
		}
		promise.then(function (data) {
			ws.send(JSON.stringify([
				cmd,
				id,
				{ result: data }
			]));
		})
		.catch(function (e) {
			ws.send(JSON.stringify([
				cmd,
				id,
				{error: e.message}
			]));
		});
	},
	wsSendFormat: function (cmd, data) {
		const id = Date.now() + '_' + Math.random();
		return JSON.stringify([
			cmd,
			id,
			data
		]);
	}
}
