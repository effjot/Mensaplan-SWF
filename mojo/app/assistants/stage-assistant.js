function StageAssistant() {
    /* this is the creator function for your stage assistant object */

    this.aboutMessage =
        $L("Copyright 2011 code-devils.de and")
        + " "
        + Mojo.Controller.appInfo.vendor
        + ".<br><a href='" + Mojo.Controller.appInfo.vendorurl + "'>"
        + Mojo.Controller.appInfo.vendorurl + "</a><br>"
        + $L("Menus taken from the website of the") + " "
        + "<a href='http://www.studentenwerk-frankfurt.de/'>"
        + $L("Studentenwerk Frankfurt") + "</a>.";

}


/* Push main scene */

StageAssistant.prototype.setup = function() {
    this.controller.pushScene('main');
}


/* App Menu ("About" info) */

StageAssistant.prototype.handleCommand = function(event) {
    this.controller = Mojo.Controller.stageController.activeScene();
    if (event.type == Mojo.Event.command) {
        switch(event.command) {
        case 'do-about':
            this.controller.showAlertDialog({
                onChoose: function(value) {},
                title: $L(Mojo.Controller.appInfo.title) + " "
                    + Mojo.Controller.appInfo.version,
                message: this.aboutMessage,
                allowHTMLMessage: true,
                choices:[
                    {label:$L("OK"), value:""}
                ]
            });
            break;
        }
    }
};
