// src/extension.js
const vscode = require("vscode");
const cp = require("child_process");
const fs = require("fs");
const { execFile } = require("child_process");
const path = require("path");
const tmp = require("os").tmpdir();
const AdmZip = require("adm-zip");

class ClassNode extends vscode.TreeItem {
  constructor(label, fullPath, collapsibleState, jarRoot, classPath) {
    super(label, collapsibleState);
    this.fullPath = fullPath;
    this.children = [];
    this.classPath = classPath;

    this.id = label + "::" + fullPath + classPath;
    this.resourceUri = vscode.Uri.file(fullPath);
    this.contextValue =
      collapsibleState === vscode.TreeItemCollapsibleState.None
        ? "classFile"
        : "folder";

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
}

function buildTreeFromPaths(jarPath, classPaths) {
  const jarLabel = path.basename(jarPath);
  const rootNode = new ClassNode(
    jarLabel,
    "/",
    vscode.TreeItemCollapsibleState.Expanded,
    jarPath,
    "/"
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

  setJarFile(jarPath) {
    const javaPath =
      vscode.workspace.getConfiguration("jarExplorer").get("jdkPath") || "java";
    const jarTool = path.join(
      this.context.extensionPath,
      "resources",
      "JarExplorerService.jar"
    );

    execFile(javaPath, ["-jar", jarTool, "JarView", jarPath], (err, stdout) => {
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
        const list = JSON.parse(stdout); // expects list of class paths
        const flatPaths = list.map((e) => e.name); // ["com/example/MyClass.class"]
        let newNode = buildTreeFromPaths(jarPath, flatPaths);
        let arr = this.tree.filter((e) => {
          return e.getId() == newNode.getId();
        });
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
    vscode.workspace.getConfiguration("jarExplorer").get("jdkPath") || "java";
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

function activate(context) {
  const treeProvider = new JarTreeDataProvider(context);
  vscode.window.registerTreeDataProvider("jarExplorerView", treeProvider);

  const provier = new (class {
    provideTextDocumentContent(uri) {
      return decodeBase64Url(uri.query);
    }
  })();
  const regs = vscode.workspace.registerTextDocumentContentProvider(
    "virtual",
    provier
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
        
        try {
          const result = await runJarTool(jarPath, entryPath, context);

          const uri = vscode.Uri.parse(`virtual:/${className}?${result}`);

          await openWithLoader(uri,className);
        } catch (err) {
        
          vscode.window.showErrorMessage(
            "Something went wrong : " + err.message
          );
        }
      }
    )
  );
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

exports.activate = activate;

function deactivate() {}
exports.deactivate = deactivate;
