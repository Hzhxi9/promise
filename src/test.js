const Promises = require('./promise');

const p = new Promises((resolve, reject) => {
  throw new Error('执行器错误');
});

// 第一个then方法中的错误要在第二个then方法中捕获到
// p.then()
//   .then()
//   .then(
//     value => {
//       console.log(3);
//       console.log(value);
//     },
//     reason => {
//       console.log(4);
//       console.log(reason.message);
//     }
//   );

const p1 = new Promises((resolve, reject) => {
  setTimeout(() => resolve(3), 2000);
});

const p2 =  new Promises((resolve, reject) => {
  setTimeout(() => resolve(4), 3000);
});

Promises.all([p1, p2]).then(res => console.log(res))

Promises.race([p1, p2]).then((res) => {
  console.log(res);
});
