# TODO: #
## Update `on` impl for additional `"console.{x}"` event types ##
     - And, ONLY IF NECESSARY: Update `on` and `off` impls to support callback context objects...?

// In "README.md":
	   1. "console.log"              _(requires PhantomJS 1.2+)_
	   1. "console.debug"            _(requires PhantomJS 1.2+)_
	   1. "console.info"             _(requires PhantomJS 1.2+)_
	   1. "console.warn"             _(requires PhantomJS 1.2+)_
	   1. "console.error"            _(requires PhantomJS 1.2+)_
	   1. "console.assert"           _(requires PhantomJS 1.2+)_
	   1. "console.group"            _(requires PhantomJS 1.2+)_
	   1. "console.groupCollapsed"   _(requires PhantomJS 1.2+)_
	   1. "console.groupEnd"         _(requires PhantomJS 1.2+)_
	   1. "console.time"             _(requires PhantomJS 1.2+)_
	   1. "console.timeEnd"          _(requires PhantomJS 1.2+)_
	   1. "console.count"            _(requires PhantomJS 1.2+)_


// In "BetterWebPage.js". Outside of "on":
		var consoleInstrumentationPadding = "__",
			consoleInstrumentationPrefix = consoleInstrumentationPadding + "PhantomJS:console.",
			consoleInstrumentationSuffix = consoleInstrumentationPadding,
			reIsConsoleMsgTypeAnnouncement = (function(pad) {
				return new RegExp("^" + pad + "PhantomJS:console\.[.]+" + pad + "$", "g");
			})(consoleInstrumentationPadding),
			reMatchConsoleMsgType = (function(pad) {
				return new RegExp("^" + pad + "PhantomJS:(.+)" + pad + "$", "g");
			})(consoleInstrumentationPadding),
			isMessageTypeAnnouncement = function(msg) {
				return reIsConsoleMsgTypeAnnouncement.test(msg);
			},
			getMessageType = function(msg) {
				var msgType;
				if (isMessageTypeAnnouncement(msg)) {
					var matches = msg.match(reMatchConsoleMsgType);
					if (matches && matches.length === 1) {
						msgType = matches[0];
					}
					else {
						msgType = "console.?";
					}
				}
				return msgType || "";
			};


// In "BetterWebPage.js". In "on":
					else if (typeof callbackFunc !== "function") {
						if (!(typeof callbackFunc === "object" && callbackFunc !== null && typeof callbackFunc.callback === "function")) {
							throw new TypeError("ERROR: callbackFunc must be a function or a context object!");
						}
						else {
							throw new TypeError("ERROR: callbackFunc must be a function or a context object!");
						}
					}

// In "BetterWebPage.js". In "on":
					// Initialization
					if (!thisWebPage._emitter) {
						thisWebPage._emitter = new EventEmitter();
					}
					if (typeof thisWebPage._lastConsoleMsgType === "undefined") {
						thisWebPage._lastConsoleMsgType = "";
					}

					// References
					var emitter = thisWebPage._emitter,
						isEventTypeSupported = emitterEventTypes.hasOwnProperty(eventType),
						cbContext;

					if (typeof callbackFunc === "function") {
						cbContext = {
							"callback": callbackFunc,
							"binding": thisWebPage
						};
					}
					else {
						cbContext = callbackFunc;
					}


// In "BetterWebPage.js". Near end of `switch` statement in "on":
							case "console.log":
							case "console.debug":
							case "console.info":
							case "console.warn":
							case "console.error":
							case "console.assert":
								if (coreEvents.onConsoleMessage === noop) {
									// Instrument WebPage's window.console to add parseable prefixes
									var instrumentWebPageConsole = function(funcNamePrefix, funcNameSuffix) {
										var originalLogFunc = window.console.log;
										for (var prop in window.console) {
											if (typeof window.console[prop] === "function") {
												var originalFunc = window.console[prop];
												window.console[prop] = function() {
													originalLogFunc("" + funcNamePrefix + prop + funcNameSuffix);
													originalFunc.apply(this, arguments);
												};
											}
										}
									};
									var injectInstrumentedConsole = function() {
										thisWebPage.evaluate(instrumentWebPageConsole, consoleInstrumentationPrefix, consoleInstrumentationSuffix);
									};

									// Hack into the listeners for "init" to put this first
									var runFirst = emitter.hasListeners("init");
									// TODO: runFirst is not currently supported here. Make an inner-on function...?
									thisWebPage.on("init", injectInstrumentedConsole, runFirst);

									coreEvents.onConsoleMessage = function(msg /*, lineNumber, sourceId */) {
										if (isMessageTypeAnnouncement(msg)) {
											thisWebPage._lastConsoleMsgType = getMessageType(msg);
										}
										else {
											var consoleEventType = thisWebPage._lastConsoleMsgType;
											if (consoleEventType) {
												thisWebPage._lastConsoleMsgType = "";
												emitter.emit.apply(emitter, prependArg(consoleEventType, arguments));
											}
											emitter.emit.apply(emitter, prependArg("console.*", arguments));
										}
									};
								}
								break;




## Hide the original event API, e.g. `page.onInitialized` ##

// In "README.md":
 - Hides the original event API, e.g.:
     Attempting to set event callbacks using the original event API (e.g. `page.onInitialized = function() { };`) will throw `Error`s

// In "BetterWebPage.js":
// Try to use lookupSetter to save a reference to the setters (for use by "on"/"off"), then set a new setter to throw Errors




## Rename the "open" event to "ready"? ##
     - Not entirely sure that "ready" is an accurate name either, though.

// Update "README.md": find "open", replace with "ready"
// Update "BetterWebPage.js": find "open", replace with "ready"



