# Focus Files

An extension to keep track of important files by marking them as **focused** and accessing them quickly from a dedicated view. In many situations it can be used instead of the default **open editors** in VSCode to access marked files instad of opened files. Sekect one or multiple files in the **Explorer** then right-click and hit `Add to Focused Files`.

---

## Support This Project

If you find this extension useful, you can support development via PayPal:
[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue)](https://www.paypal.com/donate?hosted_button_id=CRPY96XAY793A)
Thank you for helping keep this extension maintained and improving!

---

## ✨ Features

- 📌 Mark the current file as focused
- 📁 Add files directly from the Explorer (right-click)
- 🔁 Re-marking a file moves it to the top (priority)
- ❌ Remove individual files
- 🧹 Clear all focused files (with confirmation)
- 💾 Persistent state (restored after reload)
- 🧠 Automatically skips deleted files on reload
- 🔢 Configurable maximum number of focused files
- 🖱️ Supports multi-select in Explorer

---

## 📂 Focus Files View

- Located in the Explorer sidebar
- Displays a list of your focused files
- Shows file name + relative path
- Click a file to open it

When empty, a placeholder message is shown:

Use <your shortcut> to add files.

---

## 🚀 Commands

| Command | Description |
|--------|-------------|
| `Focus Files: Mark File` | Add current or selected file(s) to focused list |
| `Focus Files: Remove File` | Remove a file from the list |
| `Focus Files: Clear Files` | Remove all focused files |

---

## 🖱️ Usage

### From Editor
- Open a file
- Run command: **"Mark File"**
- (Optional) Use your keybinding

### From Explorer
- Right-click a file (or multiple files)
- Click **"Add to Focused Files"**

---

## ⚙️ Configuration

Available in VS Code Settings:

```json
{
  "focusFiles.maxItems": 10
}
```

| Setting               | Description                     |
| --------------------- | ------------------------------- |
| `focusFiles.maxItems` | Maximum number of focused files |

**⌨️ Keybindings**

You can assign a shortcut via:

File → Preferences → Keyboard Shortcuts

Search for: `Focus Files: Mark File`

## 🧾 License
 GNU General Public License (GPL) v3