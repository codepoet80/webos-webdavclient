# webOS WebDAV Client

<img src="https://raw.githubusercontent.com/codepoet80/webos-webdavclient/master/icon.png">

A WebDAV file browser for webOS devices (TouchPad, Pre3) with full support for ownCloud and NextCloud servers.

Based on an app by Aventer, updates by Jon W.

Original license unknown, modifications under MIT.

## Features

- Browse WebDAV servers with authentication
- Download files to device
- Upload files from device
- Create and delete folders
- Per-server proxy settings
- Works with ownCloud, NextCloud, and other WebDAV servers

## Building from Source

### Requirements

- Palm webOS SDK (provides `palm-package`)
- Standard Unix tools (`ar`, `tar`)

### Build

```bash
./build.sh
```

This creates `com.aventer.webdavclient_X.X.X_all.ipk`.

### Install

**Use webOS Quick Install** (not palm-install) to install the IPK. The app includes a native service that requires post-install scripts to register properly.

## How It Works

The app includes a native JavaScript service that handles authenticated WebDAV operations using curl. This bypasses webOS browser limitations where the built-in download manager doesn't properly pass HTTP Basic Auth credentials to ownCloud/NextCloud servers.

The service requires the webOS homebrew infrastructure (`run-homebrew-js-service`), which is automatically available on any device set up for homebrew apps via webOS Quick Install or Preware.

## Server Setup

This app depends on a WebDAV server of some kind. You may choose to setup a WebDAV server to proxy your Cloud drive storage from a computer in your local area network, allowing webOS mobile devices (like TouchPad or Pre3) to access those files. As an example, I've documented how to setup the excellent open source [WebDAV server Dave](https://github.com/micromata/dave), to serve this purpose...

### Download and Install Dave on your Computer

Dave is cross-platform, and does not include (or particularly need) an installer:

* [Download the latest release of Dave](https://github.com/micromata/dave/releases/) to your platform of choice
* Unzip the contents of the release, and place the Dave folder in an appropriate place for executables for your operating system
* Create a subfolder in the Dave folder called: `config`
* Copy the file `config-sample.yaml` into the new `config` subfolder and rename it to: `config.yaml`

### Configure Dave for your Cloud Storage and Network on your Computer

* Open the newly created `config.yaml` file in a text editor (eg: Notepad, TextWrangler, VSCode, nano, etc...)
* Find the line that starts with `dir` and replace the `/tmp` with the path to your Cloud storage. Note that regardless of Operating System, you should use Unix-convention file paths, where the boot drive is `/` (so on Windows, `/` means `C:\`)
    * Example for OneDrive on Windows: `/Users/YourUserName/OneDrive/Subfolder`
    * Example for OneDrive on Mac: `/users/yourusername/OneDrive/Subfolder`
    * (Unfortunately, because of the presence of system files in the root OneDrive folder, you must use a subfolder)
* Find the line `users` then below that, the line `user`, and below that, remove the line `subdir`
* You may also want to change the username and hashed password. See the [Dave User Management](https://github.com/micromata/dave#user-management) docs for details
* If necessary, you can also change the TCP port that Dave runs on -- the default, 8000, will work for most users

### Start Dave with the new Config on your Computer

* Double-click the Dave executable to start it. Depending on your operating system, you may have to create security or firewall exceptions for it to run. In most cases, the Operating System will prompt you, and you can confirm that Dave is safe to run.
    * For Windows users, if you do not know your network type, and you only plan to use Dave at home, when prompted for a Windows Firewall exception, check the box for both Private and Public network types
* Find the IP address of your computer:
    * Windows: launch a Command Prompt and type `ipconfig`
    * Linux or Mac: launch a Terminal (shell) window and type `ifconfig`
    * In either case, on your home network, your IP address probably starts with: 192.168...

### Configure the webOS WebDAV Client on your Device

**Important Note:** If using a local server, uncheck "Use System Proxy" in the server settings if you have an external proxy configured on your device.

* Install [WebDAV Client from App Museum II](http://appcatalog.webosarchive.org/app/webdav) (or build from this repo and install with webOS Quick Install)
* Press the `+` button to add a new server
* Give your WebDAV server any display name
* Change the protocol to HTTP (HTTPS is supported by Dave, but not covered in this readme)
* In the `Server Name` box, enter the IP address you found above
* Leave the `Server Path` blank
* In the `Username` box, enter: `user` (unless you changed the username above)
* In the `Password` box, enter: `foo` (unless you encoded a new password above)
* Uncheck "Use System Proxy" if connecting to a local server
* Hit the Save button
* Now tap your new Server in the list on the left. In a few seconds, your Cloud files should load!

### Make Dave launch on Startup on your Computer

Each operating system has its own method for makings app launch at startup. I'll cover brief instructions for one way to do this in Windows. For other operating systems or approaches, [Google is your friend](https://www.google.com/search?form=MOZLBR&pc=MOZI&q=making+an+app+run+at+startup+mac).

#### Windows Startup

* Find the Dave executable you unzipped and moved to an appropriate location earlier
* Right-click on it, and choose "Create Shortcut"
* Press the Windows key on your keyboard and type `run` then hit enter
* In the box that appears type `shell:startup`
* Copy (or move) the shortcut you just made into the window that appears
