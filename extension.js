// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('Congratulations, your extension "acss helper" is now active!');
  require("./src/completion")(context);
  let disposable = vscode.commands.registerCommand(
    "Hello",
    function () {
      vscode.window.showInformationMessage("Hello World from air!");
    }
  );
  context.subscriptions.push(disposable);
}
// exports.activate = activate;
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
