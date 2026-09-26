# <img src="./media/icon.png" width="30px" /> JAR Explorer

A Visual Studio Code extension to explore and decompile `.jar`, `.war`, `.ear`, `.zip` and `.vsix` files directly inside VS Code.

Effortlessly browse Java archives, view their internal structure (including **nested archives**), inspect resources, and decompile `.class` files using a custom decompiler like [CFR](https://www.benf.org/other/cfr).

<table align="center">
  <tr>
    <td align="center" style="padding: 4px 10px;">
      <a href="https://github.com/en-rypted/jar-explorer" target="_blank" style="text-decoration: none;">
        <img src="./media/github-black.png" width="20px" height="20px" style="border-radius: 50%; background: white;"><br>
        <b>GitHub</b>
      </a>
    </td>
    <td align="center" style="padding: 4px 10px;"></td>
    <td align="center" style="padding: 4px 10px;">
      <a href="https://www.linkedin.com/in/shivwakchaure" target="_blank" style="text-decoration: none;">
        <img src="./media/linkedin.png" width="18px" height="18px"><br>
        <b>LinkedIn</b>
      </a>
    </td>
    <td align="center" style="padding: 4px 10px;"></td>
    <td align="center" style="padding: 4px 10px;">
      <a href="https://marketplace.visualstudio.com/items?itemName=shivwakchaure.jar-explorer" target="_blank" style="text-decoration: none;">
        🧩<br>
        <b>VS Code</b>
      </a>
    </td>
  </tr>
</table>


---

![JAR Explorer Demo](https://raw.githubusercontent.com/en-rypted/jar-explorer/dev/media/short_demo.gif)

---

## ✨ Features

- 📁 **Tree view** of `.jar`, `.war`,`.ear`,`.zip` and `.vsix` file structures  
- 🧬 View `.class` files with **syntax highlighting and decompiled Java source**  
- 🔭 **Deep Search (Search Code):** Search for text/regex inside all decompiled classes across the JAR simultaneously!
- ⚡ **Lightning Fast Scanning:** Uses native binary scanning for instant results.
- ⚙️ **Advanced Search Options:** Supports Match Case (`Aa`), Match Whole Word (`ab`), and Regular Expressions (`.*`).
- 🧪 Integrates with your custom JAR-based decompiler (e.g. [CFR](https://www.benf.org/other/cfr))  
- ⚙️ Configurable paths for **Decompiler JAR** and **JDK**  
- ⏳ Displays **loading state** while decompiling large files  
- 🚫 Supports **cancellation** and **automatic timeout** for stuck decompilation  
- 🧹 Clean and **modern WebView interface** with file tabs  
- 📂 Handles **multiple JAR/WAR/EAR/ZIP files** simultaneously  
- 🔁 Supports **nested archives** (e.g. JAR inside WAR, WAR inside EAR)  
- 🖼️ View embedded images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg` directly in the viewer  
- ❌ **Remove from Jar Explorer** option for closing archives quickly
- 🧭 **Dedicated navigation icon** in the **Activity Bar** for quick access to the Jar Explorer  

---

## 📽 Demo

![Watch demo](https://raw.githubusercontent.com/en-rypted/jar-explorer/dev/media/large_demo.gif)

## 🧪 How to Use This Extension

Follow these steps to explore and decompile `.jar`, `.war`,`.ear`,`.zip` and `.vsix` archives right inside VS Code:

---

### 1️⃣ Install Java

- Install **Java 21**.
- Make sure the Java binary `bin path` is available in your system `PATH`.
- Alternatively, set the Java path manually in extension settings.

---

### 2️⃣ Open an Archive

- Right-click any supported archive file (`.jar`,`.war`,`.ear`,`.zip`,`.vsix`)
- Select **🧩 Open in JAR Explorer**
- Or simply **click** the file in the VS Code Explorer

> 📌 The file will open in the **Jar Explorer** side panel

---

### 3️⃣ Browse Files in Tree View

- The archive opens in a **folder-like structure**
- You can expand folders and view all contained files, including nested archives

---

### 4️⃣ View Any File

- Click on any file (`.class`, `.xml`, `.json`, `.png`, etc.)
- The content will open in a dedicated **VS Code editor tab**
- `.class` files are automatically decompiled.

---

### 5️⃣ Open Nested Archives

- If an archive contains another archive (e.g., `.jar` inside `.war`), just click on it
- It will appear as a subfolder in the Jar Explorer, allowing further navigation

---

### 6️⃣ Search Inside JARs (Deep Search)

- Hover over an opened JAR in the Jar Explorer panel.
- Click the **🔭 Telescope (Search Code)** icon, or the **🔍 Magnifying Glass (Locate File)** icon.
- Alternatively, type your search query and toggle rules (Regex, Match Case, Match Whole Word).
- Matches will intuitively appear in the new **Search Results** panel! Click any match to open the decompiled file immediately.

---

### 7️⃣ Remove an Archive

- Hover over the root archive node
- Click the **❌ Remove Folder** icon
- The archive will close and the decompiled cache is cleared.

---

### 8️⃣ Need Help?

- If you're stuck, feel free to **ask a question** in the [**Marketplace Q&A section**](https://marketplace.visualstudio.com/items?itemName=shivwakchaure.jar-explorer&ssr=false#qna)
- Feedback and suggestions are always welcome!

---

## 📁 Supported File Types

| File Type | Description                                                                 |
|-----------|-----------------------------------------------------------------------------|
| `.jar`    | Java Archive – used for packaging Java classes, libraries, and metadata     |
| `.war`    | Web Application Archive – used to package web applications (Servlets, JSP, HTML, etc.) |
| `.ear`    | Enterprise Application Archive – packages multiple Java EE modules (JARs, WARs) for deployment |
| `.zip`    | ZIP Archive – compressed archive for bundling multiple files with optional compression |
| `.vsix`   | VS Code Extension Package – used to distribute and install Visual Studio Code extensions |

---

## ⚙️ Requirements

- **Java JDK 21** installed or added to PATH

---

## 🔧 Extension Settings

This extension contributes the following settings:

| Setting | Description |
|--------|-------------|
| `jarExplorer.jdkPath`  | Path to your Java executable (`java`) |

You can add these in your `settings.json`:

```json
{
  "jarExplorer.jdkPath": "D:\\software\\jdk-21.0.4\\bin\\java.exe",
}
```

![JAR Explorer Demo](https://raw.githubusercontent.com/en-rypted/jar-explorer/dev/media/how_change_jdk_path.gif)

## 📝 Release Notes

### 📦 v1.2.1

- ☕ **Hotfix:** Recompiled the Java backend server to target **Java 11**, solving the `UnsupportedClassVersionError` for users running older JVMs (Java 11 - Java 24).

---

### 📦 v1.2.0

- 🔭 **Deep Search Code:** Added a blazing fast backend binary scanner to instantly search for text or regex across all decompiled classes inside a JAR.
- 🎨 **Native UI Integration:** Search results are meticulously designed with native file icons, line numbers, and text highlighting directly in the Tree View!
- ⚙️ **Advanced Matching:** Added native-style toggles for **Match Case**, **Match Whole Word**, and **Regular Expressions**.
- 🖱️ **Instant Navigation:** Clicking a search result instantly navigates you to the exact matched line of code.
- 🎯 **Smart Search Prompts:** Added a dropdown to intelligently pick which JAR to search when multiple archives are open.
- 🧹 Added a **Clear Search Results** action.
- 🍎 Fixed an issue causing improper Java executable paths (`.exe`) on macOS and Linux systems.

---

### 📦 v1.1.0

- Added support for `.war`,`.ear`,`.zip` and `.vsix` archives
- Full support for **nested archives** (e.g., `.jar` inside `.war`)
- Embedded **image viewing**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`
- Improved decompiler support: loading indicators, cancel, and timeout
- Modern WebView UI with tabs and syntax-highlighted `.class` files
- **Activity Bar icon** for quick access to Jar Explorer
- Option to **remove files** from explorer tree
- Handles **multiple archive files** simultaneously

---

See full changelog in [CHANGELOG.md](./CHANGELOG.md)

---

### 📦 v1.0.0

- Added support for viewing files other than `.class` files within the `.jar`.
- Improved file opening behavior and view handling.
- Multiple `.jar` files can now be opened simultaneously in the Jar Explorer tab.
- This is stable release.

---

### 📦 v0.0.1 

- Initial beta release with support for viewing `.class` files.

---

## 💳 Credits

- We have used the CFR Decompiler (https://www.benf.org/other/cfr) to reverse engineer .class files. CFR was chosen for its accuracy, support for modern Java features, and ease of integration into Java-based tooling workflows.
- Icons used from <a href="https://www.flaticon.com/free-icons/files-and-folders" title="files and folders icons">JAR Explorer icon created by bearicons - Flaticon</a>

## 🙌 Stay Connected

If you find this extension helpful, consider supporting it:

<table>
  <tr>
    <td style="vertical-align: middle; padding: 4px;">
      <img src="./media/github-black.png" width="20px" height="20px" style="background:white; border-radius:50%;">
    </td>
    <td style="vertical-align: middle; padding: 4px;">
      ⭐️ <b>Star</b> and <b>Follow</b> the project on
      <a href="https://github.com/en-rypted/jar-explorer" target="_blank">GitHub</a>
    </td>
  </tr>
  <tr>
    <td style="vertical-align: middle; padding: 4px;">
      <img src="./media/linkedin.png" width="18px" height="18px">
    </td>
    <td style="vertical-align: middle; padding: 4px;">
      <b>Follow me on LinkedIn</b>:
      <a href="https://www.linkedin.com/in/shivwakchaure" target="_blank">linkedin.com/in/shivwakchaure</a>
    </td>
  </tr>
</table>

> Your feedback, stars, and shares mean a lot! 💙