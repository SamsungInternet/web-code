# Deprecated

I've recently started using [cdr/code-server](https://github.com/cdr/code-server) which is a full VS Code instance which now
runs on Android. The same way this does.

# Web Code

A node based VSCode like editor. Made for Samsung DeX.

![Screenshot of Web Code on DeX](https://github.com/AdaRoseEdwards/web-code/blob/master/Screenshot_20170524-134934.png)

# Installation

In a Terminal (or Termux for Android)

* Install node:
```
apt get update
apt get install nodejs
```

* Install web-code
```
npm install -g web-code
```

* Run web-code
```
web-code ./my-file.js
```

# Using Web Code

You open up web-code in your browser.

go to: `http://127.0.0.1:3000`

You can change the Web Code port from it's default of 3000 by running `PORT=8080 web-code` when starting a new instance of the web code daemon. 

Web Code will only run a single instance of the server but will reuse this instance for opening additional files and folders.

You can open as many files/folders as you like by running `web-code foo.txt` and it will use the existing process.

# Development

1. clone this repo
2. `npm install`
3. `npm run watch`

# Your first PR

Try adding an icon for a file format you like in: `static/styles/icons.css` only a few file formats have been mapped. To corresponding icons from atom file-icons.
