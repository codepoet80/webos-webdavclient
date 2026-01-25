/**
 * CommandLine - Shell command execution wrapper for webOS services
 */

// Get Node.js require function from IMPORTS (webOS service framework)
var require = IMPORTS.require;

var CommandLine = function() {
    this.childProcess = require("child_process");
};

/**
 * Execute a shell command
 * @param {string} cmd - Command to execute
 * @param {function} callback - Callback function(error, stdout, stderr)
 * @param {number} timeout - Optional timeout in milliseconds (default 300000 = 5 min)
 */
CommandLine.prototype.exec = function(cmd, callback, timeout) {
    var options = {
        encoding: 'utf8',
        timeout: timeout || 300000,
        maxBuffer: 1024 * 1024,
        killSignal: 'SIGTERM'
    };

    this.childProcess.exec(cmd, options, function(error, stdout, stderr) {
        callback(error, stdout, stderr);
    });
};

/**
 * Execute a command and return a promise-like future
 * @param {string} cmd - Command to execute
 * @param {object} future - webOS future object for async result
 * @param {number} timeout - Optional timeout in milliseconds
 */
CommandLine.prototype.execWithFuture = function(cmd, future, timeout) {
    this.exec(cmd, function(error, stdout, stderr) {
        if (error) {
            future.result = {
                returnValue: false,
                errorCode: error.code || -1,
                errorText: stderr || error.message || "Command execution failed",
                stdout: stdout,
                stderr: stderr
            };
        } else {
            future.result = {
                returnValue: true,
                stdout: stdout,
                stderr: stderr
            };
        }
    }, timeout);
};

/**
 * Build a curl command for WebDAV operations
 * @param {object} options - Options object
 * @param {string} options.url - Target URL
 * @param {string} options.username - HTTP Basic auth username
 * @param {string} options.password - HTTP Basic auth password
 * @param {string} options.method - HTTP method (GET, PUT, DELETE, MKCOL)
 * @param {string} options.outputFile - Local file path for downloads
 * @param {string} options.inputFile - Local file path for uploads
 * @param {boolean} options.insecure - Skip SSL certificate verification (default true)
 * @param {boolean} options.embedCredentials - Embed credentials in URL instead of using -u flag
 * @param {boolean} options.noProxy - Bypass system proxy settings
 * @returns {string} The curl command string
 */
CommandLine.prototype.buildCurlCommand = function(options) {
    var args = ["/usr/bin/curl"];

    // SSL options
    if (options.insecure !== false) {
        args.push("-k"); // Skip SSL verification
    }

    // Bypass proxy if requested
    if (options.noProxy) {
        args.push("--noproxy", '"*"');
    }

    // Determine final URL (may have embedded credentials)
    var finalUrl = options.url;

    // Authentication - either embed in URL or use -u flag
    if (options.username && options.password) {
        if (options.embedCredentials) {
            // Embed credentials in URL: http://user:pass@host/path
            // This works better with some reverse proxies
            var encodedUser = encodeURIComponent(options.username);
            var encodedPass = encodeURIComponent(options.password);
            finalUrl = finalUrl.replace(/^(https?:\/\/)/, '$1' + encodedUser + ':' + encodedPass + '@');
        } else {
            // Use -u flag (sends Authorization header)
            var user = this.shellEscape(options.username);
            var pass = this.shellEscape(options.password);
            args.push("-u", '"' + user + ':' + pass + '"');
        }
    }

    // HTTP method
    if (options.method && options.method !== "GET") {
        if (options.method === "PUT" && options.inputFile) {
            // For uploads, use -T (upload-file)
            args.push("-T", '"' + this.shellEscape(options.inputFile) + '"');
        } else {
            args.push("-X", options.method);
        }
    }

    // Output file for downloads
    if (options.outputFile) {
        args.push("-o", '"' + this.shellEscape(options.outputFile) + '"');
    }

    // Progress output
    args.push("--progress-bar");

    // Fail on HTTP errors
    args.push("-f");

    // Write out HTTP code for debugging
    args.push("-w", '"%{http_code}"');

    // Add the URL (always last)
    args.push('"' + this.shellEscape(finalUrl) + '"');

    return args.join(" ");
};

/**
 * Build a wget command for WebDAV downloads (respects proxy settings)
 * @param {object} options - Options object
 * @param {string} options.url - Target URL
 * @param {string} options.username - HTTP Basic auth username
 * @param {string} options.password - HTTP Basic auth password
 * @param {string} options.outputFile - Local file path for download
 * @param {boolean} options.insecure - Skip SSL certificate verification (default true)
 * @returns {string} The wget command string
 */
CommandLine.prototype.buildWgetCommand = function(options) {
    var args = ["/usr/bin/wget"];

    // SSL options
    if (options.insecure !== false) {
        args.push("--no-check-certificate");
    }

    // Authentication
    if (options.username) {
        args.push('--user="' + this.shellEscape(options.username) + '"');
    }
    if (options.password) {
        args.push('--password="' + this.shellEscape(options.password) + '"');
    }

    // Output file
    if (options.outputFile) {
        args.push("-O", '"' + this.shellEscape(options.outputFile) + '"');
    }

    // Add the URL
    args.push('"' + this.shellEscape(options.url) + '"');

    return args.join(" ");
};

/**
 * Escape special characters for shell commands
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
CommandLine.prototype.shellEscape = function(str) {
    if (!str) return "";
    // Escape backslashes first, then other special chars
    return str.toString()
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`')
        .replace(/!/g, '\\!');
};

/**
 * Construct full WebDAV URL from components
 * @param {string} protocol - http or https
 * @param {string} server - Server hostname
 * @param {string} port - Server port
 * @param {string} serverpath - Base path on server
 * @param {string} path - Resource path
 * @returns {string} Full URL
 */
CommandLine.prototype.buildWebDAVUrl = function(protocol, server, port, serverpath, path) {
    var url = protocol + "://" + server;

    // Add port if not default
    if (port && port !== "80" && port !== "443") {
        url += ":" + port;
    } else if (port === "443" && protocol === "https") {
        // Don't add default HTTPS port
    } else if (port === "80" && protocol === "http") {
        // Don't add default HTTP port
    } else if (port) {
        url += ":" + port;
    }

    // Add server path
    if (serverpath) {
        if (serverpath.charAt(0) !== "/") {
            url += "/";
        }
        url += serverpath;
    }

    // Add resource path (URL-encode if not already encoded)
    if (path) {
        if (path.charAt(0) !== "/" && url.charAt(url.length - 1) !== "/") {
            url += "/";
        }
        // URL-encode the path if it contains unencoded characters like spaces
        if (path.indexOf(' ') >= 0 || path.indexOf('%') < 0) {
            url += encodeURI(path);
        } else {
            url += path;
        }
    }

    return url;
};
