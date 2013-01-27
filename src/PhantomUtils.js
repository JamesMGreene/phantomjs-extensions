/*!
 * PhantomUtils v0.1
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
	var DEFAULT_TIMEOUT = 3000, /* 3000ms = 3 seconds */
		DEFAULT_POLL_INTERVAL = 500, /* 500 ms = 0.5 seconds */
		_getTimeFunc = (function() {
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
		_shimDefs,
		_sysArgs,
		padLeftWithZeroes = function(text, desiredLength) {
			return Array(desiredLength - String(text).length + 1).join("0") + text;
		},
		_phantomLibPath = window.phantom.libraryPath,
		_phantomWorkingDir = window.require('fs').workingDirectory;

	// Public API
	var PhantomUtils = {

		/**
		*
		*/
		shim: function(shimTarget, settings) {
			settings = settings || {};
			var doNotExport = !!settings.doNotExport, /* var console = shim("console", { doNotExport: true }); */
				mergeWithExistingObject = !!settings.mergeObjects,  /* shim("console", { mergeObjects: true }); */
				overwriteExisting = !!settings.overwriteExisting; /* shim("console.log", { overwriteExisting: true }); */

			var target = window,
				shimTargetHierarchy = shimTarget.split("."),
				console_time_timers = {},
				shimDefs = _shimDefs = _shimDefs || {
					Date: {
						now: function() { return +(new window.Date()); }
					},
					performance: {
						now: (function() {
							var nowFunc;
							if (window.performance && window.performance.webkitNow) {
								// TODO: Wrap with anonymous function shell, if necessary?
								nowFunc = window.performance.webkitNow;
							}
							else if (window.Date.now) {
								nowFunc = window.Date.now;
							}
							else {
								// TODO: Wrap with anonymous function shell, if necessary?
								nowFunc = shimDefs.Date.now;
							}
							return nowFunc;
						})()
					}
				},
				targetShimDef = shimDefs;

			// Skip the "window" segment of the identifier chain, if provided, as it is assumed to be equivalent to "window" in this scope
			if (shimTargetHierarchy.length && shimTargetHierarchy[0] === "window") {
				shimTargetHierarchy.shift();
			}

			// Ensure that we have a shim for this target
			for (var i = 0, len = shimTargetHierarchy.length; i < len; i++) {
				targetShimDef = targetShimDef[shimTargetHierarchy[i]];
				if (!targetShimDef) {
					break;
				}
			}

			// If we found a matching shim
			if (targetShimDef) {
				if (!doNotExport) {
					return targetShimDef;
				}
				else {
					// Skip the last item as that is the real target shim
					while (shimTargetHierarchy.length > 1) {
						var nextTarget = shimTargetHierarchy.shift();
						if (!target[nextTarget]) {
							target[nextTarget] = {};
						}
						target = target[nextTarget];
					}
					var finalTarget = shimTargetHierarchy.shift();
					if (!target[finalTarget]) {
						Object.defineProperty(target, finalTarget, { value: targetShimDef });
					}
					else if (overwriteExisting) {
						Object.defineProperty(target, finalTarget, { value: targetShimDef });
					}
					else {
						window.console.warn("[WARNING] The definition you were trying to shim already existed but you did not set the 'overwriteExistingMembers' argument to true!");
					}

					// Also return it for the heck of it
					return targetShimDef;
				}
			}
			else {
				throw new Error("Does not currently support shimming for specified target: " + shimTarget);
			}
		},

		/**
		* 
		*/
		getTimestamp: function(now) {
			return now.getFullYear() + "-" + padLeftWithZeroes((now.getMonth() + 1), 2) + "-" + padLeftWithZeroes(now.getDate(), 2) + "T" +
				padLeftWithZeroes(now.getHours(), 2) + ":" + padLeftWithZeroes(now.getMinutes(), 2) + ":" + padLeftWithZeroes(now.getSeconds(), 2);
		},

		/**
		* 
		*/
		getCurrentTimestamp: function() {
			return PhantomUtils.getTimestamp(new Date());
		},

		/**
		* Stole initial implementation from Lo-Dash (a better drop-in replacement for Underscore.js):
		*   https://github.com/bestiejs/lodash/blob/v0.3.2/lodash.js#L1967
		*
		* I subsequently added the aggregatorFunc-related code myself.
		*
		* Example usages:
		*   stdout.write = debounce(console.log, 250);
		*   stdout.write = debounce(console.log, 250, true);
		*   stdout.write = debounce(console.log, 250, false, function(msg) {  });
		*/
		debounce: function(func, wait, immediate, aggregatorFunc) {
			var args,
				result,
				thisArg,
				timeoutId;

			function delayed() {
				timeoutId = undefined;
				if (!immediate) {
					func.apply(thisArg, args);
				}
			}

			return function() {
				var isImmediate = immediate && !timeoutId;
				args = arguments;
				thisArg = this;

				clearTimeout(timeoutId);
				timeoutId = setTimeout(delayed, wait);

				if (isImmediate) {
					result = func.apply(thisArg, args);
				}
				return result;
			};
		},

		/**
		* Stole implementation from Lo-Dash (a better drop-in replacement for Underscore.js):
		*   https://github.com/bestiejs/lodash/blob/v0.3.2/lodash.js#L2152
		*
		* I subsequently added the aggregatorFunc-related code myself.
		*
		* Example usage:
		*   stdout.write = throttle(console.log, 500);
		*/
		throttle: function(func, wait, aggregatorFunc) {
			var args,
				result,
				thisArg,
				timeoutId,
				lastCalled = 0;

			function trailingCall() {
				lastCalled = new Date;
				timeoutId = undefined;
				func.apply(thisArg, args);
			}

			return function() {
				var now = new Date,
					remain = wait - (now - lastCalled);

				args = arguments;
				thisArg = this;

				if (remain <= 0) {
					lastCalled = now;
					result = func.apply(thisArg, args);
				}
				else if (!timeoutId) {
					timeoutId = setTimeout(trailingCall, remain);
				}
				return result;
			};
		},

		/**
		* My own personal implementation of a buffering wrapper function.
		* Example usage(s):
		*   stdout.write = buffer(console.log, 20);
		*   stdout.write = buffer(console.log, 20, function(buffer) { return buffer.join("\n"); });
		*/
		buffer: function(func, maxBufferSize, aggregatorFunc) {
			var args,
				thisArg,
				buffer = [],
				flushFunc;

			var flushFunc = function() {
				thisArg = this;

				if (aggregatorFunc) {
					var aggregation = aggregatorFunc.call(thisArg, buffer);
					func.apply(thisArg, aggregation);
				}
				else {
					for (var i = 0, len = buffer.length; i < len; i++) {
						func.call(thisArg, buffer[i]);
					}
				}

				// Clear the buffer
				buffer.length = 0;
			},
				bufferFunc = function() {
					args = arguments;
					thisArg = this;

					buffer.push(args);

					if (buffer.length >= maxBufferSize) {
						flushFunc();
					}
				};

			bufferFunc.flush = flushFunc;
			return bufferFunc;
		},

		/** Shim to make this script work with all versions of PhantomJS */
		getSystemArgs: function() {
			if (_sysArgs) {
				return _sysArgs;
			}

			var sys;
			if (PhantomUtils.compareVersion("1.5", "lt")) {
				// For versions older than PhantomJS 1.5
				sys = {
					// TODO: Consider prepending the relative difference between `_phantomLibPath` and `_phantomWorkingDir`
					// `phantom.scriptName` will differ from `require("system").args[0]` if the script was not in the working directory
					args: [window.phantom.scriptName]
				};
				for (var a = 0; a < window.phantom.args.length; a++) {
					sys.args.push(window.phantom.args[a]);
				}
			}
			else {
				sys = require("system");
			}
			return _sysArgs = sys.args;
		},

		/** Get JUST the filename of the currently executing script, NOT the path to it */
		getScriptName: function() {
			// Chop off any directory path segments
			var scriptRelativePathOrName = PhantomUtils.getSystemArgs()[0],
				filenameStartIndex = scriptRelativePathOrName.lastIndexOf("/") + 1;

			return scriptRelativePathOrName.substring(filenameStartIndex);
		},

		/** Get an absolute path to the currently executing script */
		getScriptPath: function() {
			// `scriptRelativePathOrName` will differ between 1.5+ and versions 1.4.x- if the script was not in the working directory
			var scriptRelativePathOrName = PhantomUtils.getSystemArgs()[0];

			if (PhantomUtils.compareVersion("1.5", "lt")) {
				return _phantomLibPath + scriptRelativePathOrName;
			}
			else {
				return _phantomWorkingDir + scriptRelativePathOrName;
			}
		},

		getPositionalArg: function(position) {
			return PhantomUtils.getSystemArgs()[position + 1];
		},

		isPositionalArgValid: function(position) {
			var posArg = PhantomUtils.getPositionalArg(position);
			return !!posArg && posArg.charAt(0) !== "-";
		},

		getNamedArg: function(argName, defaultValue) {
			var sysArgs = PhantomUtils.getSystemArgs(),
				argNameLower = argName.toLowerCase(),
				returnVal = defaultValue,  // if not provided, naturally set to undefined
				sysArgLower;
			// Don't bother with index 0, that's the phantom.scriptName
			for (var i = sysArgs.length - 1; i > 0; i--) {
				sysArgLower = sysArgs[i].toLowerCase();
				if (sysArgLower === argNameLower) {
					returnVal = true;
					break;
				}
				else if (sysArgLower.indexOf(argNameLower + "=") === 0) {
					returnVal = sysArgs[i].split("=").slice(1).join("=");
					break;
				}
			}
			return returnVal;
		},

		/**
		* Compare a `version` string (e.g. "1.6.1") against the currently executing version of PhantomJS.
		* Boolean return value indicates the result of the comparsion operation of type `comparisonType` (e.g. `"eq"` for "equal")
		*/
		compareVersion: function(version, comparisonType) {
			var versionParts = (version || "").split(".", 3),
				phantomVersion = window.phantom.version,
				versionToCompare = {
					major: versionParts[0] || 0,
					minor: versionParts[1] || 0,
					patch: versionParts[2] || 0
				},
				normalizedComparisonType = comparisonType.toLowerCase(),
			/* Find the equality results up front to prevent unnecessary recursion and/or non-DRY code. */
				equalityResult = {
					major: phantomVersion.major === versionToCompare.major,
					minor: phantomVersion.minor === versionToCompare.minor,
					patch: phantomVersion.patch === versionToCompare.patch,
					all: (function() { return equalityResult.major && equalityResult.minor && equalityResult.patch })()
				};

			switch (normalizedComparisonType) {
				// Equal                              
				case "eq":
					return equalityResult.all;
					// Not equal
				case "ne":
				case "neq":
					return !equalityResult.all;
					// Greater than, Greater than or equal
				case "gt":
				case "ge":
				case "gte":
					return equalityResult.all ||
						phantomVersion.major > versionToCompare.major ||
						(equalityResult.major && (phantomVersion.minor > versionToCompare.minor)) ||
						(equalityResult.major && equalityResult.minor && (phantomVersion.patch > versionToCompare.patch));
					// Less than, Less than or equal
				case "lt":
				case "le":
				case "lte":
					return equalityResult.all ||
						phantomVersion.major < versionToCompare.major ||
						(equalityResult.major && phantomVersion.minor < versionToCompare.minor) ||
						(equalityResult.major && equalityResult.minor && (phantomVersion.patch < versionToCompare.patch));
					// Other
				default:
					throw new TypeError("ERROR: `comparisonType` was an unexpected value: " + comparisonType);
			}
		},

		/** Sleep (a.k.a. busy/synchronous wait). Not recommended for general use. */
		sleep: function(ms) {
			// Discourage the user from actually using this function
			window.console.warn("[WARNING] This function (PhantomUtils.sleep) does a busy/synchronous wait and thus is not recommended for general use!");

			// Validate
			if (typeof ms !== "number") {
				throw new TypeError("ArgumentException: 'ms' must be a number");
			}
			if (ms <= 0) {
				throw new TypeError("ArgumentException: 'ms' must be a number greater than 0");
			}

			var startTime = _getTimeFunc();
			while (_getTimeFunc() - startTime < ms);
		},

		/**
		* Asynchronous wait loop.
		* @param onReadyFn {Function} Function invoked if your blocking condition is met.
		* @param onTimeoutFn {Function} Function invoked if your wait loop exceeds its timeout without the blocking condition being met. Should accept 1 input argument: the timeout duration.
		* @param readyCheckFn {Function} Function invoked to check if your blocking condition has been met.
		* @param [timeout=DEFAULT_TIMEOUT] {Number} The maximum duration to wait for the blocking condition to be met.
		* @param [pollInterval=DEFAULT_POLL_INTERVAL] {Number} The duration to wait between ready checks (in milliseconds).
		*/
		asyncWait: function(onReadyFn, onTimeoutFn, readyCheckFn, timeout, pollInterval) {
			var maxTimeout = timeout || DEFAULT_TIMEOUT,
				readyCheckInterval = pollInterval || DEFAULT_POLL_INTERVAL,
				start = _getTimeFunc(),
				radioSilenceDuration = 0,
				interval = setInterval(function() {
					radioSilenceDuration = _getTimeFunc() - start;
					if (radioSilenceDuration < maxTimeout) {
						if (readyCheckFn()) {
							onReadyFn();  // Do what it's supposed to do once the condition is fulfilled
							clearInterval(interval);  // Stop this interval
						}
					}
					else {
						onTimeoutFn(radioSilenceDuration);
						clearInterval(interval);  // Stop this interval
					}
				}, readyCheckInterval);  // ...and repeat check...
		},

		/**
		* Asynchronous wait loop, sliding.
		* @param onReadyFn {Function} Function invoked if your blocking condition is met.
		* @param onTimeoutFn {Function} Function invoked if your wait loop exceeds its timeout without the blocking condition being met. Should accept 1 input argument: the timeout duration.
		* @param readyCheckFn {Function} Function invoked to check if your blocking condition has been met.
		* @param activityCheckFn {Function} Function invoked to check if the activity is still alive. Returns the most recent Date of activity.
		* @param [slidingTimeout=DEFAULT_TIMEOUT] {Number} The maximum duration to wait for the blocking condition to be met.
		* @param [pollInterval=DEFAULT_POLL_INTERVAL] {Number} The duration to wait between ready checks (in milliseconds).
		* @param [debugWriterDelegate] {Function} Function invoked to write any debugging messages.
		*/
		asyncSlidingWait: function(onReadyFn, onTimeoutFn, readyCheckFn, activityCheckFn, slidingTimeout, pollInterval, debugWriterDelegate) {
			var maxTimeoutSinceLastHeartbeat = slidingTimeout ? slidingTimeout : DEFAULT_TIMEOUT,
				readyCheckInterval = pollInterval || DEFAULT_POLL_INTERVAL,
				lastHeartbeat = undefined,
				newHeartbeat = undefined,
				radioSilenceDuration = 0,
				interval = setInterval(function() {
					newHeartbeat = activityCheckFn();
					if (lastHeartbeat === undefined) {
						lastHeartbeat = newHeartbeat;
					}

					if (debugWriterDelegate) {
						debugWriterDelegate("PhantomJS client-side heartbeat increased by " + (newHeartbeat - lastHeartbeat) + " ms");
					}

					// If not timed out yet...
					radioSilenceDuration = (newHeartbeat ? newHeartbeat - lastHeartbeat : 0);
					if (newHeartbeat != null && (radioSilenceDuration < maxTimeoutSinceLastHeartbeat)) {
						if (readyCheckFn()) {
							onReadyFn();  // Do what it's supposed to do once the condition is fulfilled
							clearInterval(interval);  // Stop this interval
						}
					}
					else {
						onTimeoutFn(radioSilenceDuration);
						clearInterval(interval);  // Stop this interval
					}
					// Store
					lastHeartbeat = newHeartbeat;
				}, readyCheckInterval);  // ...and repeat check...
		}
	};

	return exports = (module || {}).exports = PhantomUtils;

})(this);