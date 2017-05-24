/* eslint no-var: 0 */
import { remoteCmd } from './ws.js';
var data = {};

export default {
	set: function set(key, datum) {
		data[key] = datum;
	},

	sync: function () {

		// Tell the server the root path for this window has changed
		return remoteCmd('SYNC_STATE', data);
	},

	get: function get(key) {
		return data[key];
	}
};