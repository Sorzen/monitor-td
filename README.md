## 概述
实现前端JS错误监控，监控window.onerror，资源加载错误，跨域js错误，ajax请求错误以及捕获vue的errorHandler错误等上报，自定义sendError上报方法

## 开发

*   `npm run build`: 进行本地构建
*   `npm run test`: 进行测试，打开[http://localhost:3000/index.html](http://localhost:3000/index.html)，error日志将写在log.txt里

### 开发目录
src/ - 源码

dist/ - 根据webpack打包的文件

test/ - 测试目录


***

## 文档

### 使用

直接在项目首页进行引入，会在创建项目时生成以下代码，一行代码，开箱即用。（示例代码仅供参考）
```
<script src="https://sorzen.github.io/monitor-td/dist/main.js?errorMonitor=true&performanceMonitor=true&projectId=82b12c829722d727e6ca40b8aa166e43&name=test&errorUrl=http://172.30.104.166:8038/api/errors&performanceError=http://172.30.104.166:8038/api/performance&vue=true&js=true"></script>
```

### 字段说明

对应上面URL地址中参数：

| 属性 | 说明 | 类型 | 默认值 |
| ------ | ------ | ------ | ------ |
| projectId | 项目ID | String | 空 |
| name | 项目名称 | String | 空 |
| errorUrl | 错误监控数据上报地址 | String | 空 |
| performanceError | 性能监控数据上报地址 | String | 空 |
| errorMonitor | 是否进行错误监控 | Boolean | true |
| performanceMonitor | 是否进行性能监控 | Boolean | true |
| vue | 是否进行VUE项目监控 | Boolean | true |
| js | 是否进行JS项目监控 | Boolean | true |


### 特点

- js语法报错

    主要通过window.onerror()进行页面错误监控。
- 异步代码运行报错

    主要通过window.addEventListener('unhandledrejection',fn());进行页面异步代码错误监控。
    
- 资源加载报错

    主要通过window.addEventListener('error',fn());进行页面异步代码错误监控。
    
- 接口请求报错

    主要通过window.fetch();进行接口请求错误监控。

- ajax请求报错
    
    主要通过对window.XMLHttpRequest监控，进行ajax接口请求错误监控。

- 控制台错误信息
  
    主要通过window.console.error();进行控制台错误监控。

    注：html5: console.error会打印日志，显示红色的错误信息，但不会阻挡对下面js的执行。

    windows: onsole.error会阻挡程序执行，js异常就是语法或逻辑错误，比如 this._btn1 = abc; //abc是不存在这样会阻挡后面语句的执行，不单阻挡了本函数，函数的外边的后面代码也不执行了，也就是本次调用堆栈就报废了。


- VUE错误监控
    
    主要通过Vue.config.errorHandler();钩子函数进行VUE错误监控。
    
- 性能监控

    主要检测当前页面完全加载时间、HTTP请求响应完成时间、脚本加载时间等信息。
    
    主要通过window.performance进行页面性能监控。
    
### 致敬

-  一起熬夜的兄弟们
