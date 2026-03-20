# Aside Comments

Aside brings **Word-style margin comments** to your code. Add, edit, and browse comments that live alongside your source files, stored separately in `.aside/` so your code stays clean.

## Features

- **Margin comments** - Select code and add a comment without modifying the source file
- **File-level comments** - Attach a comment to the entire file, not tied to any specific line
- **Colored indicators** - Each comment gets a colored vertical line in the editor gutter and overview ruler, with 8 preset colors plus a custom color picker
- **Side panel** - Browse all comments for the active file in a dedicated sidebar with inline textarea editing
- **Secondary side bar** - On first run, the panel automatically moves to the secondary (right) side bar for a non-intrusive workflow
- **Editor title button** - Quick-access button in every editor tab to toggle the comments panel
- **File decorations** - Files with comments show a badge (◆) in the Explorer and Open Editors panels
- **Context menu** - Right-click any file in the Explorer or editor tabs to add a file comment
- **Hover tooltips** - Hover any commented line to see the comment, author, and quick edit/delete links
- **Line tracking** - Comments follow their code as you edit, insert, or delete lines
- **Fuzzy re-attach** - When a file changes significantly (e.g. after a git pull), comments attempt to re-anchor to the best matching code using similarity matching
- **Navigation** - Jump between line-based comments with arrow buttons in the editor title bar (hidden when only file comments exist)
- **Per-comment colors** - Pick from 8 preset colors or use the eyedropper icon for any custom color
- **Author detection** - Defaults to your GitHub or Microsoft account name, git config `user.name`, or OS username

## Getting Started

1. Open a file in VS Code
2. Select one or more lines of code
3. Press `Ctrl+Shift+M` (or `Cmd+Shift+M` on Mac), or click the **+** button in the Aside Comments panel
4. Type your comment in the textarea, pick a color, and click **Save** (or `Ctrl+Enter`)

To add a file-level comment (not attached to specific lines), use any of these methods:
- Click the **file+** icon in the Aside Comments panel title bar
- Right-click a file in the Explorer and choose **Add File Comment**
- Right-click an editor tab and choose **Add File Comment**
- Right-click in the editor and choose **Add File Comment**

Comments are stored in `.aside/<filepath>.json` files relative to your workspace root. Add `.aside/` to your `.gitignore` to keep comments local, or commit them to share with your team.

## Commands

| Command | Keybinding | Description |
|---------|-----------|-------------|
| `Aside: Add Comment` | `Ctrl+Shift+M` | Add a comment on the selected lines |
| `Aside: Add File Comment` | - | Add a comment attached to the entire file |
| `Aside: Edit Comment` | - | Edit an existing comment |
| `Aside: Delete Comment` | - | Delete a comment |
| `Aside: Go to Next Comment` | - | Jump to the next comment in the file |
| `Aside: Go to Previous Comment` | - | Jump to the previous comment in the file |
| `Aside: Toggle Comments Panel` | - | Open/focus the comments side panel |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `aside.author` | `""` | Author name for new comments. If empty, detects from GitHub/Microsoft auth, git config, or OS username |
| `aside.storagePath` | `.aside` | Folder name for storing comment files, relative to workspace root |
| `aside.fuzzyMatchThreshold` | `0.7` | Similarity threshold (0-1) for fuzzy re-attaching orphaned comments |
| `aside.showMinimapIndicators` | `true` | Show color indicators in the overview ruler for commented lines |
| `aside.showGutterLines` | `true` | Show comment indicators in the editor gutter |

## How It Works

- Each source file with comments gets a corresponding JSON file in `.aside/` (e.g. `src/app.ts` -> `.aside/src/app.ts.json`)
- Comments store a snapshot of the anchored code so they can be re-attached after external changes
- Line positions are updated in real-time as you type
- If a comment's anchor code is fully replaced, it's marked as **orphaned** with a red indicator
- File-level comments have no line anchor and appear at the top of the comments panel
- Comments auto-save 5 seconds after changes, and immediately on file save
- Each comment stores its color, author, timestamps, and line range
- Author is detected from: configured setting > GitHub auth > Microsoft auth > git config > OS username

## Tips

- **Secondary side bar**: On first activation, Aside Comments tries to move itself to the right side bar. If this doesn't happen automatically, right-click the Aside Comments icon in the activity bar and choose "Move to Secondary Side Bar"
- **Editor button**: Click the Aside Comments lozenge indicator in any editor's title bar to quickly open the comments panel
- **File comments**: Use file-level comments for general notes about a file (e.g. TODOs, architecture notes) that aren't tied to specific lines

## License

MIT
