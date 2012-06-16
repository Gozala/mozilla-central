/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint undef: true es5: true node: true browser: true devel: true
         forin: true latedef: false */
/*global define: true, Cu: true, __URI__: true */
;(function(id, factory) { // Module boilerplate :(
  if (typeof(define) === 'function') { // RequireJS
    define(factory);
  } else if (typeof(require) === 'function') { // CommonJS
    factory.call(this, require, exports, module);
  } else if (~String(this).indexOf('BackstagePass')) { // JSM
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

function resolution(value) {
  /**
  Returns non-standard compliant (`then` does not returns a promise) promise
  that resolves to a given `value`. Used just internally only.
  **/
  return { then: function then(resolve) { resolve(value); } };
}

function rejection(reason) {
  /**
  Returns non-standard compliant promise (`then` does not returns a promise)
  that rejects with a given `reason`. This is used internally only.
  **/
  return { then: function then(resolve, reject) { reject(reason); } };
}

function attempt(f) {
  /**
  Returns wrapper function that delegates to `f`. If `f` throws then captures
  error and returns promise that rejects with a thrown error. Otherwise returns
  return value. (Internal utility)
  **/
  return function effort(options) {
    try { return f(options); }
    catch(error) { return rejection(error); }
  };
}

function isPromise(value) {
  /**
  Returns true if given `value` is promise. Value is assumed to be promise if
  it implements `then` method.
  **/
  return value && typeof(value.then) === 'function';
}

function defer() {
  /**
  Returns object containing following properties:
  - `promise` Eventual value representation implementing CommonJS [Promises/A]
    (http://wiki.commonjs.org/wiki/Promises/A) API.
  - `resolve` Single shot function that resolves returned `promise` with a given
    `value` argument.
  - `reject` Single shot function that rejects returned `promise` with a given
    `reason` argument.

  ## Examples

  var deferred = defer()
  deferred.promise.then(console.log, console.error)
  deferred.resolve(value)
  */

  // Create an array where `pending` observers will be collected. Once promise
  // is realized array will be nullified indicating that promise is resolved.
  // Once promise is resolved `result` will be assigned a resolution value.
  // Note that result is always a promise (or alike), this takes care of
  // values / errors propagation without any additional logic.
  var pending = [], result;

  var deferred = {
    promise: {
      then: function then(onResolve, onReject) {
        var deferred = defer();
        // Decorate `onResolve` / `onReject` handlers with `attempt` wrapper.
        // This will make sure that `deferred` is rejected on exceptions in
        // event handlers. If handler is not provided fall back to
        // `resolution` / `rejection` that will just propagate values.
        onResolve = resolve ? attempt(onResolve) : resolution;
        onReject = reject ? attempt(onReject) : rejection;

        // Create an observers that will invoke registered handlers
        // and propagate results to a returned promise.
        function resolve(value) { deferred.resolve(onResolve(value)); }
        function reject(reason) { deferred.resolve(onReject(reason)); }

        // If promise is pending register listeners. Otherwise forward
        // observers to a result.
        if (pending) pending.push([ resolve, reject ]);
        else result.then(resolve, reject);

        return deferred.promise;
      }
    },
    resolve: function resolve(value) {
      /**
      Resolves associated `promise` to a given `value`, unless it's already
      resolved or rejected.
      **/
      if (pending) {
        // Store resolution `value` as a promise (`value` itself may be a
        // promise), so that all subsequent listeners can be forwarded to it,
        // which either resolves immediately or forwards if `value` is
        // a promise. This takes care of value / error propagation.
        result = isPromise(value) ? value : resolution(value);
        var observers = pending, index = 0, count = observers.length;
        // Mark promise as resolved.
        pending = null;
        // Forward resolution value to all registered observers.
        while (index < count) result.then.apply(result, observers[index++]);
      }
    },
    reject: function reject(reason) {
      /**
      Rejects associated `promise` with a given `reason`, unless it's already
      resolved / rejected.
      **/
      deferred.resolve(rejection(reason));
    }
  };

  return deferred;
}
exports.defer = defer;

function resolve(value) {
  /**
  Returns a promise resolved to a given `value`.
  **/
  var deferred = defer();
  deferred.resolve(value);
  return deferred.promise;
}
exports.resolve = resolve;

function reject(reason) {
  /**
  Returns a promise rejected with a given `reason`.
  **/
  var deferred = defer();
  deferred.reject(reason);
  return deferred.promise;
}
exports.reject = reject;

});
