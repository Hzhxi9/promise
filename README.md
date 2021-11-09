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
