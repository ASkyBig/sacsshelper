const vscode = require('vscode');
const fs = require('fs');

function statPath(path) {
  try {
    return fs.statSync(path);
  } catch (ex) {}
  return false;
}
function getCssFile () {
  let cssObjArr = [];
  
  let sacssFilePath = '';
  const folders = vscode.workspace.workspaceFolders;
  if (folders) {
    for (let i = 0; i < folders.length; i++) {
      const folderPath = folders[i].uri.path;
      if (__dirname.includes(folderPath)) {
        sacssFilePath = folderPath;
      } else {
        const cssPath = `${folderPath}/node_modules/sacss/index.css`;
          if (statPath(cssPath)) {
            sacssFilePath = cssPath;
            break;
          }
      }
    }
  }
  if (!sacssFilePath) return;
  try {
    const data = fs.readFileSync(sacssFilePath, 'utf8');
    const cssArr = data.match(/\..*?{.*}/g);
    cssObjArr = cssArr.map(item => {
      let key = item.match(/\.(.*)?{/)[1];
      let v = item.match(/\{(.*?)\}/)[1];
      return {[key]: v}
    })
    return cssObjArr;
 
  } catch (err) {
    console.error('err ===', err)
  }
}
function provideHover(document, position) {
  const word = document.getText(document.getWordRangeAtPosition(position));
  let cssObjArr = getCssFile();
  if (!cssObjArr.length) return;
  const item = cssObjArr.find(cssObj => {
    if (Object.keys(cssObj)[0] === word) {
      return cssObj;
    }
  })
  if (item) {
    return new vscode.Hover(`${Object.values(item)[0]}`) 
  }
}

module.exports = function(context) {
  let cssObjArr = getCssFile();
  let triggerCharacters = [];

  const charArr = cssObjArr.map(item => {
    return Object.keys(item)[0].charAt(0)
  })
  triggerCharacters = [...new Set(charArr)];  
  
  const provide1 = vscode.languages.registerHoverProvider('*', {
      provideHover
  })

  const provide2 = vscode.languages.registerCompletionItemProvider(['javascriptreact', 'typescriptreact', 'js', 'javascript', 'ts', 'typescript', 'tsx', 'jsx'], {
    
      provideCompletionItems: (document, position, token, context) => {
        const line        = document.lineAt(position);
        // 截取当前行起始位置到光标所在位置的字符串
        const lineText = line.text.substring(0, position.character);

        // 只要当前光标前的字符串包括 `class`或className
          if(/(class|className)=(\"|\'|\{)/.test(lineText)){
            const res = cssObjArr.map(classItem => {
              const completionItem1 = new vscode.CompletionItem(Object.keys(classItem)[0]);
              completionItem1.kind = vscode.CompletionItemKind.Class;
              completionItem1.detail = ' ' + classItem[Object.keys(classItem)[0]];
              completionItem1.insertText = Object.keys(classItem)[0];
              return completionItem1;
            })
            return res;
          }
      },
      resolveCompletionItem: (item, token) => {
        return null;
      }
  }, ...triggerCharacters)
  context.subscriptions.push(provide1, provide2)
};
