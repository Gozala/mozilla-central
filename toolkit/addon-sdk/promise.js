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
  // Define FIFO queue of observer pairs. Once promise is resolved & all queued
  // observers are forwarded to `result` and variable is set to `null`.
  var observers = [];
  // Promise `result`, which will be assigned a resolution value once promise
  // is resolved. Note that result will always be assigned promise (or alike)
  // object to take care of propagation through promise chains. If result is
  // `null` promise is not resolved yet.
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

        // If enclosed promise observers queue is still alive a enqueue a new
        // pair into it. Note that this does not necessary means that promise
        // is pending, it may already be resolved, but we still have to queue
        // observers to guarantee an order of propagation.
        if (observers)
          observers.push(resolve, reject);
        // Otherwise just forward observers to a `result` promise (or alike).
        else
          result.then(resolve, reject);

        return deferred.promise;
      }
    },
    /**
     * Resolves associated `promise` to a given `value`, unless it's already
     * resolved or rejected.
     */
    resolve: function resolve(value) {
      if (!result) {
        // Store resolution `value` in a `result` as a promise, so that all
        // the subsequent handlers can be simple forwarded to it. This way all
        // the promise propagation will be automatically taken care of.
        result = isPromise(value) ? value : resolution(value);
        // Forward already registered observers to a `result` promise in order
        // of their registration. Note we internally shift observer pairs from
        // queue until it's exhausted to guarantee
        // [FIFO](http://en.wikipedia.org/wiki/FIFO) prioritization.
        // This way handlers registered as side effect of observer forwarding
        // will be queued rather instead of being invoked immediately.
        while (observers.length)
          result.then(observers.shift(), observers.shift());
        // Once `observers` queue is exhausted we nullify it, to forward
        // new handlers straight to the `result`.
        observers = null;
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
