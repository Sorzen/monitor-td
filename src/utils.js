function isFunction(what) {
  return typeof what === 'function';
}

function isUndefined(what) {
  return what === void 0;
}

function hasKey(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function each(obj, callback) {
  var i, j;

  if (isUndefined(obj.length)) {
    for (i in obj) {
      if (hasKey(obj, i)) {
        callback.call(null, i, obj[i]);
      }
    }
  } else {
    j = obj.length;
    if (j) {
      for (i = 0; i < j; i++) {
        callback.call(null, i, obj[i]);
      }
    }
  }
}

function objectMerge(obj1, obj2) {
  if (!obj2) {
    return obj1;
  }
  each(obj2, function (key, value) {
    obj1[key] = value;
  });
  return obj1;
}

var handleWindowError = function (_window, config) {
  _oldWindowError = _window.onerror;
  _window.onerror = function (msg, url, line, col, error) {
    var eventId = `${url}${line}${col}`
    if (error && error.stack) {
      config.sendError({
        title: msg,
        msg: {
          resourceUrl: url,
          rowNum: line,
          colNum: col,
          info: error.stack,
          filename: url,
          eventId: eventId,
        },
        category: 'js',
        level: 'error'
      });
    } else if (typeof msg === 'string') {
      config.sendError({
        title: msg,
        msg: {
          resourceUrl: url,
          rowNum: line,
          colNum: col,
          info: error.stack,
          userAgent: error.target.userAgent,
          filename: url,
          eventId,
        },
        category: 'js',
        level: 'error'
      });
    }
    if (_oldWindowError && isFunction(_oldWindowError)) {
      windowError && windowError.apply(window, arguments);
    }
  }

}

var handleRejectPromise = function (_window, config) {
  _window.addEventListener('unhandledrejection', function (event) {
    if (event) {
      var reason = event.reason;
      config.sendError({
        title: 'unhandledrejection',
        msg: reason,
        category: 'js',
        level: 'error'
      });
    }
  }, true);
}

var handleResourceError = function (_window, config) {
  _window.addEventListener('error', function (event) {
    if (event) {
      var target = event.target || event.srcElement;
      var isElementTarget = target instanceof HTMLScriptElement || target instanceof HTMLLinkElement || target instanceof HTMLImageElement;
      if (!isElementTarget) return; // js error不再处理

      var url = target.src || target.href;
      config.sendError({
        title: target.nodeName,
        msg: {
          url: url,
          eventId: url,
        },
        category: 'resource',
        level: 'error',
      });
    }
  }, true);
}

var _handleFetchError = function (_window, config) {
  if (!_window.fetch) return;
  let _oldFetch = _window.fetch;
  _window.fetch = function () {
    return _oldFetch.apply(this, arguments)
      .then(res => {
        if (!res.ok) { // True if status is HTTP 2xx
          config.sendError({
            title: arguments[0],
            msg: res,
            category: 'ajax',
            level: 'error'
          });
        }
        return res;
      })
      .catch(error => {
        config.sendError({
          title: arguments[0],
          msg: {
            message: error.message,
            stack: error.stack
          },
          category: 'ajax',
          level: 'error'
        });
        throw error;
      })
  }
}

var handleAjaxError = function (_window, config) {
  var protocol = _window.location.protocol;
  if (protocol === 'file:') return;

  // 处理fetch
  _handleFetchError(_window, config);

  // 处理XMLHttpRequest
  if (!_window.XMLHttpRequest) {
    return;
  }
  var xmlhttp = _window.XMLHttpRequest;

  var _oldSend = xmlhttp.prototype.send;
  var _handleEvent = function (event) {
    if (event && event.currentTarget && event.currentTarget.status !== 200) {
      config.sendError({
        title: event.target.responseURL,
        msg: {
          response: event.target.response,
          responseURL: event.target.responseURL,
          status: event.target.status,
          statusText: event.target.statusText,
          eventId: event.target.responseURL,
        },
        category: 'ajax',
        level: 'error'
      });
    }
  }
  xmlhttp.prototype.send = function () {
    if (this['addEventListener']) {
      this['addEventListener']('error', _handleEvent);
      this['addEventListener']('load', _handleEvent);
      this['addEventListener']('abort', _handleEvent);
    } else {
      var _oldStateChange = this['onreadystatechange'];
      this['onreadystatechange'] = function (event) {
        if (this.readyState === 4) {
          _handleEvent(event);
        }
        _oldStateChange && _oldStateChange.apply(this, arguments);
      };
    }
    return _oldSend.apply(this, arguments);
  }
}

var handleConsoleError = function (_window, config) {
  if (!_window.console || !_window.console.error) return;

  var _oldConsoleError = _window.console.error;
  _window.console.error = function () {
    config.sendError({
      title: 'consoleError',
      msg: JSON.stringify(arguments.join(',')),
      category: 'js',
      level: 'error'
    });
    _oldConsoleError && _oldConsoleError.apply(_window, arguments);
  };
}

var handleVueError = function (_window, config) {
  var vue = _window.Vue;
  if (!vue || !vue.config) return; // 没有找到vue实例
  var _oldVueError = vue.config.errorHandler;

  Vue.config.errorHandler = function VueErrorHandler(error, vm, info) {
    var metaData = {};
    if (Object.prototype.toString.call(vm) === '[object Object]') {
      metaData.componentName = vm._isVue ? vm.$options.name || vm.$options._componentTag : vm.name;
      metaData.propsData = vm.$options.propsData;
    }
    config.sendError({
      title: 'vue Error',
      msg: {
        meta: metaData,
        info,
      },
      category: 'js',
      level: 'error'
    });

    if (_oldVueError && isFunction(_oldVueError)) {
      _oldOnError.call(this, error, vm, info);
    }
  };
}



// 性能监控
// function handleAddListener(type, fn) {
//   if(window.addEventListener) {
//     window.addEventListener(type, fn)
//   } else {
//     window.attachEvent('on' + type, fn)
//   }
// }


// function getTiming(callback) {
//   try {
//     var time = window.performance && window.performance.timing;
//     var navigation = window.performance && window.performance.navigation;
//     var timingObj = {
//       redirectNums: 0, // 重定向次数
//       redirecttime: 0, // 重定向时间
//       DNSAnalyseTime: 0, // DNS解析时间
//       TCPHandshakeTime: 0, // TCP完成握手时间
//       httpRequestResTime: 0, // HTTP请求响应完成时间
//       domStartLoadingTime: 0, // DOM开始加载前所花费时间
//       domFinishLoadingTime: 0, // DOM加载完成时间
//       domAnalysisCompletionTime: 0, // DOM结构解析完成时间
//       scriptLoadingTime: 0, // 脚本加载时间
//       onLoadEventTime: 0, // onload事件时间
//       pageFinishLoadingTime: 0, // 页面完全加载时间
//     };
//     // var timingObj = {};
//     var loadTime = (time.loadEventEnd - time.loadEventStart) / 1000;

//     if(loadTime <= 0) {
//       setTimeout(function() {
//         getTiming();
//       }, 200);
//       return;
//     }

//     // timingObj.redirectNums = navigation && navigation.redirectCount;
//     // timingObj.redirecttime = (time.redirectEnd - time.redirectStart) / 1000;
//     // timingObj.DNSAnalyseTime = (time.domainLookupEnd - time.domainLookupStart) / 1000;
//     // timingObj.TCPHandshakeTime = (time.connectEnd - time.connectStart) / 1000;



//     console.log(time);
//     timingObj.redirectNums = navigation && navigation.redirectCount;
//     timingObj.redirecttimeredirecttime = (time.redirectEnd - time.redirectStart) / 1000;
//     timingObj.DNSAnalyseTime = (time.domainLookupEnd - time.domainLookupStart) / 1000;
//     timingObj.TCPHandshakeTime = (time.connectEnd - time.connectStart) / 1000;
//     timingObj.httpRequestResTime = (time.responseEnd - time.requestStart) / 1000;
//     timingObj.domStartLoadingTime = (time.responseEnd - time.navigationStart) / 1000;
//     timingObj.domFinishLoadingTime = (time.domComplete - time.domLoading) / 1000;
//     timingObj.domAnalysisCompletionTime = (time.domInteractive - time.domLoading) / 1000;
//     timingObj.scriptLoadingTime = (time.domContentLoadedEventEnd - time.domContentLoadedEventStart) / 1000;
//     timingObj.onLoadEventTime = (time.loadEventEnd - time.loadEventStart) / 1000;
//     timingObj.pageFinishLoadingTime = (timingObj.redirecttime + timingObj.DNSAnalyseTime + timingObj.TCPHandshakeTime + timingObj.httpRequestResTime + timingObj.domAnalysisCompletionTime + timingObj.domFinishLoadingTime);

//     // for(item in timingObj) {
//     //   console.log(item + ":" + timingObj[item] + '毫秒(ms)');
//     // }
//     // return timingObj;
//     console.log(timingObj);
//     callback(timingObj);
//   } catch(e) {
//     console.log('test:'+timingObj)
//     console.log('timing:'+performance.timing);
//   }
// }




module.exports = {
  isFunction,
  objectMerge,
  handleWindowError,
  handleRejectPromise,
  handleConsoleError,
  handleResourceError,
  handleAjaxError,
  handleVueError,
  // handleAddListener,
  // getTiming,
};