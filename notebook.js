const fs = require('fs');

const esprima = require('esprima');
const escodegen = require('escodegen');

require('codemirror/lib/codemirror.css');
require('codemirror/mode/javascript/javascript');
const CodeMirror = require('codemirror');

const { transform } = require('./transform');

const fibExample = fs.readFileSync(__dirname + '/fib2.js').toString();

window.CodeMirror = CodeMirror;


class IDE {
  constructor(editor) {
    this.editor = editor;

    editor.on('change', this.onEditorChange.bind(this));

    this.reparse();
  }
  onEditorChange(editor, event) {
    console.log('change!', event);
    this.reparse();
  }
  reparse() {
    const ast = esprima.parse(this.editor.getValue());
    const [newAst, errors] = transform(ast);

    // The nodes in newAst are in the order they should be evaluated,
    // not necessarily the order they appear in the file.
    const nodes = newAst.body;
    const strings = nodes.map(n => escodegen.generate(n, {format:{compact:true}}));

    // TODO eval nodes one at a time, snapshotting the global variables
    //  - maybe rewrite each node as a function that accepts and returns values!
  }
}



const editor = CodeMirror(document.body, {
  value: fibExample,
  mode: "javascript",
  lineNumbers: true,
});
window.editor = editor;

const ide = new IDE(editor);
window.ide = ide;


console.log("ready!");


