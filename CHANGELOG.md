# 📦 Changelog

All notable changes to this project will be documented here.

---

## [1.1.0] – 2025-07-25

### 🆕 Archive Support Enhancements
- ✅ Added support for **`.war`**, **`.ear`**,**`.zip`** and **`.vsix`** files alongside `.jar`
- 🔁 Supports browsing **nested archives** (e.g. `.jar` inside `.war`, `.war` inside `.ear`, etc.)
- 📂 Improved tree view to reflect internal structure of multi-level archive files

### 🖼️ File Viewing Improvements
- 🖼️ Now you can **view embedded images**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`
- 📜 Added syntax highlighting and viewing for `.xml`, `.json`, `.properties`, `.txt`

### 🔧 Decompilation Features
- 🧬 Enhanced `.class` file viewer with **decompiled Java output**
- ⏳ Shows **loading indicator** while decompiling large `.class` files
- 🚫 Added support for **decompilation cancellation** and timeout fallback
- ⚙️ Customizable path to your **Decompiler JAR** (e.g., CFR) and optional JDK

### 💡 UI and UX Enhancements
- 🧭 Introduced **dedicated Activity Bar icon** for quick access to the Jar Explorer
- 🧹 Clean and modern **WebView-based decompiled code viewer**
- ❌ **Remove file** option from Jar Explorer to manage open archives easily
- 📂 Support for **opening and exploring multiple archives** simultaneously

✅ **Upgrade now** to explore and decompile all your Java archives—even deeply nested ones—right inside VS Code!

---

## [1.0.0] – 2025-07-19

### 🚀 Added
- Support for opening non-`.class` files (e.g., `.xml`, `.properties`, `.txt`) directly from JARs
- Ability to open and manage **multiple JAR files** simultaneously in the Jar Explorer
- Improved file viewer handling with better error resilience and support for more file types

---

## [0.0.1] – 2025-07-18

### 🎉 Initial Release
- View `.class` files from `.jar` archives with syntax highlighting
- Basic tree view to explore archive structure
