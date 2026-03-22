# Changelog

## 0.2.1

- Add search icon in tree view title for searching comments
- Create package tags for better discoverability while improving README

## 0.2.0

- Rename all identifiers from `aside.*` to `asideComments.*` for clarity in settings, commands, and UI
- Create a command to search for comments
- Fix author setting description to reflect actual auto-detection fallback chain
- Change author detection order to Microsoft auth > GitHub auth > git config > OS username
- Rename `showMinimapIndicators` to `showScrollbarIndicators` while implementing setting toggles for scrollbar and gutter indicators (previously defined but not functional)
- Fix file comment targeting when invoked from Explorer context menu on a non-active file
- Create tree view for items with comments
- Add folder comments: right-click a folder in the Explorer to add or view comments
- Add unit test suite with Vitest covering CommentStore, LineTracker, FileMapper, FileDecorationProvider, and types
- Add `showExplorerBadges` setting to toggle comment badges in Explorer and Open Editors

## 0.1.1

- Swap the badge icon from ◆ to 🗨 to better represent comments and avoid confusion with other decorations
- Fix toggle panel button disappearing and not closing the panel
- Change default theme color
- Fix type error in getAuthor return value

## 0.1.0

- Initial release
- Margin comments on code files, stored separately from source code
- File-level comments not tied to specific lines
- Per-comment colors with 8 presets and custom color picker
- Side panel for browsing and editing comments
- Auto-move to secondary side bar on first activation
- Editor title bar navigation buttons
- File decorations with badge in Explorer
- Hover tooltips with quick edit/delete links
- Real-time line tracking as you edit
- Fuzzy re-attach after external changes
- Author detection from GitHub/Microsoft auth, git config, or OS username
