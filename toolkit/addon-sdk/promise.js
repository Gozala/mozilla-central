/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint undef: true es5: true node: true browser: true devel: true
         forin: true latedef: false */
/*global define: true, Cu: true, __URI__: true */
;(function(id, factory) { // Module boilerplate :(
  if (typeof(define) === 'function') { // RequireJS
    define(factory);
  } else if (typeof(require) === 'function') { // CommonJS
    factory.call(this, require, exports, module);
  } else if (String(this).indexOf('BackstagePass') >= 0) { // JSM
    factory(function require(uri) {
      var imports = {};
      this['Components'].utils.import(uri, imports);
      return imports;
    }, this, { uri: __URI__, id: id });
    this.EXPORTED_SYMBOLS = Object.keys(this);
  } else {  // Browser or alike
    var globals = this
    factory(function require(id) {
      return globals[id];
    }, (globals[id] = {}), { uri: document.location.href + '#' + id, id: id });
  }
}).call(this, 'promise', function(require, exports, module) {

'use strict';

/**
 * Internal utility: Wraps given `value` into simplified promise, pre-resolved
 * to `value`. Note the result is not a full promise, as it's method `then`
 * does not returns anything.
 */
function resolution(value) {
  return { then: function then(resolve) { resolve(value); } };
}

/**
 * Internal utility: Wraps given input into simplified promise, pre-rejected
 * with given `reason`. Note the result is not a full promise, as it's method
 * `then` does not returns anything.
 */
function rejection(reason) {
  return { then: function then(resolve, reject) { reject(reason); } };
}

/**
 * Internal utility: Decorates given `f` function, so that on exception promise
 * rejected with thrown error is returned.
 */
function attempt(f) {
  return function effort(input) {
    try {
      return f(input);
    }
    catch(error) {
      return rejection(error);
    }
  };
}

/**
 * Internal utility: Returns `true` if given `value` is promise. Value is
 * assumed to be promise if it implements `then` method.
 */
function isPromise(value) {
  return value && typeof(value.then) === 'function';
}

/**
 * Creates deferred object containing fresh promise & methods to either resolve
 * or reject it. Result contains following properties:
 * - `promise` Eventual value representation implementing CommonJS [Promises/A]
 *   (http://wiki.commonjs.org/wiki/Promises/A) API.
 * - `resolve` Single shot function that resolves enclosed `promise` with a
 *   given `value`.
 * - `reject` Single shot function that rejects enclosed `promise` with a given
 *   `reason`.
 *
 *  ## Example
 *
 *  function readURI(uri, type) {
 *    var deferred = defer();
 *    var request = new XMLHttpRequest();
 *    request.open("GET", uri, true);
 *    request.responseType = type;
 *    request.onload = function onload() {
 *      deferred.resolve(request.response);
 *    }
 *    request.onerror = function(event) {
 *     deferred.reject(event);
 *    }
 *    request.send();
 *
 *    return deferred.promise;
 *  }
 */
function defer() {
  // Array to store promise observers up until it's resolved.
  var observers = [];
  // Promise `result`, which will be assigned a resolution value once resolved.
  // Note that result will always be assigned promise (or alike) object to take
  // care propagation through promise chains. If `result` is `null` then
  // promise is pending.
  var result = null;

  var deferred = {
    promise: {
      then: function then(onResolve, onReject) {
        var deferred = defer();
        // Decorate `onResolve` / `onReject` handlers with `attempt` wrapper.
        // This way it's guaranteed to always returns even on exceptions. On
        // exceptions promise rejected with a thrown error is returned.
        // If handler is missing, fall back to internal utility function that
        // takes care of propagation.
        onResolve = onResolve ? attempt(onResolve) : resolution;
        onReject = onReject ? attempt(onReject) : rejection;

        // Create a pair of observers that invoke given handlers & propagate
        // results to a resulting promise (One that is returned by `then`).
        function resolve(value) { deferred.resolve(onResolve(value)); }
        function reject(reason) { deferred.resolve(onReject(reason)); }

        // If enclosed promise is resolved, then forward observers to the
        // resolution result (which is promise or alike).
        if (result)
          result.then(resolve, reject);
        // Otherwise register observers.
        else
          observers.push({ resolve: resolve, reject: reject });

        return deferred.promise;
      }
    },
    /**
     * Resolves associated `promise` to a given `value`, unless it's already
     * resolved or rejected.
     */
    resolve: function resolve(value) {
      if (!result) {
        // Store resolution `value` as a `result` of enclosed promise. Note
        // that `result` is a promise (like) or normalized to one, this way all
        // subsequent listeners can be simple forwarded to and all the
        // propagation will automatically be taken care of.
        result = isPromise(value) ? value : resolution(value);
        // Forward all registered observers to a result.
        var pending = observers.splice(0), index = 0, count = pending.length;
        while (index < count) {
          var observer = pending[index++];
          result.then(observer.resolve, observer.reject);
        }
      }
    },
    /**
     * Rejects associated `promise` with a given `reason`, unless it's already
     * resolved / rejected.
     */
    reject: function reject(reason) {
      deferred.resolve(rejection(reason));
    }
  };

  return deferred;
}
exports.defer = defer;

/**
 * Returns a promise resolved to a given `value`.
 */
function resolve(value) {
  var deferred = defer();
  deferred.resolve(value);
  return deferred.promise;
}
exports.resolve = resolve;

/**
 * Returns a promise rejected with a given `reason`.
 */
function reject(reason) {
  var deferred = defer();
  deferred.reject(reason);
  return deferred.promise;
}
exports.reject = reject;

});
