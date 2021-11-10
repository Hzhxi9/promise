一、 分析 Promise 调用

1. Promise 的构造函数接收一个 executor(), 在`new Promise()`时就立刻执行这个 executor 回调
2. executor() 内部的异步任务被放入宏/微任务队列, 等待执行
3. then() 被执行, 收集成功/失败回调, 放入成功/失败队列
4. executor() 的异步任务被执行, 触发 resolve / reject, 从成功/失败队列中取出回调依次执行

这是一种观察者模式, 这种 收集依赖 -> 触发通知 -> 取出依赖执行的方式, 被广泛运用于观察者模式的实现

在 Promise 里, 执行顺序是 then 收集依赖 -> 异步出发 resolve -> resolve 执行依赖

二、 Promise A+ 规范

ES6 的 Promise 实现需要遵循 [Promise A+](https://promisesaplus.com/), 是规范对 Promise 的状态控制做了要求

总结亮点就是:

> 1. Promise 本质就是状态机, 且状态只能为以下三种: PENDING(等待态)、FULFILLED(执行态)、REJECTED(拒绝态), 状态的变更是单向的, 只能从 PENDING -> FULFILLED 或者 PENDING -> REJECTED, 状态变更不可逆
> 2. then 接收两个可选参数, 分别对应状态改变时触发的回调, then 方法返回一个 promise。 then 方法可以被用一个 promise 调用多次

三、 then 的链式调用实现

1. then() 需要返回一个 Promise, 这样才能找到 then 方法, 所以需要把 then 方法的返回值包装成 Promise
2. then() 的回调需要拿到上一个 then 的返回值
3. then() 的回调需要顺序执行

四、 值穿透 && 状态已变更的情况

1. 值穿透: 根据规范, 如果 then() 接收的参数不是 function, 那么我们应该忽略它。 如果没有忽略, 当 then 回调不为 function 时将会抛出异常, 导致链式调用中断

2. 处理状态为 resolve/reject 的情况:

   - 存在 PENDING -> FULFILLED / REJECTED 状态的转变
   - 存在 resolve / reject 在 then() 之前就被执行(比如 Promise.resolve().then()), 如果这个时候还把 then()回调 push 到 resolve/reject 执行队列中, 那么回调将不会被执行, 因此对于状态已经变为 FULFILLED 或者 REJECTED 的情况, 执行执行 then 回调

五、 兼容同步任务

因为 Promise 的执行顺序是 new Promise -> then() 收集回调 -> resolve/reject 执行回调, 这一顺序是建立在 executor 是异步任务的前提上的

如果 executor 是一个同步任务, 那么顺序就会变成 new Promise -> resolve/reject 执行回调 -> then() 收集依赖, resolve 的执行跑到了 then 之前

为了兼容这种情况, 给 resolve/reject 执行回调的操作包一个 setTimeout, 让它异步执行

1. 最长递增子序列在 vue 中的应用

以下元素 在 vue 中怎么变换

old a b c d e f g
new a b e d c h f g

2. 高调解释 VDOM DIFF
3. TDD 测试驱动开发
4. 最小堆在 React 任务调度中的应用

六、 async/await 实现

async/await 实际上是对 generator(生成器)的封装, 是一个语法糖

> ES6 新引入了 Generator 函数, 可以通过 yield 关键字, 把函数的执行流挂起, 通过 next()方法可以切换到下一个状态, 为改变执行流程提供了可能, 从而为异步编程提供解决方案

```js
function* gen() {
  yield '1';
  yield '2';
  yield '3';
}
const g = gen(); /**获取迭代器*/
gen.next(); /**{value: "1", done: false}*/
gen.next(); /**{value: "2", done: false}*/
gen.next(); /**{value: "3", done: true}*/

function* gen1() {
  console.log(yield '1'); // test1
  console.log(yield '2'); // test2
  console.log(yield '3'); // test3
}
const g1 = gen1(); /**获取迭代器*/
gen1.next();
gen1.next('test1');
gen1.next('test2');
gen1.next('test3');
```

\*/yield 和 async/await 都提供了暂停执行的功能,但两者又三点不同

- async/await 自带执行器, 不需要手动调用 next() 就能自动执行下一步
- async 函数返回值是 Promise 对象, 而 Generator 返回的是生成器对象
- await 能够返回 Promise 的 resolve / reject 的值

七、 自动执行

我们希望生成器函数能自动往下执行, 且 yield 能返回 resolve 的值

1. 我们封装了一个 run 方法，run 方法里我们把执行下一步的操作封装成\_next()，
2. 每次 Promise.then()的时候都去执行\_next()，实现自动迭代的效果。
3. 在迭代的过程中，我们还把 resolve 的值传入 gen.next()，使得 yield 得以返回 Promise 的 resolve 的值

> 是不是只有.then 方法这样的形式才能完成我们自动执行的功能呢？答案是否定的，yield 后边除了接 Promise，还可以接 thunk 函数，thunk 函数不是一个新东西，所谓 thunk 函数，就是单参的只接受回调的函数。
> 无论是 Promise 还是 thunk 函数，其核心都是通过传入回调的方式来实现 Generator 的自动执行。

```js
function run(gen) {
  /**
   * 由于每次gen()获取到的都是最新的迭代器,
   * 因此获取迭代器操作要放在_next()之前, 否则会进入死循环
   */
  const g = gen();
  /**封装一个方法, 递归执行g.next()*/
  function _next(val) {
    /**获取迭代器对象, 并返回resolve的值*/
    const res = g.next(val);
    /**递归终止条件*/
    if (res.done) return res.value;
    /**Promise 的then方法是实现自动执行的前提*/
    res.value.then(val => {
      /**
       * 等待Promise完成就自动执行下一个next
       * 并传入resolve的值
       */
      _next(val);
    });
  }
  /**第一次执行*/
  _next();
}

function* gen() {
  console.log(yield Promise.resolve(1)); // 1
  console.log(yield Promise.resolve(2)); // 2
  console.log(yield Promise.resolve(3)); // 3
}
run(gen);
```

八、 返回 Promise && 异常处理

1. 需要兼容基本类型: 这段代码能自动执行的前提是 yield 后面跟着 Promise, 为了兼容后面跟着基本类型值的情况, 我们需要吧 yield 跟的内容(gen().next.value)都用 Promise.resolve()转化一遍
2. 缺少错误处理: 上边代码里的 Promise 如果执行失败，就会导致后续执行直接中断，我们需要通过调用 Generator.prototype.throw()，把错误抛出来，才能被外层的 try-catch 捕获到
3. 返回值是 Promise: async/await 的返回值是一个 Promise，我们这里也需要保持一致，给返回值包一个 Promise

```js
function run(gen) {
  /**把返回值包装成Promise*/
  return new Promise((resolve, reject) => {
    const g = gen();
    function _next(value) {
      /**错误处理*/
      try {
        const res = g.next(value);
      } catch (error) {
        return reject(err);
      }
      if (res.done) return resolve(res.value);
      /**res.value 包装成Promise, 以兼容yield后面跟着基本类型的情况*/
      Promise.resolve(res.value).then(
        val => {
          _next(val);
        },
        err => {
          /**抛出错误*/
          g.throw(err);
        }
      );
    }
    _next();
  });
}

function* gen() {
  try {
    console.log(yield Promise.resolve(1));
    console.log(yield 2);
    console.log(yield Promise.reject('error'));
  } catch (error) {
    console.log(error);
  }
}
const result = run(gen); // result是一个Promise
// 1 2 error
```

babel 对 async/await 的转化结果

```js
/**相当于run*/
function _asyncToGenerator(fn) {
  /**
   * return 一个function 和async保持一致
   * 我们的run直接执行generator, 其实是不规范的
   */
  return function () {
    var self = this;
    var args = arguments;
    return new Promise(function (resolve, reject) {
      var gen = fn.apply(self, args);
      /**相当于我们的_next*/
      function _next(value) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, 'next', value);
      }
      /**处理异常*/
      function _throw(err) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, 'throw', err);
      }
      _next(undefined);
    });
  };
}

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
  try {
    var info = gen[key](arg);
    var value = info.value;
  } catch (error) {
    reject(error);
    return;
  }
  if (info.done) resolve(value);
  else Promise.resolve(value).then(_next, _throw);
}

const foo = _asyncToGenerator(function* () {
  try {
    console.log(yield Promise.resolve(1)); // 1
    console.log(yield 2); // 2
    return '3';
  } catch (error) {
    console.log(error);
  }
});

foo().then(res => {
  console.log(res);
});
```

有关 await 暂停执行的秘密，我们还要到 Generator 的实现中去寻找答案

九、 Generator 实现

1. 简单的 Generator 使用实例

```js
function* foo() {
  yield 'result1';
  yield 'result2';
  yield 'result3';
}

const gen = foo();
console.log(gen.next().value);
console.log(gen.next().value);
console.log(gen.next().value);
```

我们可以在[babel](https://babeljs.io/repl/#?browsers=&build=&builtIns=false&corejs=3.6&spec=false&loose=false&code_lz=GYVwdgxgLglg9mAVAAmHOAKAlMg3gKGWQE8YBTAGwBNkByAJzIGcQKoBGWwk86uxlmwBMXIqUo0GzVlADMXAL7d8EBEyjIA5mTDIAvKnTYVauBTIA6CnE0ZtYC2DIAPKNgsA3AIYUQZLCZgTGaW1rb2ji5uWJ4-fgGqQSFWNnY6ka7u3r7-QA&debug=false&forceAllTransforms=false&shippedProposals=false&circleciRepo=&evaluate=false&fileSize=false&timeTravel=false&sourceType=module&lineWrap=true&presets=es2015%2Creact%2Cstage-2&prettier=false&targets=&version=7.5.5&externalPlugins=&assumptions=%7B%7D)官网上在线转化这段代码，看看 ES5 环境下是如何实现 Generator 的：

```js
'use strict';

var _marked =
  /*#__PURE__*/
  regeneratorRuntime.mark(foo);

function foo() {
  return regeneratorRuntime.wrap(function foo$(_context) {
    while (1) {
      switch ((_context.prev = _context.next)) {
        case 0:
          _context.next = 2;
          return 'result1';

        case 2:
          _context.next = 4;
          return 'result2';

        case 4:
          _context.next = 6;
          return 'result3';

        case 6:
        case 'end':
          return _context.stop();
      }
    }
  }, _marked);
}

var gen = foo();
console.log(gen.next().value);
console.log(gen.next().value);
console.log(gen.next().value);
```

代码咋一看不长，但如果仔细观察会发现有两个不认识的东西 —— regeneratorRuntime.mark 和 regeneratorRuntime.wrap，这两者其实是 regenerator-runtime 模块里的两个方法，regenerator-runtime 模块来自 facebook 的 [regenerator](https://github.com/facebook/regenerator) 模块，完整代码在 runtime.js。

2. regeneratorRuntime.mark()

regeneratorRuntime.mark(foo)这个方法在第一行被调用，我们先看一下 runtime 里 mark()方法的定义

```js
//runtime.js里的定义稍有不同，多了一些判断，以下是编译后的代码
runtime.mark = function (genFun) {
  genFun.__proto__ = GeneratorFunctionPrototype;
  genFun.prototype = Object.create(Gp);
  return genFun;
};
```

这里边 GeneratorFunctionPrototype 和 Gp 我们都不认识，他们被定义在 runtime 里，不过没关系，我们只要知道 mark()方法为生成器函数（foo）绑定了一系列原型就可以了，这里就简单地过了

3. regeneratorRuntime.wrap()

从上面 babel 转化的代码我们能看到，执行 foo()，其实就是执行 wrap()，那么这个方法起到什么作用呢，他想包装一个什么东西呢，我们先来看看 wrap 方法的定义：

```js
//runtime.js里的定义稍有不同，多了一些判断，以下是编译后的代码
function wrap(innerFn, outerFn, self) {
  var generator = Object.create(outerFn.prototype);
  var context = new Context([]);
  generator._invoke = makeInvokeMethod(innerFn, self, context);

  return generator;
}
```

代码分析:

- wrap 方法创建了一个 generator, 并继承 outFun.prototype;
- new 一个 context 对象
- makeInvokeMethod 方法接收 innerFn(对应 foo$)、context 和 this, 并把返回值挂到 generator.invoke 上
- return 了 generator

总结: 其实 wrap()相当于是给 generator 增加了一个\_invoke 方法

- outerFn.prototype 其实就是 genFun.prototype
- context 可以直接理解为这样一个全局对象，用于储存各种状态和上下文：

```js
var ContinueSentinel = {};

var context = {
  done: false,
  method: 'next',
  next: 0,
  prev: 0,
  abrupt: function (type, arg) {
    var record = {};
    record.type = type;
    record.arg = arg;

    return this.complete(record);
  },
  complete: function (record, afterLoc) {
    if (record.type === 'return') {
      this.rval = this.arg = record.arg;
      this.method = 'return';
      this.next = 'end';
    }

    return ContinueSentinel;
  },
  stop: function () {
    this.done = true;
    return this.rval;
  },
};
```

- makeInvokeMethod 的定义如下，它 return 了一个 invoke 方法，invoke 用于判断当前状态和执行下一步，其实就是我们调用的 next()

```js
//以下是编译后的代码
function makeInvokeMethod(innerFn, context) {
  // 将状态置为start
  var state = 'start';
  return function invoke(method, arg) {
    // 已完成
    if (state === 'completed') {
      return { value: undefined, done: true };
    }

    context.method = method;
    context.arg = arg;

    // 执行中
    while (true) {
      state = 'executing';

      var record = {
        type: 'normal',
        arg: innerFn.call(self, context), // 执行下一步,并获取状态(其实就是switch里边return的值)
      };

      if (record.type === 'normal') {
        // 判断是否已经执行完成
        state = context.done ? 'completed' : 'yield';
        // ContinueSentinel其实是一个空对象,record.arg === {}则跳过return进入下一个循环
        // 什么时候record.arg会为空对象呢, 答案是没有后续yield语句或已经return的时候,也就是switch返回了空值的情况(跟着上面的switch走一下就知道了)
        if (record.arg === ContinueSentinel) {
          continue;
        }
        // next()的返回值
        return {
          value: record.arg,
          done: context.done,
        };
      }
    }
  };
}
```

- 为什么 generator.\_invoke 实际上就是 gen.next 呢，因为在 runtime 对于 next()的定义中，next()其实就 return 了\_invoke 方法

```js
// Helper for defining the .next, .throw, and .return methods of the
// Iterator interface in terms of a single ._invoke method.
function defineIteratorMethods(prototype) {
  ['next', 'throw', 'return'].forEach(function (method) {
    prototype[method] = function (arg) {
      return this._invoke(method, arg);
    };
  });
}

defineIteratorMethods(Gp);
```
