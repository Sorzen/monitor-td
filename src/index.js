var $ = require('jquery');

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
    // console.log(error);
    var eventId = `${url}${line}${col}`
    config.sendError({
      title: msg,
      msg: {
        resourceUrl: url,
        rowNum: line,
        colNum: col,
        info: error,
        filename: url,
        eventId: eventId,
      },
      category: 'js',
      level: 'error'
    })
    if (_oldWindowError && isFunction(_oldWindowError)) {
      windowError && windowError.apply(window, arguments);
    }
  }

}

var handleRejectPromise = function (_window, config) {
  _window.addEventListener('unhandledrejection', function (event) {
    console.log(event);
    if (event) {
      var reason = event.reason;
      config.sendError({
        title: '不捕获Promise异步错误',
        msg: reason,
        category: 'js',
        level: 'error'
      });
    }
  }, true);
}

// 资源请求错误
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

// 请求错误
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

// ajax请求错误
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


// 捕获控制台打印报错
var handleConsoleError = function (_window, config) {
  if (!_window.console || !_window.console.error) return;

  var _oldConsoleError = _window.console.error;
  _window.console.error = function () {
    config.sendError({
      title: 'consoleError',
      msg: JSON.stringify(arguments),
      category: 'js',
      level: 'error'
    });
    _oldConsoleError && _oldConsoleError.apply(_window, arguments);
  };
}


// vue钩子函数监控报错
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

// var utils = {
//   isFunction,
//   objectMerge,
//   handleWindowError,
//   handleRejectPromise,
//   handleConsoleError,
//   handleResourceError,
//   handleAjaxError,
//   handleVueError,
//   // handleAddListener,
// };


var _window =
    typeof window !== 'undefined' ?
    window :
    typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};
var monitorTd = _window.monitorTd;
if (!monitorTd) {
    var MonitorTdJs= function () {};
    var monitorTd = new MonitorTdJs();
    monitorTd.init = function (options) {
        if (options.errorMonitor) {
            console.log('错误监控执行了');
            var defaultConfig = {
                jsError: true,
                resourceError: true,
                ajaxError: true,
                consoleError: true, // console.error默认不处理
                scriptError: false, // 跨域js错误，默认不处理，因为没有任何信息
                vue: true,
                autoReport: true,
                filters: [], // 过滤器，命中的不上报
                levels: ['info', 'warning', 'error'],
                category: ['js', 'resource', 'ajax']
            }
            var config = objectMerge(defaultConfig, options);

            if (config.scriptError) {
                config.filters.push(function () {
                    return /^Script error\.?$/.test(arguments[0]);
                })
            }

            // 处理过滤器
            // var _oldSendError = config.sendError;
            // config.sendError = function (title, msg, level, category, tags) {
            //     try {
            //         var isFilter = config.filters.some(func => {
            //             return isFunction(func) && func.apply(this, arguments);
            //         })
            //         if (isFilter) {
            //             return
            //         }
            //         _oldSendError.apply(this, arguments);
            //         if (config.autoReport) {
            //             return
            //         }
            //         // TODO ajax上报
            //     } catch (e) {
            //         _oldSendError({
            //             title: 'monitorTd',
            //             msg: e,
            //             category: 'js'
            //         })
            //     }
            // }


            var _window = typeof window !== 'undefined' ? window :
                typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};
            var addEventListener = _window.addEventListener || _window.attachEvent;
            if (config.jsError) {
                handleWindowError(_window, config);
            }
            if (config.jsError) {
                // https://developer.mozilla.org/zh-CN/docs/Web/Events/unhandledrejection
                handleRejectPromise(_window, config);
            }
            if (config.resourceError && addEventListener) {
                handleResourceError(_window, config);
            }
            if (config.ajaxError) {
                handleAjaxError(_window, config);
            }
            if (config.consoleError) {
                handleConsoleError(_window, config);
            }
            if (config.vue) {
                handleVueError(_window, config);
            }
        }
        if (options.performanceMonitor) {
            // var performanceObj = {};
            console.log('性能监控执行了');
            window.addEventListener('load', () => {
              var timeInterval = setInterval(() =>{
                var time = window.performance && window.performance.timing;
                var navigation = window.performance && window.performance.navigation;
                var timingObj = {
                  redirectNums: 0, // 重定向次数
                  redirecttime: 0, // 重定向时间
                  DNSAnalyseTime: 0, // DNS解析时间
                  TCPHandshakeTime: 0, // TCP完成握手时间
                  httpRequestResTime: 0, // HTTP请求响应完成时间
                  domStartLoadingTime: 0, // DOM开始加载前所花费时间
                  domFinishLoadingTime: 0, // DOM加载完成时间
                  domAnalysisCompletionTime: 0, // DOM结构解析完成时间
                  scriptLoadingTime: 0, // 脚本加载时间
                  onLoadEventTime: 0, // onload事件时间
                  pageFinishLoadingTime: 0, // 页面完全加载时间
                };
                var timingObj = {};
                var loadTime = (time.loadEventEnd - time.loadEventStart) / 1000;
                if(loadTime>0) {
                  timingObj.redirectNums = navigation && navigation.redirectCount;
                  timingObj.redirecttimeredirecttime = (time.redirectEnd - time.redirectStart) / 1000;
                  timingObj.DNSAnalyseTime = (time.domainLookupEnd - time.domainLookupStart) / 1000;
                  timingObj.TCPHandshakeTime = (time.connectEnd - time.connectStart) / 1000;
                  timingObj.httpRequestResTime = (time.responseEnd - time.requestStart) / 1000;
                  timingObj.domStartLoadingTime = (time.responseEnd - time.navigationStart) / 1000;
                  timingObj.domFinishLoadingTime = (time.domComplete - time.domLoading) / 1000;
                  timingObj.domAnalysisCompletionTime = (time.domInteractive - time.domLoading) / 1000;
                  timingObj.scriptLoadingTime = (time.domContentLoadedEventEnd - time.domContentLoadedEventStart) / 1000;
                  timingObj.onLoadEventTime = (time.loadEventEnd - time.loadEventStart) / 1000;
                  timingObj.pageFinishLoadingTime = (timingObj.redirecttime + timingObj.DNSAnalyseTime + timingObj.TCPHandshakeTime + timingObj.httpRequestResTime + timingObj.domAnalysisCompletionTime + timingObj.domFinishLoadingTime);
                  timingObj.url = window.location.href;
                  clearInterval(timeInterval);
                  options.sendPerformance(timingObj);
                }
              }, 1000)
              
            });
        }
    }

    var paramsObj = {};
    var doc = document;
    var scripts = doc.scripts;
    var loaderScript = scripts[scripts.length - 1];
    // var src="https://kylenxu.github.io/monitor-td/index.js?errorMonitor=true&performanceMonitor=true&projectId=82b12c829722d727e6ca40b8aa166e43&name=test&errorUrl=http://172.30.104.166:8038/api/errors&performanceError=http://172.30.104.166:8038/api/performance&vue=true";
    loaderScript.src.split('?')[1].split('&').forEach((item)=>{
        paramsObj[item.split('=')[0]] = item.split('=')[1];
    });
    monitorTd.init({
        vue: paramsObj.vue,
        js: paramsObj.js,
        errorMonitor: paramsObj.errorMonitor,
        [performanceMonitor]: paramsObj.performanceMonitor,
        // 监控错误
        sendError: function (error) {
            error.application = window.navigator.userAgent;
            $.ajax({
                xhrFields: {
                    withCredentials: true
                },
                type: "post",
                data: {
                    date: (new Date()).getTime(),
                    projectId: paramsObj.projectId,
                    name: paramsObj.name,
                    eventId: error.msg.eventId || '',
                    error: JSON.stringify(error),
                },
                async: false,
                url: paramsObj.errorUrl,
                dataType: "json",
                success: function (res) {
                    return res;
                    // throw new Error(res.status + ':' + res.statusText);
                },
                error: function (res) {
                    throw new Error(res.status + ':' + res.statusText);
                }
            });
        },
        // 监控性能
        sendPerformance: function (performance) {
            $.ajax({
                xhrFields: {
                    withCredentials: true
                },
                type: "post",
                data: {
                    date: (new Date()).getTime(),
                    projectId: paramsObj.projectId,
                    name: paramsObj.name,
                    url: performance.url,
                    performance: JSON.stringify(performance),
                },
                async: false,
                url: paramsObj.performanceError,
                dataType: "json",
                success: function (res) {
                    return res;
                    // throw new Error(res.status + ':' + res.statusText);
                },
                error: function (res) {
                    throw new Error(res.status + ':' + res.statusText);
                }
            });
        },
    });

}

_window.monitorTd = monitorTd;
// module.exports = monitorTd;