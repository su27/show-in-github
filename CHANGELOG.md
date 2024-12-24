# Change Log

All notable changes to the "Show Me in GitHub" extension will be documented in this file.

## [0.0.6] - 2024-03-14

### Fixed
- Fixed "Open in GitHub" in diff view to correctly open commit URL instead of file URL

## [0.0.5] - 2024-03-14

### Changed
- Changed commit details view to VS Code's built-in diff editor
- Improved cursor positioning in diff view
- Fixed keyboard shortcuts in Visual mode
- Fixed keyboard shortcuts in diff view

## [0.0.4] - 2024-03-14

### Changed
- Fixed blame info disappearing when switching editors
- Fixed blame info disappearing when opening diff view
- Improved color scheme for blame info
- Added Iosevka Nerd Font support for blame info
- Added syntax highlighting for diff view

## [0.0.3] - 2024-03-14

### Changed
- Changed keyboard shortcuts from `, w` to `Alt+, w`
- Changed keyboard shortcuts from `, b l` to `Alt+, b`
- Changed keyboard shortcuts from `, s` to `Alt+, s`
- Fixed keyboard shortcuts in diff preview window
- Removed legacy command support

## [0.0.2] - 2024-03-14

### Changed
- Changed command prefix to "show-me-in-github"
- Changed "Copy GitHub URL" to "Open in GitHub"
- Improved keyboard shortcuts customization instructions
- Fixed activation events

## [0.0.1] - 2024-03-14

### Added
- Initial release
- Copy GitHub file URL functionality
  - Support for line number selection
  - Support for GitHub Enterprise
  - Support for copying commit URLs from diff view
- Git Blame information display
  - Color-coded timestamps
  - Fixed-width format
  - Toggle functionality
- Commit details viewer
  - Side panel diff view
  - Automatic line highlighting
  - Quick navigation