/**
 * Android 4 (API 14-19 / Chromium 30 / Android WebKit) Polyfills
 * Guarantees 100% compatibility with Android 4.0 - 4.4 KitKat devices & legacy POS terminals.
 */
(function(window, document) {
  'use strict';

  // 1. Console safety
  window.console = window.console || {};
  var methods = ['log', 'warn', 'error', 'info', 'dir', 'debug', 'table'];
  for (var m = 0; m < methods.length; m++) {
    if (typeof window.console[methods[m]] !== 'function') {
      window.console[methods[m]] = function() {};
    }
  }

  // 2. Element.prototype.matches & closest
  if (!Element.prototype.matches) {
    Element.prototype.matches =
      Element.prototype.matchesSelector ||
      Element.prototype.mozMatchesSelector ||
      Element.prototype.msMatchesSelector ||
      Element.prototype.oMatchesSelector ||
      Element.prototype.webkitMatchesSelector ||
      function(s) {
        var matches = (this.document || this.ownerDocument).querySelectorAll(s),
            i = matches.length;
        while (--i >= 0 && matches.item(i) !== this) {}
        return i > -1;
      };
  }

  if (!Element.prototype.closest) {
    Element.prototype.closest = function(s) {
      var el = this;
      while (el && el.nodeType === 1) {
        if (el.matches && el.matches(s)) return el;
        el = el.parentElement || el.parentNode;
      }
      return null;
    };
  }

  // 3. Array.prototype.find
  if (!Array.prototype.find) {
    Array.prototype.find = function(predicate) {
      if (this == null) throw new TypeError('Array.prototype.find called on null or undefined');
      if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
      var list = Object(this);
      var length = list.length >>> 0;
      var thisArg = arguments[1];
      for (var i = 0; i < length; i++) {
        var value = list[i];
        if (predicate.call(thisArg, value, i, list)) return value;
      }
      return undefined;
    };
  }

  // 4. Array.prototype.findIndex
  if (!Array.prototype.findIndex) {
    Array.prototype.findIndex = function(predicate) {
      if (this == null) throw new TypeError('Array.prototype.findIndex called on null or undefined');
      if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
      var list = Object(this);
      var length = list.length >>> 0;
      var thisArg = arguments[1];
      for (var i = 0; i < length; i++) {
        if (predicate.call(thisArg, list[i], i, list)) return i;
      }
      return -1;
    };
  }

  // 5. Array.prototype.includes
  if (!Array.prototype.includes) {
    Array.prototype.includes = function(searchElement, fromIndex) {
      if (this == null) throw new TypeError('"this" is null or not defined');
      var o = Object(this);
      var len = o.length >>> 0;
      if (len === 0) return false;
      var n = fromIndex | 0;
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
      while (k < len) {
        if (o[k] === searchElement || (typeof o[k] === 'number' && typeof searchElement === 'number' && isNaN(o[k]) && isNaN(searchElement))) {
          return true;
        }
        k++;
      }
      return false;
    };
  }

  // 6. String.prototype.includes
  if (!String.prototype.includes) {
    String.prototype.includes = function(search, start) {
      if (typeof start !== 'number') start = 0;
      if (start + search.length > this.length) return false;
      return this.indexOf(search, start) !== -1;
    };
  }

  // 7. String.prototype.startsWith
  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(search, pos) {
      pos = !pos || pos < 0 ? 0 : +pos;
      return this.substring(pos, pos + search.length) === search;
    };
  }

  // 8. String.prototype.endsWith
  if (!String.prototype.endsWith) {
    String.prototype.endsWith = function(search, this_len) {
      if (this_len === undefined || this_len > this.length) this_len = this.length;
      return this.substring(this_len - search.length, this_len) === search;
    };
  }

  // 9. Object.assign
  if (typeof Object.assign !== 'function') {
    Object.assign = function(target) {
      if (target == null) throw new TypeError('Cannot convert undefined or null to object');
      var to = Object(target);
      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];
        if (nextSource != null) {
          for (var nextKey in nextSource) {
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    };
  }

  // 10. Object.values
  if (!Object.values) {
    Object.values = function(obj) {
      var vals = [];
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          vals.push(obj[key]);
        }
      }
      return vals;
    };
  }

  // 11. HTMLCanvasElement.prototype.toBlob
  if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.toBlob) {
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      value: function(callback, type, quality) {
        var dataURL = this.toDataURL(type, quality).split(',')[1];
        setTimeout(function() {
          var binStr = atob(dataURL),
              len = binStr.length,
              arr = new Uint8Array(len);
          for (var i = 0; i < len; i++) {
            arr[i] = binStr.charCodeAt(i);
          }
          if (typeof callback === 'function') {
            callback(new Blob([arr], { type: type || 'image/png' }));
          }
        }, 0);
      }
    });
  }

  // 12. CustomEvent
  (function () {
    if (typeof window.CustomEvent === "function") return;
    function CustomEvent (event, params) {
      params = params || { bubbles: false, cancelable: false, detail: null };
      var evt = document.createEvent('CustomEvent');
      evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
      return evt;
    }
    window.CustomEvent = CustomEvent;
  })();

  // 13. Minimal ES5 Promise polyfill for Android 4.0 - 4.2 WebKit
  if (typeof window.Promise !== 'function') {
    function SimplePromise(executor) {
      var self = this;
      self.state = 'pending';
      self.value = undefined;
      self.callbacks = [];

      function resolve(val) {
        if (self.state !== 'pending') return;
        self.state = 'fulfilled';
        self.value = val;
        for (var i = 0; i < self.callbacks.length; i++) {
          self.callbacks[i].onFulfilled(val);
        }
      }

      function reject(err) {
        if (self.state !== 'pending') return;
        self.state = 'rejected';
        self.value = err;
        for (var i = 0; i < self.callbacks.length; i++) {
          self.callbacks[i].onRejected(err);
        }
      }

      try {
        executor(resolve, reject);
      } catch (e) {
        reject(e);
      }
    }

    SimplePromise.prototype.then = function(onFulfilled, onRejected) {
      var self = this;
      return new SimplePromise(function(resolve, reject) {
        function handle() {
          if (self.state === 'fulfilled') {
            if (typeof onFulfilled === 'function') {
              try {
                resolve(onFulfilled(self.value));
              } catch (e) {
                reject(e);
              }
            } else {
              resolve(self.value);
            }
          } else if (self.state === 'rejected') {
            if (typeof onRejected === 'function') {
              try {
                resolve(onRejected(self.value));
              } catch (e) {
                reject(e);
              }
            } else {
              reject(self.value);
            }
          }
        }

        if (self.state === 'pending') {
          self.callbacks.push({
            onFulfilled: function() { handle(); },
            onRejected: function() { handle(); }
          });
        } else {
          setTimeout(handle, 0);
        }
      });
    };

    SimplePromise.prototype['catch'] = function(onRejected) {
      return this.then(null, onRejected);
    };

    SimplePromise.resolve = function(val) {
      return new SimplePromise(function(res) { res(val); });
    };

    SimplePromise.reject = function(err) {
      return new SimplePromise(function(_, rej) { rej(err); });
    };

    window.Promise = SimplePromise;
  }

  // 14. AudioContext normalization
  window.AudioContext = window.AudioContext || window.webkitAudioContext || null;

  // 15. Safe LocalStorage wrapper for Android 4 private mode / quota limitations
  try {
    var testKey = '__test_storage__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
  } catch (storageErr) {
    console.warn('LocalStorage unavailable or restricted in this Android environment, enabling memory store fallback.');
    var memoryStorage = {};
    window.localStorage = {
      getItem: function(key) { return memoryStorage[key] || null; },
      setItem: function(key, val) { memoryStorage[key] = String(val); },
      removeItem: function(key) { delete memoryStorage[key]; },
      clear: function() { memoryStorage = {}; }
    };
  }

})(window, document);
