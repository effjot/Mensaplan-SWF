/* Global variable holding data and preferences */

Mensaplan = {};
Mensaplan.prefs = {             // Preferences
    mensa:       "CottbusBTU",  // Mensa to display
    showImages:  true,          // Show images for ingredients?
    filterFood:  false,         // Hide meals matching keywords?
    filterWords: new Array(),
    wholeWords:  true,          // Match only full words in filter?
    showWelcome: true           // Show welcome message and changelog? (At first start)
}

Mensaplan.storePrefs = function() {
    Mojo.Log.info("Storing prefs to DB.");
    Mensaplan.depot.add("prefs", Mensaplan.prefs,
		        function() {
                            Mojo.Log.info("Prefs stored successfully.");
                        },
		        function(event) {
			    Mojo.Log.info("Prefs DB failure: %j", event);
	                });
}


function StageAssistant() {
    /* this is the creator function for your stage assistant object */

    this.aboutMessage =
        "<div style='float: right'><img src='images/fj-logo.png'></div>"
        + $L("Copyright 2009–2012 code-devils.de and")
        + " "
        + Mojo.Controller.appInfo.vendor + ".<br>"
        + "<a href='" + Mojo.Controller.appInfo.vendorurl + "'>"
        + Mojo.Controller.appInfo.vendorurl + "</a><br>"
        + "<div style='clear: both'>"
        + $L("Menus for the 5 mensas of the") + " "
        + "<a href='http://www.studentenwerk-frankfurt.de/'>"
        + $L("Studentenwerk Frankfurt") + "</a>."
        + "<br>"
        + $L("Support and development:") + " "
        + "<a href='http://forums.webosnation.com/webos-homebrew-apps/295179-mensaplan-studentenwerk-frankfurt-swf.html'>"
        + $L("webOS Nation forum")
        + "</a>.</div>";
}


/* Push main scene */

StageAssistant.prototype.setup = function() {
    /* this function is for setup tasks that have to happen when the
       stage is first created */

    // allows free orientation of application

    this.controller.setWindowOrientation("free");

    // get preferences, then push first scene (in callback)
    var dboptions = { name: "dbmensaplanswf", replace: false };
    Mensaplan.depot = new Mojo.Depot(dboptions, this.dbConnectionSuccess.bind(this),
                                     this.dbFailure.bind(this));
}


/* Setup of Mojo.Depot database */

StageAssistant.prototype.dbConnectionSuccess = function() {
    Mojo.Log.info("DB successfully connected.");
    Mensaplan.depot.get("prefs", this.getPrefs.bind(this),
 this.dbFailure.bind(this));
};

StageAssistant.prototype.dbFailure = function(event) {
    Mojo.Controller.errorDialog("Database failure: %j.", event);
};

StageAssistant.prototype.getPrefs = function(args) {
    if (args) {
	for (value in args) {
	    Mensaplan.prefs[value] = args[value];
	    Mojo.Log.info("Pref: ", value, args[value], Mensaplan.prefs[value]);
	}
    }
    Mojo.Log.info("Prefs: %j", Mensaplan.prefs);

    // Prefs are loaded, now we can push the first scene
    if (Mensaplan.prefs.showWelcome)
        this.controller.pushScene("welcome", true);
    else
        this.controller.pushScene("main");
};



/* Handle "About" menu */

StageAssistant.prototype.handleCommand = function(event) {
    this.controller = Mojo.Controller.stageController.activeScene();
    var restricted = false;

    if (event.type == Mojo.Event.command) {
        switch (event.command) {
        case "do-about-restricted":
            restricted = true;
            // continue with "do-about" case
        case "do-about":
            this.controller.
                showAlertDialog(
                    { onChoose:
                        function(value) {
                            switch (value) {
                            case "ok":
                                return;
                            case "moreinfo":
                                this.controller.stageController.
                                    pushScene("welcome",
                                              false);
                                break;
                            }
                        },
                      title: $L(Mojo.Controller.appInfo.title) + " "
                             + Mojo.Controller.appInfo.version,
                      message: this.aboutMessage,
                      allowHTMLMessage: true,
                      choices: restricted ?
                        [
                            { label: $L("OK"), type: "primary", value: "ok" }
                        ]
                        :
                        [
                            { label: $L("More info / change log"), type: "secondary", value: "moreinfo" },
                            { label: $L("OK"), type: "primary", value: "ok" }
                        ]
                    });
            break;
        }
    }
};
