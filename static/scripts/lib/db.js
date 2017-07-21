/* global Promise, isServer */
/* eslint no-var: 0, no-console: 0 */
/* eslint-env es6 */

import PouchDB from 'pouchdb-browser';
try {
	var db = isServer ? null : new PouchDB('web-code', {});
} catch (e) {
	console.log(e);
}
function updateDBDoc(_id, obj) {

	updateDBDoc.promise = updateDBDoc.promise || Promise.resolve();

	/* update last open folder in db */
	return updateDBDoc.promise = updateDBDoc.promise
		.then(function () {
			return db.get(_id)
		})
		.catch(function (e) {
			if (e.status === 404) {
				return { _id: _id }
			}
			if (e.name === 'indexed_db_went_bad') {
				console.log('Updating DB Failed: ' + e.reason);
				return;
			}
			throw e;
		})
		.then(function (doc) {
			if (!doc) return;
			Object.keys(obj).forEach(function (key) {
				doc[key] = obj[key];
			});
			db.put(doc);
		});
}

export { db, updateDBDoc };