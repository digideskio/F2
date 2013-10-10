﻿define('F2.Ajax', ['F2', 'F2.Promise'], function(F2, Promise) {

	// --------------------------------------------------------------------------
	// Helpers
	// --------------------------------------------------------------------------

	function queryStringify(obj) {
		var qs = [];

	  for (var p in obj) {
	    qs.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]));
	  }

	  return qs.join('&');
	}

	function delim(url) {
		return (url.indexOf('?') === -1) ? '?' : '&';
	}

	/**
	 * Parses URI
	 * @method _parseURI
	 * @private
	 * @param {The URL to parse} url
	 * @returns {Parsed URL} string
	 * Source: https://gist.github.com/Yaffle/1088850
	 * Tests: http://skew.org/uri/uri_tests.html
	 */
	function _parseURI(url) {
		var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
		// authority = '//' + user + ':' + pass '@' + hostname + ':' port
		return (m ? {
				href     : m[0] || '',
				protocol : m[1] || '',
				authority: m[2] || '',
				host     : m[3] || '',
				hostname : m[4] || '',
				port     : m[5] || '',
				pathname : m[6] || '',
				search   : m[7] || '',
				hash     : m[8] || ''
			} : null);
	}

	/**
	 * Abosolutizes a relative URL
	 * @method _absolutizeURI
	 * @private
	 * @param {e.g., location.href} base
	 * @param {URL to absolutize} href
	 * @returns {string} URL
	 * Source: https://gist.github.com/Yaffle/1088850
	 * Tests: http://skew.org/uri/uri_tests.html
	 */
	function _absolutizeURI(base, href) { // RFC 3986
		function removeDotSegments(input) {
			var output = [];
			input.replace(/^(\.\.?(\/|$))+/, '')
				.replace(/\/(\.(\/|$))+/g, '/')
				.replace(/\/\.\.$/, '/../')
				.replace(/\/?[^\/]*/g, function (p) {
					if (p === '/..') {
						output.pop();
					} else {
						output.push(p);
					}
				});
			return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
		}

		href = _parseURI(href || '');
		base = _parseURI(base || '');

		return !href || !base ? null : (href.protocol || base.protocol) +
			(href.protocol || href.authority ? href.authority : base.authority) +
			removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
			(href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
			href.hash;
	}

	/**
	 * Tests a URL to see if it's on the same domain (local) or not
	 * @method isLocalRequest
	 * @param {URL to test} url
	 * @returns {bool} Whether the URL is local or not
	 * Derived from: https://github.com/jquery/jquery/blob/master/src/ajax.js
	 */
	function _isLocalRequest(url) {
		var rurl = /^([\w.+-]+:)(?:\/\/([^\/?#:]*)(?::(\d+)|)|)/,
			urlLower = url.toLowerCase(),
			parts = rurl.exec( urlLower ),
			ajaxLocation,
			ajaxLocParts;

		try {
			ajaxLocation = location.href;
		}
		catch(e) {
			// Use the href attribute of an A element
			// since IE will modify it given document.location
			ajaxLocation = document.createElement('a');
			ajaxLocation.href = '';
			ajaxLocation = ajaxLocation.href;
		}

		ajaxLocation = ajaxLocation.toLowerCase();

		// uh oh, the url must be relative
		// make it fully qualified and re-regex url
		if (!parts){
			urlLower = _absolutizeURI(ajaxLocation,urlLower).toLowerCase();
			parts = rurl.exec(urlLower);
		}

		// Segment location into parts
		ajaxLocParts = rurl.exec(ajaxLocation) || [];

		// do hostname and protocol and port of manifest URL match location.href? (a "local" request on the same domain)
		var matched = !(parts &&
				(parts[1] !== ajaxLocParts[1] || parts[2] !== ajaxLocParts[2] ||
					(parts[3] || (parts[1] === 'http:' ? '80' : '443')) !==
						(ajaxLocParts[3] || (ajaxLocParts[1] === 'http:' ? '80' : '443'))));

		return matched;
	}

	// --------------------------------------------------------------------------
	// GET/POST
	// --------------------------------------------------------------------------

	function _ajax(params, cache) {
		if (!params.url) {
			throw 'F2.Ajax: you must provide a url.';
		}

		var defer = Promise.defer();

		if (_isLocalRequest(params.url)) {
			params.crossOrigin = false;
		}

		// Determine the method if none was provided
		if (!params.method) {
			if (params.crossOrigin) {
				params.method = 'jsonp';
			}
			else {
				params.method = 'post';
			}
		}

		// Look for methods that use query strings
		if (params.method === 'get' || params.type === 'jsonp') {
			// Stringify the data onto the url
			if (params.data) {
				params.url += delim(params.url) + queryStringify(params.data);
			}
			else {
				// Pull data off the obj to avoid confusion
				delete params.data;
			}

			// Bust cache if asked
			if (!cache) {
				params.url += delim(params.url) + Math.floor(Math.random() * 1000000);
			}
		}

		if (params.type === 'jsonp') {
			// Create a random callback name
			params.jsonpCallbackName = 'F2_' + Math.floor(Math.random() * 1000000);

			// Add a jsonp callback to the window
			window[params.jsonpCallbackName] = function(response) {
				defer.resolve(response);

				// Pull the callback off the window
				delete window[params.jsonpCallbackName];
			};
		}
		else {
			params.success = defer.resolve;
			params.error = defer.reject;
		}

		// Make the call
		reqwest(params);

		return defer.promise;
	}

	_ajax.get = function(url, data, type, cache) {
		return _ajax(
			{
				data: data,
				method: 'get',
				type: type,
				url: url
			},
			cache
		);
	};

	_ajax.post = function(url, data, type) {
		return _ajax({
			data: data,
			method: 'post',
			type: type,
			url: url
		});
	};

	_ajax.jsonp = function(url, data, cache) {
		return _ajax(
			{
				data: data,
				type: 'jsonp',
				url: url
			},
			cache
		);
	};

	return _ajax;

});