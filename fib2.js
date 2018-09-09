function fib(n) {
  let [a, b] = [0, 1];
  for (let i=0; i<n; ++i) {
    [a, b] = [b, a + b];
  }
  return a;
}
fib(20);

[1,2,3,4,5,6,7,8,9].map(fib);
