/**
 * WebDavService - UI-side wrapper for WebDAV native service
 * Provides a clean API for the Enyo UI to call the native service
 * Uses PalmServiceBridge for webOS service invocation (same as Enyo's PalmService kind)
 */

var WebDavService = function() {
    this.serviceUri = "palm://com.aventer.webdavclient.service/";
    this.serviceAvailable = null; // null = unknown, true/false after check
};

/**
 * Internal method to make a service call using PalmServiceBridge
 * @param {string} method - Service method name
 * @param {object} params - Parameters to pass
 * @param {function} onSuccess - Success callback
 * @param {function} onFailure - Failure callback
 */
WebDavService.prototype._call = function(method, params, onSuccess, onFailure) {
    var bridge = new PalmServiceBridge();

    bridge.onservicecallback = function(response) {
        var result;
        try {
            result = typeof response === 'string' ? JSON.parse(response) : response;
        } catch (e) {
            enyo.warn("[WebDavService] Failed to parse response: " + e);
            if (onFailure) onFailure({ errorText: "Failed to parse response" });
            return;
        }

        // Check for failure
        if (!result || result.errorCode || result.returnValue === false) {
            if (onFailure) onFailure(result || { errorText: "Service call failed" });
        } else {
            if (onSuccess) onSuccess(result);
        }
    };

    var uri = this.serviceUri + method;
    var json = JSON.stringify(params || {});

    enyo.log("[WebDavService] Calling: " + uri);
    bridge.call(uri, json);

    return bridge;
};

/**
 * Check if the service is available
 * @param {function} callback - Callback(isAvailable)
 */
WebDavService.prototype.checkAvailable = function(callback) {
    var self = this;

    this._call("status", {},
        function(response) {
            self.serviceAvailable = true;
            enyo.log("[WebDavService] Service is available");
            if (callback) callback(true);
        },
        function(response) {
            self.serviceAvailable = false;
            enyo.warn("[WebDavService] Service not available: " + JSON.stringify(response));
            if (callback) callback(false);
        }
    );
};

/**
 * Get service version
 * @param {function} onSuccess - Callback({version: string})
 * @param {function} onFailure - Callback({errorText: string})
 */
WebDavService.prototype.getVersion = function(onSuccess, onFailure) {
    this._call("version", {}, onSuccess, onFailure);
};

/**
 * Download a file from WebDAV server
 * @param {object} options - Download options
 * @param {string} options.url - Full URL to download (optional if server params provided)
 * @param {string} options.protocol - http or https
 * @param {string} options.server - Server hostname
 * @param {string} options.port - Server port
 * @param {string} options.serverpath - Base path on server
 * @param {string} options.path - Resource path
 * @param {string} options.localPath - Local file path to save to
 * @param {string} options.username - HTTP Basic auth username
 * @param {string} options.password - HTTP Basic auth password
 * @param {boolean} options.useWget - Use wget instead of curl (respects proxy)
 * @param {function} onSuccess - Success callback({localPath, fileSize, completed})
 * @param {function} onFailure - Failure callback({errorText, errorCode})
 */
WebDavService.prototype.download = function(options, onSuccess, onFailure) {
    var params = {
        localPath: options.localPath,
        username: options.username,
        password: options.password,
        useWget: options.useWget || false,
        useProxy: options.useProxy
    };

    // Either use full URL or build from components
    if (options.url) {
        params.url = options.url;
    } else {
        params.protocol = options.protocol || "https";
        params.server = options.server;
        params.port = options.port || "443";
        params.serverpath = options.serverpath || "";
        params.path = options.path || "";
    }

    enyo.log("[WebDavService] Download request: " + (options.url || options.server + options.path));

    this._call("download", params,
        function(response) {
            enyo.log("[WebDavService] Download success: " + JSON.stringify(response));
            if (onSuccess) onSuccess(response);
        },
        function(response) {
            enyo.warn("[WebDavService] Download failed: " + JSON.stringify(response));
            if (onFailure) onFailure(response);
        }
    );
};

/**
 * Upload a file to WebDAV server
 * @param {object} options - Upload options
 * @param {string} options.localPath - Local file path to upload (required)
 * @param {string} options.url - Full URL to upload to (optional if server params provided)
 * @param {string} options.protocol - http or https
 * @param {string} options.server - Server hostname
 * @param {string} options.port - Server port
 * @param {string} options.serverpath - Base path on server
 * @param {string} options.path - Resource path to upload to
 * @param {string} options.username - HTTP Basic auth username
 * @param {string} options.password - HTTP Basic auth password
 * @param {function} onSuccess - Success callback({finish: true})
 * @param {function} onFailure - Failure callback({errorText, errorCode})
 */
WebDavService.prototype.upload = function(options, onSuccess, onFailure) {
    var params = {
        localPath: options.localPath,
        username: options.username,
        password: options.password,
        useProxy: options.useProxy
    };

    // Either use full URL or build from components
    if (options.url) {
        params.url = options.url;
    } else {
        params.protocol = options.protocol || "https";
        params.server = options.server;
        params.port = options.port || "443";
        params.serverpath = options.serverpath || "";
        params.path = options.path || "";
    }

    enyo.log("[WebDavService] Upload request: " + options.localPath + " -> " + (options.url || options.server + options.path));

    this._call("upload", params,
        function(response) {
            enyo.log("[WebDavService] Upload success: " + JSON.stringify(response));
            if (onSuccess) onSuccess(response);
        },
        function(response) {
            enyo.warn("[WebDavService] Upload failed: " + JSON.stringify(response));
            if (onFailure) onFailure(response);
        }
    );
};

/**
 * Create a directory on WebDAV server
 * @param {object} options - Mkdir options
 * @param {string} options.url - Full URL to create (optional if server params provided)
 * @param {string} options.protocol - http or https
 * @param {string} options.server - Server hostname
 * @param {string} options.port - Server port
 * @param {string} options.serverpath - Base path on server
 * @param {string} options.path - Directory path to create
 * @param {string} options.username - HTTP Basic auth username
 * @param {string} options.password - HTTP Basic auth password
 * @param {function} onSuccess - Success callback
 * @param {function} onFailure - Failure callback({errorText})
 */
WebDavService.prototype.mkdir = function(options, onSuccess, onFailure) {
    var params = {
        username: options.username,
        password: options.password,
        useProxy: options.useProxy
    };

    if (options.url) {
        params.url = options.url;
    } else {
        params.protocol = options.protocol || "https";
        params.server = options.server;
        params.port = options.port || "443";
        params.serverpath = options.serverpath || "";
        params.path = options.path || "";
    }

    this._call("mkdir", params, onSuccess, onFailure);
};

/**
 * Delete a file or directory on WebDAV server
 * @param {object} options - Delete options
 * @param {string} options.url - Full URL to delete (optional if server params provided)
 * @param {string} options.protocol - http or https
 * @param {string} options.server - Server hostname
 * @param {string} options.port - Server port
 * @param {string} options.serverpath - Base path on server
 * @param {string} options.path - Resource path to delete
 * @param {string} options.username - HTTP Basic auth username
 * @param {string} options.password - HTTP Basic auth password
 * @param {function} onSuccess - Success callback
 * @param {function} onFailure - Failure callback({errorText})
 */
WebDavService.prototype.deleteResource = function(options, onSuccess, onFailure) {
    var params = {
        username: options.username,
        password: options.password,
        useProxy: options.useProxy
    };

    if (options.url) {
        params.url = options.url;
    } else {
        params.protocol = options.protocol || "https";
        params.server = options.server;
        params.port = options.port || "443";
        params.serverpath = options.serverpath || "";
        params.path = options.path || "";
    }

    this._call("delete", params, onSuccess, onFailure);
};

/**
 * List directory contents via PROPFIND (uses curl)
 * @param {object} options - List options
 * @param {string} options.url - Full URL to list (optional if server params provided)
 * @param {string} options.protocol - http or https
 * @param {string} options.server - Server hostname
 * @param {string} options.port - Server port
 * @param {string} options.serverpath - Base path on server
 * @param {string} options.path - Directory path to list
 * @param {string} options.username - HTTP Basic auth username
 * @param {string} options.password - HTTP Basic auth password
 * @param {boolean} options.useProxy - If false, bypasses system proxy
 * @param {function} onSuccess - Success callback({response: xmlString})
 * @param {function} onFailure - Failure callback({errorText})
 */
WebDavService.prototype.list = function(options, onSuccess, onFailure) {
    var params = {
        username: options.username,
        password: options.password,
        useProxy: options.useProxy
    };

    if (options.url) {
        params.url = options.url;
    } else {
        params.protocol = options.protocol || "https";
        params.server = options.server;
        params.port = options.port || "443";
        params.serverpath = options.serverpath || "";
        params.path = options.path || "";
    }

    enyo.log("[WebDavService] List request: " + (options.url || options.server + "/" + (options.path || "")) + " useProxy=" + options.useProxy);

    this._call("list", params,
        function(response) {
            enyo.log("[WebDavService] List success");
            if (onSuccess) onSuccess(response);
        },
        function(response) {
            enyo.warn("[WebDavService] List failed: " + JSON.stringify(response));
            if (onFailure) onFailure(response);
        }
    );
};

/**
 * Get service preferences
 * @param {function} onSuccess - Success callback({prefs: {useWget, useProxy, downloadPath}})
 * @param {function} onFailure - Failure callback
 */
WebDavService.prototype.getPrefs = function(onSuccess, onFailure) {
    this._call("getPrefs", {}, onSuccess, onFailure);
};

/**
 * Set service preferences
 * @param {object} prefs - Preferences to set
 * @param {boolean} prefs.useWget - Prefer wget over curl (wget ignores proxy)
 * @param {boolean} prefs.useProxy - Use curl for all operations including directory listing (respects system proxy)
 * @param {string} prefs.downloadPath - Default download directory
 * @param {function} onSuccess - Success callback({prefs})
 * @param {function} onFailure - Failure callback
 */
WebDavService.prototype.setPrefs = function(prefs, onSuccess, onFailure) {
    this._call("setPrefs", prefs || {}, onSuccess, onFailure);
};

/**
 * Convenience method to build a download URL from server config
 * @param {object} server - Server configuration object
 * @param {string} path - Resource path
 * @returns {string} Full URL
 */
WebDavService.prototype.buildUrl = function(server, path) {
    var url = server.protocol + "://" + server.servername;

    if (server.port && server.port !== "80" && server.port !== "443") {
        url += ":" + server.port;
    }

    if (server.serverpath) {
        if (server.serverpath.charAt(0) !== "/") {
            url += "/";
        }
        url += server.serverpath;
    }

    if (path) {
        // Ensure path is properly encoded
        url += encodeURI(path);
    }

    return url;
};
