/*!
 * PhantomConsole v0.1
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
	
	// Private stuff, encapsulated via closure
	var _getTimeFunc = (function() {
			// Figure this out once and once only!
			var impl;
			if (window.performance && window.performance.now) {
				impl = function() { return window.performance.now(); };
			}
			else if (window.performance && window.performance.webkitNow) {
				impl = function() { return window.performance.webkitNow(); };
			}
			else if (window.Date.now) {
				impl = function() { return window.Date.now(); };
			}
			else {
				impl = function() { return +(new window.Date()); };
			}
			return impl;
		})(),
		_defaultPrefixer = function(methodName) {
			return (methodName ? "[" + (methodName || "").toUpperCase() + "] " : "");
		},
		_reEndsWithWhitespace = /\s+$/g,
		_defaultConsoleConfig = {
			indent: "    ",
			formatters: {
				prefix: function(methodName) {
					var prefix;
					switch (methodName) {
						case "log":
						case "time":
						case "clear":
						case "groupEnd":
							// No prefix for `console.log`, etc.
							break;
						case "warn":
							prefix = _defaultPrefixer("warning");
							break;
						case "group":
						case "groupCollapsed":
							prefix = _defaultPrefixer("group");
							break;
						case "timeEnd":
							prefix = _defaultPrefixer("timer");
							break;
						case "assert":
							prefix = _defaultPrefixer(methodName);
							prefix += (prefix.search(_reEndsWithWhitespace) === -1 ? " " : "") + "Assertion failed: ";
							break;
						case "trace":
							prefix = _defaultPrefixer(methodName).replace(_reEndsWithWhitespace, ":");
							break;
						default:
							prefix = _defaultPrefixer(methodName);
							break;
					}
					return prefix || "";
				},
				suffix: function(methodName) {
					var suffix;
					switch (methodName) {
						case "group":
						case "groupCollapsed":
							suffix = " {";
							break;
						case "groupEnd":
							suffix = "}";
							break;
						default:
							// None
							break;
					}
					return suffix || "";
				}
			}
		},
		_originalConsole = window.console,
		_phantomConsole = {
			instance: null,
			verbosity: null,
			outputConfig: null
		};

	// Public API
	var PhantomConsoleModule = {
		/**
		* Verbosity enumeration to control the level of console/logging output.
		*/
		Verbosity: (function() {
			var levels = {
				NONE: 0,
				ASSERT: 1,
				ERROR: 2,
				WARN: 3,
				INFO: 4,
				DEBUG: 5,
				ALL: 6
			};
			
			// Default verbosity is INFO, meaning that you will NOT see messaages from
			// the DEBUG (console.debug) or ALL (console.log) levels.
			levels.DEFAULT = levels.INFO;

			return levels;
		})(),

		/**
		* Create an instance of the PhantomConsole.
		*/
		create: function(verbosity, outputConfig) {
			verbosity = verbosity || PhantomConsoleModule.Verbosity.DEFAULT;
			outputConfig = outputConfig || _defaultConsoleConfig;
			
			if (!_phantomConsole.instance || (_phantomConsole.verbosity !== verbosity) || (_phantomConsole.outputConfig !== outputConfig)) {
				var realConsole = _originalConsole,
					_timers = {},
					_counters = {},
					indentLevel = 0,
					indentText = outputConfig.indent || "",
					indent = function() {
						return Array(indentLevel + 1).join(indentText);
					},
					prefix = function(methodName) {
						var prefixVal;
						if (outputConfig.formatters && (typeof outputConfig.formatters.prefix === "function")) {
							prefixVal = outputConfig.formatters.prefix(methodName);
						}
						return prefixVal || "";
					},
					suffix = function(methodName) {
						var suffixVal;
						if (outputConfig.formatters && (typeof outputConfig.formatters.suffix === "function")) {
							suffixVal = outputConfig.formatters.suffix(methodName);
						}
						return suffixVal || "";
					},
					Verbosity = PhantomConsoleModule.Verbosity,
					phantomConsole = {
						log: function(msg) {
							if (verbosity >= Verbosity.ALL) {
								var methodName = "log";
								realConsole.log(indent() + prefix(methodName) + msg + suffix(methodName));
							}
						},
						debug: function(msg) {
							if (verbosity >= Verbosity.DEBUG) {
								var methodName = "debug";
								realConsole.debug(indent() + prefix(methodName) + msg + suffix(methodName));
							}
						},
						info: function(msg) {
							if (verbosity >= Verbosity.INFO) {
								var methodName = "info";
								realConsole.info(indent() + prefix(methodName) + msg + suffix(methodName));
							}
						},
						warn: function(msg) {
							if (verbosity >= Verbosity.WARN) {
								var methodName = "warn";
								realConsole.warn(indent() + prefix(methodName) + msg + suffix(methodName));
							}
						},
						error: function(msg) {
							if (verbosity >= Verbosity.ERROR) {
								var methodName = "error";
								realConsole.error(indent() + prefix(methodName) + msg + suffix(methodName));
							}
						},
						assert: function(condition, msg) {
							if (verbosity >= Verbosity.ASSERT) {
								var methodName = "assert";
								realConsole.assert(!!condition, indent() + prefix(methodName) + msg + suffix(methodName));
								
								/*
								// NOTE: Spec claims this should throw an error, too, but it doesn't do so in any browser.
								//       Does throw an AssertionError in Node.js.
								throw new Error("Assertion failed: " + msg);
								// OR...
								if (typeof AssertionError === "undefined") {
									AssertionError = function(msg) {};
									AssertionError.prototype = Error;
									AssertionError.constructor = AssertionError;
									throw new AssertionError("Assertion failed: " + msg);
								}
								*/
							}
						},
						group: function(name) {
							if (verbosity > Verbosity.NONE) {
								// Useless: realConsole.group(name);
								var methodName = "group";
								realConsole.log(indent() + prefix(methodName) + name + suffix(methodName));
								indentLevel++;
							}
						},
						groupCollapsed: function(name) {
							if (verbosity > Verbosity.NONE) {
								// Useless: realConsole.groupCollapsed(name);
								var methodName = "groupCollapsed";
								realConsole.log(indent() + prefix(methodName) + name + suffix(methodName));
								indentLevel++;
							}
						},
						groupEnd: function() {
							if (verbosity > Verbosity.NONE) {
								if (indentLevel > 0) {
									indentLevel--;
									
									var methodName = "groupEnd";
									realConsole.log(indent() + prefix(methodName) + suffix(methodName));
									// Useless: realConsole.groupEnd();
								}
							}
						},
						clear: function() {
							if (verbosity > Verbosity.NONE) {
								while (indentLevel > 0) {
									phantomConsole.groupEnd();
								}
							}
						},
						time: function(timerName) {
							if (verbosity >= Verbosity.INFO && !_timers[timerName]) {
								_timers[timerName] = _getTimeFunc();
							}
						},
						timeEnd: function(timerName) {
							if (verbosity >= Verbosity.INFO) {
								var startTime = _timers[timerName];
								if (startTime) {
									var endTime = _getTimeFunc(),
										timeElapsed = endTime - startTime,
										methodName = "timeEnd";

									realConsole.info(indent() + prefix(methodName) + timerName + ": " + timeElapsed + "ms" + suffix(methodName));

									_timers[timerName] = null;
									delete _timers[timerName];
									
									// Not in the spec but Firebug does this
									return timeElapsed;
								}
							}
						},
						trace: function() {
							if (verbosity >= Verbosity.DEBUG) {
								// Useless: realConsole.trace();
								try {
									// Intentional:
									throw new Error("Intentionally thrown error for console.trace internal usage only!");
								}
								catch (e) {
									var thisFunctionsThrowStatement = e.stackArray.shift(),
										methodName = "trace",
										tracePrefix = prefix(methodName),
										traceSuffix = suffix(methodName),
										traceMsgStack = tracePrefix ? [tracePrefix] : [];
									e.stackArray.forEach(function(t) {
										traceMsgStack.push(" -> " + (t.file || t.sourceURL) + ": " + t.line + (t.function ? ' (in function "' + t.function + '")' : ""));
									});
									if (traceSuffix) {
										traceMsgStack.push(traceSuffix);
									}
									traceMsgStack[0] = indent() + traceMsgStack[0];
									realConsole.log(traceMsgStack.join("\n" + indent()));
								}
							}
						},
						count: function(title) {
							if (verbosity >= Verbosity.INFO) {
								// Useless: realConsole.count(counterTitle);

								var counterTitle = title || "",
									methodName = "count";
								_counters[counterTitle] = (_counters[counterTitle] || 0);
								_counters[counterTitle]++;
								realConsole.log(indent() + prefix(methodName) + counterTitle + ": " + _counters[counterTitle] + suffix(methodName));
							}
						}
					};

				// May or may not cover the following (depends on if they are in QtWebKit core:
				//    dir, dirxml, timeStamp, profile, profileEnd, exception, table, etc.
				for (var prop in realConsole) {
					if (!phantomConsole[prop]) {
						if (typeof realConsole[prop] === "function") {
							phantomConsole[prop] = function() {
								if (verbosity > Verbosity.NONE) {
									realConsole[prop].apply(this, arguments);
								}
							};
						}
						else {
							phantomConsole[prop] = realConsole[prop];
						}
					}
				}

				// Store it
				_phantomConsole = {
					instance: phantomConsole,
					verbosity: verbosity,
					outputConfig: outputConfig
				};
			}
			
			return _phantomConsole.instance;
		},

		/**
		* Return the original, not-so-better console.
		*/
		getOriginal: function() {
			return _originalConsole;
		}
	};

	return exports = (typeof module !== "undefined" ? module : {}).exports = PhantomConsoleModule;

})(this);