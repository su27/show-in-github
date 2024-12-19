# Show Me in GitHub

An extension for viewing blame information and commit details in VS Code, and copy file/commit URL in GitHub/GitHub Enterprise. Quickly navigate with keyboard shortcuts.

There are a lot of similar extensions, but I love vim-fugitive so much and I want to mimic part of its functionality.

![screenshot](./images/screenshot.jpg)

## Features

- Open current file/lines in GitHub or GitHub Enterprise
- Show Git blame information with color-coded timestamps
- View commit changes in side-by-side diff

### Open in GitHub (`Alt+, w`)
- Open file in GitHub
- Support line number selection
- Support commit URL in diff view

### Git Blame Information (`Alt+, b`)
- Toggle Git blame information display
- Shows commit hash, author, and timestamp
- Color-coded: newer commits appear brighter

### View Commit Details (`Alt+, s`)
- Show commit details for the current line
- Opens in a side-by-side diff view showing changes before and after the commit
- Shows the full context of the commit changes

## Installation

Install from VS Code Marketplace or download VSIX file from [releases](https://github.com/su27/show-in-github/releases).

## Usage

### Keyboard Shortcuts

Default shortcuts:
- `Alt+, w` - Open in GitHub
- `Alt+, b` - Toggle Git Blame information
- `Alt+, s` - Show commit details for current line

To customize these shortcuts:
1. Open Keyboard Shortcuts in VS Code:
   - Windows/Linux: Press `Ctrl+K Ctrl+S`
   - Mac: Press `Cmd+K Cmd+S`
2. Search for "Show Me in GitHub" to see all commands
3. Click the pencil icon next to any command to edit its shortcut
4. Press your desired key combination
5. Press Enter to save

Or directly edit `keybindings.json`:
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Preferences: Open Keyboard Shortcuts (JSON)"
3. Add your custom keybindings:

### For Vim Users

If you prefer Vim `<leader>` style shortcuts in normal mode like me, you can add these configurations to your `settings.json`:

```json
"vim.normalModeKeyBindingsNonRecursive": [
   {
      "before": [",", "w"],
      "commands": ["openGitHubUrl"]
   },
   {
      "before": [",", "b", "l"],
      "commands": ["showGitBlame"]
   },
   {
      "before": [",", "<CR>"],
      "commands": ["showCommit"]
   }
]
```

### Examples

- Press `Alt+, w` to open current file in GitHub
- Select lines before `Alt+, w` to include line numbers
- Press `Alt+, b` to toggle blame info
- With blame info shown, press `Alt+, s` to view commit changes

## Known Issues

- When open the commit details, the cursor may not be in the correct position.

## Release Notes

### 0.0.3

- Changed keyboard shortcuts from `, w` to `Alt+, w`
- Changed keyboard shortcuts from `, b l` to `Alt+, b`
- Changed keyboard shortcuts from `, s` to `Alt+, s`
- Fixed keyboard shortcuts in diff preview window
- Removed legacy command support

### 0.0.2

- Changed command prefix to "show-me-in-github"
- Changed "Copy GitHub URL" to "Open in GitHub"
- Improved keyboard shortcuts customization instructions
- Fixed activation events

### 0.0.1

Initial release:
- Basic GitHub URL copying functionality
- Git blame information display
- Commit details viewer
- GitHub Enterprise support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the [MIT License](LICENSE).