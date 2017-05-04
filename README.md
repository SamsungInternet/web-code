# Web Code

A node based VSCode like editor. Made for Samsung DeX.

# Installation

In a Terminal (or Termux for Android)

* Install node:

```
apt get install nodejs
```

* Update npm

```
npm install -g npm
```

* Install web-code

```
npm install -g web-code
```

* (DeX/Termux only) Fix Shebang
```
termux-fix-shebang `which web-code`
```

* Run web-code
```
web-code
```

# Development

1. clone this repo
2. `npm install`
3. `npm run build`
4. `npm run start`

# Your first PR

Try adding an icon for a file format you like in: `static/styles/icons.css` only a few file formats have been mapped. To corresponding icons from atom file-icons.

# Pouch Docs

## INIT_STATE

Used for setting how the app will start next time it is opened.

```
{
	_id
	_rev
	previous_path // last path accessed by the user
}
```

## 'OPEN_TABS_FOR_' + path

The last tabs opened for a particular path

```
{
	open_tabs: [
		// file data objects
	]
}
```
