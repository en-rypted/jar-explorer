// src/extension.js
const vscode = require("vscode");
const cp = require("child_process");
const fs = require("fs");
const os = require('os');
const { execFile } = require("child_process");
const path = require("path");
const http = require("http");

let javaServerProcess = null;
let javaServerPort = null;

function getJavaServerPort(context) {
  return new Promise((resolve, reject) => {
    if (javaServerProcess && javaServerPort) {
      resolve(javaServerPort);
      return;
    }

    let javaPath = vscode.workspace.getConfiguration("jarExplorer").get("jdkPath") || "java";
    if (process.platform === 'win32' && javaPath !== "java" && !javaPath.endsWith(".exe")) {
      javaPath += ".exe";
    }

    const jarTool = path.join(context.extensionPath, "resources", "JarExplorerService.jar");
    const jarCfrTool = path.join(context.extensionPath, "resources", "cfr-0.152.jar");
    const cpStr = `${jarTool}${path.delimiter}${jarCfrTool}`;

    javaServerProcess = cp.spawn(javaPath, ["-cp", cpStr, "Main", "server"]);
    
    let resolved = false;

    javaServerProcess.stdout.on("data", (data) => {
      const output = data.toString();
      const match = output.match(/PORT:(\d+)/);
      if (match) {
        javaServerPort = parseInt(match[1]);
        resolved = true;
        resolve(javaServerPort);
      }
    });

    let lastError = "";
    javaServerProcess.stderr.on("data", (data) => {
      lastError += data.toString();
    });

    javaServerProcess.on("exit", (code) => {
      javaServerProcess = null;
      javaServerPort = null;
      if (!resolved) {
        reject(new Error(`Java server exited unexpectedly with code ${code}. Error: ${lastError}`));
      }
    });

    javaServerProcess.on("error", (err) => {
      if (!resolved) {
        reject(err);
      }
    });
  });
}

function makeHttpRequest(port, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: port,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(responseData);
        } else {
          reject(new Error(`Server responded with ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

class SearchTreeDataProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.results = [];
  }

  setResults(query, jarPath, matchingFiles, isRegex = false, isCaseSensitive = false, isWholeWord = false) {
    const total = matchingFiles.length;
    let description = total === 1 ? "1 result" : `${total} results`;
    const titleNode = new vscode.TreeItem(`Search: "${query}"`, vscode.TreeItemCollapsibleState.Expanded);
    titleNode.description = description;
    titleNode.iconPath = new vscode.ThemeIcon("search");

    // Store children on the title node
    titleNode.children = matchingFiles.map(file => {
      let label = path.basename(file);
      let item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
      item.description = path.dirname(file) === '.' ? '' : path.dirname(file);
      item.resourceUri = vscode.Uri.file(file);
      item.iconPath = vscode.ThemeIcon.File;
      item.command = {
        command: "jarExplorer.openClassFile",
        title: "Open Class File",
        arguments: [jarPath, file, label]
      };
      
      // Store metadata for background decompilation
      item.isFileNode = true;
      item.jarPath = jarPath;
      item.filePath = file;
      item.query = query;
      item.isRegex = isRegex;
      item.isCaseSensitive = isCaseSensitive;
      item.isWholeWord = isWholeWord;
      item.fileLabel = label;
      
      return item;
    });

    this.results = [titleNode];
    this._onDidChangeTreeData.fire();
  }

  clear() {
    this.results = [];
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (!element) {
      return this.results;
    }
    
    if (element.isFileNode) {
      if (element.children) {
        return element.children;
      }
      
      // We haven't fetched the snippets yet. Fetch from backend!
      try {
        const port = await getJavaServerPort(this.context);
        const stdout = await makeHttpRequest(port, "/decompile", { jarPath: element.jarPath, classPath: element.filePath });
        
        let decoded = "";
        if (element.filePath.endsWith(".class")) {
           decoded = Buffer.from(stdout, "base64").toString("utf-8");
        } else {
           decoded = Buffer.from(stdout, "base64").toString("utf-8"); // Everything returns base64 right now
        }
        
        let lines = decoded.split('\n');
        let children = [];
        
        let patternStr = element.isRegex ? element.query : element.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (element.isWholeWord) {
          patternStr = `\\b(?:${patternStr})\\b`;
        }
        let pattern = new RegExp(patternStr, element.isCaseSensitive ? 'g' : 'gi');
        
        for (let i = 0; i < lines.length; i++) {
          pattern.lastIndex = 0;
          let match = pattern.exec(lines[i]);
          if (match) {
             let snippet = lines[i].trim();
             
             pattern.lastIndex = 0;
             let highlights = [];
             let prefix = `${i + 1}: `;
             
             let snippetMatch;
             while ((snippetMatch = pattern.exec(snippet)) !== null) {
               let start = prefix.length + snippetMatch.index;
               let end = start + snippetMatch[0].length;
               highlights.push([start, end]);
               
               if (snippetMatch.index === pattern.lastIndex) {
                 pattern.lastIndex++;
               }
             }
             
             if (snippet.length > 200) snippet = snippet.substring(0, 200) + "...";
             
             let lineItem = new vscode.TreeItem(
               { label: `${prefix}${snippet}`, highlights: highlights },
               vscode.TreeItemCollapsibleState.None
             );
             lineItem.command = {
               command: "jarExplorer.openClassFileAndGoToLine",
               title: "Go to Line",
               arguments: [element.jarPath, element.filePath, element.fileLabel, i]
             };
             children.push(lineItem);
          }
        }
        
        element.children = children;
        
        // Update description with accurate matches
        element.description = children.length === 1 ? "1 match" : `${children.length} matches`;
        this._onDidChangeTreeData.fire(element);
        
        return children;
        
      } catch (e) {
         return [new vscode.TreeItem(`Failed to fetch snippets: ${e.message}`, vscode.TreeItemCollapsibleState.None)];
      }
    }

    return element.children || [];
  }
}

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

  async setJarFile(jarPath, entryPath) {
    vscode.commands.executeCommand('workbench.view.extension.jarExplorer');
    try {
      const port = await getJavaServerPort(this.context);
      const endpoint = entryPath ? "/innerjar" : "/jarview";
      const body = entryPath ? { jarPath, classPath: entryPath } : { jarPath };
      
      const stdout = await makeHttpRequest(port, endpoint, body);

      let flatPaths = [];
      let absPath;
      const res = JSON.parse(stdout); 
      if (!Array.isArray(res)) {
        flatPaths = res.fileList.map((e) => e.name);
        absPath = res.absolutePath; 
      } else {
        flatPaths = res.map((e) => e.name); 
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
      vscode.window.showErrorMessage("Failed to load JAR: " + e.message);
    }
  }

  getTreeItem(item) {
    return item;
  }

  getChildren(element) {
    return element ? element.children : this.tree;
  }
  

}

async function runJarTool(jarPath, entryPath, context) {
  try {
    const port = await getJavaServerPort(context);
    const stdout = await makeHttpRequest(port, "/decompile", { jarPath, classPath: entryPath });
    return stdout;
  } catch (err) {
    throw err;
  }
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

  const searchProvider = new SearchTreeDataProvider(context);
  vscode.window.registerTreeDataProvider("jarExplorerSearch", searchProvider);
   
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

  context.subscriptions.push(
    vscode.commands.registerCommand("jarExplorer.searchJar", async (node) => {
      let jarId = node ? node.getId() : null;
      let jarRootNode = null;

      if (jarId) {
        jarRootNode = treeProvider.tree.find(n => n.getId() === jarId);
      } else if (treeProvider.tree.length === 1) {
        jarRootNode = treeProvider.tree[0];
      } else if (treeProvider.tree.length > 1) {
        const jarItems = treeProvider.tree.map(n => ({
          label: n.label,
          description: n.description,
          node: n
        }));
        const selected = await vscode.window.showQuickPick(jarItems, {
          placeHolder: "Select a JAR to search in"
        });
        if (!selected) return;
        jarRootNode = selected.node;
      }

      if (!jarRootNode) {
        vscode.window.showInformationMessage("No JAR is currently open.");
        return;
      }

      // Collect all classPaths
      const allPaths = [];
      const traverse = (n) => {
        if (n.children.length === 0 && n.classPath !== "/") {
          allPaths.push(n.classPath);
        } else {
          n.children.forEach(traverse);
        }
      };
      traverse(jarRootNode);

      const selection = await vscode.window.showQuickPick(allPaths, {
        placeHolder: `Search in ${jarRootNode.label}... (e.g. MyClass or .xml)`,
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (selection) {
        let label = path.basename(selection);
        let jarPath = jarRootNode.getId().split("::")[0];
        vscode.commands.executeCommand("jarExplorer.openClassFile", jarPath, selection, label);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("jarExplorer.deepSearchJar", async (node) => {
      let jarId = node ? node.getId() : null;
      let jarRootNode = null;

      if (jarId) {
        jarRootNode = treeProvider.tree.find(n => n.getId() === jarId);
      } else if (treeProvider.tree.length === 1) {
        jarRootNode = treeProvider.tree[0];
      } else if (treeProvider.tree.length > 1) {
        const jarItems = treeProvider.tree.map(n => ({
          label: n.label,
          description: n.description,
          node: n
        }));
        const selected = await vscode.window.showQuickPick(jarItems, {
          placeHolder: "Select a JAR to search in"
        });
        if (!selected) return;
        jarRootNode = selected.node;
      }

      if (!jarRootNode) {
        vscode.window.showInformationMessage("No JAR is currently open.");
        return;
      }

      const queryObj = await new Promise((resolve) => {
        const input = vscode.window.createInputBox();
        input.title = "Search Code";
        input.placeholder = `Search inside ${jarRootNode.label}...`;

        let isCaseSensitive = false;
        let isRegex = false;
        let isWholeWord = false;

        const updateButtons = () => {
          input.buttons = [
            {
              iconPath: new vscode.ThemeIcon('case-sensitive'),
              tooltip: isCaseSensitive ? 'Match Case (ON)' : 'Match Case (OFF)'
            },
            {
              iconPath: new vscode.ThemeIcon('whole-word'),
              tooltip: isWholeWord ? 'Match Whole Word (ON)' : 'Match Whole Word (OFF)'
            },
            {
              iconPath: new vscode.ThemeIcon('regex'),
              tooltip: isRegex ? 'Use Regular Expression (ON)' : 'Use Regular Expression (OFF)'
            }
          ];
          input.prompt = `Press Enter to search (Case: ${isCaseSensitive ? 'ON' : 'OFF'}, Word: ${isWholeWord ? 'ON' : 'OFF'}, Regex: ${isRegex ? 'ON' : 'OFF'})`;
        };
        
        updateButtons();

        input.onDidTriggerButton(btn => {
          if (btn.tooltip.startsWith('Match Case')) {
            isCaseSensitive = !isCaseSensitive;
          } else if (btn.tooltip.startsWith('Match Whole Word')) {
            isWholeWord = !isWholeWord;
          } else if (btn.tooltip.startsWith('Use Regular')) {
            isRegex = !isRegex;
          }
          updateButtons();
        });

        input.onDidAccept(() => {
          const query = input.value;
          input.hide();
          resolve(query ? { query, isCaseSensitive, isRegex, isWholeWord } : null);
        });

        input.onDidHide(() => {
          input.dispose();
          resolve(null);
        });
        
        input.show();
      });

      if (!queryObj) return;
      const { query, isCaseSensitive, isRegex, isWholeWord } = queryObj;

      let jarPath = jarRootNode.getId().split("::")[0];
      
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Searching for code: "${query}"...`,
        cancellable: false
      }, async (progress) => {
        try {
          const port = await getJavaServerPort(context);
          const stdout = await makeHttpRequest(port, "/searchcontent", { 
            jarPath, 
            query, 
            isRegex: isRegex.toString(), 
            caseSensitive: isCaseSensitive.toString(),
            isWholeWord: isWholeWord.toString()
          });
          const matchingFiles = JSON.parse(stdout);

          if (!matchingFiles || matchingFiles.length === 0) {
            vscode.window.showInformationMessage(`No files containing "${query}" were found.`);
            searchProvider.setResults(query, jarPath, [], isRegex, isCaseSensitive, isWholeWord);
            return;
          }

          searchProvider.setResults(query, jarPath, matchingFiles, isRegex, isCaseSensitive, isWholeWord);
          vscode.commands.executeCommand('jarExplorerSearch.focus');

        } catch (e) {
          vscode.window.showErrorMessage("Code search failed: " + e.message);
        }
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("jarExplorer.clearSearch", () => {
      searchProvider.clear();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("jarExplorer.openExternalJar", async () => {
      const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: "Open JAR",
        filters: {
          "JAR Archives": ["jar", "zip", "war", "ear"]
        }
      });

      if (fileUris && fileUris[0]) {
        treeProvider.setJarFile(fileUris[0].fsPath);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("jarExplorer.openClassFileAndGoToLine", async (jarPath, entryPath, className, lineNumber) => {
      await openClassFile(jarPath, entryPath, className, treeProvider, context, { isCancellationRequested: false });
      
      setTimeout(() => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const position = new vscode.Position(lineNumber, 0);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
      }, 500); 
    })
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
