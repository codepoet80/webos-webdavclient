# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a webOS WebDAV client application built with the Enyo 1.0 framework. It provides a file browser interface for accessing WebDAV servers from legacy webOS devices (TouchPad, Pre3). The app ID is `com.aventer.webdavclient`.

The app includes a **native JavaScript service** that uses curl for authenticated WebDAV operations (download, upload, mkdir, delete, directory listing), bypassing webOS browser limitations with authentication.

## Building

Run the build script to create an installable IPK:

```bash
./build.sh
```

This will:
1. Validate all required files are present
2. Run `palm-package` to create the initial IPK
3. Inject `postinst` and `prerm` scripts into the control archive (palm-package doesn't do this automatically)
4. Output the final IPK file

**Install using webOS Quick Install** (not palm-install) - the postinst scripts are required for service registration.

## Architecture

### Enyo Framework (1.0)

The app uses HP/Palm's Enyo 1.0 framework. Key concepts:
- **Kinds**: Enyo components defined with `enyo.kind({...})`
- **Components**: Declarative UI hierarchy in the `components` array
- **Dependency loading**: `depends.js` lists all source files loaded by `enyo.depends()`

### Source Files (UI)

| File | Purpose |
|------|---------|
| `source/webdav.js` | Main UI component (`WebDavClient` kind) - server list, file navigator, dialogs |
| `source/webdav-service.js` | UI-side wrapper for calling the native service via PalmServiceBridge |
| `source/davapi.js` | WebDAV protocol handler (`davApi` class) - XHR fallback for PROPFIND |
| `source/prefs.js` | LocalStorage wrapper for server configuration |
| `source/mimetypeList.js` | MIME type to icon mappings |
| `source/Updater-Helper.js` | App update checker (App Museum II) |

### Service Files (Native Service)

| File | Purpose |
|------|---------|
| `service/webdav-assistant.js` | Command handlers (Download, Upload, List, Mkdir, Delete, etc.) |
| `service/commandline.js` | Shell command execution wrapper for curl/wget |
| `service/services.json` | Service definition and command registration |
| `service/sources.json` | Service source file manifest |
| `service/dbus` | D-BUS service registration file |
| `service/roles.json` | Luna Service Bus permissions (allows inbound connections) |

### Package Files

| File | Purpose |
|------|---------|
| `package/packageinfo.json` | Package metadata |
| `package/postinst` | Post-install script - copies service files, registers D-BUS and role files |
| `package/prerm` | Pre-remove script - cleans up service registration |

### UI Structure

Three-panel sliding layout:
1. **Left panel**: Server list with add/configure buttons
2. **Right panel**: File/directory navigator with back/refresh/upload controls
3. **Modal dialogs**: Server configuration, file details, about

### Native Service

The native service (`com.aventer.webdavclient.service`) handles authenticated WebDAV operations using curl:

- **Why needed**: webOS's built-in download manager doesn't properly pass HTTP Basic Auth credentials to ownCloud/NextCloud servers
- **How it works**: The UI calls the service via `PalmServiceBridge`, the service executes curl commands with proper authentication
- **Service runner**: Uses `run-homebrew-js-service` (from webOS homebrew infrastructure) to avoid jail sandbox issues

Service commands:
- `status` / `version` - Service health checks
- `download` - Download file with authentication
- `upload` - Upload file via PUT
- `list` - Directory listing via PROPFIND
- `mkdir` - Create directory via MKCOL
- `delete` - Delete resource via DELETE
- `getPrefs` / `setPrefs` - Service preferences

### Data Storage

Server configurations stored in `localStorage` via the `Prefs` utility:
- Protocol, server name, port, path
- Username and password (stored in plain text)
- Per-server proxy bypass setting

## Code Conventions

- German comments throughout the original codebase
- ES5 JavaScript (no modules, no modern syntax)
- Enyo component patterns for UI elements

## Service Registration

The postinst script handles service registration:
1. Copies service files to `/media/cryptofs/apps/usr/palm/services/com.aventer.webdavclient.service/`
2. Registers D-BUS service in `/var/palm/ls2/services/{prv,pub}/`
3. Installs role files in `/var/palm/ls2/roles/{prv,pub}/` for Luna permissions
4. Runs `ls-control scan-services` to refresh service registry

## Dependencies

- webOS homebrew infrastructure (provides `run-homebrew-js-service`)
- curl binary at `/usr/bin/curl`
- Typically satisfied by any device set up for homebrew apps via webOS Quick Install
