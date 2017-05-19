/* Like web-code-stats but for storing the file inside and not as a seperate file */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import {updateDBDoc, db} from './db.js';

var idToBufferFileMap = new Map();

var compulsaryAttrs = [
	'name',
	'id',
	'icon'
];

var optionalAttrs = [
	'mime'
]

var keys = compulsaryAttrs.concat(optionalAttrs);

export default function BufferFile(data) {

	this.data = {};

	compulsaryAttrs.forEach(function (key) {
		if (data[key]) {
			this.data[key] = data[key];
		} else {
			throw Error('Missing Key: ' + key);
		}
	}.bind(this));

	if (idToBufferFileMap.has(data.id)) {
		return idToBufferFileMap.get(data.id);
	}
	idToBufferFileMap.set(data.id, this)

	optionalAttrs.forEach(function (key) {
		if (data[key]) {
			this.data[key] = data[key];
		}
	}.bind(this));

	//  Try fetching from DB
	this.valuePromise = db.get(data.id)
	.catch(function (e) {
		if (e.status === 404) {
			var doc = this.toDoc();
			doc._id = this.data.id;
			doc.value = '';
			return db.put(doc).then(function () {
				return doc;	
			});
		}
		throw e;
	}.bind(this))
	.then(function (doc) {
		this.value = doc.value;
		return doc.value;
	}.bind(this));
}

BufferFile.prototype.update = function update(value) {
	// save doc to disk
	return this.valuePromise = this.valuePromise
	.then(function () {
		return updateDBDoc(this.data.id, {
			value: value
		});
	}.bind(this))
	.then(function () {
		return value;
	});
}

BufferFile.prototype.toDoc = function toDoc() {
	var out = {
		isBufferFileDoc: true
	};
	keys.forEach(function (key) {
		out[key] = this.data[key];
	}.bind(this));
	return out;
}