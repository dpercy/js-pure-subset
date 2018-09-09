#!/bin/sh

cat fib.js | node -p
cat fib.js | node main.js | node -p

cat fib2.js | node -p
cat fib2.js | node main.js | node -p
