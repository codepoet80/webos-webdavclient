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

// Helper to get user-friendly error message from HTTP status code
function getHttpErrorMessage(httpCode, operation) {
    var code = parseInt(httpCode, 10);
    if (isNaN(code)) return null;

    switch (code) {
        case 401:
            return "Authentication failed. Please check your username and password.";
        case 403:
            return "Access denied. Your credentials may be incorrect or you don't have permission for this operation.";
        case 404:
            return "Resource not found. The file or folder may have been moved or deleted.";
        case 405:
            return "Operation not supported by the server.";
        case 409:
            return "Conflict. The parent folder may not exist, or a resource with that name already exists.";
        case 412:
            return "Precondition failed. The resource may have been modified.";
        case 423:
            return "Resource is locked by another user or process.";
        case 507:
            return "Insufficient storage on the server.";
        default:
            if (code >= 500) {
                return "Server error (HTTP " + code + "). Please try again later.";
            } else if (code >= 400) {
                return "Request failed (HTTP " + code + ").";
            }
            return null;
    }
}

// Helper to build error result with user-friendly message
function buildErrorResult(operation, httpCode, stderr, errorMessage) {
    var friendlyMessage = getHttpErrorMessage(httpCode, operation);
    var errorText;

    if (friendlyMessage) {
        errorText = friendlyMessage;
    } else if (stderr && stderr.trim()) {
        errorText = operation + " failed: " + stderr.trim();
    } else if (errorMessage) {
        errorText = operation + " failed: " + errorMessage;
    } else {
        errorText = operation + " failed.";
    }

    return {
        returnValue: false,
        errorCode: parseInt(httpCode, 10) || -1,
        errorText: errorText,
        httpCode: httpCode
    };
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
            embedCredentials: true,
            noProxy: !useProxy  // Bypass proxy if useProxy is false
        });
    }

    console.log("[WebDAV] Download command: " + command.replace(/"[^"]*:[^"]*"/, '"***:***"'));

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

            // Parse curl HTTP code from stdout if available
            var httpCode = stdout ? stdout.trim() : "";
            var result = buildErrorResult("Download", httpCode, stderr, error.message);
            result.completed = true;
            future.result = result;
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
    // Note: embedCredentials is intentionally omitted here — old webOS curl has a quirk
    // where URL-embedded credentials don't work for PUT, but -u flag does.
    var command = cmd.buildCurlCommand({
        url: url,
        username: args.username,
        password: args.password,
        inputFile: args.localPath,
        method: "PUT",
        insecure: true,
        noProxy: args.useProxy === false
    });

    console.log("[WebDAV] Upload command: " + command.replace(/-u "[^"]*"/, '-u "***:***"'));

    // Execute upload
    cmd.exec(command, function(error, stdout, stderr) {
        if (error) {
            var httpCode = stdout ? stdout.trim() : "";
            var result = buildErrorResult("Upload", httpCode, stderr, error.message);
            result.finish = false;
            future.result = result;
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
        embedCredentials: true,
        insecure: true,
        noProxy: args.useProxy === false
    });

    console.log("[WebDAV] Mkdir command: " + command.replace(/password[^"]*"[^"]*"/, 'password="***"'));

    cmd.exec(command, function(error, stdout, stderr) {
        if (error) {
            var httpCode = stdout ? stdout.trim() : "";
            // Special case: 405 means directory already exists for MKCOL
            if (httpCode === "405") {
                future.result = {
                    returnValue: false,
                    errorCode: 405,
                    errorText: "Directory already exists."
                };
            } else {
                future.result = buildErrorResult("Create directory", httpCode, stderr, error.message);
            }
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
        embedCredentials: true,
        insecure: true,
        noProxy: args.useProxy === false
    });

    console.log("[WebDAV] Delete command: " + command.replace(/password[^"]*"[^"]*"/, 'password="***"'));

    cmd.exec(command, function(error, stdout, stderr) {
        if (error) {
            var httpCode = stdout ? stdout.trim() : "";
            future.result = buildErrorResult("Delete", httpCode, stderr, error.message);
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

    var curlArgs = ["/usr/bin/curl"];
    curlArgs.push("-k");
    curlArgs.push("-s");
    curlArgs.push("-S");
    curlArgs.push("-f");

    if (args.useProxy === false) {
        curlArgs.push("--noproxy", '"*"');
    }

    curlArgs.push("-X", "PROPFIND");
    curlArgs.push("-H", '"Depth: 1"');
    curlArgs.push("-H", '"Content-Type: application/xml"');
    curlArgs.push("-d", "'" + propfindXml + "'");
    curlArgs.push("-w", '"\\n__HTTP_CODE__:%{http_code}"');
    curlArgs.push('"' + cmd.shellEscape(finalUrl) + '"');

    var command = curlArgs.join(" ");
    console.log("[WebDAV] List command: " + command.replace(/:[^@]+@/, ':***@'));

    cmd.exec(command, function(error, stdout, stderr) {
        // Parse HTTP code from output (appended at end)
        var httpCode = null;
        var responseBody = stdout || "";
        var httpCodeMatch = responseBody.match(/__HTTP_CODE__:(\d+)$/);
        if (httpCodeMatch) {
            httpCode = httpCodeMatch[1];
            responseBody = responseBody.replace(/\n?__HTTP_CODE__:\d+$/, "");
        }

        if (error) {
            future.result = buildErrorResult("List directory", httpCode, stderr, error.message);
        } else if (httpCode && parseInt(httpCode, 10) >= 400) {
            // HTTP error but curl didn't fail (shouldn't happen with -f, but just in case)
            future.result = buildErrorResult("List directory", httpCode, stderr, null);
        } else {
            // Return the raw XML response - the UI will parse it
            future.result = {
                returnValue: true,
                response: responseBody,
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
