## Focus Files


The **Focus Files** extension helps you quickly access your most important files and locations, letting you stay organized and productive. Instead of relying on VSCode’s default **Open Editors**, you can mark files or specific locations as **focused** and navigate them easily through a dedicated view.

---

## Support This Project

If you find this extension useful, you can support development via PayPal:
[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue)](https://www.paypal.com/donate?hosted_button_id=CRPY96XAY793A)
Thank you for helping keep this extension maintained and improving!

---
## ✨ What's new

This version incorporates:

- Pinned positions with labels
- Preview text size configuration
- `Remove Position` command
- Placeholder instructions updated to match current behavior

---

## ✨ Features

- 📌 **Mark the current file as focused** – Pin the file you are working on for easy access.
- 📁 **Add files directly from the Explorer** – Select one or multiple files, right-click, and choose **Pin to Focused Files**.
- 🔖 **Pin specific text locations** – Highlight text and pin it; the location will appear under the main file with a label, line, and column.
- 🔁 **Re-marking a file moves it to the top** – Priority is given to recently pinned files.
- ❌ **Remove individual files or positions** – Delete pins without affecting other focused files.
- 🧹 **Clear all focused files** – Remove everything at once (with confirmation).
- 💾 **Persistent state** – Your focused files and positions are saved and restored after reload.
- 🧠 **Automatically skips deleted files** – Focused files that no longer exist are ignored on reload.
- 🔢 **Configurable maximums** – Set limits for the number of focused files and positions per file.
- 🖱️ **Supports multi-select in Explorer** – Pin multiple files at once for efficiency.

Stay focused, reduce clutter, and navigate your key files faster than ever.

---

## 📂 Focus Files View

- Located in the Explorer sidebar
- Displays a list of your focused files
- Shows file name + relative path, and any pinned positions with labels
- Click a file to open it or a position to jump to the exact location

When empty, a placeholder message is shown:

Use the default `ctrl+alt+f` to add files or set your own shortcut

---

## 🚀 Commands

| Command | Description |
|--------|-------------|
| `Focus Files: Mark File` | Add current file or selection(s) to the focused list |
| `Focus Files: Remove File` | Remove a file from the list |
| `Focus Files: Remove Position` | Remove a pinned position within a file |
| `Focus Files: Clear Files` | Remove all focused files |

---

## 🖱️ Usage

### From Editor
- Open a file
- Select text (optional) to pin a specific location
- Run command: **"Mark File"**
- (Optional) Use your keybinding

### From Explorer
- Right-click a file (or multiple files)
- Click **"Pin to Focused Files"**

---


## ⚙️ Configuration

Available in VS Code Settings:

```json
{
  "focusFiles.maxItems": 10,
  "focusFiles.maxPositionsPerFile": 5,
  "focusFiles.minPreviewSize": 10,
  "focusFiles.maxPreviewSize": 50
}
```

| Setting               | Description                     |
| --------------------- | ------------------------------- |
| `focusFiles.maxItems` | Maximum number of focused files |
| `focusFiles.maxPositionsPerFile` | Maximum number of pinned positions per file|
| `focusFiles.minPreviewSize` | 	Minimum preview text length for position labels |
| `focusFiles.maxPreviewSize` | Maximum preview text length for position labels |

**⌨️ Keybindings**

You can assign a shortcut via:

File → Preferences → Keyboard Shortcuts

Search for: `Focus Files: Mark File`

## 🧾 License
 GNU General Public License (GPL) v3