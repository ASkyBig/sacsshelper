const vscode = require('vscode');
const fs = require('fs');

const window = vscode.window;
const workspace = vscode.workspace;

const DEFAULT_STYLE = {
    color: "#2196f3",
    backgroundColor: "green",
};

const marginPaddingNumberMap = new Map([
  [/^\bml\d+\b/, ['margin-left']],
  [/^\bmt\d+\b/, ['margin-top']],
  [/^\bmr\d+\b/, ['margin-right']],
  [/^\bmb\d+\b/, ['margin-bottom']],
  [/^\bpl\d+\b/, ['padding-left']],
  [/^\bpt\d+\b/, ['padding-top']],
  [/^\bpr\d+\b/, ['padding-right']],
  [/^\bpb\d+\b/, ['padding-bottom']],
])
function statPath(path) {
  try {
    return fs.statSync(path);
  } catch (ex) {}
  return false;
}

function getCssFile () {
  let cssObjArr = [];
  
  let sacssFilePath = '';
  const folders = workspace.workspaceFolders;
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
  const word = document.getText(document.getWordRangeAtPosition(position, /[a-zA-Z\d.%]+/));
  if (/\b(m|p)[ltbr]\d+\b/.test(word)) {
    const numberArray = word.match(/\d+/)
    const res = [...marginPaddingNumberMap].filter(([key, value]) => key.test(word))

    return new vscode.Hover(`${res[0][1]}: ${numberArray[0]}`) 
  }
  let cssObjArr = getCssFile();
  if (!cssObjArr.length) return;
  const item = cssObjArr.find(cssObj => {
    if (Object.keys(cssObj)[0].replace(/(\\)/g, '') === word) {
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

  let timer = null;
  let activeEditor = window.activeTextEditor;
  let keywordsPattern, pattern, styleForRegExp, decorationTypes

  let settings = workspace.getConfiguration('sacsshelper');

  initColor(settings);

  context.subscriptions.push(vscode.commands.registerCommand('sacsshelper.togglesacss', function () {
      settings.update('isEnable', !settings.get('isEnable'), true).then(function () {
          triggerUpdateDecorations();
      });
  }))

  if (activeEditor) {
    triggerUpdateDecorations();
  }

  window.onDidChangeActiveTextEditor(function (editor) {
      activeEditor = editor;
      if (editor) {
          triggerUpdateDecorations();
      }
  }, null, context.subscriptions);

  workspace.onDidChangeTextDocument(function (event) {
      if (activeEditor && event.document === activeEditor.document) {
          triggerUpdateDecorations();
      }
  }, null, context.subscriptions);

  workspace.onDidChangeConfiguration(function () {
      settings = workspace.getConfiguration('sacsshelper');
      //NOTE: if disabled, do not re-initialize the data or we will not be able to clear the style immediatly via 'toggle' command
      if (!settings.get('isEnable')) return;

      initColor(settings);
      triggerUpdateDecorations();
  }, null, context.subscriptions);

  function initColor (settings) {
    const customDefaultStyle = settings.get('defaultStyle');

    const keyArr = cssObjArr.map(item => {
      return Object.keys(item)[0]
    })

    let re = keyArr.reduce((res, item, index) => {
      item = item.replace(/\\/, '')  
      if (index === 0) return res + item;
      return res + '|' + item;
    }, '')

    re = `(?<=class[^'"\`]*(['"\`])[^'"\`]*)(` + '\\b)((m|p)[tblr]\\d+|' + re  + `)(?=(\\b|\\s).*\\1)`;
    keywordsPattern = re;
    styleForRegExp = Object.assign({}, DEFAULT_STYLE, customDefaultStyle, {
        overviewRulerLane: vscode.OverviewRulerLane.Right
    });
    decorationTypes = {};
    pattern = keywordsPattern;
    pattern = new RegExp(pattern, 'g');
  }

  function updateDecorations () {
    if (!activeEditor || !activeEditor.document) return;
    const text = activeEditor.document.getText();
    let mathes = {}, match;
  
    while (match = pattern.exec(text)) {
        var startPos = activeEditor.document.positionAt(match.index);
        var endPos = activeEditor.document.positionAt(match.index + match[0].length);
        var decoration = {
            range: new vscode.Range(startPos, endPos)
        };

        var matchedValue = match[0];

        if (mathes[matchedValue]) {
            mathes[matchedValue].push(decoration);
        } else {
            mathes[matchedValue] = [decoration];
        }

        if (keywordsPattern.trim() && !decorationTypes[matchedValue]) {
            decorationTypes[matchedValue] = window.createTextEditorDecorationType(styleForRegExp);
        }
    }

    Object.keys(decorationTypes).forEach((v) => {
        var rangeOption = settings.get('isEnable') && mathes[v] ? mathes[v] : [];
        var decorationType = decorationTypes[v];
        activeEditor.setDecorations(decorationType, rangeOption);
    })

  }

  function triggerUpdateDecorations () {
      timer && clearTimeout(timer);
      timer = setTimeout(updateDecorations, 0);
  }

  const charArr = cssObjArr.map(item => {
    return Object.keys(item)[0].charAt(0)
  })
  triggerCharacters = [...new Set(charArr)];  
  
  const provide1 = vscode.languages.registerHoverProvider('*', {
      provideHover
  })

  const provide2 = vscode.languages.registerCompletionItemProvider(['html', 'javascriptreact', 'typescriptreact', 'js', 'javascript', 'ts', 'typescript', 'tsx', 'jsx'], {
    
      provideCompletionItems: (document, position, token, context) => {
        const line = document.lineAt(position);
        // 截取当前行起始位置到光标所在位置的字符串
        const lineText = line.text.substring(0, position.character);

        // 只要当前光标前的字符串包括 class= 或className=
          if(/(class|className)=(\"|\'|\{)/.test(lineText)){
            const res = cssObjArr.map(classItem => {
              const completionItem1 = new vscode.CompletionItem(Object.keys(classItem)[0]);
              completionItem1.kind = vscode.CompletionItemKind.Class;
              completionItem1.detail = ' ' + classItem[Object.keys(classItem)[0]];
              completionItem1.insertText = Object.keys(classItem)[0].includes('\\') ? Object.keys(classItem)[0].replace(/\\/, '') : (Object.keys(classItem)[0].includes('\.') ? Object.keys(classItem)[0].replace(/\./, ''): Object.keys(classItem)[0]);
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
