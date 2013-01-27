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
	
	var writeTrace = function(trace) {
		var msgStack = ["TRACE:"];
		trace.forEach(function(item) {
			msgStack.push(' -> ' + (item.file || item.sourceURL) + ': ' + item.line + (item.function ? " (in function '" + item.function + "')" : ""));
		});
		return msgStack.join("\n");
	};

	phantom.onError = function(msg, trace) {
		try {
			console.error("[phantom.error] " + msg + "\n" + writeTrace(trace));
		}
		finally {
			console.error("FAIL!");
			phantom.exit(1);
		}
	};

	
	if (phantom.injectJs("CJSRequire.js")) {
		console.log("Successfully injected CJSRequire.js");
	}
	else {
		throw new Error("Failed to inject CJSRequire.js");
	}
	
	// Get the full console capabilities
	// var phantomConsole = require("PhantomConsole").create();
	// if (phantomConsole) {
		// console = phantomConsole;
		// console.log("The PhantomConsole module has been loaded and is overriding `window.console`");
	// }
	// else {
		// throw new Error("The PhantomConsole module failed to load!");
	// }

	var page = require("BetterWebPage").create();
	page.customHeaders = { "x-host": "wat" };
	if (page && typeof page.on === "function") {
		console.log("The BetterWebPage module has been loaded");
	}
	else {
		throw new Error("The BetterWebPage module failed to load!");
	}
	
	page.on("error", function(msg, trace) {
		//console.count("*** VIA EMISSION ***");
		console.error("[page.error] " + msg + "\n" + writeTrace(trace));
	});
	
	page.on("init", function() {
		//console.count("*** VIA EMISSION ***");
		//console.log("init");
		page.customHeaders = {};
	});
	
	// Try out chaining
	page.on("load.start", function() {
		//console.count("*** VIA EMISSION ***");
		//console.log("load.start");
	})
	.on("load.finish", function(status) {
		//console.count("*** VIA EMISSION ***");
		//console.log("load.finish");
		
		window.setTimeout(function() { console.log("That's sufficient. Exiting..."); phantom.exit(0); }, 5000);
	});
	
	page.on("resource.request", function(req) {
		//console.count("*** VIA EMISSION ***");
		//console.log("resource.request: " + req.id);
	});
	// Try out wildcard listeners
	page.on("resource.receive.*", function(resp) {
		//console.count("*** VIA EMISSION ***");
		//console.log("resource.receive.*: " + resp.id + " (" + resp.stage + ")");
	});
	
	console.log("OS?");
	console.log(JSON.stringify(require("system").os));
	
	console.log("Loading page...");
	page.open("http://www.google.com/", function(status) {
		//console.log("load.finish: via `page.open` callback, NOT via emission");
		window.setTimeout(function() { console.log("Wow, this one caused the exit? Weird."); phantom.exit(0); }, 10000);
	});
})(this);