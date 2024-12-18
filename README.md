# Show Me in GitHub

An extension for viewing blame information and commit details in VS Code, and copy file/commit URL in GitHub/GitHub Enterprise. Quickly navigate with keyboard shortcuts.

There are a lot of similar extensions, but I love vim-fugitive so much and I want to mimic part of its functionality.

![screenshot](./images/screenshot.jpg)

## Features

- Open GitHub URLs for files and line selections
- Display Git Blame information with color-coded timestamps
- View commit details with automatic line highlighting
- Support for GitHub Enterprise

### Open in GitHub (`Alt+, w`)
- Open the current file in GitHub
- Open with line numbers when text is selected
- Open commit details in diff preview window

### Git Blame Information (`Alt+, b`)
- Toggle Git blame information display
- Shows commit hash, author, and timestamp
- Color-coded: newer commits appear brighter
- Fixed-width format for better readability

### View Commit Details (`Alt+, s`)
- Show commit details for the current line
- Opens in a side panel with diff view
- Automatically highlights the relevant changes
- Press `Esc` to close the diff view

## Requirements

- VS Code 1.60.0 or higher
- Git repository
- GitHub or GitHub Enterprise remote repository

## Installation

There are two ways to install:

1. From VS Code Marketplace:
   - Open Extensions in VS Code (`Ctrl+Shift+X` / `Cmd+Shift+X`)
   - Search for "Show Me in GitHub"
   - Click Install

2. From VSIX file:
   - Download the .vsix file from [releases](https://github.com/su27/show-me-in-github/releases)
   - Drag and drop the file into VS Code
   - Or install from VSIX via VS Code command palette

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

### Examples

1. Open file URL:
   - Open any file in your repository
   - Press `Alt+, w`
   - The file is opened in GitHub

2. Open file URL with line numbers:
   - Select one or multiple lines
   - Press `Alt+, w`
   - The file is opened in GitHub with line numbers

3. View blame information:
   - Press `Alt+, b` to toggle blame info
   - Press again to hide

4. Check commit details:
   - Show blame info first
   - Move cursor to any line
   - Press `Alt+, s` to view commit details

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