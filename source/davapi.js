function davApi() {

    this.server = "";
    this.protocol = "";
    this.username = "";
    this.password = "";
    this.sessionCookie = "";

    // Initializieren der Klasse
    this.init = function(server, serverpath, port, protocol, username, password) {
        enyo.log("init called with: " + server + "," + serverpath + "," + port + "," + protocol + "," + username + "," + password);
        this.server = server + ":" + port;
        this.serverpath = serverpath;
        this.protocol = protocol;
        this.username = username;
        this.password = password;
    }

    /* Verzeichnis Struktur auslesen
    	---------------------------------------------------
    	
    	Uebergabeparameter:
    		path    = Auszulesendes Verzeichnis
    		handler = Beinhaltet die Funktion welche das Ergebnis (Inhalt des Verzeichnisses) bearbeiten soll.
    					 Der Handler muss wie folgt aussehen: handler(JSON Object);
    					 
    					 Das JSON Object ist wie folgt aufgebaut:
    					 {path:, filename:, creationdate:, lastmodified:, contenttype:}
    		
    */
    this.getDirList = function(path, handler) {

        var request = new XMLHttpRequest();

        if (this.serverpath && this.serverpath != "" && this.serverpath != "/" && path.indexOf(this.serverpath) == -1)
            path = this.serverpath + "/" + path;
        // the path have to end with a slash "/" -- but only one!		
        path = path.replace(/\/+$/, '') + '/';
 
        var openPath = this.protocol + "://" + this.server + "/" + encodeURI(path);
        enyo.log('PROPFIND ' + openPath);
        request.open('PROPFIND', openPath, true);
        request.setRequestHeader('Depth', 1);
        request.setRequestHeader('Content-Type', 'application/x-www-form-escaped');
        request.setRequestHeader("Authorization", "Basic " + btoa(this.username + ":" + this.password));
        request.setRequestHeader('Origin', 'http://localhost'); //over-ride webOS app-based origin so ownCloud/nextCloud don't block us
            // Es muss ein bestimmtes XML Format an den Server gesendet werden, um entsprechende Rueckmeldung zu bekommen
        var xml = '<?xml version="1.0" encoding="utf-8" ?><D:propfind xmlns:D="DAV:"><D:allprop /></D:propfind>';

        request.onreadystatechange = function() {
            // Request war erfolgreich
            if (request.readyState == 4) {
                // Response Elemente laden und in der schleife durchlaufen um die sich darunter befindlichen Daten auszulesen 
                enyo.log("response status: " + request.status + "," + request.statusText);
                if (request.status >= 200 && request.status < 300) {
                    this.sessionCookie = request.getResponseHeader("Set-Cookie");
                    this.sessionCookie = this.sessionCookie.split(';')[0];
                    enyo.log("Received session cookie: " + this.sessionCookie);

                    if (request.responseXML) {
                        // Check if the response is a old rfc implementation or a new one.
                        var xmltype = request.responseXML.getElementsByTagName("multistatus")[0].getAttribute("xmlns:s");
                        if (xmltype) {
                            xmltype = "RFC2518"
                        } else {    
                            xmltype = "RFC4437";
                        }
                        enyo.log("Parsing response using type: " + xmltype);

                        var xmlRequest = request.responseXML.getElementsByTagName("response");
                        var count = xmlRequest.length;

                        // Speichern der Dateistruktur in einem JSON Object
                        var dirListData = [];

                        for (var i = 1; i < count; i++) {
                            try {
                                var hrefValue = xmlRequest[i].getElementsByTagName("href")[0].firstChild.nodeValue;
                                var getlastmodifiedValue = xmlRequest[i].getElementsByTagName("getlastmodified")[0].firstChild.nodeValue;
                                getlastmodifiedValue = Date.parse(getlastmodifiedValue);
                                getlastmodifiedValue = formatDateString(getlastmodifiedValue);
                            } catch (e) {
                                var getlastmodifiedValue = "";
                            }

                            if (xmltype == "RFC4437") {
                                try {
                                    var getlastmodifiedValue = xmlRequest[i].getElementsByTagName("getlastmodified")[0].firstChild.nodeValue;
                                    getlastmodifiedValue = Date.parse(getlastmodifiedValue);
                                    getlastmodifiedValue = formatDateString(getlastmodifiedValue);
                                } catch (e) {
                                    enyo.log("getlastmodified element not found");
                                    var getlastmodifiedValue = "unknown";
                                }
                                try {
                                    var creationdateValue = xmlRequest[i].getElementsByTagName("creationdate")[0].firstChild.nodeValue;
                                    creationdateValue = Date.parse(creationdateValue);
                                    creationdateValue = formatDateString(creationdateValue);
                                } catch (e) {
                                    //enyo.log("creationdate element not found, using last modified date");
                                    var creationdateValue = getlastmodifiedValue;
                                }
                                try {
                                    var getcontentlength = xmlRequest[i].getElementsByTagName("getcontentlength")[0].firstChild.nodeValue;
                                    getcontentlength = ((getcontentlength/1024));
                                    getcontentlength = Math.round(getcontentlength * 100) / 100
                                    getcontentlength = getcontentlength + " KB";
                                } catch (e) {
                                    var getcontentlength = "";
                                }
                                try {
                                    var getcontenttypeValue = xmlRequest[i].getElementsByTagName("getcontenttype")[0].firstChild.nodeValue;
                                } catch (e) {
                                    try {
                                        var getcontenttypeValue = xmlRequest[i].getElementsByTagName("collection")[0];
                                        getcontenttypeValue = "httpd/unix-directory";
                                    } catch(e) {
                                        enyo.log("getcontenttype element not found");
                                        var getcontenttypeValue = "unknown";    
                                    }
                                }
                                
                                var itemData = xmlRequest[i];
                            }

                            if (xmltype == "RFC2518") {
                                var creationdateValue = "";
                                var getcontenttypeValue = "";
                                var getcontentlength = "";
                                if (xmlRequest[i].getElementsByTagName("collection")[0]) {
                                    getcontenttypeValue = "httpd/unix-directory";
                                } else {
                                    getcontenttypeValue = getContentType(hrefValue);
                                }
                                var itemData = xmlRequest[i];
                            }

                            // Nur den Dateinamen ausgeben, wenn das Letzte Zeichen ein "/" ist, muss dieses erst einmal entfernt werden
                            if (hrefValue.length > 1 && hrefValue.lastIndexOf("/") == hrefValue.length - 1) {
                                hrefValue = hrefValue.substring(0, hrefValue.lastIndexOf("/"));
                            }

                            var hrefNorm = new Array;
                            hrefNorm = hrefValue.split("/");
                            //enyo.log("new file, path: " + decodeURI(hrefValue) + ", filename: " + decodeURI(hrefNorm[hrefNorm.length - 1]) + ", creationdate: " + creationdateValue + ", lastmodified: " + getlastmodifiedValue + ", contenttype: " + getcontenttypeValue);
                            //Hide dot files
                            if (decodeURI(hrefNorm[hrefNorm.length - 1]).indexOf(".") != 0)
                                dirListData.push({ path: decodeURI(hrefValue), filename: decodeURI(hrefNorm[hrefNorm.length - 1]), creationdate: creationdateValue, lastmodified: getlastmodifiedValue, contenttype: getcontenttypeValue, contentlength: getcontentlength, fulldata: itemData });

                        }
                        // Aufrufen der uebergebenen Funktion
                        enyo.log("Finished parsing data for " + dirListData.length + " files");
                        enyo.log("calling handler, passing sessionCookie: " + this.sessionCookie);
                        handler(dirListData, request.readyState, this.sessionCookie);
                    }
                } else {
                    enyo.log("Unexpected HTTP response to directory list!");
                    handler("error", request.status);
                }
            } else {
                handler(null, request.readyState);
            }
        }
        enyo.log("sending " + xml);
        request.send(xml);
    }

    /* Datei herunterladen
    	---------------------------------------------------
    	
    	Uebergabeparameter:
    		file        = Die Datei welche geladen werden soll, dies im Format "/path/filename"
    		contenttype = Dies ist der Type des files
    		handler     = Beinhaltet die Funktion welche das Ergebnis (Inhalt der Datei) bearbeiten soll.	
    				
    */
    this.getFile = function(file, contenttype, handler) {
        var request = new XMLHttpRequest();

        enyo.log('GET ' + this.protocol + "://" + this.server + encodeURI(file) + " of content type " + contenttype);
        request.open('GET', this.protocol + "://" + this.server + encodeURI(file), true);
        request.setRequestHeader('Depth', 0);
        request.setRequestHeader('Content-Type', contenttype);
        request.setRequestHeader('Origin', 'http://localhost'); //over-ride webOS app-based origin so ownCloud/nextCloud don't block us

        request.onreadystatechange = function() {
            // Request war erfolgreich
            if (request.readyState == 4) {
                if (request.responseText) {
                    handler(request.responseText);
                }
            }
        }
        request.send();
    }

    this.getSessionCookie = function() {
        return this.sessionCookie;
    }


    /* Datei oder Verzeichnis loeschen
    	---------------------------------------------------
    	
    	Uebergabeparameter:
    		file    = Die Datei oder das Verzeichnis, welches geloescht werden soll, dies im Format "/path/filename"
    		handler = Beinhaltet die Funktion welche das Ergebnis bearbeiten soll.
    						
    */
    this.deleteObject = function(object, handler) {
        var request = new XMLHttpRequest();
        request.open('DELETE', this.protocol + "://" + this.server + encodeURI(object), true);

        request.onreadystatechange = function() {
            // Request war erfolgreich
            if (request.readyState == 4) {
                if (request.responseText) {
                    var xmlRequest = request.responseXML.getElementsByTagName("response");
                    request.setRequestHeader('Origin', 'http://localhost'); //over-ride webOS app-based origin so ownCloud/nextCloud don't block us

                    // Speichern der Dateistruktur in einem JSON Object
                    var response = [];

                    var hrefValue = xmlRequest[0].getElementsByTagName("href")[0].firstChild.nodeValue;
                    var statusValue = xmlRequest[0].getElementsByTagName("status")[0].firstChild.nodeValue;
                    var errorValue = xmlRequest[0].getElementsByTagName("error")[0].firstChild.nodeValue;

                    response.push({ path: decodeURI(hrefValue), status: statusValue, error: errorValue });
                    handler(response);
                }
            }
        }
        request.send();
    }


    /* Verzeichnis erstellen
    	---------------------------------------------------
    	
    	Uebergabeparameter:
    		file        = Die Datei welche geladen werden soll, dies im Format "/path/filename"
    		handler     = Beinhaltet die Funktion welche das Ergebnis (Inhalt der Datei) bearbeiten soll.	
    				
    */
    this.createDir = function(file, handler) {
        var request = new XMLHttpRequest();
        request.open('MKCOL', this.protocol + "://" + this.server + encodeURI(file), true);
        request.setRequestHeader('Origin', 'http://localhost'); //over-ride webOS app-based origin so ownCloud/nextCloud don't block us

        request.onreadystatechange = function() {
            // Request war erfolgreich
            if (request.readyState == 4) {
                handler(request.responseText);
            }
        }
        request.send();
    }


    /* Datei hochladen
    	---------------------------------------------------
    	
    	Uebergabeparameter:
    		file        = Die Datei welche geladen werden soll, dies im Format "/path/filename"
    		handler     = Beinhaltet die Funktion welche das Ergebnis (Inhalt der Datei) bearbeiten soll.	
    				
    */
    this.uploadFile = function(filepath, content, handler) {
        var request = new XMLHttpRequest();
        request.open('PUT', this.protocol + "://" + this.server + encodeURI(filepath), true);
        request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        request.setRequestHeader('Origin', 'http://localhost'); //over-ride webOS app-based origin so ownCloud/nextCloud don't block us
        request.onreadystatechange = function() {
            // Request war erfolgreich
            if (request.readyState == 4) {
                handler(request.responseText);
            }
        }
        request.send(content);
    }
}

// Datei Icon je nach contenttype ausgeben
function getContentType(filename) {
    var fend = "." + filename.slice(filename.lastIndexOf(".") + 1, filename.length);
    for (var i=0;i<mimetypeList.length;i++){
        var thisType = mimetypeList[i];
        if (thisType.extension == fend)
            return thisType.mimetype;
    }
    enyo.log("Could not find mimetype for file: " + filename)
    return "application/octet-stream";
}

function formatDateString(d) {
    d = new Date(d);
    var datestring = 
            d.getFullYear() + "-" +
            (d.getMonth()+1) + "-" + 
            d.getDate()  + " " + 
            d.getHours() + ":" + 
            d.getMinutes();
    return datestring;
}