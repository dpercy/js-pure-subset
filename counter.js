
function makeCounter() {
  let i = 0;

  // closing over a mutable local variable should fail!
  return function() { return ++i; }
}
const c = makeCounter();
c();
c();
