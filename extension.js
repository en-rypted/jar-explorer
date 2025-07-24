// src/extension.js
const vscode = require("vscode");
const cp = require("child_process");
const fs = require("fs");
const os = require('os');
const { execFile } = require("child_process");
const path = require("path");

let absolutePathArray = [];

class ClassNode extends vscode.TreeItem {
  constructor(label, fullPath, collapsibleState, jarRoot, classPath, isRoot = false) {
    super(label, collapsibleState);
    this.fullPath = fullPath;
    this.children = []; 
    this.classPath = classPath;
    this.isRoot = isRoot;

    this.id = jarRoot + "::" + label + "::" + classPath;
    this.resourceUri = vscode.Uri.file(fullPath);
    this.contextValue =
      collapsibleState === vscode.TreeItemCollapsibleState.None
        ? "classFile"
        : isRoot ? "jarRoot" : "folder";

    if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
      this.command = {
        command: "jarExplorer.openClassFile",
        title: "Open Class File",
        arguments: [jarRoot, classPath, label],
      };
    }
  }

  getId() {
    return this.id;
  }

  setChildren(parts, newNode) {
    let currentChildren = this.children;
    for (let i = 0; i < currentChildren.length; i++) {
      if (currentChildren[i].label === parts[0]) {
        if (parts.length === 1) {
          currentChildren[i].children = newNode.children;
          currentChildren[i].collapsibleState = 2;
           currentChildren[i].contextValue = "folder";
          return;
        } else {
          currentChildren[i].setChildren(parts.shift(), newNode);
          return;
        }
      }
    }
  }
  getIsRoot() {
    return this.isRoot;
  }
}

function buildTreeFromPaths(jarPath, classPaths) {
  const jarLabel = path.basename(jarPath);
  const rootNode = new ClassNode(
    jarLabel,
    "/",
    vscode.TreeItemCollapsibleState.Expanded,
    jarPath,
    "/",
    true // isRoot flag
  );

  for (const classPath of classPaths) {
    const parts = classPath.split("/");
    let current = rootNode;
    let currentPath = jarPath; // start with JAR path as root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part == "") {
        continue;
      }
      currentPath = path.join(currentPath, part);
      let existing = current.children.find((c) => c.label === part);

      if (!existing) {
        const isLeaf = i === parts.length - 1;
        existing = new ClassNode(
          part,
          currentPath,
          isLeaf
            ? vscode.TreeItemCollapsibleState.None
            : vscode.TreeItemCollapsibleState.Collapsed,
          jarPath,
          classPath
        );
        current.children.push(existing);
      }

      current = existing;
    }
  }

  return rootNode; // Return a single top-level node (the JAR file)
}

class JarTreeDataProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.tree = [];
  }

  setJarFile(jarPath, entryPath) {
     vscode.commands.executeCommand('workbench.view.extension.jarExplorer');
    const javaPath =
         vscode.workspace.getConfiguration("jarExplorer").get("jdkPath") ? vscode.workspace.getConfiguration("jarExplorer").get("jdkPath").endsWith(".exe") ? vscode.workspace.getConfiguration("jarExplorer").get("jdkPath") : vscode.workspace.getConfiguration("jarExplorer").get("jdkPath")+".exe" : "java";
    const jarTool = path.join(
      this.context.extensionPath,
      "resources",
      "JarExplorerService.jar"
    );
    let cmarArr = entryPath ?["-jar", jarTool, "InnerJar", jarPath,entryPath] :["-jar", jarTool, "JarView", jarPath]
    execFile(javaPath, cmarArr, (err, stdout) => {
      if (err) {
        vscode.window.showErrorMessage(
          "Failed to run JarExplorer: " + err.message
        );
        if (
          err.message.includes("java.lang.UnsupportedClassVersionError") ||
          err.message.includes("ENOENT")
        ) {
          const message =
            "JDK 21 is required. Please install or set the path to JDK 21.";
          const button = "Download JDK 21";
          const jdkPathButton = "Set JDK Path in Settings";
          vscode.window
            .showInformationMessage(message, button, jdkPathButton)
            .then((selection) => {
              if (selection === button) {
                vscode.env.openExternal(
                  vscode.Uri.parse(
                    "https://www.oracle.com/java/technologies/javase/jdk21-archive-downloads.html"
                  )
                );
              } else if (selection === jdkPathButton) {
                vscode.commands.executeCommand(
                  "workbench.action.openSettingsJson"
                );
                vscode.window.showInformationMessage(`In settings.json, add:
"java.home": "/path/to/your/jdk21"`);
              }
            });
        }
        return;
      }
      try {
        let flatPaths = [];
        let absPath;
        const res = JSON.parse(stdout); // expects list of class paths
        if (!Array.isArray(res)) {
          flatPaths = res.fileList.map((e) => e.name);
          absPath = res.  absolutePath; 
        } else {
          flatPaths = res.map((e) => e.name); // ["com/example/MyClass.class"]
        }
        let newNode = buildTreeFromPaths(jarPath, flatPaths);
        let newInnerNode = null;
        if(absPath) {
            newInnerNode =buildTreeFromPaths(absPath, flatPaths);
            let arr = absolutePathArray.filter((e) => {
              return e.id == newNode.getId();
            });
        if(arr.length > 0) {
          arr[0].paths = [...arr[0].paths, absPath];
        } else {
            absolutePathArray.push({id:newNode.getId(), paths : [absPath]});
        }
        }
        let arr = this.tree.filter((e) => {
          return e.getId() == newNode.getId();
        });
        if (newInnerNode) {
          arr[0].setChildren(entryPath.split("/"), newInnerNode);
          this._onDidChangeTreeData.fire();
          return;
        }
        if (arr.length > 0) {
          vscode.window.showInformationMessage(
            "This Jar : " + jarPath + " Already added in Jar Explorer.😊"
          );
          return;
        }
        this.tree = [...this.tree, newNode];
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

function runJarTool(jarPath, entryPath, context) {
  const jarTool = path.join(
    context.extensionPath,
    "resources",
    "JarExplorerService.jar"
  );
  const jdkPath =
   vscode.workspace.getConfiguration("jarExplorer").get("jdkPath") ? vscode.workspace.getConfiguration("jarExplorer").get("jdkPath").endsWith(".exe") ? vscode.workspace.getConfiguration("jarExplorer").get("jdkPath") : vscode.workspace.getConfiguration("jarExplorer").get("jdkPath")+".exe" : "java";
  const jarCfrTool = path.join(
    context.extensionPath,
    "resources",
    "cfr-0.152.jar"
  );

  return new Promise((resolve, reject) => {
    const cmd = cp.spawn(jdkPath, [
      "-jar",
      jarTool,
      "classDecompile",
      jarPath,
      jdkPath,
      entryPath,
      jarCfrTool,
    ]);

    let output = "";
    let error = "";

    cmd.stdout.on(
      "data",
      (data) => (output += data.toString().replace(/[\r\n]+/g, ""))
    );
    cmd.stderr.on("data", (data) => (error += data.toString()));

    cmd.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(error || `Tool failed with exit code ${code}`));
    });
  });
}


function decodeBase64Url(base64Url) {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

  while (base64 % 4) {
    base64 += "=";
  }
  return atob(base64);
}

function decodeBase64UrlToBase64(base64Url) {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

  while (base64 % 4) {
    base64 += "=";
  }
  return base64;
}

function activate(context) {
  const treeProvider = new JarTreeDataProvider(context);
  vscode.window.registerTreeDataProvider("jarExplorerView", treeProvider);
   
  const provider   = new (class {
    provideTextDocumentContent(uri) {
      return decodeBase64Url(uri.query);
    }
  })();
  const regs = vscode.workspace.registerTextDocumentContentProvider(
    "virtual",
    provider
  );
  vscode.window.registerCustomEditorProvider(
    "jarExplorer.editor",
    {
      async openCustomDocument(uri) {
        return { uri, dispose: () => {} };
      },
      async resolveCustomEditor(document, webviewPanel, _token) {
        treeProvider.setJarFile(document.uri.fsPath);
        setTimeout(() => {
          if (!webviewPanel.disposed) {
            webviewPanel.dispose();
          }
        }, 100);
      },
    },
    { supportsMultipleEditorsPerDocument: false }
  );
 
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "jarExplorer.openClassFile",
      async (jarPath, entryPath, className) => {
         await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification, // or .Window or .SourceControl
        title: `Opening file ${className}...🥳`,
        cancellable: false
      }, async (progress, token) => {
          
            progress.report({ increment: 0 });
           await openClassFile(jarPath, entryPath, className, treeProvider,context,token);
           progress.report({ increment: 100 });

      }
    );
      }
    )
  );


  context.subscriptions.push(
   vscode.commands.registerCommand('jarExplorer.openWithCustomEditor', async (uri) => {
       await vscode.commands.executeCommand(
           'vscode.openWith',
           uri,
           'jarExplorer.editor',
       );
      })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("jarExplorer.removeFile", async (node) => {
      let id = node.getId();
      const index = treeProvider.tree.findIndex((e) => e.getId() === id);
      if (index !== -1) {
        treeProvider.tree.splice(index, 1);
        treeProvider._onDidChangeTreeData.fire();
        let dirs = absolutePathArray.filter((e) => e.id === id);
        if(dirs.length > 0) {
           dirs[0].paths?.forEach((e) => {
          deleteTempDirectory(e.split("\\").slice(0, -1).join("\\"));
        });
        }
       
        vscode.window.showInformationMessage(
          `Removed ${node.label} from JAR Explorer.`
          
        );
      } else {
        vscode.window.showErrorMessage(
          `Failed to remove ${node.label}. Not found in JAR Explorer.`
        );
      }

    }));

 
}

async function openWithLoader(uri,className) {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification, // or .Window or .SourceControl
        title: `Opening file ${className}...🥳`,
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0 });

        // Simulate loading or await your real async action
        await vscode.commands.executeCommand("vscode.open", uri);

        progress.report({ increment: 100 });
    });

  }

  function deleteTempDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        deleteTempDirectory(fullPath); // recursive delete
      } else {
        try {
          fs.unlinkSync(fullPath);
        } catch (err) {
          console.error(`Failed to delete file: ${fullPath} due to ${err}`);
        }
      }
    }

    // Finally delete the parent directory
    try {
      fs.rmdirSync(dirPath);
    } catch (err) {
      console.error(`Failed to delete directory: ${dirPath} due to ${err}`);
    }
  }
}

const openClassFile = async (jarPath, entryPath, className, treeProvider, context,token) => {
  if (entryPath.endsWith(".jar") || entryPath.endsWith(".zip") || entryPath.endsWith(".war") || entryPath.endsWith(".ear")) {
    treeProvider.setJarFile(jarPath, entryPath);
    return;
  }

        try {
          let uri = null;
          const result = await runJarTool(jarPath, entryPath, context);
           if (result.startsWith("Error:")) {
            vscode.window.showErrorMessage(result);
            return;
          }
          if (result.startsWith("Invalid class file")) {
            vscode.window.showErrorMessage(result);
            return;
          }
          if (result.startsWith("No class found")) {
            vscode.window.showErrorMessage(result);
            return;
          } 
          if(className.endsWith(".png") || className.endsWith(".jpg") || className.endsWith(".jpeg") || className.endsWith(".gif") || className.endsWith(".svg")) {
               const buffer = Buffer.from(decodeBase64UrlToBase64(result), 'base64');
              const tempFile = path.join(os.tmpdir(), className);
             fs.writeFileSync(tempFile, buffer);
              uri = vscode.Uri.file(tempFile);
          }else{
             uri = vscode.Uri.parse(`virtual:/${className}?${result}`);
          }
         // await openWithLoader(uri,className);
         if(!token.isCancellationRequested) {
            await vscode.commands.executeCommand("vscode.open", uri);  
         }
         
        } catch (err) {
        
          vscode.window.showErrorMessage(
            "Something went wrong : " + err.message
          );
        }
      }

exports.activate = activate;

function deactivate() {}
exports.deactivate = deactivate;
