var ggbHTML5ScriptLoadInProgress = false;
var ggbHTML5ScriptLoadFinished = false;

/**
 * @param ggbVersion The version of the GeoGebraFile as string in the format x.x (e.g. '4.4')
 * @param parameters
 * @param views
 * @param appletID
 */
var GGBApplet = function() {
    var applet = {};

    // Define the parameters
    var ggbVersion = null;
    var parameters = null;
    var views = null;
    var appletID = null;

    for(var i=0; i<arguments.length; i++) {
        var p = arguments[i];
        switch(typeof(p))
        {
            case 'number':
                ggbVersion = p.toFixed(1);
                break;
            case 'string':
                // Check for a version number
                if (p.match(new RegExp("^[0-9]\.[0-9]$"))) {
                    ggbVersion = p;
                } else {
                    appletID = p;
                }
                break;
            case 'object':
                if (p.is3D != undefined) {
                    views = p;
                } else {
                    parameters = p;
                }
                break;
        }
    }

    if (views == null)
        views = {"is3D":false,"AV":false,"SV":false,"CV":false,"EV2":false,"CP":false,"PC":false,"DA":false,"FI":false,"PV":false,"macro":false};

    if (appletID != null && parameters.id == undefined) {
        parameters.id = appletID;
    }

    // Private members
    var jnlpFilePath = "";
    var html5Codebase = "";
    var javaCodebase = "";
    var isOverriddenJavaCodebase = false;
    var isHTML5Offline = false;
    var isJavaOffline = false;
    var loadedAppletType = null;
    var javaCodebaseVersion = null;
    var html5CodebaseVersion = null;
    var html5CodebaseScript = null;
    var previewImagePath = null;
    var previewLoadingPath = null;
    var fonts_css_url = null;
    var giac_js_url = null;
    var jnlpBaseDir = null;

    parameters.height = Math.round(parameters.height);
    parameters.width = Math.round(parameters.width);

    /**
     * Overrides the codebase for HTML5.
     * @param codebase Can be an URL or a local file path.
     * @param offline Set to true, if the codebase is a local URL and no web URL
     */
    applet.setHTML5Codebase = function(codebase, offline) {
        html5Codebase = codebase;

        if (offline == null) {
            offline = (codebase.indexOf("http") === -1);
        }
        isHTML5Offline = offline;

        // Set the scriptname (web or webSimple)
        html5CodebaseScript = "web.nocache.js";
        if (! offline) { // Currently we don't use webSimple for offline worksheets
            var folders = html5Codebase.split("/");
            if (folders.length>0) {
                if (folders[folders.length-2] == 'webSimple') {
                    html5CodebaseScript = "webSimple.nocache.js";
                }
            }
        }

        // Extract the version from the codebase folder
        if (codebase.slice(-1) != '/') {
        	codebase += '/';
        }
        var folders = codebase.split('/');
        html5CodebaseVersion = folders[folders.length-3];
        if (html5CodebaseVersion.substr(0,4) == 'test') {
        	html5CodebaseVersion = html5CodebaseVersion.substr(4,1) + '.' + html5CodebaseVersion.substr(5,1);
        }
    }

    /**
     * Overrides the codebase version for Java.
     * @param version The version of the codebase that shoudl be used for java applets.
     */
    applet.setJavaCodebaseVersion = function(version) {
        javaCodebaseVersion = version;
        setDefaultJavaCodebaseForVersion(version);
    }

    /**
     * Overrides the codebase version for HTML5.
     * If another codebase than the default codebase should be used, this method has to be called before setHTML5Codebase.
     * @param version The version of the codebase that should be used for HTML5 applets.
     */
    applet.setHTML5CodebaseVersion = function(version) {
        html5CodebaseVersion = version;
        setDefaultHTML5CodebaseForVersion(version);
    }

    /**
     * Overrides the codebase for Java.
     * @param codebase Can be an URL or a local file path.
     * @param offline Set to true, if the codebase is a local URL and no web URL
     */
    applet.setJavaCodebase = function(codebase, offline) {
        isOverriddenJavaCodebase = true;

        if (codebase.slice(-1) == '/') {
            javaCodebaseVersion = codebase.slice(-4,-1);
        } else {
            javaCodebaseVersion = codebase.slice(-3);
        }

        if (offline == null) {
            offline = (codebase.indexOf("http") === -1);
        }
        if (offline && jnlpBaseDir != null) {
            jnlpBaseDir = null;
        }

        doSetJavaCodebase(codebase, offline);
    }

    applet.setFontsCSSURL = function(url) {
        fonts_css_url = url;
    }

    applet.setGiacJSURL = function(url) {
        giac_js_url = url;
    }

    var doSetJavaCodebase = function(codebase, offline) {
        javaCodebase = codebase;

        // Check if the codebase is online or local
        isJavaOffline = offline;

        // Set the name of the JNLP file to the codebase directory
        if (jnlpBaseDir == null) {
            var dir='';
            if (isJavaOffline) {
                var loc = window.location.pathname;
                dir = loc.substring(0, loc.lastIndexOf('/'))+'/';
            }
            applet.setJNLPFile(dir+codebase+'/'+buildJNLPFileName(isJavaOffline));
        } else {
            applet.setJNLPFile(jnlpBaseDir+javaCodebaseVersion+'/'+buildJNLPFileName(isJavaOffline));
        }
    }

    /**
     * Overrides the JNLP file to use.
     * By default (if this method is not called), the jnlp file in the codebase directory is used.
     * Cannot be used in combination with setJNLPBaseDir
     * @param newJnlpFilePath The absolute path to the JNLP file.
     */
    applet.setJNLPFile = function(newJnlpFilePath) {
        jnlpFilePath = newJnlpFilePath;
    }

    /**
     * Sets an alternative base directory for the JNLP File. The path must not include the version number.
     * @param baseDir
     */
    applet.setJNLPBaseDir = function(baseDir) {
        jnlpBaseDir = baseDir;
        applet.setJNLPFile(jnlpBaseDir+javaCodebaseVersion+'/'+buildJNLPFileName(isJavaOffline));
    }

    /**
     * Injects the applet;
     * @param containerID The id of the HTML element that is the parent of the new applet.
     * All other content (innerText) of the container will be overwritten with the new applet.
     * @param type Can be 'preferJava', 'preferHTML5', 'java', 'html5' or 'auto'. Default='auto';
     * @return The type of the applet that was injected or null if the applet could not be injected.
     */
    applet.inject = function() {
        var type = 'auto';
        var container_ID = parameters.id;
        for(var i=0; i<arguments.length; i++) {
            var p = arguments[i].toLowerCase();
            if (p == 'preferjava' || p == 'preferhtml5' || p == 'java' || p == 'html5' || p == 'auto') {
                type = p;
            } else {
                container_ID = arguments[i];
            }
        }

        // Use the container id as appletid, if it was not defined.
        type = detectAppletType(type); // Sets the type to either 'java' or 'html5'

        if (type === "java") {
            injectJavaApplet(container_ID, parameters);
        } else {
            if (navigator.appName == 'Microsoft Internet Explorer' && getIEVersion() < 10) {

                alert("Please install Java from www.java.com or use the Google Chrome browser");

                var error = document.getElementById(container_ID);
                error.innerHTML = 'Please install Java from <a href="www.java.com">www.java.com</a> or use the <a href="http://www.google.com/chrome>Google Chrome</a> browser';
                type = null;
            } else {
                injectHTML5Applet(container_ID, parameters);
            }
        }
        loadedAppletType = type;

        return loadedAppletType;
    }



    /**
     * @returns boolean Whether the system is capable of showing the GeoGebra Java applet
     */
    applet.isJavaInstalled = function() {
        if (typeof deployJava === 'undefined') {
            // incase deployJava.js not available
            if (navigator.javaEnabled()) {
                // Check if IE is in metro mode
                if (navigator.appName == 'Microsoft Internet Explorer' && getIEVersion() >= 10) {
                    if(window.innerWidth == screen.width && window.innerHeight == screen.height) {
                        return false;
                    }
                }
                return true;
            }
        } else {
            return (deployJava.versionCheck("1.6.0+") || deployJava.versionCheck("1.4") || deployJava.versionCheck("1.5.0*"));
        }
    }

    /**
     * @return NULL if not version found. Else return some things like: '1.6.0_31'
     */
    var JavaVersion = function() {
        var resutl = null;
        // Walk through the full list of mime types.
        for( var i=0,size=navigator.mimeTypes.length; i<size; i++ )
        {
            // The jpi-version is the plug-in version.  This is the best
            // version to use.
            if( (resutl = navigator.mimeTypes[i].type.match(/^application\/x-java-applet;jpi-version=(.*)$/)) !== null )
                return resutl[1];
        }
        return null;
    }

    /**
     * @returns boolean Whether the system is capable of showing the GeoGebra HTML5 applet
     */
    applet.isHTML5Installed = function() {
        if (views.is3D || navigator.appName == 'Microsoft Internet Explorer' && getIEVersion() < 10) {
            return false;
        }
        return true;
    }

    /**
     * @returns The type of the loaded applet or null if no applet was loaded yet.
     */
    applet.getLoadedAppletType = function() {
        return loadedAppletType;
    }

    applet.setPreviewImage = function(previewFilePath, loadingFilePath) {
        previewImagePath = previewFilePath;
        previewLoadingPath = loadingFilePath;
    }

//    var validateJavaApplet = function(appletElem, container_ID) {
//        if ((typeof appletElem.isAnimationRunning) === 'undefined') {
//            log("Error: The GeoGebra Java applet could not be started. Used JNLP file = '"+jnlpFilePath+"'. Switching to HTML5 instead.");
//
//            // Try html5 instead
//            applet.inject(container_ID, 'html5');
//        }
//    }

    var injectJavaApplet = function(container_ID, parameters) {
        var appletElem = document.getElementById(container_ID);

        // Remove the html5 applet if it exists
        removeExistingApplet(appletElem);

        if (views.CV && (navigator.appVersion.indexOf("Mac")!=-1 || navigator.appVersion.indexOf("Linux")!=-1 || navigator.appVersion.indexOf("X11")!=-1)) {
            // Load the javascript version of giac
            if (giac_js_url != null) {
                giac_url = giac_js_url;
            } else {
                giac_url = javaCodebase+'/giac.js';
            }
            var script = document.createElement("script");
            script.setAttribute("src", giac_url);


            setupGIAC = function() {
                _GIAC_caseval = __ggb__giac.cwrap('_ZN4giac7casevalEPKc', 'string', ['string']);
            }

            script.onload = setupGIAC;
            appletElem.appendChild(script);

            script = document.createElement("script");
            script.innerHTML = "" +
                "       var _GIAC_caseval = 'nD';" +
                "       function _ggbCallGiac(exp) {" +
                "           var ret = _GIAC_caseval(exp);" +
                "           return ret;" +
                "       }";
            appletElem.appendChild(script);
        }

        var applet = document.createElement("applet");
        applet.setAttribute("name", (parameters.id != undefined ? parameters.id : "ggbApplet"));
        applet.setAttribute("height", parameters.height);
        applet.setAttribute("width", parameters.width);
        applet.setAttribute("code", "dummy");

        appendParam(applet, "jnlp_href", jnlpFilePath);
        if (isOverriddenJavaCodebase) {
            appendParam(applet, "codebase", javaCodebase);
        }

        appendParam(applet, "boxborder", "false");
        appendParam(applet, "centerimage", "true");

        if(ggbVersion === "5.0")
            appendParam(applet, "java_arguments", "-Xmx1024m -Djnlp.packEnabled=false");
        else
            appendParam(applet, "java_arguments", "-Xmx1024m -Djnlp.packEnabled=true");

        // Add dynamic parameters
        for (var key in parameters) {
            if (key != 'width' && key != 'height') {
                appendParam(applet, key, parameters[key]);
            }
        }

        appendParam(applet, "framePossible", "false");
        if (! isJavaOffline)
            appendParam(applet, "image", "https://www.geogebra.org/webstart/loading.gif");

        appendParam(applet, "codebase_lookup", "false");

        if (navigator.appName != 'Microsoft Internet Explorer' || getIEVersion() > 9) {
            applet.appendChild(document.createTextNode("This is a Java Applet created using GeoGebra from www.geogebra.org - it looks like you don't have Java installed, please go to www.java.com"));
        }

        appletElem.appendChild(applet);

//        setTimeout(validateJavaApplet(appletElem, container_ID),5000);

        log("GeoGebra Java applet injected. Used JNLP file = '"+jnlpFilePath+"'"+(isOverriddenJavaCodebase?" with overridden codebase '"+javaCodebase+"'." : "."));
    }

    var appendParam = function(applet, name, value) {
        var param = document.createElement("param");
        param.setAttribute("name", name);
        param.setAttribute("value", value);
        applet.appendChild(param);
    }

    var removeExistingApplet = function(appletParent) {
        var elems = appletParent.getElementsByTagName("applet");
        if (elems[0] != undefined && elems[0].parentNode == appletParent) {
            appletParent.removeChild(elems[0]);
        }
        elems = appletParent.getElementsByTagName("article");
        if (elems[0] != undefined && elems[0].parentNode == appletParent) {
            appletParent.removeChild(elems[0]);
        }
        elems = appletParent.getElementsByTagName("div");
        if (elems[0] != undefined && elems[0].parentNode == appletParent) {
            appletParent.removeChild(elems[0]);
        }
//        appletElem.innerHTML = "";
    }

    var injectHTML5Applet = function(container_ID, parameters) {
        var appletElem = document.getElementById(container_ID);

        // Remove the java applet if it exists
        removeExistingApplet(appletElem);

        if (typeof(renderGGBElement) == 'function') {
            var loadScript = ( !ggbHTML5ScriptLoadInProgress && !ggbHTML5ScriptLoadFinished );
            var renderWithoutReload = ggbHTML5ScriptLoadFinished;
        } else {
            var loadScript = ( !ggbHTML5ScriptLoadInProgress || ggbHTML5ScriptLoadFinished );
            var renderWithoutReload = false;
        }

        var article = document.createElement("article");
        var bkp_height = parameters.height;
        var bkp_width = parameters.width;

        // The HTML 5 version changes the height depending on which bars are shown. So we have to correct it here.
        if (parseFloat(html5CodebaseVersion) >= 4.4) {
            if (parameters.showToolBar) {
                parameters.height -= 9;
            }
            if (parameters.showMenuBar) {
                parameters.height -= 2;
            }
            if (parameters.showAlgebraInput) {
                parameters.height -= 34;
            }
        } else {
            if (parameters.showToolBar) {
                parameters.height -= 59;
            }
            if (parameters.showMenuBar) {
                parameters.height -= 34;
            }
            if (parameters.showAlgebraInput) {
                parameters.height -= 34;
                parameters.width -= 97;
            }
        }
        article.name = "ggbApplet";
        article.className = "geogebraweb";
        article.style.border = '1px solid black';
        article.style.display = 'inline-block';
        article.setAttribute("name", "ggbApplet");

        for (var key in parameters) {
            article.setAttribute("data-param-"+key, parameters[key]);
        }

        // Add the tag for the preview image
        if (previewImagePath != null && parseFloat(html5CodebaseVersion)>=4.4) {
            var preview = document.createElement("div");
            preview.className = "ggb_preview";
            preview.style.position = "absolute";
            preview.style.zIndex = "1";
            preview.style.top = "0px";
            preview.style.left = "0px";
            preview.style.border = "1px solid black"
            preview.style.background = "url('"+previewImagePath+"') no-repeat center center";
            preview.style.width = parameters.width+'px';
            preview.style.height = parameters.height+'px';
            article.appendChild(preview);

            if (previewLoadingPath != null) {
                var previewLoading = document.createElement("div");
                previewLoading.style.position = "absolute";
                previewLoading.style.zIndex = "2";
                previewLoading.style.top = "11px";
                previewLoading.style.left = "11px";
                previewLoading.style.background = "url('"+previewLoadingPath+"') no-repeat";
                previewLoading.style.width = '177px';
                previewLoading.style.height = '31px';
                preview.appendChild(previewLoading);
            }

            var previewContainer = document.createElement("div");
            previewContainer.style.position = "relative";
            previewContainer.style.display = 'inline-block';
            previewContainer.appendChild(article);
            appletElem.appendChild(previewContainer);
        } else {
            appletElem.appendChild(article);
        }


        // Load the web script
        if (loadScript) {
            if (parseFloat(html5CodebaseVersion)>=4.4) {

                if (fonts_css_url == null) {
                    var f_c_u = html5Codebase+"css/fonts.css";
                } else {
                    var f_c_u = fonts_css_url;
                }

                var fontscript1 = document.createElement("script");
                fontscript1.type = 'text/javascript';
                fontscript1.innerHTML = '\n' +
                    '//<![CDATA[\n' +
                    'WebFontConfig = {\n' +
                    '   loading: function() {},\n' +
                    '   active: function() {},\n' +
                    '   inactive: function() {},\n' +
                    '   fontloading: function(familyName, fvd) {},\n' +
                    '   fontactive: function(familyName, fvd) {},\n' +
                    '   fontinactive: function(familyName, fvd) {},\n' +
                    '   custom: {\n' +
                    '       families: ["geogebra-sans-serif", "geogebra-serif"],\n' +
                    '           urls: [ "'+f_c_u+'" ]\n' +
                    '   }\n' +
                    '};\n' +
                    '//]]>\n' +
                    '\n';

                var fontscript2 = document.createElement("script");
                fontscript2.type = 'text/javascript';
                fontscript2.src = html5Codebase+'/js/webfont.js';

                appletElem.appendChild(fontscript1);
                appletElem.appendChild(fontscript2);
            }

            var script = document.createElement("script");

            var scriptLoaded = function() {
//                log("GeoGebra Web Script loaded. Src = "+script.src);
                ggbHTML5ScriptLoadInProgress = false;
                ggbHTML5ScriptLoadFinished = true;
            }

            script.src=html5Codebase + html5CodebaseScript;
            script.onload = scriptLoaded;
            ggbHTML5ScriptLoadInProgress = true;
            ggbHTML5ScriptLoadFinished = false;

            log("GeoGebra HTML5 applet injected. Codebase = '"+html5Codebase+"'.");
            appletElem.appendChild(script);
        } else if (renderWithoutReload) {
            renderGGBElement(article);
            log("GeoGebra HTML5 applet injected and rendered with previously loaded codebase.")
        } else {
            log("GeoGebra HTML5 applet injected without reloading web codebase.");
        }

        parameters.height = bkp_height;
        parameters.width = bkp_width;
    }

    var buildJNLPFileName = function(isOffline) {
        var version = parseFloat(javaCodebaseVersion);
        var filename = "applet" + version*10 + "_";
        if (isOffline) {
            filename += "local";
        } else {
            filename += "web";
        }
        if (views.is3D) {
            filename += "_3D";
        }
        filename += ".jnlp";
        return filename;
    }


    /**
     * Detects the type of the applet (java or html5).
     * If a fixed type is passed in preferredType (java or html5), this type is forced.
     * Otherwise the method tries to find out which types are supported by the system.
     * If a preferredType is passed, this type is used if it is supported.
     * If auto is passed, the preferred type is html5 for versions >= 4.4 and java for all versions < 4.4.
     * @param preferredType can be 'preferJava', 'preferHTML5', 'java', 'html5' or 'auto'. Default='auto'
     */
    var detectAppletType = function(preferredType) {
        preferredType = preferredType.toLowerCase();
        if ((preferredType === "java") || (preferredType === "html5")) {
            return preferredType;
        }

        if (preferredType === "preferjava") {
            if (applet.isJavaInstalled()) {
                return "java";
            } else {
                return "html5";
            }
        } else if (preferredType === "preferhtml5") {
            if (applet.isHTML5Installed()) {
                return "html5";
            } else {
                return "java";
            }
        } else {
            // type=auto
            if ((applet.isJavaInstalled()) &&
                (parseFloat(ggbVersion) < 4.4 || !applet.isHTML5Installed() || views.PC || views.is3D)) {
                return "java";
            } else {
                return "html5";
            }
        }
    }

    var getIEVersion = function() {
        a=navigator.appVersion;
        return a.indexOf('MSIE')+1?parseFloat(a.split('MSIE')[1]):999
    }


    /**
     * @param version Can be: 3.2, 4.0, 4.2, 4.4, 5.0, test, test42, test44, test50
     */
    var setDefaultHTML5CodebaseForVersion = function(version) {

        // Set the correct codebase version for the passed version
        if (version == "test") {
            if (parseFloat(ggbVersion) < 4.4)
                version = "4.4";
            else
                version = ggbVersion;
            html5CodebaseVersion += version.substr(0,1) + version.substr(2,1);
        } else
            html5CodebaseVersion = version;
        if (version.substr(0,4) != "test") {
            if (parseFloat(html5CodebaseVersion)<4.4) // For versions below 4.4 the HTML5 codebase of version 4.4 is used.
                html5CodebaseVersion = "4.4";
            else if (parseFloat(version) >= 5.0)
                html5CodebaseVersion = "test50";
            else if (version == "test44")
                html5CodebaseVersion = "4.4"; // there is no 4.4 test version

//            if (parseFloat(html5CodebaseVersion)<=4.4)
//                html5CodebaseVersion = "test50"; // todo: remove

        }

        // Set the codebase URL for the version
        if (html5CodebaseVersion == "4.2") {
            codebase = "http://js.geogebra.at/";
            var hasWebSimple = false;
        } else {
            var hasWebSimple = true;
            if (window.location.protocol.substr(0,4) == 'http')
                var protocol = window.location.protocol;
            else
                var protocol = 'http:';
            var codebase = protocol+"//www.geogebra.org/web/" + html5CodebaseVersion + "/";
            var codebase = './'
        }

        // Decide if web or websimple should be used
        if (hasWebSimple && !views.is3D && !views.AV && !views.SV && !views.CV && !views.EV2 && !views.CP && !views.PC && !views.DA && !views.FI && !views.PV
            && !parameters.showToolBar && !parameters.showMenuBar && !parameters.showAlgebraInput && !parameters.enableRightClick) {
            codebase += 'webSimple/';
        } else {
            codebase += 'web/';
        }

        applet.setHTML5Codebase(codebase, false);
    }

    var setDefaultJavaCodebaseForVersion = function(version) {

        // There are no test versions for java. So when test is passed, it will be converted to the normal codebase
        if (version == "test32")
            javaCodebaseVersion = "3.2";
        else if (version == "test40")
            javaCodebaseVersion = "4.0";
        else if (version == "test42")
            javaCodebaseVersion = "4.2";
        else if (version == "test50")
            javaCodebaseVersion = "5.0";
        else if (version == "test")
            javaCodebaseVersion = ggbVersion;
        else
            javaCodebaseVersion = version;

        // For versions below 4.0 the java codebase of version 4.0 is used.
        if (parseFloat(javaCodebaseVersion)<4.0)
            javaCodebaseVersion = "4.0";

        if (window.location.protocol.substr(0,4) == 'http')
            var protocol = window.location.protocol;
        else
            var protocol = 'http:';
        var codebase = protocol+"//jars.geogebra.org/webstart/" + javaCodebaseVersion + '/';
        if (javaCodebaseVersion == '4.0' || javaCodebaseVersion == '4.2')
            codebase += 'jnlp/';

        applet.setJNLPBaseDir('https://www.geogebratube.org/webstart/');

        doSetJavaCodebase(codebase, false);
    }

    var log = function(text) {
        if ( window.console && window.console.log ) {
            console.log(text);
        }
    }

    // Initialize the codebase with the default URLs
    setDefaultHTML5CodebaseForVersion(ggbVersion);
    setDefaultJavaCodebaseForVersion(ggbVersion);

    return applet;

};


function iframeAppletByName(name) {
    if (eval("typeof(window.frames." + name + ".document)") != 'undefined')
        return eval("window.frames." + name + ".document.ggbApplet");
    return eval("window.frames." + name + ".contentDocument.ggbApplet");
}
