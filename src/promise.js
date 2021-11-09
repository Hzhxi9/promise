/**定义三个变量表示状态 */
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

class Promises {
  constructor(executor) {
    /**
     * 执行器, 进入会立即执行
     * 并传入 resolve 和 reject
     **/
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
    /**只有状态是等待时才执行状态修改 */
    if (this.status === PENDING) {
      /**修改状态为成功 */
      this.status = FULFILLED;
      /**保存成功之后的值 */
      this.value = value;
      /**resolve里面将所有成功的回调拿出来执行 */
      while (this.onFulfilledCallbacks.length) {
        /**Array.shift() 取出数组第一个元素，然后（）调用,shift不是纯函数，取出后，数组将失去该元素，直到数组为空 */
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

  /**race 静态方法 */
  static race(promises) {
    return new Promises((resolve, reject) => {
      for (let i = 0, len = promises.length; i < len; i++) promises[i].then(resolve, reject);
    });
  }

  /**all 静态方法 => 获取所有的promise，都执行then，把结果放到数组，一起返回 */
  static all(promises) {
    const arr = [];
    let i = 0;
    function processData(index, data,resolve) {
      arr[index] = data;
      i++;
      if (i === promises.length) resolve(arr);
    }

    return new Promises((resolve, reject) => {
      for (let i = 0, len = promises.length; i < len; i++) {
        promises[i].then(data => {
          processData(i, data, resolve);
        }, reject);
      }
    });
  }

  then(onFulfilled, onRejected) {
    /**如果不传, 就使用默认函数 */
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
            /**调用成功回调, 并且把值返回 */
            const x = realOnFulfilled(this.value);
            /**传入 resolvePromises 集中处理 */
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
          fulfilledMicrotask();
          break;
        case REJECTED:
          rejectedMicrotask();
          break;
        case PENDING:
          /**
           * 因为不知道后续状态的变化情况,
           * 所以将成功和失败的回调函数存储起来
           * 等到执行成功失败函数的时候在传递
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
