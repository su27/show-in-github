# Show in GitHub

An extension for viewing blame information and commit details in VS Code, and copy file/commit URL in GitHub/GitHub Enterprise. Quickly navigate with keyboard shortcuts.

## Features

- Copy GitHub URLs for files and line selections
- Display Git Blame information with color-coded timestamps
- View commit details with automatic line highlighting
- Support for GitHub Enterprise

### Open in GitHub (`, w`)
- Open the current file in GitHub
- Open with line numbers when text is selected
- Open commit details in diff preview window

### Git Blame Information (`, b l`)
- Toggle Git blame information display
- Shows commit hash, author, and timestamp
- Color-coded: newer commits appear brighter
- Fixed-width format for better readability

### View Commit Details (`, s`)
- Show commit details for the current line
- Opens in a side panel with diff view
- Automatically highlights the relevant changes
- Press `Esc` to close the diff view

## Requirements

- VS Code 1.60.0 or higher
- Git repository
- GitHub or GitHub Enterprise remote repository

## Installation

1. Open VS Code
2. Press `Ctrl+P` / `Cmd+P`
3. Type `ext install github-file-url`
4. Press Enter

## Usage

### Keyboard Shortcuts

- `, w` - Copy GitHub URL
- `, b l` - Toggle Git Blame information
- `, s` - Show commit details for current line

### Examples

1. Copy file URL:
   - Open any file in your repository
   - Press `, w`
   - URL is copied to clipboard

2. Copy URL with line numbers:
   - Select one or multiple lines
   - Press `, w`
   - URL with line numbers is copied

3. View blame information:
   - Press `, b l` to toggle blame info
   - Press again to hide

4. Check commit details:
   - Show blame info first
   - Move cursor to any line
   - Press `, s` to view commit details

## Extension Settings

This extension contributes the following settings:

* `showInGithub.shortcuts.copyUrl`: Shortcut for copying GitHub URL (default: `, w`)
* `showInGithub.shortcuts.toggleBlame`: Shortcut for toggling Git blame information (default: `, b l`)
* `showInGithub.shortcuts.showCommit`: Shortcut for showing commit details (default: `, s`)

You can customize these shortcuts in your VS Code settings:

## Known Issues

None at the moment.

## Release Notes

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