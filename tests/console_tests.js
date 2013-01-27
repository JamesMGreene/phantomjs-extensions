/*!
 * This file is a part of:
 * https://github.com/JamesMGreene/phantomjs-extensions/
 *
 * Copyright © 2012: James Greene (Team Gunmetal, Inc.)
 * Released under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 */
 
/*global phantom:false */
/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, browser:true, devel:true, es5:true, indent:4, maxerr:50 */ 

(function(window) {
	"use strict";
	
	var traceWriter = function(trace) {
		var msgStack = ["TRACE:"];
		trace.forEach(function(t) {
			msgStack.push(" -> " + (t.file || t.sourceURL) + ": " + t.line + (t.function ? " (in function '" + t.function + "')" : ""));
		});
		return msgStack.join("\n");
	};

	phantom.onError = function(msg, trace) {
		console.error("FATAL!");
		console.error(msg + "\n" + traceWriter(trace));
		phantom.exit(1);
	};
	
	function consoleTrace() {
		function traceInside() {
			console.trace();
		}
		traceInside();
	}
	
	var traceIt = function() {
		try {
			throw new Error("TRACE ME!");
		}
		catch (e) {
			var thisFunctionsThrowStatement = e.stackArray.shift();
			return traceWriter(e.stackArray);
		}
	};

	var i = 0,
		getCounter = function() {
			return "" + (i++) + ". ";
		},
		getCounterHeading = function() {
			return "" + (i++) + ": ";
		};
	
	console.log("***** ORIGINAL CONSOLE *****");
	
	console.info(getCounter() + "Blah"); // 0
	console.group(getCounter() + "Group"); // 1 - does not print
	console.info(getCounter() + "    Blah");  // 2
	console.log(getCounterHeading());  // Leading 3
	console.groupEnd();  // Should be 3 - does not print
	console.info(getCounter() + "Blah");  // 4
	
	console.assert(true, getCounter() + "True");  // 5 - does not print, which is correct
	console.assert(false, getCounter() + "False!!!");  // 6
	
	console.time(getCounter() + "TimerGo");  // 7 - does not print
	
	console.log(getCounter() + "Counter:");  // 8
	for (var j = 0; j < 5; j++) {
		console.log(getCounterHeading() + "Looping " + j);  // Leading 9-13
		console.count("Counter title"); // 9-13 - does not print
	}
	console.log(getCounter() + "Counter done");  // 14
	
	// Apparently this ONLY affects Notepad -_-
	console.log(getCounter() + "Newline test\nLine1\nLine 2");  // 15
	
	console.log(getCounter() + "Tracer:");  // 16
	console.log(getCounterHeading());  // Leading 17
	consoleTrace();  // 17 - prints 1 blank line
	console.log(getCounter() + "Tracer done");  // 18
	
	console.log(getCounter() + "Trace func:");  // Leading 19
	console.log(traceIt());  // 19
	console.log(getCounter() + "Trace func done");  // 20
	
	
	window.setTimeout(function() {
		console.log(getCounterHeading());  // Leading 21
		console.timeEnd("TimerGo");  // 21 - does not print
		
		console.debug(getCounter() + "console.debug");  // 22
		console.warn(getCounter() + "console.warn");  // 23
		console.error(getCounter() + "console.error");  // 24
		console.log(getCounter() + "DONE!");  // 25
		
		phantom.exit(0);
	}, 2000);
	
})(this);