const fs = require('fs');

const esprima = require("esprima");
const escodegen = require("escodegen");
const escope = require("escope");

function main() {
  const contents = fs.readFileSync('/dev/stdin').toString();
  const tree = esprima.parse(contents);
  const [newTree, errors] = transform(tree);
  errors.forEach(e => console.error(e));
  const newContent = escodegen.generate(newTree);
  console.log(prelude);
  console.log(newContent);
}

function transform(tree) {
  let errors = [];
  function error(node, message) {
    errors.push({ node, message });
    return makeThrowString(message);
  }
  function unhandled(tree) {
    console.error(tree);
    throw new Error('unhandled node');
  }
  const sm = escope.analyze(tree);

  const SCOPE_SYM = Symbol('SCOPE');

  function transform(tree) {
    switch (tree.type) {
      case 'Program': {
        let { body } = tree;
        body = body.map(transform);
        return { ...tree, body };
      }
      case 'VariableDeclaration': {
        let { kind, declarations } = tree;
        declarations = declarations.map(transform);
        return { ...tree, declarations };
      }
      case 'VariableDeclarator': {
        let { init } = tree;
        init = transform(init);
        return { ...tree, init };
      }
      case 'Literal': {
        let { value } = tree;
        switch (typeof value) {
          case 'string': break;
          case 'number': break;
          default: return error(tree, "Only string and number literals are allowed");
        }
        return { ...tree, value };
      }
      case 'FunctionDeclaration': {
        // rewrite as a const-bound named-function-expression
        let { id } = tree;

        // HACK! attach the scope in here... really the passes should be broken up:
        // 1. "desugar" fundecl -> const funexpr
        // 2. scope analysis
        // 3. purity pass
        const scope = sm.acquire(tree);

        const newTree = {
          type: 'VariableDeclaration',
          kind: 'const',
          declarations: [
            {
              type: 'VariableDeclarator',
              id: id,
              init: {
                ...tree,
                type: 'FunctionExpression',
                [SCOPE_SYM]: scope // HACK
              }
            }
          ]
        };

        return transform(newTree);
      }
      case 'FunctionExpression': {
        let { params, body, generator, expression, async } = tree;
        if (generator) unhandled(tree);
        if (expression) unhandled(tree);
        if (async) unhandled(tree);
        body = transform(body);
        // Assert we don't close over any mutable locals
        {
          const scope = sm.acquire(tree) || tree[SCOPE_SYM]; // HACK due to fundecl case
          for (const ref of scope.through) {
            if (!ref.isReadOnly()) {
              return error(tree, "Can't capture a mutable variable");
            }
          }
        }
        return makeMarkFunctionPure({ ...tree, body });
      }
      case 'BlockStatement': {
        let { body } = tree;
        body = body.map(transform);
        return { ...tree, body };
      }
      case 'ExpressionStatement': {
        let { expression } = tree;
        expression = transform(expression);
        return { ...tree, expression };
      }
      case 'IfStatement': {
        let { test, consequent, alternate } = tree;
        test = transform(test);
        consequent = transform(consequent);
        if (alternate) alternate = transform(alternate);
        return { ...tree, test, consequent, alternate };
      }
      case 'Identifier': {
        return tree;
      }
      case 'ReturnStatement': {
        let { argument } = tree;
        argument = transform(argument);
        return { ...tree, argument };
      }
      case 'CallExpression': {
        let { callee, arguments } = tree;
        if (callee.type === 'MemberExpression') {
          // Rewrite o.f() as o['f']()
          callee = rewriteMember(callee);
          let { object, property } = callee;

          object = transform(object);
          property = transform(property);
          arguments = arguments.map(transform);

          return makeCall('__pureMethodCall', object, property, ...arguments);
        } else {
          callee = transform(callee);
          arguments = arguments.map(transform);
          callee = makeAssertFunctionPure(callee);
          return { ...tree, callee, arguments };
        }
      }
      case 'ArrayExpression': {
        let { elements } = tree;
        elements = elements.map(transform);
        return { ...tree, elements };
      }
      case 'ForStatement': {
        let { init, test, update } = tree;
        init = transform(init);
        test = transform(test);
        update = transform(update);
        return { ...tree, init, test, update };
      }
      case 'BinaryExpression': {
        let { operator, left, right } = tree;
        left = transform(left);
        right = transform(right);

        switch (operator) {
          case '+':
          case '<':
          case '-':
            left = makeAssertPrimitive(left);
            right = makeAssertPrimitive(right);
            break;
          default: throw unhandled(tree);
        }

        return { ...tree, left, right };
      }
      case 'UpdateExpression': {
        // This is like a combination of an assignment and a binop
        let { operator, argument } = tree;
        if (argument.type !== 'Identifier')
          return error(tree, "Can't mutate this value; can only mutate variables");

        switch (operator) {
          case '++':
            // It's ok to duplicate the argument, because it's an Identifier.
            return makeSeq(makeAssertPrimitive(argument), tree);
          default: throw unhandled(tree);
        }
      }
      default:
        throw unhandled(tree);
    }
  }

  const newTree = transform(tree);
  return [newTree, errors];
}

function makeThrowString(str) {
  return {
    "type": "CallExpression",
    "callee": {
      "type": "ArrowFunctionExpression",
      "id": null,
      "params": [],
      "body": {
        "type": "BlockStatement",
        "body": [
          {
            "type": "ThrowStatement",
            "argument": {
              "type": "Literal",
              "value": str
            }
          }
        ]
      },
      "generator": false,
      "expression": false,
      "async": false
    },
    "arguments": []
  };
}

const prelude = `
const __assertPrimitive = function(v) {
  if (v === null) return v;
  switch (typeof v) {
    case 'object':
    case 'function':
      throw Error('not a primitive: ' + __describe(v));
    default:
      return v;
  }
};
const __describe = function(val) {
  switch (typeof val) {
    case 'function': return Function.prototype.toString.call(val);
    case 'object': return Object.prototype.toString.call(val);
    case 'string': return JSON.stringify(val);
    default: return val.toString();
  }
};
const __markFunctionPure = function(f) {
  f.__isPure = true;
  return f;
};
const __assertFunctionPure = function(f) {
  if (typeof f !== 'function') throw Error('not a function: ' + __describe(f));
  if (!f.__isPure) throw Error('not a pure function: ' + __describe(f));
  return f;
};
const __pureMethodCall = function(o, f, ...args) {
  __assertFunctionPure(o[f]);
  return o[f](...args);
};

// mark things pure
__markFunctionPure([].map);
`;

function rewriteMember(tree) {
  // Rewrite o.x as o['x']
  if (tree.computed) return tree;

  let { property } = tree;
  property = { type: 'Literal', value: property.name };
  return { ...tree, computed: true, property };
}

function makeAssertPrimitive(tree) {
  return makeCall('__assertPrimitive', tree);
}

function makeMarkFunctionPure(tree) {
  return makeCall('__markFunctionPure', tree);
}

function makeAssertFunctionPure(tree) {
  return makeCall('__assertFunctionPure', tree);
}

function makeCall(funcName, ...args) {
  return {
    "type": "CallExpression",
    "callee": {
      "type": "Identifier",
      "name": funcName
    },
    "arguments": args
  };
}

function makeSeq(...args) {
  return {
    "type": "SequenceExpression",
    "expressions": args
  };
}

if (module === require.main) {
  main();
}
