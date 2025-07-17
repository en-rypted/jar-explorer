// src/extension.js
const vscode = require("vscode");
const cp = require("child_process");
const fs = require("fs");
const {execFile}= require("child_process");
const path = require("path");
const tmp = require("os").tmpdir();
const AdmZip = require("adm-zip");

class ClassNode extends vscode.TreeItem {
  constructor(label, fullPath, collapsibleState, jarRoot,classPath) {
    super(label, collapsibleState);
    this.fullPath = fullPath;
    this.children = [];
	this.classPath = classPath;

    this.id = fullPath;
    this.resourceUri = vscode.Uri.file(fullPath);
    this.contextValue = collapsibleState === vscode.TreeItemCollapsibleState.None ? "classFile" : "folder";

    if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
      this.command = {
        command: "jarExplorer.openClassFile",
        title: "Open Class File",
        arguments: [jarRoot,classPath,label]
      };
    }
  }
}

function buildTreeFromPaths(jarPath, classPaths) {
  const jarLabel = path.basename(jarPath);
  const rootNode = new ClassNode(jarLabel, "/", vscode.TreeItemCollapsibleState.Expanded, true);

  for (const classPath of classPaths) {
    const parts = classPath.split("/");
    let current = rootNode;
    let currentPath = jarPath; // start with JAR path as root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
	  if(part == ''){
		continue;
	  }
      currentPath = path.join(currentPath, part);
      let existing = current.children.find(c => c.label === part);

      if (!existing) {
        const isLeaf = i === parts.length - 1;
        existing = new ClassNode(part, currentPath,
          isLeaf ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,jarPath,classPath);
        current.children.push(existing);
      }

      current = existing;
    }
  }

  return [rootNode]; // Return a single top-level node (the JAR file)
}

class JarTreeDataProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.tree = [];
  }

  setJarFile(jarPath) {
    const javaPath = vscode.workspace.getConfiguration().get("jarExplorer.jdkPath", "java");
    const jarTool = path.join(this.context.extensionPath, "resources", "JarExplorerService.jar");

    execFile(javaPath, ["-jar", jarTool,"JarView" ,jarPath], (err, stdout) => {
      if (err) {
        vscode.window.showErrorMessage("Failed to run JarExplorer: " + err.message);
        return;
      }
      try {
        const list = JSON.parse(stdout); // expects list of class paths
        const flatPaths = list.map(e => e.name); // ["com/example/MyClass.class"]
        this.tree = buildTreeFromPaths(jarPath,flatPaths);
        this._onDidChangeTreeData.fire();
      } catch (e) {
        vscode.window.showErrorMessage("Invalid JSON output from tool.");
      }
    });
  }

  getTreeItem(item) {
    return item;
  }

  getChildren(element) {
    return element ? element.children : this.tree;
  }
}




function runJarTool(jarPath, entryPath,context) {
  const jarTool = path.join(context.extensionPath, "resources", "JarExplorerService.jar");
  const jdkPath = vscode.workspace.getConfiguration("jarExplorer").get("jdkPath") || "java";
  const jarCfrTool = path.join(context.extensionPath, "resources", "cfr-0.152.jar");

  return new Promise((resolve, reject) => {
    const cmd = cp.spawn(jdkPath, [
      "-jar",
      jarTool,
	  "classDecompile",
      jarPath,
	    jdkPath,
      entryPath,
	  jarCfrTool
    ]);

    let output = "";
    let error = "";

    cmd.stdout.on("data", data => (output += data.toString()));
    cmd.stderr.on("data", data => (error += data.toString()));

    cmd.on("close", code => {
      if (code === 0) resolve(output);
      else reject(new Error(error || `Tool failed with exit code ${code}`));
    });
  });
}

function getWebviewContent(title, code ,loading = false) {
	 const loadingHtml = `
    <div id="loader" style="text-align:center; padding-top:50px;">
      <svg width="40" height="40" viewBox="0 0 40 40" stroke="#ccc">
        <g fill="none" fill-rule="evenodd">
          <g transform="translate(2 2)" stroke-width="3">
            <circle stroke-opacity=".5" cx="18" cy="18" r="18"/>
            <path d="M36 18c0-9.94-8.06-18-18-18">
              <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite"/>
            </path>
          </g>
        </g>
      </svg>
      <p>Decompiling class...</p>
    </div>`;
  return `
    <!DOCTYPE html>
    <html>
    <head>
       <link href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.css" rel="stylesheet" />
      <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-java.min.js"></script>
      <style>
        body {
          font-family: monospace;
          padding: 1rem;
          background-color: #1e1e1e;
          color: #d4d4d4;
        }
        pre {
          white-space: pre-wrap;
        }
        code {
          font-size: 14px;
        }
      </style>
    </head>
    <body>
         ${loading ? loadingHtml : ` <pre><code class="language-java">${code}</code></pre>`}
     
    </body>
    </html>
  `;
}

function activate(context) {
  const treeProvider = new JarTreeDataProvider(context);
  vscode.window.registerTreeDataProvider("jarExplorerView", treeProvider);

  vscode.window.registerCustomEditorProvider(
	"jarExplorer.editor",
	{
		async openCustomDocument(uri){
			return {uri,dispose:()=>{}}
		},
		async resolveCustomEditor(document,webviewPanel,_token){
			treeProvider.setJarFile(document.uri.fsPath);
			setTimeout(() => {
				if(!webviewPanel.disposed){
					webviewPanel.dispose();
				}
			}, 100);
		}
		
	},
	{supportsMultipleEditorsPerDocument:false}
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("jarExplorer.openClassFile", async (jarPath, entryPath,className) => {
      const panel = vscode.window.createWebviewPanel("jarExplorerView", className, vscode.ViewColumn.One, {
        enableScripts: true
      });
	  panel.webview.html = getWebviewContent(className, "",true);

      try {
        const result = await runJarTool(jarPath, entryPath,context);
		const escaped = result
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
            
	   panel.webview.html = getWebviewContent(className, escaped);
      } catch (err) {
        panel.webview.html = `<h3>Error</h3><pre>${err.message}</pre>`;
      }
    })
  );
}



exports.activate = activate;

function deactivate() {}
exports.deactivate = deactivate;
