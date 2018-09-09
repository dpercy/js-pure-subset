
const x = 1;

// error: no mutable bindings at the top level
let y = 2;
y = 123;

function sum(arr) {
  // mutable locals are ok!
  // the function is still pure.
  let total = 0;
  for (let i=0; i<arr.length; ++i) {
    total += arr[i];
  }
  return total;
}

function makeCounter() {
  let i = 0;
  // error: can't close over mutable variable,
  // because that would mean the closure is a mutable value.
  return () => ++i;
}

function callsPush(arr) {
  // compile time warning: you are ignoring the result of this function call
  // runtime error: tried to call an impure function
  arr.push(1);
  arr.push(2);
  arr.push(3);
}
// rewritten to:
function callsPush(arr) {
  __pure_call(arr.push, arr, 1);
  __pure_call(arr.push, arr, 2);
  __pure_call(arr.push, arr, 3);
}
callsPush[IS_PURE_SYMBOL] = true;
// where
function __pure_call(func, self, ...args) {
  if (type func !== 'function') throw Error('tried to call a non-function');
  if (!func[IS_PURE_SYMBOL]) throw Error('tried to call an impure function');
  return func.call(self, ...args);
}
