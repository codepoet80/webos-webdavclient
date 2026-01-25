# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a webOS WebDAV client application built with the Enyo 1.0 framework. It provides a file browser interface for accessing WebDAV servers from legacy webOS devices (TouchPad, Pre3). The app ID is `com.aventer.webdavclientlite`.

## Development Environment

**No build system or package manager** - This is a pure web application using the Enyo 1.0 framework.

**No test framework** - The project has no automated testing infrastructure.

**No linting/formatting tools** - Code style is manually maintained.

### Running the App

- Install on a webOS device using webOS Developer Tools or WOSQI
- For development, the app can be loaded directly in a browser that supports Enyo 1.0
- Entry point is `index.html`

## Architecture

### Enyo Framework (1.0)

The app uses HP/Palm's Enyo 1.0 framework. Key concepts:
- **Kinds**: Enyo components defined with `enyo.kind({...})`
- **Components**: Declarative UI hierarchy in the `components` array
- **Dependency loading**: `depends.js` lists all source files loaded by `enyo.depends()`

### Source Files

| File | Purpose |
|------|---------|
| `source/webdav.js` | Main UI component (`WebDavClient` kind) - server list, file navigator, dialogs |
| `source/davapi.js` | WebDAV protocol handler (`davApi` class) - PROPFIND requests, authentication |
| `source/prefs.js` | LocalStorage wrapper for server configuration |
| `source/mimetypeList.js` | MIME type to icon mappings |
| `source/Updater-Helper.js` | App update checker (App Museum II) |

### UI Structure

Three-panel sliding layout:
1. **Left panel**: Server list with add/configure buttons
2. **Right panel**: File/directory navigator with back/refresh controls
3. **Modal dialogs**: Server configuration, file details, about

### WebDAV Implementation

- Uses `XMLHttpRequest` with `PROPFIND` method
- Supports RFC 2518 and RFC 4437 response formats
- Basic HTTP authentication with Base64 encoding
- Origin header override (`http://localhost`) for ownCloud/NextCloud compatibility

### Data Storage

Server configurations stored in `localStorage` via the `Prefs` utility:
- Protocol, server name, port, path
- Username and password (stored in plain text)

## Code Conventions

- German comments throughout the codebase
- ES5 JavaScript (no modules, no modern syntax)
- Enyo component patterns for UI elements
