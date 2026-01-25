enyo.kind({
    name: "WebDavClient",
    kind: enyo.VFlexBox,

    dirListData: [], // Das JSON Data Array für die Datei und Verzeichnisliste

    // Die WebDav Api
    davReq: new davApi(),
    // Native service for file transfers
    webdavService: new WebDavService(),
    // Service availability flag
    serviceAvailable: false,
    // Der Aktuell ausgewaehlte Server   
    currentServer: [],
    // Das aktuell ausgwaehlte Datei Object   
    currentItem: "",
    // Das aktuelle Verzeichnis
    currentPath: "/",
    // Das Verzeichnis in dem die ausgewaehlte Datei gespeichert wird
    targetDir: "/media/internal/downloads",
    // Kennung ob die heruntergeladene Datei auch geöffnet werden soll       
    fileOpen: false,
    // Aktuelles Download ticket
    downloadTicket: null,
    // Mit Server verbunden
    connected: false,
    // Server konfiguration ändern
    changeServer: false,
    lastServer: null,

    db: null,

    components: [
        { kind: "ApplicationEvents", onLoad: "initializeWebDavClient" },
        { kind: "AppMenu", components: [
            { caption: "About", onclick: "showAboutMessage" }
        ]},
        { kind: "SlidingPane", multiView: true, flex: 1, components: [ 
            {name: "panelServers", width: "250px", components: [
                // Linker Abschnitt    
                { kind: "Header", name: "ServerHeader", className: "enyo-header-dark", style: "height:60px;", components: [
                    { kind: enyo.VFlexBox, content: "WebDav Servers", flex: 1 },
                ]},
                { kind: "Scroller", flex: 1, components: [
                    { kind: "VFlexBox", align: "left", components: [
                        { name: "serverList", kind: "VirtualRepeater", flex: 1, onSetupRow: "renderServerListItem", components: [
                            // Server Liste
                            { name: "serverItem", kind: "SwipeableItem", layoutKind: "HFlexLayout", onclick: "btnClickConnectServer", onConfirm: "deleteServerListItem", components: [
                                { name: "captionServer", flex: 1 }
                            ]}
                        ]}
                    ]}
                ]},
                { kind: "Spacer" },
                { kind: "Toolbar", name: "ServerToolbar", components: [
                    { kind: "ToolButton", name: "btnAddServer", icon: "images/add.png", onclick: "btnClickShowAddServerDialog" },
                    { kind: "ToolButton", name: "btnConfigureServer", icon: "images/configure.png", onclick: "btnClickOpenServerConfigure" },
                    { kind: "ToolButton", name: "btnCancelServer", icon: "images/back.png", onclick: "btnClickOpenServerConfigure", showing: false },
                ]},
            ]},
            // Rechter Abschnitt
            {name: "panelListing", name: "Navigator", components: [
                { kind: "PageHeader", style: "height:60px;", className: "enyo-header-dark", components: [
                    { kind: enyo.VFlexBox, content: "Navigator", flex: 1 },
                    { kind: "Spinner", name: "spinner" },
                ]},
                // NOTE: the scroller has flex set to 1
                { kind: "Scroller", name: "dirListScroller", flex: 1, components: [
                    //{ kind: "VFlexBox", flex: 1, align: "left", components: [
                        { kind: "VirtualRepeater", /*kind: enyo.VirtualList,*/ name: "dirList", flex: 1, onSetupRow: "renderDirListItem", components: [
                            { kind: "Item", layoutKind: "HFlexLayout", name: "dirItem", style: "height:45px", onclick: "btnClickOpenDirFile", onConfirm: "deleteDirListItem", components: [
                                { kind: "Image", name: "dirIcon", style: "height:32px;witdh:32px;", onerror:"iconError"},
                                { kind: "VFlexBox", align: "left", components: [
                                    { name: "captionDir", style: "font-size:13px;font-weight:bold;" },
                                    { name: "captionMeta", style: "font-size:10px;font-style:italic;padding-top:1px;" }
                                ]}
                            ]}
                        ]}
                    //]}
                ]},
                { kind: "Toolbar", components: [
                    { kind: "GrabButton" },
                    { kind: "ToolButton", icon: "images/back.png", onclick: "btnClickDirListBack" },
                    { kind: "ToolButton", icon: "images/refresh.png", onclick: "btnClickRefreshNavigator" },
                    { kind: "ToolButton", icon: "images/document-new.png", onclick: "btnClickShowUploadFilePicker" }
                ]}
            ]}
        ]},
        // Add Server Dialog
        { kind: "ModalDialog", name: "addServerDialog", onOpen: "addServerDialogOpen", components: [
            { kind: "Scroller", name: "scrollerServerSetup", height: "320px", components: [
                { kind: "RowGroup", caption: "Add new WebDAV Server", components: [
                    { kind: "VFlexBox", align: "left", style: "padding: 0px", components: [
                        { kind: "Input", name: "itemName", spellcheck: false, autoWordComplete: false, hint: "Display Name" },
                        { kind: "CustomListSelector", name: "protocol", style: "padding-left:10px;", onChange: "protocolChanged", value: "http", items: [
                            { caption: "HTTP", value: "http" },
                            { caption: "HTTPS", value: "https" }
                        ]},
                        { kind: "Input", name: "port", spellcheck: false, autoWordComplete: false, hint: "Port" },
                        { kind: "Input", name: "servername", disabled: false, spellcheck: false, autoWordComplete: false, autoCapitalize: "lowercase", hint: "Server Name" },
                        { kind: "Input", name: "serverpath", disabled: false, spellcheck: false, autoWordComplete: false, autoCapitalize: "lowercase", hint: "Server Path (optional)" },
                        { kind: "Input", name: "username", spellcheck: false, autoWordComplete: false, autoCapitalize: "lowercase", hint: "Username" },
                        { kind: "PasswordInput", name: "password", spellcheck: false, autoWordComplete: false, hint: "Password" },
                        { kind: "HFlexBox", align: "center", style: "padding-top:10px;", components: [
                            { kind: "CheckBox", name: "useProxyCheckbox", checked: true },
                            { content: "Use System Proxy", style: "font-size:14px; padding-left:10px;" }
                        ]}
                    ]}
                ]},
                { kind: "HFlexBox", align: "middle", components: [
                    { kind: "Button", flex: 1, caption: "Save", onclick: "btnClickSaveAddServerDialog" },
                    { kind: "Button", flex: 1, caption: "Close", onclick: "btnClickCloseAddServerDialog" }
                ]}
            ]}
        ]},
        // Message Dialog fuer jegliche Art von Meldungen
        { name: "infoMessageDialog", kind: "ModalDialog", style: "width:320px", components: [{
            kind: "VFlexBox", align: "center", style: "padding: 5px", components: [
                { name: "infoMessage", style: "font-weight:bold;font-size:13px;padding-bottom:10px" },
                { kind: "Button", flex: 1, caption: "OK", onclick: "btnClickCloseInfoMessageDialog" }
            ]}
        ]},
        // Message Dialog fuer Datei aktionen (oeffnen oder downloaden)
        { name: "fileActionDialog", kind: "ModalDialog", style: "width:320px", components: [
            { kind: "VFlexBox", align: "left", style: "align:right", components: [
                { kind: "RowGroup", caption: "File Action", components: [
                    { kind: "VFlexBox", align: "left", components: [
                        { name: "fileName", style: "font-weight:bold;font-size:13px;" },
                        { name: "fileCreationDate", style: "font-size:13px;" },
                        { name: "fileLastModified", style: "font-size:13px;" },
                        { name: "fileContentType", style: "font-size:13px;" }
                    ]}
                ]}
            ]},
            { kind: "ProgressBar", name: "fileDownloadProgressBar", minimum: 0, maximum: 100, position: 1 },
            { kind: "HFlexBox", align: "right", style: "padding: 5px", components: [
                { name: "buttonOpenFile", kind: "Button", flex: 1, caption: "Open", onclick: "btnClickOpenFile" },
                { name: "buttonDownloadFile", kind: "Button", flex: 1, caption: "Save", onclick: "btnClickDownloadFile" },
                { name: "buttonCancelFile", kind: "Button", flex: 1, caption: "Close", onclick: "btnClickCloseFileActionDialog" }
            ]}
        ]},
        // Message Dialog fuer das Anlegen eines neuen Verzeichnisses
        { kind: "ModalDialog", name: "createFolderDialog", style: "width:320px", components: [
            { kind: "VFlexBox", align: "left", style: "align:right", components: [
                { kind: "RowGroup", caption: "Create Folder", components: [
                    { kind: "VFlexBox", align: "left", components: [
                        { name: "folderName", kind: "Input", hint: "Folder Name" },
                    ]}
                ]}
            ]},
            { kind: "HFlexBox", align: "right", style: "padding: 5px", components: [
                { kind: "Button", flex: 1, caption: "Create", onclick: "btnClickCreateNewFolder" },
                { kind: "Button", flex: 1, caption: "Cancel", onclick: "btnClickCloseCreateFolderDialog" }
            ]}
        ]},
        { kind: "FilePicker", name: "uploadFilePicker", onPickFile: "uploadFilePickerResponse" },

        // Palm Service Calls                                   
        { name: "fileDownload", kind: "PalmService", service: "palm://com.palm.downloadmanager/", method: "download", onSuccess: "downloadFileResponse", subscribe: true },
        { name: "fileDownloadCancel", kind: "PalmService", service: "palm://com.palm.downloadmanager/", method: "cancelDownload", onSuccess: "cancelFileSuccess", onFailure: "cancelFileFailure" },
        { name: "fileOpen", kind: "PalmService", service: "palm://com.palm.applicationManager/", method: "open", onSuccess: "downloadFileResponse", subscribe: true },
        { name: "fileSend", kind: "PalmService", service: "palm://com.aventer.webdavclient.service/", method: "sendfile", onSuccess: "sendFileSuccess", onFailure: "sendFileFailure" },

        { name: "myUpdater", kind: "Helpers.Updater" }
    ],

    // Daten der angelegten Server (Format: JSON)
    serverData: [],

    // Programmstart
    initializeWebDavClient: function(inSender) {
        // Konfiguration Laden. Wenn die DB noch nicht existiert, wird diese erstellt
        this.environment = enyo.fetchDeviceInfo();

        // Check if native service is available
        var self = this;
        this.webdavService.checkAvailable(function(available) {
            self.serviceAvailable = available;
            if (available) {
                enyo.log("Native WebDAV service is available - using curl/wget for transfers");
            } else {
                enyo.warn("Native WebDAV service not available - falling back to XHR");
            }
        });

        this.loadPrefs();
    },

    loadPrefs: function() {
        var ignoreDB = Prefs.getCookie("ignoreDB", false);
        var savedServers = Prefs.getCookie("serverlist", []);
        if (savedServers.length > 0) {
            enyo.log("Found preferences browser storage, skipping database...");
            this.serverData = savedServers;
            this.$.serverList.render();
            this.$.myUpdater.CheckForUpdate(this, "WebDAV Client HD");
        } else {
            if (!ignoreDB) {
                enyo.log("No preferences found in browser storage, trying database...");
                this.db = openDatabase('WebDavDB', '0.2', 'WebDAV Data Store', 2000);
                if (this.db) {
                    // Serverliste laden
                    sqlString = "select * from serverliste";
                    enyo.log("Reading from DB8 with sql string: " + sqlString);
                    this.db.transaction(enyo.bind(this, (function(transaction) { 
                        transaction.executeSql(sqlString, [], enyo.bind(this, this.loadServerListFromDB), enyo.bind(this, this.showWelcomeMessage)); 
                    })));
                }
            } else {
                this.showWelcomeMessage();
            }
        }
    },

    // Handler fuer das auswerten der Serverlist Laden query  
    loadServerListFromDB: function(transaction, results) {
        enyo.log("loading server list from DB");
        for (var i = 0; i < results.rows.length; i++) {
            var row = results.rows.item(i);
            this.serverData.push({ servername: row.servername, serverpath: row.serverpath, name: row.name, username: row.username, password: row.password, protocol: row.protocol, port: row.port });
        }
        // Save loaded data to browser storage so we don't need to use the DB any more
        Prefs.setCookie("serverlist", this.serverData);
        Prefs.setCookie("ignoreDB", true);
        if (this.serverData.length > 0) {
            this.$.serverList.render();
            this.showWelcomeMessage(null, null, "migration");
        } else {
            this.showWelcomeMessage(null, null);
        }
        // Silently empty out database in the background to complete migration
        sqlString = "drop table serverliste";
        enyo.log("Clearing DB8 with sql string: " + sqlString);
        this.db.transaction(enyo.bind(this, (function(transaction) { 
            transaction.executeSql(sqlString, [], function() { enyo.log("Database cleared!")}, function() { enyo.warn("Database could not be cleared!")} ); 
        })));
    },

    showWelcomeMessage: function(a, b, migration) {
        var message = "Welcome to webDav Client, start by adding a server.";
        if (migration)
            message = "Upgrade complete! Data from previous version has been imported.";
        this.showInfoMessage(message);
    },

    selectNextView: function () {
		if (screen.width < 500) {
			var pane    = this.$.slidingPane;
			var viewIdx = pane.getViewIndex();
			if (viewIdx < pane.views.length - 1) {
				viewIdx = viewIdx + 1;
			} else {
				return;	// we've selected the last available view.
			}
			pane.selectViewByIndex(viewIdx);
		}
	},

    /* ********************** CONFIGURE SERVER *************************** */
    /*
     * Server konfigurations Mode aktivieren
     */
    btnClickOpenServerConfigure: function() {
        if (!this.changeServer) {
            this.changeServer = true;
            this.$.btnAddServer.hide();
            this.$.btnConfigureServer.hide();
            this.$.btnCancelServer.show();
            this.$.btnConfigureServer.icon = "back.png";
        } else {
            this.changeServer = false;
            this.$.btnAddServer.show();
            this.$.btnConfigureServer.show();
            this.$.btnCancelServer.hide();
            this.$.btnConfigureServer.icon = "configure.png";
            this.selectedServerItem = null;
            this.$.serverList.render();
        }
        this.$.ServerHeader.addRemoveClass("editingHighlight", this.changeServer);
        this.$.ServerToolbar.addRemoveClass("editingHighlight", this.changeServer);
    },

    /* ************************* APP MENU ******************************** */
    openAbout: function() {
        this.$.fileOpen.call({ target: "http://www.aventer.biz/13-0-WebDAV-Client-HD.html" });
    },

    /* *********************** Datei Hochladen *************************** */

    // Filepicker Dialog anzeigen
    btnClickShowUploadFilePicker: function(inSender, inIndex) {
        if (this.connected) {
            this.$.uploadFilePicker.pickFile();
        }
    },

    // Ausgewaehlte Datei einlesen
    uploadFilePickerResponse: function(inSender, inFile) {
        if (inFile !== 'undefined' && inFile.length > 0) {
            var filename = inFile[0].fullPath.split("/");
            var targetFilename = filename[filename.length - 1];
            var self = this;

            this.$.spinner.show();

            // Use native service for upload
            this.webdavService.upload({
                localPath: inFile[0].fullPath,
                protocol: this.currentServer.protocol,
                server: this.currentServer.servername,
                port: this.currentServer.port,
                serverpath: this.currentServer.serverpath,
                path: this.currentPath + "/" + targetFilename,
                username: this.currentServer.username,
                password: this.currentServer.password,
                useProxy: this.currentServer.useProxy !== false
            }, function(response) {
                // Success
                self.$.spinner.hide();
                enyo.windows.addBannerMessage("Upload complete!", "{}");
                // Refresh directory listing
                doGetDirList(self.currentPath, getDirListContent);
            }, function(response) {
                // Failure
                self.$.spinner.hide();
                var errorMsg = response.errorText || "Upload failed";
                self.showInfoMessage("Error: " + errorMsg);
            });
        }
    },

    // Datei wurde erfolgreich eingelesen und soll nun hochgeladen werden
    sendFileSuccess: function(inSender, inResponse) {
        this.$.spinner.show();
        if (inResponse.finish !== 'undefined') {
            if (inResponse.finish) {
                this.$.dirList.render();
            }
        }
    },

    // Datei wurde erfolgreich eingelesen und soll nun hochgeladen werden
    sendFileFailure: function(inSender, inResponse) {
        if (inResponse.error !== 'undefined') {
            if (inResponse.error) {
                this.$.spinner.hide();
                this.showInfoMessage("Error: " + inResponse.errorText);
            }
        }
    },

    /* *************** Neues Verzeichnis Anlegen Dialog ****************** */

    // Neues Verzeichnis anlegen
    btnClickCreateNewFolder: function() {
        // Verzeichnis nur anlegen, wenn ein Name angegeben wurde
        if (this.$.folderName.getValue()) {
            this.$.spinner.show();
            // Verzeichnis erstellen			
            this.davReq.createDir(this.currentPath + "/" + this.$.folderName.getValue(), getCreateFolderRequest);

            this.$.folderName.setValue("");
            this.$.dirList.render();
            this.$.createFolderDialog.close();
        }
    },

    // Anzeigen des "neuen Verzeichnis anlegen" Dialoges
    btnClickShowNewFolderDialog: function(inSender, inIndex) {
        if (this.connected) {
            this.$.createFolderDialog.openAtCenter();
        }
    },

    // Schliessen des "neues Verzeichnis anlegen" Dialoges ohne zu speichern 
    btnClickCloseCreateFolderDialog: function(inSender, inIndex) {
        this.$.folderName.setValue("");
        this.$.createFolderDialog.close();
    },


    /* *************** File Dialog bezogene Aktionen **************** */

    /* File Dialog Oeffnen
       -------------------------------------------------
       
       Uebergabeparameter:
       		item : ist JSON Object im Format {path:, filename:, creationdate:, lastmodified:, contenttype:}
       		
    */
    showFileActionDialog: function(item) {
        // FileAction Dialog oeffnen	
        this.$.fileActionDialog.openAtCenter();

        // Progressbar nicht anzeigen
        this.$.fileDownloadProgressBar.hide();

        // Die Felder Innerhalb des Dialogs beschreiben
        enyo.log("Selected item data: " + (new XMLSerializer()).serializeToString(item.fulldata));
        this.$.fileName.setContent("Filename: " + item.filename);
        if (item.contentlength != "")
            this.$.fileCreationDate.setContent("File Size: " + item.contentlength);
        else {
            if (item.creationdate != item.lastmodified)
                this.$.fileCreationDate.setContent("Creation Date: " + item.creationdate);
            else
                this.$.fileCreationDate.setContent("");
        }

        this.$.fileLastModified.setContent("Last Modified: " + item.lastmodified);
        this.$.fileContentType.setContent("Content Type: " + item.contenttype);

        this.$.buttonOpenFile.setState("disabled", false);
        this.$.buttonDownloadFile.setState("disabled", false);
        this.$.buttonCancelFile.setContent("Close");

        this.$.fileDownloadProgressBar.hide();
        this.$.fileDownloadProgressBar.setPosition(0);
    },

    // Ausgewaehlte Datei Oeffnen
    btnClickOpenFile: function(inSender) {
        enyo.log("User requested remote file OPEN");
        this.doFileDownload(inSender, true);
    },

    // Ausgewahlte Datei downloaden
    btnClickDownloadFile: function(inSender) {
        enyo.log("User requested remote file DOWNLOAD");
        this.doFileDownload(inSender, false);
    },

    doFileDownload: function(inSender, openAfterDownload) {
        this.fileOpen = false;
        if (openAfterDownload !== 'undefined')
            this.fileOpen = openAfterDownload;

        this.$.spinner.show();
        this.$.buttonOpenFile.setState("disabled", true);
        this.$.buttonDownloadFile.setState("disabled", true);
        this.$.buttonCancelFile.setContent("Cancel");
        this.$.fileDownloadProgressBar.setPosition(0);
        this.$.fileDownloadProgressBar.show();

        // wenn der servername ein verzeichnis mit beinhalltet, dann muss dieser erst einmal entfernt werden.
        var path = "";
        var servername = this.currentServer.servername;
        if (servername.indexOf("/") > 0) {
            path = servername.slice(servername.indexOf("/"), servername.length);
            servername = servername.slice(0, servername.indexOf("/")); //remove trailing slash from server name if present
        }

        var localPath = this.targetDir + "/" + this.currentItem.filename;

        // Use native service if available (fixes authentication issue)
        if (this.serviceAvailable) {
            enyo.log("Using native service for download to: " + localPath);
            var self = this;

            // Note: currentItem.path already contains the full path including serverpath
            // So we pass it directly without serverpath to avoid duplication
            this.webdavService.download({
                protocol: this.currentServer.protocol,
                server: servername,
                port: this.currentServer.port,
                serverpath: "",
                path: this.currentItem.path,
                localPath: localPath,
                username: this.currentServer.username,
                password: this.currentServer.password,
                useProxy: this.currentServer.useProxy !== false
            }, function(response) {
                // Success
                self.$.spinner.hide();
                self.$.fileDownloadProgressBar.setPosition(100);
                enyo.windows.addBannerMessage("Download complete!", "{}");
                self.$.fileActionDialog.close();

                // Open file if requested
                if (self.fileOpen) {
                    enyo.log("Opening downloaded file: " + localPath);
                    self.$.fileOpen.call({ target: localPath });
                    self.fileOpen = false;
                }
                self.renderDirListItem(inSender, self.selectedDirItem, true);
            }, function(response) {
                // Failure
                self.$.spinner.hide();
                self.$.fileActionDialog.close();
                self.fileOpen = false;
                var errorMsg = response.errorText || "Download failed";
                enyo.windows.addBannerMessage("Download failed!", "{}");
                self.showInfoMessage("Error: " + errorMsg);
                self.renderDirListItem(inSender, self.selectedDirItem, true);
            });
        } else {
            // Fallback to download manager (may not work with auth)
            var usePath = this.currentServer.serverpath + encodeURI(this.currentItem.path);
            var useTarget = this.currentServer.protocol + "://" + encodeURI(this.currentServer.username).replace("@", "%40") + ":" + encodeURI(this.currentServer.password).replace("@", "%40") + "@" + servername + ":" + this.currentServer.port + usePath;
            enyo.log("Fallback: Trying get file with target: " + useTarget + " to " + localPath);

            // Note: This doesn't work reliably on webOS - credentials aren't getting passed properly
            this.$.fileDownload.call({
                target: useTarget,
                mime: this.currentItem.contenttype,
                targetDir: this.targetDir,
                targetFilename: this.currentItem.filename,
                canHandlePause: false,
                subscribe: true
            });
        }
    },
    
    // Anzeigen der Progressbar und setzen der Position  
    downloadFileResponse: function(inSender, inResponse) {
        enyo.log("Got information about file download: " + JSON.stringify(inResponse));
        this.$.fileDownloadProgressBar.show();

        // Download Ticketnummer merken, um den download ggfs abzubrechen
        this.downloadTicket = inResponse.ticket;
        var percent = (100 / inResponse.amountTotal) * inResponse.amountReceived;

        // Nur die Position aktualisieren, wenn die Prozentzahl groesser 1 ist um ein springen des balkens zu umgehen 
        if (percent == percent && percent > 1 && percent && percent <= 100) {
            this.$.fileDownloadProgressBar.setPosition(percent);
        }

        // Download ist beendet (finished)s
        if (inResponse && (inResponse.completed || inResponse.aborted)) {
            enyo.log("Download actually complete!");
            enyo.log(JSON.stringify(inResponse));
            this.$.spinner.hide();
            if (inResponse.completionStatusCode == 200) {
                this.$.fileDownloadProgressBar.setPosition(percent);
                enyo.windows.addBannerMessage("Download complete!", "{}");
            }
            else if (inResponse.completionStatusCode == 12 || inResponse.aborted)
                enyo.windows.addBannerMessage("Download cancelled", "{}");
            else {
                enyo.windows.addBannerMessage("Download failed!", "{}");
                this.downloadFileFailure(inSender, { errorText: "Download failed - " + translateErrorCode(inResponse.completionStatusCode) + " (" + inResponse.completionStatusCode + ")"})
            }
            this.$.fileActionDialog.close();

            // Datei oeffnen sofern der User den oeffnen button drueckte
            if (this.fileOpen) {
                enyo.log("Opening downloaded file: " + this.targetDir + "/" + this.currentItem.filename);
                this.$.fileOpen.call({ target: this.targetDir + "/" + this.currentItem.filename });
                this.fileOpen = false;
            }
            this.renderDirListItem(inSender, this.selectedDirItem, true);
        }
    },

    cancelFinished : function(inSender, inResponse) {
        enyo.log("Cancel Download success, results=" + enyo.json.stringify(inResponse));
    },
    cancelFail : function(inSender, inResponse) {
        enyo.log("Cancel Download failure, results=" + enyo.json.stringify(inResponse));
    },

    // FileActionDialog fenster soll ohne weitere Aktion geschlossen werden
    btnClickCloseFileActionDialog: function(inSender) {
        this.$.spinner.hide();
        this.fileOpen = false;
        // Wenn gerade am downloaden ist, den download abbrechen
        if (this.downloadTicket) {
            // Legacy download manager cancel
            this.$.fileDownloadCancel.call({ ticket: this.downloadTicket});
            this.downloadTicket = null;
            this.$.fileDownloadProgressBar.setPosition(1);
        } else {
            // Native service downloads run to completion (can't be cancelled easily)
            this.$.fileActionDialog.close();
            this.renderDirListItem(inSender, this.selectedDirItem, true);
        }
    },

    // Message Ausgabe, wenn beim herunterladen eines Files ein Fehler auftrat
    downloadFileFailure: function(inSender, inResponse) {
        this.$.spinner.hide();
        this.$.fileActionDialog.close();
        this.fileOpen = false;
        this.showInfoMessage("Error: " + inResponse.errorText);
        this.renderDirListItem(inSender, this.selectedDirItem, true);
    },

    /* *************** WebDav File List bezogene Funktionen ***************** */


    // FileList Eintraege erstellen
    renderDirListItem: function(inSender, inIndex, deselect) {
        var item = this.dirListData[inIndex];
        if (item) {

            // Pruefen ob der aktuelle Eintrag ausgewaehlt wurde
            var isSelected = (inIndex == this.selectedDirItem);
            if (deselect) { //allow override 
                isSelected = false;
                this.selectedDirItem = null;
            }
            if (isSelected) {
                // Hintergrundfarbe aendern

                // Wenn das ausgewaehlte Object ein Verzeichnis ist, dann in dieses wechseln
                if (item.contenttype == "httpd/unix-directory") {
                    enyo.warn("Changing Directory!");
                    this.currentPath = item.path;
                    this.currentItem = null;
                    this.$.spinner.show();
                    doGetDirList(item.path, getDirListContent);
                    this.selectedDirItem = null;
                    webdav.$.dirListScroller.scrollTo(0,0);
                } else {
                    this.currentItem = item;
                    this.showFileActionDialog(item);
                }
            }
            this.$.dirItem.addRemoveClass("highlightedRow", isSelected);

            // Den Pfad des Verzeichnisses/Files entfernen und normalisiert ausgeben
            this.$.captionDir.setContent(item.filename);
            this.$.captionMeta.setContent("Last Modified: " + item.lastmodified);

            // Je nach type des Objectes, ein entsprechende Icon ausgeben
            this.$.dirIcon.setSrc(getImageByMimeType(item.contenttype));
            return true;
        }
    },

    //Handle icons for unknown file types
    iconError: function(inSender, inEvent) {
        unknownIcon = inEvent.target || inEvent.srcElement;
        enyo.log("Couldn't find an icon for " + unknownIcon.src + ", using default icon");
        unknownIcon.src = "images/mimetype/empty.png";
    },

    // Oeffnen des ausgewaehlten Verzeichnisses oder Datei
    btnClickOpenDirFile: function(inSender, inEvent) {
        // Ausgewaehlte Datei/Verzeichnis oeffnen  		  	  				
        this.selectedDirItem = inEvent.rowIndex;
        this.renderDirListItem(inSender, inEvent.rowIndex);
    },

    // File Liste neu Laden
    btnClickRefreshNavigator: function(inSender, inEvent) {
        if (this.connected) {
            this.$.spinner.show();
            doGetDirList(this.currentPath, getDirListContent);
        }
    },

    // Ein Verzeichnis zurueckgehen
    btnClickDirListBack: function() {
        if (this.connected) {
            this.$.spinner.show();
            this.currentPath = this.currentPath.substring(0, this.currentPath.lastIndexOf("/"));
            doGetDirList(this.currentPath, getDirListContent);
            webdav.$.dirListScroller.scrollTo(0,0);
        }
    },

    // Das zu loeschende Objekt auf dem Server loeschen und die Liste entsprechend anpassen
    deleteDirListItem: function(inSender, inIndex) {
        this.davReq.deleteObject(this.dirListData[inIndex].path, getDeleteDirListItemResponse);
        this.dirListData.splice(inIndex, 1);
        this.$.dirList.render();
    },

    /* *************** Server Liste bezogene Funktionen ****************** */

    // Mit Server verbinden und Stammverzeichnis laden
    btnClickConnectServer: function(inSender, inEvent) {
        if (!this.changeServer) {
            this.selectNextView();
            this.$.spinner.show();
        }
        this.selectedServerItem = inEvent.rowIndex;
        this.$.serverList.render();
    },

    // ServerList Eintraege erstellen
    renderServerListItem: function(inSender, inIndex) {
        var item = this.serverData[inIndex];
        // Pruefen ob der aktuelle Eintrag ausgewaehlt wurde
        var isSelected = (inIndex == this.selectedServerItem);
        if (isSelected) {
            // Hintergrundfarbe aendern und Server connecten
            this.currentServer = item;
            this.currentPath = "";
            if (!this.changeServer) {
                if (this.currentServer != this.lastServer) {
                    if (this.lastServer)
                        enyo.warn("Current server changed, connecting to new server: " + item.servername + " from: " + this.lastServer.name);
                    this.connectWebDavServer(item.servername, item.serverpath, item.port, item.protocol, item.username, item.password);
                    this.selectedServerItem = null;
                    this.lastServer = this.currentServer;
                } else {
                    this.$.spinner.hide();
                }
            } else {
                this.$.addServerDialog.openAtCenter();
            }
        }
        this.$.serverItem.addRemoveClass("highlightedRow", isSelected);

        // Eintrag ausgeben
        if (item) {
            this.$.captionServer.setContent(item.name);
            return true;
        }
    },

    // Das zu loeschende Server Object aus der Serverliste und der DB entfernen
    deleteServerListItem: function(inSender, inIndex) {
        this.serverData.splice(inIndex, 1);
        Prefs.setCookie("serverlist", this.serverData);
        this.$.serverList.render();
    },


    /* ****************** AddServer Dialog bezogene Funktionen ******************* */

    // Server hinzufuegen
    btnClickShowAddServerDialog: function() {
        this.$.addServerDialog.openAtCenter();
        this.$.port.setValue("443");
    },

    addServerDialogOpen: function(inSender, inEvent) {
        if (!this.changeServer) {
            // Formular leeren
            this.$.itemName.setValue("");
            this.$.servername.setValue("");
            this.$.serverpath.setValue("");
            this.$.username.setValue("");
            this.$.password.setValue("");
            this.$.protocol.setValue("http");
            this.$.port.setValue("80");
            this.$.useProxyCheckbox.setChecked(true); // Default to using proxy for new servers
            this.$.servername.setStyle("visibility:visible")

        } else {
            // Server Informationen in das Formular eintragen
            this.$.itemName.setValue(this.serverData[this.selectedServerItem].name);
            this.$.servername.setValue(this.serverData[this.selectedServerItem].servername);
            this.$.serverpath.setValue(this.serverData[this.selectedServerItem].serverpath);
            this.$.username.setValue(this.serverData[this.selectedServerItem].username);
            this.$.password.setValue(this.serverData[this.selectedServerItem].password);
            this.$.protocol.setValue(this.serverData[this.selectedServerItem].protocol);
            this.$.port.setValue(this.serverData[this.selectedServerItem].port);
            // Use saved useProxy value, default to true for backwards compatibility
            var useProxy = this.serverData[this.selectedServerItem].useProxy;
            this.$.useProxyCheckbox.setChecked(useProxy !== false);

            this.$.servername.disabled = true;
        }
    },

    // Neu angelegten Server speicher:
    btnClickSaveAddServerDialog: function() {
        // Eingaben auslesen
        nvItemName = this.$.itemName.getValue();
        nvServername = this.$.servername.getValue();
        nvServerpath = this.$.serverpath.getValue();
        nvUsername = this.$.username.getValue();
        nvPassword = this.$.password.getValue();
        nvProtocol = this.$.protocol.getValue();
        nvPort = this.$.port.getValue();
        nvUseProxy = this.$.useProxyCheckbox.getChecked();

        // Neuen Server Speichern oder aktualisieren
        if (!this.changeServer) {
            var itemPos = this.serverData.length;
        } else {
            var itemPos = this.selectedServerItem;
        }
        // Eingaben in ein Array schreiben
        this.serverData[itemPos] = { servername: nvServername, serverpath: nvServerpath, name: nvItemName, username: nvUsername, password: nvPassword, protocol: nvProtocol, port: nvPort, useProxy: nvUseProxy };
        Prefs.setCookie("serverlist", this.serverData);

        this.$.serverList.renderRow(itemPos);
        this.$.serverList.render();

        this.$.addServerDialog.close();
    },

    // AddServerDialog schliessen ohne zu speichern
    btnClickCloseAddServerDialog: function() {
        this.$.itemName.setValue("");
        this.$.servername.setValue("");
        this.$.serverpath.setValue("");
        this.$.username.setValue("");
        this.$.password.setValue("");
        this.$.protocol.setValue("https");
        this.$.port.setValue("443");
        this.$.addServerDialog.close();
    },

    // Ein anderes Protokoll wurde ausgewaehlt.
    protocolChanged: function(inSender, inValue, inOldValue) {
        if (inValue == "https") {
            this.$.port.setValue("443");
        } else {
            this.$.port.setValue("80");
        }

    },

    /* ***************** Info Message Dialog Funktionen ******************* */

    // Info Message schliessen
    btnClickCloseInfoMessageDialog: function(inSender, inEvent) {
        this.$.infoMessage.setContent("");
        this.$.infoMessageDialog.close();
    },

    // Info Message Fenster mit uebergebenen error Object oeffnen  
    showErrorInInfoMessage: function(inTrans, inError) {
        this.showInfoMessage("Error Message: " + inError.message + " |  Error Code: " + inError.code);
    },

    // Info Message Fenster mit uebergebenen error Object oeffnen  
    showAboutMessage: function(inTrans, inError) {
        this.showInfoMessage("WebDAV Client: Original code by Aventer, updates by codepoet in 2022, and codepoet and Starkka15 in 2026.");
    },

    // Info Message Fenster mit uebergebenen Text oeffnen
    showInfoMessage: function(text) {
        this.$.infoMessageDialog.openAtCenter();
        this.$.infoMessage.setContent(text);
    },

    /* ***************** WebDAV bezogene Funktionen ********************* */

    // Mit dem WebDav Server verbinden
    connectWebDavServer: function(servername, serverpath, port, protocol, username, password) {
        // wenn der servername ein verzeichnis mit beinhalltet, dann muss dieser erst einmal entfernt werden.
        var path = "";
        if (servername.indexOf("/") > 0) {
            path = servername.slice(servername.indexOf("/"), servername.length);
            servername = servername.slice(0, servername.indexOf("/"));
        }

        this.davReq.init(servername, serverpath, port, protocol, username, password);
        doGetDirList(path, getDirListContent);
    },

});


// request Handler fuer das Auslesen des WebDav Verzeichnisses. Diese Funktion wird aus der davAPI aufgerufen
// content = JSON Object mit folgendem Aufbau {path:, filename, creationdate:, lastmodified:, contenttype:}
// For errors: content = "error" or error object, requestState = error code or -1
function getDirListContent(content, requestState) {
    if (content && content !== "error" && requestState == 4) {
        webdav.connected = true;
        //webdav.$.dirListScroller.scrollTo(0);
        webdav.$.spinner.hide();
        webdav.dirListData = content
        webdav.$.dirList.render();
    } else {
        // Error case
        webdav.$.spinner.hide();
        webdav.connected = false;

        // Check if content is an error object with errorText
        if (content && content.errorText) {
            webdav.showInfoMessage(content.errorText);
        } else if (content === "error" || requestState !== 4) {
            webdav.showInfoMessage("Failed to connect to server. Please check your settings and credentials.");
        }
    }
}

// Wrapper for directory listing that uses native service (curl)
function doGetDirList(path, handler) {
    // Use per-server useProxy setting, default to true for backwards compatibility
    var useProxy = webdav.currentServer.useProxy !== false;

    if (webdav.serviceAvailable) {
        enyo.log("Using native service for directory listing (curl, useProxy=" + useProxy + ")");
        // Don't pass serverpath if path already contains it (to avoid duplication)
        var serverpath = "";
        if (path.indexOf(webdav.currentServer.serverpath) === -1) {
            serverpath = webdav.currentServer.serverpath;
        }
        webdav.webdavService.list({
            protocol: webdav.currentServer.protocol,
            server: webdav.currentServer.servername,
            port: webdav.currentServer.port,
            serverpath: serverpath,
            path: path,
            username: webdav.currentServer.username,
            password: webdav.currentServer.password,
            useProxy: useProxy
        }, function(response) {
            // Parse XML response
            if (response.response) {
                var parser = new DOMParser();
                var xmlDoc = parser.parseFromString(response.response, "application/xml");
                var dirListData = parseWebDAVResponse(xmlDoc, webdav.currentServer.serverpath);
                handler(dirListData, 4);
            } else {
                handler("error", -1);
            }
        }, function(error) {
            enyo.warn("Native service list failed: " + JSON.stringify(error));
            // Pass error object so handler can display errorText
            handler(error, error.errorCode || -1);
        });
    } else {
        enyo.log("Using XHR for directory listing (service not available)");
        webdav.davReq.getDirList(path, handler);
    }
}

// Parse WebDAV XML response from native service
function parseWebDAVResponse(xmlDoc, serverpath) {
    var dirListData = [];
    var responses = xmlDoc.getElementsByTagName("response");

    // Determine XML type
    var multistatus = xmlDoc.getElementsByTagName("multistatus")[0];
    var xmltype = multistatus && multistatus.getAttribute("xmlns:s") ? "RFC2518" : "RFC4437";
    enyo.log("Parsing native service response using type: " + xmltype);

    for (var i = 1; i < responses.length; i++) {
        try {
            var hrefValue = responses[i].getElementsByTagName("href")[0].firstChild.nodeValue;
            var getlastmodifiedValue = "";
            try {
                getlastmodifiedValue = responses[i].getElementsByTagName("getlastmodified")[0].firstChild.nodeValue;
                getlastmodifiedValue = formatDateString(Date.parse(getlastmodifiedValue));
            } catch (e) {
                getlastmodifiedValue = "unknown";
            }

            var creationdateValue = getlastmodifiedValue;
            var getcontentlength = "";
            try {
                getcontentlength = responses[i].getElementsByTagName("getcontentlength")[0].firstChild.nodeValue;
                getcontentlength = Math.round((getcontentlength / 1024) * 100) / 100 + " KB";
            } catch (e) {}

            var getcontenttypeValue = "";
            try {
                getcontenttypeValue = responses[i].getElementsByTagName("getcontenttype")[0].firstChild.nodeValue;
            } catch (e) {
                if (responses[i].getElementsByTagName("collection")[0]) {
                    getcontenttypeValue = "httpd/unix-directory";
                } else {
                    getcontenttypeValue = getContentType(hrefValue);
                }
            }

            // Normalize href (remove trailing slash for parsing filename)
            if (hrefValue.length > 1 && hrefValue.lastIndexOf("/") == hrefValue.length - 1) {
                hrefValue = hrefValue.substring(0, hrefValue.lastIndexOf("/"));
            }

            var hrefNorm = hrefValue.split("/");
            var filename = decodeURI(hrefNorm[hrefNorm.length - 1]);

            // Hide dot files
            if (filename.indexOf(".") != 0) {
                dirListData.push({
                    path: decodeURI(hrefValue),
                    filename: filename,
                    creationdate: creationdateValue,
                    lastmodified: getlastmodifiedValue,
                    contenttype: getcontenttypeValue,
                    contentlength: getcontentlength,
                    fulldata: responses[i]
                });
            }
        } catch (e) {
            enyo.warn("Error parsing response item: " + e);
        }
    }

    enyo.log("Parsed " + dirListData.length + " items from native service response");
    return dirListData;
}

// request Handler fuer das auswerten des Rueckgabecodes des loeschvorganges
function getDeleteDirListItemResponse(content) {
    // Bei dem getesteten webdav server, gab es hier nie response
}

// request Handler fuer das anlegen eines neuen Verzeichnisses
function getCreateFolderRequest(content) {
    // Bei dem getesteten webdav server, gab es hier nie response
    doGetDirList(webdav.currentPath, getDirListContent);
}

// request Handler fuer das uploaden einer Datei
function uploadFileSuccess(content) {
    doGetDirList(webdav.currentPath, getDirListContent);
}

// Die eigentliche encodeURI Version scheint unter webos nicht wirklich zu funktionieren, daher diese hier
function myescape(content) {
    content = encodeURI(content);
    return content.replace(/@/g, "%40");
}

function translateErrorCode(code) {
    switch(code) {
        case -1:
            return "General error";
        case -2:
            return "Connection timeout";
        case -3:
            return "Corrupt file";
        case -4:
            return "File system error";
        case -5:
            return "HTTP error";
        case 11:
            return "Download interrupted";
        case 12:
            return "Download canclled";
        default:
            return "Unknown error";
    }
}

// Datei Icon je nach contenttype ausgeben
function getImageByMimeType(contenttype) {

    switch(contenttype) {
        case "application/msword":
            return "images/mimetype/application-msword.png";
        default:
            iconPath = contenttype.replace("/", "-");
            iconPath = iconPath.split(";");
            iconPath = iconPath[0];
            iconPath = "images/mimetype/" + iconPath + ".png";
            return iconPath;        
    }
}