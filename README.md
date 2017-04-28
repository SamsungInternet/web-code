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
