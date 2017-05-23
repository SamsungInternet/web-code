/* eslint no-var: 0, no-console: 0 */

function displayError(type, text, timeout) {

	var errorEl = document.getElementById('errors');

	var li = document.createElement('li');

	var textEl = document.createElement('span');
	textEl.classList.add('error-text');
	textEl.textContent = text;

	var typeEl = document.createElement('span');
	typeEl.classList.add('error-type');
	typeEl.textContent = type;

	li.appendChild(typeEl);
	li.appendChild(textEl);

	if (timeout) {
		setTimeout(function () {
			errorEl.removeChild(li);
		}, timeout);
	}

	errorEl.appendChild(li);
	return li;
}

function removeError(el) {
	var errorEl = document.getElementById('errors');
	errorEl.removeChild(el);
}

export {
	removeError,
	displayError
}

