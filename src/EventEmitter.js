/*!
 * EventEmitter v0.1
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

	/**
	* A basic event emitter.
	* Public API primarily taken from TJ Holowaychuk's https://github.com/component/emitter
	*/
	var EventEmitter = function() {
		this._eventMap = {};
	};
	
	var contextualize = function(callback) {
		var cbContext;
		if (typeof callback === "function") {
			cbContext = {
				"callback": callback
			};
		}
		else if (typeof callback === "object" && callback !== null) {
			cbContext = callback;
		}
		else {
			return null;
		}
		
		if (typeof cbContext.callback !== "function") {
			throw new TypeError("`callback` must either be a function or a contextual object");
		}
		
		if (!cbContext.hasOwnProperty("wrappedCallback")) {
			cbContext.wrappedCallback = null;
		}
		if (!cbContext.hasOwnProperty("binding")) {
			cbContext.binding = null;
		}
		if (!cbContext.hasOwnProperty("onlyOnce") || typeof cbContext.onlyOnce !== "boolean") {
			cbContext.onlyOnce = false;
		}
		
		return cbContext;
	};

	Object.defineProperties(EventEmitter.prototype, {
		"on": {
			value: function(eventType, callback, runFirst) {
				var cbContext = contextualize(callback),
					op = !!runFirst ? "unshift" : "push";
				(this._eventMap[eventType] = this._eventMap[eventType] || [])[op](cbContext);
				
				// Chain!
				return this;
			}
		},

		"off": {
			value: function(eventType, callback) {
				var cbContexts = this._eventMap[eventType];
				if (cbContexts) {
					// Remove all handlers for this `eventType`
					if (typeof callback === "undefined") {
						delete this._eventMap[eventType];
					}
					// Remove any handlers for this `eventType` that match the provided `callback`
					else {
						var cbContextToRemove = contextualize(callback);
						for (var i = 0; i < cbContexts.length; i++) {
							if (cbContexts[i].callback === cbContextToRemove.callback) {
								cbContexts.splice(i--, 1);
							}
						}
					}
				}
				// Chain!
				return this;
			}
		},

		"once": {
			value: function(eventType, callback, runFirst) {
				var cbContext = contextualize(callback);
				cbContext.onlyOnce = true;
				
				return this.on(eventType, cbContext, runFirst);
			}
		},

		"emit": {
			value: function(eventType) {
				var args = [].slice.call(arguments, 1),
					readonlyCallbacks = this.listeners(eventType);
				for (var i = 0, len = readonlyCallbacks.length; i < len; i++) {
					var cbContext = readonlyCallbacks[i];
					if (cbContext.onlyOnce) {
						this.off(eventType, cbContext);
					}
					(cbContext.wrappedCallback || cbContext.callback).apply(cbContext.binding, args);
				}
				// Chain!
				return this;
			}
		},

		"listeners": {
			value: function(eventType) {
				// Return a COPY of the handlers array for `eventType`, or an empty array if no callbacks have been added
				var callbacks = this._eventMap[eventType];
				return (callbacks && callbacks.length ? callbacks.slice(0) : []);
			}
		},

		"hasListeners": {
			value: function(eventType) {
				var callbacks = this._eventMap[eventType];
				return callbacks && callbacks.length;
			}
		}
	});

	return exports = (module || {}).exports = EventEmitter;

})(this);