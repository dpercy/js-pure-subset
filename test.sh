#!/bin/sh

cat fib.js | node -p
cat fib.js | node transform.js | node -p

cat fib2.js | node -p
cat fib2.js | node transform.js | node -p
