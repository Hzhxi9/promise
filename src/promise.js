/**定义三个变量表示状态 */
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

class Promises {
  constructor(executor) {
    /**执行器, 进入会立即执行,并传入 resolve 和 reject */
    try {
      executor(this.resolve, this.reject);
    } catch (error) {
      /**如果发生错误, 就直接执行 reject */
      this.reject(error);
    }
  }

  /**存储状态的变量, 初始值是 pending */
  status = PENDING;
  /**成功之后的值 */
  value = null;
  /**失败之后原因 */
  reason = null;

  /**缓存成功与失败回调 */

  /**存储成功回调函数 */
  onFulfilledCallbacks = [];
  /**存储失败回调函数 */
  onRejectedCallbacks = [];

  /**
   * resolve 和 reject 用箭头函数的原因:
   * 直接调用的话, 普通函数this 指向的是 window 或者 undefined
   * 用箭头函数就可以让this 指向当前实例对象
   */

  /**更改成功后的状态 */
  resolve = value => {
    /**
     * 只有状态是等待时才执行状态修改
     * 对应规范中的状态只能由pending到fulfilled或rejected"
     **/
    if (this.status === PENDING) {
      /**修改状态为成功 */
      this.status = FULFILLED;
      /**保存成功之后的值 */
      this.value = value;
      /**resolve里面将所有成功的回调拿出来执行 */
      while (this.onFulfilledCallbacks.length) {
        /**
         * Array.shift() 取出数组第一个元素，然后（）调用,shift不是纯函数，取出后，数组将失去该元素，直到数组为空
         *
         * 之所以使用一个队列来存储回调, 是为了实现规范要求 then 方法可以被同一个 promise 调用多次
         * 如果使用一个变量而非队列来储存回调,那么即使多次p1.then()也只会执行一次回调
         **/
        this.onFulfilledCallbacks.shift()(value);
      }
    }
  };

  /**更改失败后的状态 */
  reject = reason => {
    /**只有状态是等待时才执行状态修改 */
    if (this.status === PENDING) {
      /**修改状态为失败 */
      this.status = REJECTED;
      /**保存失败之后的原因 */
      this.reason = reason;
      /**reject里面将所有失败的回调拿出来执行 */
      while (this.onRejectedCallbacks.length) {
        /**Array.shift() 取出数组第一个元素，然后（）调用,shift不是纯函数，取出后，数组将失去该元素，直到数组为空 */
        this.onRejectedCallbacks.shift()(reason);
      }
    }
  };

  /**resolve 静态方法 */
  static resolve(parameter) {
    /**传入 自身类就直接返回 */
    if (parameter instanceof Promises) return parameter;
    /**转成常规方式 */
    return new Promises(resolve => resolve(parameter));
  }

  /**reject 静态方法 */
  static reject(reason) {
    return new Promises((resolve, reject) => reject(reason));
  }

  /**
   * race 静态方法
   * 返回一个 promise, 一旦迭代器中的某个promise resolve or reject, 返回的 promise 就会解决 或 拒绝
   **/
  static race(promises) {
    // return new Promises((resolve, reject) => {
    //   for (let i = 0, len = promises.length; i < len; i++) promises[i].then(resolve, reject);
    // });
    return new Promises((resolve, reject) => {
      /**同时执行 Promise, 如果有个promise状态发生改变, 就变更 Promises 的状态 */
      for (const p of promises) {
        /**Promise.resolve(p)用于处理传入值不为Promise的情况 */
        Promises.resolve(p).then(
          /**意这个resolve是上边new MyPromise的 */
          value => resolve(value),
          error => reject(error)
        );
      }
    });
  }

  /**
   * all 静态方法 => 获取所有的promise，都执行then，把结果放到数组，一起返回
   * 返回一个 Promise 实例, 此实例在 iterable 参数内所有的 promise 都 resolve 或参数中不包含 promise 时回调完成(resolve)
   * 如果promise中有个reject, 此实例回调 reject, 失败原因的是第一个promise的结果
   **/
  static all(promises) {
    // const arr = [];
    // let i = 0;
    // function processData(index, data, resolve) {
    //   arr[index] = data;
    //   i++;
    //   if (i === promises.length) resolve(arr);
    // }

    // return new Promises((resolve, reject) => {
    //   for (let i = 0, len = promises.length; i < len; i++) {
    //     promises[i].then(data => {
    //       processData(i, data, resolve);
    //     }, reject);
    //   }
    // });
    let index = 0,
      result = [];
    return new Promises((resolve, reject) => {
      promises.forEach((p, i) => {
        /**Promise.resolve(p)用于处理传入值不为Promise的情况 */
        Promises.resolve(p).then(
          value => {
            index++;
            result[i] = value;
            /**所有 then 执行后, resolve 结果 */
            if (index === promises.length) resolve(result);
          },
          error => {
            /**有一个Promise被reject时，MyPromise的状态变为reject */
            reject(error);
          }
        );
      });
    });
  }

  /**
   * allSettled 静态方法 => 方法返回一个在所有给定的promise已被决议或被拒绝后决议的Promise
   * 并带有一个对象数组，每个对象表示对应的promise结果。
   */
  static allSettled(promises) {
    let result = [],
      index = 0;
    return new Promises((resolve, reject) => {
      promises.map((p, i) => {
        Promises.resolve(p).then(
          value => {
            index++;
            result[i] = { value, status: FULFILLED };
            if (index === promises.length) resolve(result);
          },
          reason => {
            index++;
            result[i] = { reason, status: REJECTED };
            if (index === promises.length) resolve(result);
          }
        );
      });
    });
  }

  /**
   * 接收一个Promise.all()是相反的。
   * 当任何一个被传入的 promise 完成的时候, 无论其他的 promises 完成还是被拒绝，返回的这个 promise 都会带着已完成的那个 promise 的值异步完成。
   */
  static any(promises) {
    let index = 0,
      result = null;
    return new Promises((resolve, reject) => {
      promises.forEach((p, i) => {
        /**Promise.resolve(p)用于处理传入值不为Promise的情况 */
        Promises.resolve(p).then(
          value => {
            index++;
            result = value;
            resolve(result)
            /**所有 then 执行后, resolve 结果 */
            
          },
          error => {
            /**有一个Promise被reject时，MyPromise的状态变为reject */
            index++;
          }
        );
      });
    });
  }

  /**catch 方法 => 返回一个 Promise, 并且处理拒绝的情况 */
  catch(reject) {
    /**本质就是 执行一下 then 的第二个回调 */
    return this.then(undefined, reject);
  }

  /**
   * finally 方法
   * 意义: finally()如果return了一个reject状态的Promise，将会改变当前Promise的状态
   * 这个Promises.resolve就用于改变Promise状态，在finally()没有返回reject态Promise或throw错误的情况下，去掉Promises.resolve也是一样的
   **/
  finally(callback) {
    return this.then(
      /**Promises.resolve执行回调,并在then中return结果传递给后面的Promise */
      value => Promises.resolve(callback()).then(() => value),
      reason =>
        Promises.resolve(callback()).then(() => {
          throw reason;
        })
    );
  }

  then(onFulfilled, onRejected) {
    /**
     * 如果不传, 就使用默认函数
     * 根据规范, 如果then参数不是函数, 则需要忽略它, 让链式调用继续往下执行
     **/
    const realOnFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value;
    const realOnRejected =
      typeof onRejected === 'function'
        ? onRejected
        : reason => {
            throw reason;
          };

    /**为了实现链式调用这里直接创建一个promise类,并在后面 return 出去 */
    const promises2 = new Promises((resolve, reject) => {
      /**抽离成功微任务调用 */
      const fulfilledMicrotask = () => {
        /**创建一个微任务等待 promises2 完成初始化 */
        queueMicrotask(() => {
          try {
            /**
             * 调用成功回调, 并且把值返回
             * 执行第一个(当前)的Promise的成功回调, 并获取返回值
             **/
            const x = realOnFulfilled(this.value);
            /**
             * resolvePromises =>
             *  1. 分类讨论返回值, 如果是Promise, 那么等待Promise状态变更, 否则直接resolve
             *  2. 这里 resolve 之后, 就能被下一个 then 的回调获取到返回值, 从而实现链式调用
             * 传入 resolvePromises 集中处理
             * */
            resolvePromises(promises2, x, resolve, reject);
          } catch (error) {
            reject(error);
          }
        });
      };

      /**抽离失败微任务调用 */
      const rejectedMicrotask = () => {
        /**创建一个微任务等待 promises2 完成初始化 */
        queueMicrotask(() => {
          try {
            /**调用失败回调, 并且把原因返回 */
            const x = realOnRejected(this.reason);
            /**传入 resolvePromises 集中处理 */
            resolvePromises(promises2, x, resolve, reject);
          } catch (error) {
            reject(error);
          }
        });
      };

      /**
       * 这里的内容在执行器中, 会理解执行
       * 判断状态
       */
      switch (this.status) {
        case FULFILLED:
          /**当状态已经变为resolve时,直接执行then回调 */
          fulfilledMicrotask();
          break;
        case REJECTED:
          /**当状态已经变为reject时,直接执行then回调 */
          rejectedMicrotask();
          break;
        case PENDING:
          /**
           * 因为不知道后续状态的变化情况,
           * 所以将成功和失败的回调函数存储起来
           * 等到执行成功失败函数的时候在传递
           *
           * 当状态为pending时,把then回调push进resolve/reject执行队列,等待执行
           * 把后续then收集的依赖都push进当前Promise的成功回调队列和失败回调队列中(_rejectQueue), 这是为了保证顺序调用
           */
          this.onFulfilledCallbacks.push(fulfilledMicrotask);
          this.onRejectedCallbacks.push(rejectedMicrotask);
          break;
      }
    });

    return promises2;
  }
}

function resolvePromises(p2, x, resolve, reject) {
  /**
   * 循环引用报错
   * 如果相等, 说明return的是自己, 抛出类型错误并返回
   */
  if (p2 === x) return reject(new TypeError('Chaining cycle detected for promise #<Promise>'));

  if (typeof x === 'object' || typeof x === 'function') {
    /**x 为 null 时, 直接返回, 走后面流程的逻辑会报错 */
    if (x === null) return resolve(x);

    /**A+ 规定, 声明 then = x 的then方法 */
    let then;
    try {
      /**把 x.then 赋值给 then */
      then = x.then;
    } catch (error) {
      /**如果取 x.then 赋值的时候出现错误, 则以 error 为原因拒绝 promise */
      return reject(error);
    }

    if (typeof then === 'function') {
      /**then 为 函数时, 就默认是 promise 方法*/
      let called = false;

      try {
        /** 让 then 执行 第一个参数是 this,后面是 成功回调 和 失败回调 */
        then.call(
          /**this 指向 x */
          x,
          /**如果 resolvePromises 以 y 为参数被调用, 则运行[[Resolve]](p2, y) */
          y => {
            /**
             * 如果 resolvePromises 和 rejectPromise 均被调用,
             * 或者被同一个参数调用了多次, 则优先采用首次调用并忽略剩下的调用
             * 实现这条需要前面加一个变量 called
             *
             * 成功和失败只能调用一个
             */
            if (called) return;
            called = true;
            /**resolve 的结果依旧是 promise, 那就继续解析 */
            resolvePromises(p2, y, resolve, reject);
          },
          /**如果rejectPromise 因r为参数被调用, 则以 r 参数拒绝 promise */
          r => {
            /** 成功和失败只能调用一个 */
            if (called) return;
            called = true;
            reject(r);
          }
        );
      } catch (error) {
        /**
         * 如果 调用 then 方法判出了异常 error
         * 如果 resolvePromise 或 rejectPromise 已经被调用, 直接返回
         */
        if (called) return;

        /**否则以error 为原因拒绝 promise */
        reject(error);
      }
    } else {
      /**then 不是函数, 以 x 为参数执行 promise */
      resolve(x);
    }
  } else {
    /**x 不是 对象或者函数, 以 x 为参数执行 promise */
    resolve(x);
  }
}

/**添加 deferred 进行 Promise A+ 测试*/
Promises.deferred = function () {
  var result = {};
  result.promise = new Promises(function (resolve, reject) {
    result.resolve = resolve;
    result.reject = reject;
  });
  return result;
};

module.exports = Promises;
