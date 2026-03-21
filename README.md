# Aside Comments

Word-style margin comments for VS Code. Add comments alongside your code without modifying source files.

## Demo

![Demo](resources/demo.gif)

## Features

- **Line & file comments** - select code and comment, or attach notes to an entire file
- **Panel** - browse and edit all comments in a dedicated panel
- **Colored indicators** - gutter lines, background highlights, and minimap markers with 8 presets + custom colors
- **File decorations** - files with comments show a badge (🗨) in the Explorer and Open Editors panels
- **Hover tooltips** - hover commented lines for quick preview with edit/delete links
- **Line tracking** - comments follow code as you edit, with fuzzy re-attach after external changes

## Getting Started

1. Select lines of code
2. Press `Ctrl+Shift+M` (`Cmd+Shift+M` on Mac) or right-click and choose "Add Comment" or "Add File Comment"
3. Type your comment, pick a color, and save

Comments are stored in `.aside/` files relative to your workspace. Add `.aside/` to `.gitignore` to keep them local, or commit to share with your team.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `aside.author` | `""` | Override auto-detected author name |
| `aside.storagePath` | `.aside` | Storage folder relative to workspace root |
| `aside.fuzzyMatchThreshold` | `0.7` | Similarity threshold (0-1) for re-attaching orphaned comments |
| `aside.showMinimapIndicators` | `true` | Show indicators in the overview ruler |
| `aside.showGutterLines` | `true` | Show indicators in the editor gutter |