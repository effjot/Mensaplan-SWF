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
    // allows free orientation of application
    this.controller.setWindowOrientation("free");

    if (true) //(Papersizes.prefs.showwelcome)
        this.controller.pushScene("welcome", true);
    else
        this.controller.pushScene("main");
}


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
