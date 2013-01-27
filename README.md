phantomjs-extensions
====================

A set of extensions, shims, utilities, and alternate APIs for PhantomJS. All of these modules run best on PhantomJS 1.7+
with its enhanced `require` functionality, otherwise you must use an equivalent shim implementation for `require`.


### PhantomConsole ###
PhantomConsole is a CommonJS module to provide implementations for the console object's methods, most of which are
currently missing (as of PhantomJS 1.7.0).  PhantomConsole also provides verbosity level filtering, so you can control
the amount of data that your console is logging.

**Compatibility:**
 - _Minimum:_ PhantomJS 1.2+

**Attachment Target:**
None required, though the intent it to use it to override `window.console` in the PhantomJS outer space. Don't worry,
you can always get the original console implementation back, too (details below).

**Basic Usage:**
```javascript
(function(window) {
	var PhantomConsole = require("PhantomConsole"),
		phantomConsole = PhantomConsole.create(PhantomConsole.Verbosity.ALL);
	
	// Override the main `window.console` in the PhantomJS outer space
	console = phantomConsole;
	
	// Use previously unimplemented console methods...
	console.time("Tracing");
	console.trace();
	console.timeEnd("Tracing");
	
	// Revert the main `window.console` in the PhantomJS outer space to its original implementation
	console = PhantomConsole.getOriginal();
	
	phantom.exit();
})(this);
```


### EventEmitter ###
EventEmitter is a CommonJS module inspired by TJ Holowaychuk's (@visionmedia) [`emitter` component][1].
It provides an API identical to that of the `emitter` component other than the expected arguments.
Most importantly, EventEmitter is a required dependency for [BetterWebPage][2]!

**Compatibility:**
 - _Minimum:_ PhantomJS 1.2+

**Attachment Target:**
_N/A_

**Basic Usage:**
```javascript
(function(window) {
	var EventEmitter = require("EventEmitter"),
		emitter = new EventEmitter();

	// Can accept a function callback
	emitter.on("ready", function(time) {
		console.log("Ready! At: " + time);
	});

	// Can accept a structured object
	emitter.on("ready", {
		/* The function callback that you can also pass in on its own */
		callback: function(time) {
			console.log("Ready? Just call me once but call me first! At: " + time);
		},
		/* For equivalent of callback.bind(binding) from Function.prototype.bind */
		binding: null,
		/* Calls `off` to remove this subscription after executing its callback once */
		onlyOnce: true,
		/* Adds this item to the front of the call list instead of the end */
		runFirst: true,
	});
	
	emitter.emit("ready", +(new Date()));
	// Console: "Ready? Just call me once but call me first! At: ______"
	// Console: "Ready! At: ______"
	emitter.emit("ready", +(new Date()));
	// Console: "Ready! At: ______"
	
	phantom.exit();
})(this);
```


### BetterWebPage ###
BetterWebPage is a CommonJS module that extends the PhantomJS core WebPage module with a slew of features.
Its enhancements include:
 - Add a new method `page.getDeferencedObject` to help with deferencing objects retrieved from the client-side to avoid peculiar object behavior back in the PhantomJS outer space
 - Improved `page.evaluate`:
    - Shimmed so that the function signature is equivalent to the PhantomJS 1.6+ implementation (which allows the passing of arguments) even when running in older versions
	- Added dereferencing to help avoid [peculiar object behavior][3] back in the PhantomJS outer space
 - Adds an EventEmitter API, e.g.:
     `page.on("init", function() { });` instead of `page.onInitialized = function() { };`
	 `page.off("init");` instead of `page.onInitialized = null;`
	 
	 Events supported:
	   1. "init"                     _(requires PhantomJS 1.3+)_
	   1. "resource.request"         _(requires PhantomJS 1.2+)_
	   1. "resource.receive.*"       _(requires PhantomJS 1.2+)_
	   1. "resource.receive.start"   _(requires PhantomJS 1.2+)_
	   1. "resource.receive.finish"  _(requires PhantomJS 1.2+)_
	   1. "load.start"               _(requires PhantomJS 1.2+)_
	   1. "load.finish"              _(requires PhantomJS 1.2+)_
	   1. "open"                     _(requires PhantomJS 1.2+)_
	   1. "navigate.request"         _(requires PhantomJS 1.6+)_
	   1. "navigate.complete"        _(requires PhantomJS 1.6+)_
	   1. "close"                    _(requires PhantomJS 1.7+)_
	   1. "callback"                 _(requires PhantomJS 1.6+)_
	   1. "error"                    _(requires PhantomJS 1.5+)_
	   1. "alert"                    _(requires PhantomJS 1.0+)_
	   1. "confirm"                  _(requires PhantomJS 1.6+)_
	   1. "prompt"                   _(requires PhantomJS 1.6+)_
	   1. "console.*"                _(requires PhantomJS 1.2+)_
	   1. _more coming soon..._

 - The `callback` passed to `page.open(url, callback)` will be implicitly attached with `page.on("open", callback)` (see **Special Notes** below).


**Compatibility:**
 - _Minimum:_ PhantomJS 1.3+

**Attachment Target:**
_N/A_

**Basic Usage:**
```javascript
(function(window) {
	var page = require("BetterWebPage").create();
	
	/* Handlers for "open" will always defer firing until AFTER all the "load.finish" handlers have been executed */
	page.on("open", function() {
		console.log("Check 3? Check check check!");
	});
	page.on("load.finish", function() {
		console.log("Check 1? Check!");
	});
	/* Can have multiple handlers for both the "load.finish" and "open" events */
	page.on("load.finish", function() {
		console.log("Check 2? Check check!");
	});
	page.open("http://google.com/", function(status) {
		/* This whole callback will be implicitly attached with `page.on("open", thisFunctionRef)` */

		console.log("Check 4? Let's rock! \m/");
		phantom.exit();
	});
})(this);
```

**Special Notes:**
 - Regarding `"load.finish"`: This event will fire from your top-level page (the URL passed to `page.open`) as well as
   from all of that page's child pages/frames/iframes. This is standard PhantomJS behavior for the
   [`WebPage#onLoadFinished`][4] callback but tends to surprise new users.
 - Regarding `"open"`:
     - This event will be emitted _AFTER_ all registered handlers for "load.finish" have been executed.
     - Handlers registered for this event will be executed exactly once and then automatically removed. This means
       that `"open"` handlers will not be fired for child pages/frames/iframes like the `"load.finish"` handlers
       will be.
 - Regarding `"confirm"`: The event will only be confirmed (`return true`) if _EVERY_ registered handler returns `true`.
 - Regarding `"prompt"`: The event will receive its answer/value from the _FIRST_ string value returned by a registered
   handler, including empty string (`""`). If no string values were returned, it will receive `null`.


[1]: https://github.com/component/emitter
[2]: #BetterWebPage
[3]: http://code.google.com/p/phantomjs/issues/detail?id=563
[4]: https://github.com/ariya/phantomjs/wiki/API-Reference#wiki-webpage-onLoadFinished
