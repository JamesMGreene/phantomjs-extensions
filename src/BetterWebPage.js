/*!
 * BetterWebPage v0.1
 * https://github.com/JamesMGreene/phantomjs-extensions/
 *
 * Copyright © 2012: James Greene (Team Gunmetal, Inc.)
 * Released under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 */
 
/*global exports:true, module:false */
/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, browser:true, devel:true, es5:true, indent:4, maxerr:50 */ 
 
// Assumes this is being imported via `CJSRequire`
(function(window) {
	"use strict";

	// Public API
	var BetterWebPageModule = {
		create: function() {
			var webPage = window.require("webpage").create();
			improveEvaluate(webPage);
			switchToEventEmitterApi(webPage);
			return webPage;
		}
	};
	
	var arrayProto = [].constructor.prototype,
		slice = function(thisArg) {
			return arrayProto.slice.apply(thisArg, arrayProto.slice.call(arguments, 1));
		},
		prependArg = function(firstArg, args) {
			return [firstArg].concat(slice(args));
		};

	/**
	* Override `WebPage.evaluate` to accept arguments safely, regardless of PhantomJS version compatibility issues.
	* `WebPage.evaluate` with passed arguments was introduced in PhantomJS 1.6+.
	* Also injects deferencing code to help workaround PhantomJS Issue #563: http://code.google.com/p/phantomjs/issues/detail?id=563
	*/
	var improveEvaluate = function(webPage) {
		var _evaluate = webPage.evaluate;

		Object.defineProperties(webPage, {
			/**
			* Call `page.evaluate` with arguments safely, regardless of PhantomJS version compatibility issues.
			* NOTE: You may not be able to publicly expose the function being evaluated...?
			* NOTE: Also uses `this.getDereferencedObject` to workaround PhantomJS Issue #563: http://code.google.com/p/phantomjs/issues/detail?id=563
			*/
			"evaluate": {
				value: function(funcToEval) {
					var functionSource = funcToEval.toString(),
						argumentList = slice(arguments, 1),
						argListSource = argumentList.reduce(function(pv, cv) {
							return pv + (pv ? ", " : "") + JSON.stringify(cv);
						}, ""),
						iifeSource = "(" + functionSource + ")(" + argListSource + ")";

					return this.getDereferencedObject(iifeSource);
				}
			},

			/** Workaround for PhantomJS Issue #563: http://code.google.com/p/phantomjs/issues/detail?id=563 */
			"getDereferencedObject": {
				value: function(objectName, defaultValue) {
					var pageFunc = new Function("return JSON.stringify(" + objectName + ");"),
					objJson = _evaluate(pageFunc);
					return objJson ? JSON.parse(objJson) : defaultValue;
				}
			}
		});
	};

	/**
	* Modifies the WebPage object instance by adding functions called "on" and "off" for more JavaScript-y event callbacks.
	* For supported `eventType`s, see the variable `emitterEventTypes` inside the function.
	*
	* NOTE: Also overrides `WebPage.open` to keep its API consistent and usable with the EventEmitter API.
	*/
	var switchToEventEmitterApi = function(webPage) {
		var _open = webPage.open,
			noop = function() { },
			emitterEventTypes = {
				/* args: [] */
				"init": "onInitialized",
				/* args: [] */
				"load.start": "onLoadStarted",
				/* args: [status] */
				"load.finish": "onLoadFinished",
				/* args: [status] */
				"open": "onLoadFinished",
				/* args: [page] */
				"close": "onClosing",
				/* args: [request] */
				"resource.request": "onResourceRequested",
				/* args: [response] */
				"resource.receive.*": "onResourceReceived",
				/* args: [response] */
				"resource.receive.start": "onResourceReceived",
				/* args: [response] */
				"resource.receive.finish": "onResourceReceived",
				/* args: [targetUrl, navType, willNavigate, fromMainFrame] */
				"navigate.request": "onNavigationRequested",
				/* args: [newUrl] */
				"navigate.complete": "onUrlChanged",
				/* args: [msg, trace] */
				"error": "onError",
				/* args: [msg] */
				"alert": "onAlert",
				/* args: [msg] */
				"confirm": "onConfirm",
				/* args: [msg, defaultValue] */
				"prompt": "onPrompt",
				/* args: [data] */
				"callback": "onCallback",
				/* args: [msg, lineNumber, sourceId] */
				"console.*": "onConsoleMessage",
				/* args: [msg, lineNumber, sourceId] */
				"console.log": "onConsoleMessage",
				/* args: [msg, lineNumber, sourceId] */
				"console.debug": "onConsoleMessage",
				/* args: [msg, lineNumber, sourceId] */
				"console.info": "onConsoleMessage",
				/* args: [msg, lineNumber, sourceId] */
				"console.warn": "onConsoleMessage",
				/* args: [msg, lineNumber, sourceId] */
				"console.error": "onConsoleMessage",
				/* args: [msg, lineNumber, sourceId] */
				"console.assert": "onConsoleMessage"
			},
			coreEvents = (function() {
				var callbackDict = {};
				Object.keys(emitterEventTypes).forEach(function(e) {
					if (!callbackDict.hasOwnProperty(emitterEventTypes[e])) {
						callbackDict[emitterEventTypes[e]] = noop;
					}
				});
				return callbackDict;
			})(),
			eventResponses = {
				"confirm": [],
				"prompt": []
			},
			EventEmitter = window.require("EventEmitter");  /* `require` === `CJSRequire` */


		Object.defineProperties(webPage, {
			"on": {
				value: function(eventType, callbackFunc) {
					// Argument validation
					if (typeof eventType !== "string") {
						throw new TypeError("ERROR: eventType must be a string!");
					}
					else if (!eventType) {
						throw new TypeError("ERROR: eventType must not be an empty string!");
					}
					else if (typeof callbackFunc !== "function") {
						throw new TypeError("ERROR: callbackFunc must be a function!");
					}

					// Safety dance!
					var thisWebPage = this;

					// Initialization
					if (!thisWebPage._emitter) {
						thisWebPage._emitter = new EventEmitter();
					}

					// References
					var emitter = thisWebPage._emitter,
						isEventTypeSupported = emitterEventTypes.hasOwnProperty(eventType),
						cbContext = {
							"callback": callbackFunc,
							"binding": thisWebPage
						};

					// Special handling for `open` as we're applying non-standard event behavior AND
					// it must be fired last (after any onLoadFinished handlers)
					if (isEventTypeSupported) {
						switch (eventType) {
							case "open":
								// Only let this callback run once: when the top-level page opens
								cbContext.onlyOnce = true;
								// Do NOT `break;` here, needs to flow into the next `case` statement
							case "load.finish":
								if (coreEvents[emitterEventTypes[eventType]] === noop) {
									coreEvents[emitterEventTypes[eventType]] = function() {
										emitter.emit.apply(emitter, prependArg("load.finish", arguments));
										emitter.emit.apply(emitter, prependArg("open", arguments));
									};
								}
								break;

							case "confirm":
								if (coreEvents.onConfirm === noop) {
									coreEvents.onConfirm = function(/* msg */) {
										// Listeners should be returning a Boolean confirming (true) or denying (false), which gets appended to a shared array
										emitter.emit.apply(emitter, prependArg(eventType, arguments));
										
										// Grab the results from a shared array and then AND (&&) them together (i.e. if any are false, the confirm is canceled)
										var results = eventResponses[eventType],
											cumulativeResult = results.length && results.every(function(e) { return e === true; });
										
										// Reset the array
										results.length = 0;
										
										// Return the calculated result
										return cumulativeResult;
									};
								}
								
								// Wrap these callbacks to update a shared array
								cbContext.wrappedCallback = function() {
									var result = callbackFunc.apply(this, arguments);
									eventResponses[eventType].push(result);
								};
								break;
								
							case "prompt":
								if (coreEvents.onPrompt === noop) {
									coreEvents.onPrompt = function(/* msg, defaultValue */) {
										// Listeners should be returning a String to fill-in the prompt value, which gets appended to a shared array
										emitter.emit.apply(emitter, prependArg(eventType, arguments));
										
										// Grab the results from a shared array and take the first string answer (empty string is acceptable)
										var results = eventResponses[eventType],
											stringResults = results.filter(function(e) { return typeof e === "string"; }),
											finalResult = (stringResults.length ? stringResults[0] : null);
										
										// Reset the array(s)
										results.length = 0;
										stringResults.length = 0;
										
										// Return the first string answer, otherwise null
										return finalResult;
									};
								}
								
								// Wrap these callbacks to update a shared array
								var innerPromptCallback = callbackFunc,
									wrappedPromptCallback = function() {
										var result = innerPromptCallback.apply(this, arguments);
										eventResponses[eventType].push(result);
									};
								wrappedPromptCallback._callback = innerPromptCallback;
								callbackFunc = wrappedPromptCallback;
								
								break;
								
							/* Cascading cases */
							case "resource.receive.*":
							case "resource.receive.start":
							case "resource.receive.finish":
								if (coreEvents.onResourceReceived === noop) {
									var eventTypeBase = "resource.receive.";
									coreEvents.onResourceReceived = function(resp) {
										if (resp.stage === "start") {
											emitter.emit.apply(emitter, prependArg(eventTypeBase + "start", arguments));
										}
										else if (resp.stage === "end") {
											emitter.emit.apply(emitter, prependArg(eventTypeBase + "finish", arguments));
										}
										emitter.emit.apply(emitter, prependArg(eventTypeBase + "*", arguments));
									};
								}
								break;
								
							/* Cascading cases */
							case "console.*":
								if (coreEvents.onConsoleMessage === noop) {
									coreEvents.onConsoleMessage = function(msg /*, lineNumber, sourceId */) {
										emitter.emit.apply(emitter, prependArg("console.*", arguments));
									};
								}
								break;
								
							/* Otherwise... */
							default:
								if (coreEvents[emitterEventTypes[eventType]] === noop) {
									coreEvents[emitterEventTypes[eventType]] = function() {
										emitter.emit.apply(emitter, prependArg(eventType, arguments));
									};
								}
								break;
						}
						
						// Hook it up!
						emitter.on(eventType, cbContext);
					}
					else {
						window.console.warn("Unknown `eventType` passed to `WebPage#on`: " + eventType);
					}
					
					// Chain!
					return this;
				}
			},

			"off": {
				value: function(eventType, callbackFunc) {
					// Argument validation
					var callbackFuncType = typeof callbackFunc;
					if (typeof eventType !== "string") {
						throw new TypeError("ERROR: `eventType` must be a string!");
					}
					else if (!eventType) {
						throw new TypeError("ERROR: `eventType` must not be an empty string!");
					}
					else if (callbackFuncType !== "undefined" && callbackFuncType !== "function") {
						throw new TypeError("ERROR: If provided, `callbackFunc` must be a function!");
					}

					var emitter = this._emitter;
					if (emitter) {
						emitter.off(eventType, callbackFunc);
					}

					// Chain!
					return this;
				}
			},

			"open": {
				value: function(url, onOpenedCallback) {
					if (typeof onOpenedCallback === "function") {
						this.on("open", onOpenedCallback);
					}

					_open.call(this, url);
				}
			}
		});

		// Pre-set all core PhantomJS events. Unfortunately cannot lock them down due to existing setters....
		Object.keys(coreEvents).forEach(function(e) {
			if (typeof webPage[e] !== "function") {
				webPage[e] = function() {
					return coreEvents[e].apply(this, arguments);
				};
			}
		});
	};

	return exports = (module || {}).exports = BetterWebPageModule;

})(this);