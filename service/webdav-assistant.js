/**
 * WebDAV Service Assistants
 * Provides authenticated file transfer operations via curl/wget
 */

// Get Node.js require function from IMPORTS (webOS service framework)
var require = IMPORTS.require;

var fs = require("fs");
var path = require("path");
var cmd = new CommandLine();

// Helper function for older Node.js that lacks fileExists
function fileExists(filepath) {
    try {
        fs.statSync(filepath);
        return true;
    } catch (e) {
        return false;
    }
}

// Helper to copy object (older Node.js lacks Object.assign)
function copyObject(src) {
    var dest = {};
    for (var key in src) {
        if (src.hasOwnProperty(key)) {
            dest[key] = src[key];
        }
    }
    return dest;
}

// Helper to merge objects (older Node.js lacks Object.assign)
function mergeObjects(dest, src) {
    for (var key in src) {
        if (src.hasOwnProperty(key)) {
            dest[key] = src[key];
        }
    }
    return dest;
}

// Helper for string endsWith (older Node.js lacks this method)
function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

// Helper to create directory recursively (older Node.js lacks recursive option)
function mkdirp(dirpath) {
    var parts = dirpath.split('/');
    var current = '';
    for (var i = 0; i < parts.length; i++) {
        current += parts[i] + '/';
        if (current && !fileExists(current)) {
            try {
                fs.mkdirSync(current);
            } catch (e) {
                if (e.code !== 'EEXIST') throw e;
            }
        }
    }
}

var SERVICE_VERSION = "1.0.0";
var PREFS_PATH = "/media/internal/.webdavclient-prefs.json";

// Default preferences
var defaultPrefs = {
    useWget: false,  // Use curl by default (respects proxy)
    useProxy: true,  // Use curl for all operations (including directory listing) to respect system proxy
    downloadPath: "/media/internal/downloads"
};

/**
 * StatusAssistant - Check if service is running
 */
var StatusAssistant = function() {};

StatusAssistant.prototype.run = function(future) {
    future.result = {
        returnValue: true,
        status: "running",
        message: "WebDAV service is operational"
    };
};

/**
 * VersionAssistant - Return service version
 */
var VersionAssistant = function() {};

VersionAssistant.prototype.run = function(future) {
    future.result = {
        returnValue: true,
        version: SERVICE_VERSION
    };
};

/**
 * DownloadAssistant - Download file from WebDAV server
 *
 * Parameters:
 *   url: Full URL to download (if provided, ignores other URL components)
 *   -OR-
 *   protocol: http or https
 *   server: Server hostname
 *   port: Server port
 *   serverpath: Base path on server
 *   path: Resource path to download
 *
 *   localPath: Local file path to save to
 *   username: HTTP Basic auth username
 *   password: HTTP Basic auth password
 *   useWget: Boolean, use wget instead of curl (respects proxy)
 */
var DownloadAssistant = function() {};

DownloadAssistant.prototype.run = function(future, subscription) {
    var args = this.controller.args;

    // Validate required parameters
    if (!args.localPath) {
        future.result = {
            returnValue: false,
            errorCode: -1,
            errorText: "Missing required parameter: localPath"
        };
        return;
    }

    // Build URL from components or use provided URL
    var url;
    if (args.url) {
        url = args.url;
    } else if (args.server) {
        url = cmd.buildWebDAVUrl(
            args.protocol || "https",
            args.server,
            args.port || "443",
            args.serverpath || "",
            args.path || ""
        );
    } else {
        future.result = {
            returnValue: false,
            errorCode: -1,
            errorText: "Missing required parameter: url or server"
        };
        return;
    }

    console.log("[WebDAV] Download URL: " + url);
    console.log("[WebDAV] Args: protocol=" + args.protocol + " server=" + args.server + " port=" + args.port + " serverpath=" + args.serverpath + " path=" + args.path);

    // Ensure download directory exists
    var downloadDir = path.dirname(args.localPath);
    try {
        if (!fileExists(downloadDir)) {
            mkdirp(downloadDir);
        }
    } catch (e) {
        future.result = {
            returnValue: false,
            errorCode: -2,
            errorText: "Cannot create download directory: " + e.message
        };
        return;
    }

    // Build command based on preference
    var command;
    var useWget = args.useWget || false;
    var useProxy = args.useProxy !== false; // default to true

    if (useWget) {
        command = cmd.buildWgetCommand({
            url: url,
            username: args.username,
            password: args.password,
            outputFile: args.localPath,
            insecure: true
        });
    } else {
        command = cmd.buildCurlCommand({
            url: url,
            username: args.username,
            password: args.password,
            outputFile: args.localPath,
            method: "GET",
            insecure: true,
            embedCredentials: true,  // Embed in URL for better proxy compatibility
            noProxy: !useProxy  // Bypass proxy if useProxy is false
        });
    }

    console.log("[WebDAV] Download command: " + command.replace(/password[^"]*"[^"]*"/, 'password="***"'));

    // Execute download with longer timeout (10 minutes)
    cmd.exec(command, function(error, stdout, stderr) {
        if (error) {
            // Clean up partial download on error
            try {
                if (fileExists(args.localPath)) {
                    fs.unlinkSync(args.localPath);
                }
            } catch (e) {
                // Ignore cleanup errors
            }

            var errorText = "Download failed";
            if (stderr) {
                errorText += ": " + stderr;
            } else if (error.message) {
                errorText += ": " + error.message;
            }

            // Parse curl HTTP code from stdout if available
            var httpCode = stdout ? stdout.trim() : "";
            if (httpCode && !isNaN(parseInt(httpCode))) {
                errorText += " (HTTP " + httpCode + ")";
            }

            future.result = {
                returnValue: false,
                errorCode: error.code || -1,
                errorText: errorText,
                completed: true
            };
        } else {
            // Verify file was actually downloaded
            var fileExists = false;
            var fileSize = 0;
            try {
                var stats = fs.statSync(args.localPath);
                fileExists = stats.isFile();
                fileSize = stats.size;
            } catch (e) {
                fileExists = false;
            }

            if (!fileExists || fileSize === 0) {
                future.result = {
                    returnValue: false,
                    errorCode: -3,
                    errorText: "Download completed but file is empty or missing",
                    completed: true
                };
            } else {
                future.result = {
                    returnValue: true,
                    localPath: args.localPath,
                    fileSize: fileSize,
                    completed: true
                };
            }
        }
    }, 600000); // 10 minute timeout
};

/**
 * UploadAssistant - Upload file to WebDAV server
 *
 * Parameters:
 *   localPath: Local file path to upload (required)
 *   url: Full URL to upload to (if provided, ignores other URL components)
 *   -OR-
 *   protocol: http or https
 *   server: Server hostname
 *   port: Server port
 *   serverpath: Base path on server
 *   path: Resource path to upload to
 *
 *   username: HTTP Basic auth username
 *   password: HTTP Basic auth password
 */
var UploadAssistant = function() {};

UploadAssistant.prototype.run = function(future) {
    var args = this.controller.args;

    // Validate required parameters
    if (!args.localPath) {
        future.result = {
            returnValue: false,
            errorCode: -1,
            errorText: "Missing required parameter: localPath"
        };
        return;
    }

    // Check source file exists
    try {
        if (!fileExists(args.localPath)) {
            future.result = {
                returnValue: false,
                errorCode: -2,
                errorText: "Source file does not exist: " + args.localPath
            };
            return;
        }
    } catch (e) {
        future.result = {
            returnValue: false,
            errorCode: -2,
            errorText: "Cannot access source file: " + e.message
        };
        return;
    }

    // Build URL from components or use provided URL
    var url;
    if (args.url) {
        url = args.url;
    } else if (args.server) {
        url = cmd.buildWebDAVUrl(
            args.protocol || "https",
            args.server,
            args.port || "443",
            args.serverpath || "",
            args.path || ""
        );
    } else {
        future.result = {
            returnValue: false,
            errorCode: -1,
            errorText: "Missing required parameter: url or server"
        };
        return;
    }

    // Build curl command (wget doesn't support PUT uploads)
    var command = cmd.buildCurlCommand({
        url: url,
        username: args.username,
        password: args.password,
        inputFile: args.localPath,
        method: "PUT",
        embedCredentials: true,  // Embed in URL for better proxy compatibility
        insecure: true,
        noProxy: args.useProxy === false  // Bypass proxy if user disabled it
    });

    console.log("[WebDAV] Upload command: " + command.replace(/password[^"]*"[^"]*"/, 'password="***"'));

    // Execute upload
    cmd.exec(command, function(error, stdout, stderr) {
        if (error) {
            var errorText = "Upload failed";
            if (stderr) {
                errorText += ": " + stderr;
            } else if (error.message) {
                errorText += ": " + error.message;
            }

            var httpCode = stdout ? stdout.trim() : "";
            if (httpCode && !isNaN(parseInt(httpCode))) {
                errorText += " (HTTP " + httpCode + ")";
            }

            future.result = {
                returnValue: false,
                errorCode: error.code || -1,
                errorText: errorText,
                finish: false
            };
        } else {
            future.result = {
                returnValue: true,
                finish: true
            };
        }
    }, 600000); // 10 minute timeout
};

/**
 * MkdirAssistant - Create directory on WebDAV server (MKCOL)
 *
 * Parameters:
 *   url: Full URL to create (if provided, ignores other URL components)
 *   -OR-
 *   protocol, server, port, serverpath, path
 *
 *   username: HTTP Basic auth username
 *   password: HTTP Basic auth password
 */
var MkdirAssistant = function() {};

MkdirAssistant.prototype.run = function(future) {
    var args = this.controller.args;

    // Build URL
    var url;
    if (args.url) {
        url = args.url;
    } else if (args.server) {
        url = cmd.buildWebDAVUrl(
            args.protocol || "https",
            args.server,
            args.port || "443",
            args.serverpath || "",
            args.path || ""
        );
    } else {
        future.result = {
            returnValue: false,
            errorCode: -1,
            errorText: "Missing required parameter: url or server"
        };
        return;
    }

    // Ensure URL ends with / for directory
    if (!endsWith(url, "/")) {
        url += "/";
    }

    var command = cmd.buildCurlCommand({
        url: url,
        username: args.username,
        password: args.password,
        method: "MKCOL",
        insecure: true,
        embedCredentials: true,
        noProxy: args.useProxy === false
    });

    console.log("[WebDAV] Mkdir command: " + command.replace(/password[^"]*"[^"]*"/, 'password="***"'));

    cmd.exec(command, function(error, stdout, stderr) {
        if (error) {
            var errorText = "Failed to create directory";
            if (stderr) {
                errorText += ": " + stderr;
            }

            var httpCode = stdout ? stdout.trim() : "";
            if (httpCode && !isNaN(parseInt(httpCode))) {
                if (httpCode === "405") {
                    errorText = "Directory already exists";
                } else {
                    errorText += " (HTTP " + httpCode + ")";
                }
            }

            future.result = {
                returnValue: false,
                errorCode: error.code || -1,
                errorText: errorText
            };
        } else {
            future.result = {
                returnValue: true
            };
        }
    }, 30000); // 30 second timeout
};

/**
 * DeleteAssistant - Delete file or directory on WebDAV server
 *
 * Parameters:
 *   url: Full URL to delete (if provided, ignores other URL components)
 *   -OR-
 *   protocol, server, port, serverpath, path
 *
 *   username: HTTP Basic auth username
 *   password: HTTP Basic auth password
 */
var DeleteAssistant = function() {};

DeleteAssistant.prototype.run = function(future) {
    var args = this.controller.args;

    // Build URL
    var url;
    if (args.url) {
        url = args.url;
    } else if (args.server) {
        url = cmd.buildWebDAVUrl(
            args.protocol || "https",
            args.server,
            args.port || "443",
            args.serverpath || "",
            args.path || ""
        );
    } else {
        future.result = {
            returnValue: false,
            errorCode: -1,
            errorText: "Missing required parameter: url or server"
        };
        return;
    }

    var command = cmd.buildCurlCommand({
        url: url,
        username: args.username,
        password: args.password,
        method: "DELETE",
        insecure: true,
        embedCredentials: true,
        noProxy: args.useProxy === false
    });

    console.log("[WebDAV] Delete command: " + command.replace(/password[^"]*"[^"]*"/, 'password="***"'));

    cmd.exec(command, function(error, stdout, stderr) {
        if (error) {
            var errorText = "Failed to delete";
            if (stderr) {
                errorText += ": " + stderr;
            }

            var httpCode = stdout ? stdout.trim() : "";
            if (httpCode && !isNaN(parseInt(httpCode))) {
                if (httpCode === "404") {
                    errorText = "Resource not found";
                } else {
                    errorText += " (HTTP " + httpCode + ")";
                }
            }

            future.result = {
                returnValue: false,
                errorCode: error.code || -1,
                errorText: errorText
            };
        } else {
            future.result = {
                returnValue: true
            };
        }
    }, 30000); // 30 second timeout
};

/**
 * ListAssistant - List directory contents via PROPFIND
 *
 * Parameters:
 *   url: Full URL to list (if provided, ignores other URL components)
 *   -OR-
 *   protocol, server, port, serverpath, path
 *
 *   username: HTTP Basic auth username
 *   password: HTTP Basic auth password
 *   useProxy: Boolean, if false adds --noproxy to bypass system proxy
 */
var ListAssistant = function() {};

ListAssistant.prototype.run = function(future) {
    var args = this.controller.args;

    // Build URL
    var url;
    if (args.url) {
        url = args.url;
    } else if (args.server) {
        url = cmd.buildWebDAVUrl(
            args.protocol || "https",
            args.server,
            args.port || "443",
            args.serverpath || "",
            args.path || ""
        );
    } else {
        future.result = {
            returnValue: false,
            errorCode: -1,
            errorText: "Missing required parameter: url or server"
        };
        return;
    }

    // Ensure URL ends with / for directory listing
    if (!endsWith(url, "/")) {
        url += "/";
    }

    console.log("[WebDAV] List URL: " + url);

    // Build curl command for PROPFIND
    var finalUrl = url;
    if (args.username && args.password) {
        var encodedUser = encodeURIComponent(args.username);
        var encodedPass = encodeURIComponent(args.password);
        finalUrl = finalUrl.replace(/^(https?:\/\/)/, '$1' + encodedUser + ':' + encodedPass + '@');
    }

    // Build PROPFIND XML body
    var propfindXml = '<?xml version="1.0" encoding="utf-8" ?><D:propfind xmlns:D="DAV:"><D:allprop /></D:propfind>';

    // Build curl command manually for PROPFIND
    var curlArgs = ["/usr/bin/curl"];
    curlArgs.push("-k"); // Skip SSL verification
    curlArgs.push("-s"); // Silent mode

    // Bypass proxy if useProxy is false
    if (args.useProxy === false) {
        curlArgs.push("--noproxy", '"*"');
    }

    curlArgs.push("-X", "PROPFIND");
    curlArgs.push("-H", '"Depth: 1"');
    curlArgs.push("-H", '"Content-Type: application/xml"');
    curlArgs.push("-d", "'" + propfindXml + "'");
    curlArgs.push('"' + cmd.shellEscape(finalUrl) + '"');

    var command = curlArgs.join(" ");
    console.log("[WebDAV] List command: " + command.replace(/:[^@]+@/, ':***@'));

    cmd.exec(command, function(error, stdout, stderr) {
        if (error) {
            var errorText = "Failed to list directory";
            if (stderr) {
                errorText += ": " + stderr;
            }
            future.result = {
                returnValue: false,
                errorCode: error.code || -1,
                errorText: errorText
            };
        } else {
            // Return the raw XML response - the UI will parse it
            future.result = {
                returnValue: true,
                response: stdout,
                contentType: "application/xml"
            };
        }
    }, 60000); // 60 second timeout
};

/**
 * GetPrefsAssistant - Read user preferences
 */
var GetPrefsAssistant = function() {};

GetPrefsAssistant.prototype.run = function(future) {
    var prefs = copyObject(defaultPrefs);

    try {
        if (fileExists(PREFS_PATH)) {
            var data = fs.readFileSync(PREFS_PATH, 'utf8');
            var savedPrefs = JSON.parse(data);
            prefs = mergeObjects(prefs, savedPrefs);
        }
    } catch (e) {
        console.log("[WebDAV] Could not read prefs: " + e.message);
    }

    future.result = {
        returnValue: true,
        prefs: prefs
    };
};

/**
 * SetPrefsAssistant - Save user preferences
 *
 * Parameters:
 *   useWget: Boolean, prefer wget over curl
 *   downloadPath: Default download directory
 */
var SetPrefsAssistant = function() {};

SetPrefsAssistant.prototype.run = function(future) {
    var args = this.controller.args;

    // Load existing prefs
    var prefs = copyObject(defaultPrefs);
    try {
        if (fileExists(PREFS_PATH)) {
            var data = fs.readFileSync(PREFS_PATH, 'utf8');
            var savedPrefs = JSON.parse(data);
            prefs = mergeObjects(prefs, savedPrefs);
        }
    } catch (e) {
        // Ignore read errors, use defaults
    }

    // Update with new values
    if (args.useWget !== undefined) {
        prefs.useWget = !!args.useWget;
    }
    if (args.useProxy !== undefined) {
        prefs.useProxy = !!args.useProxy;
    }
    if (args.downloadPath !== undefined) {
        prefs.downloadPath = args.downloadPath;
    }

    // Save prefs
    try {
        fs.writeFileSync(PREFS_PATH, JSON.stringify(prefs, null, 2), 'utf8');
        future.result = {
            returnValue: true,
            prefs: prefs
        };
    } catch (e) {
        future.result = {
            returnValue: false,
            errorCode: -1,
            errorText: "Failed to save preferences: " + e.message
        };
    }
};
