/* Based on Setup scene from Preware app:
   http://git.webos-internals.org/applications/preware/
   GPL v2 license */

function WelcomeAssistant(windowOrientation, atStartup) {
    /* this is the creator function for your scene assistant
       object. It will be passed all the additional parameters (after
       the scene name) that were passed to pushScene. The reference to
       the scene controller (this.controller) has not be established
       yet, so any initialization that needs the scene controller
       should be done in the setup function below. */

    this.windowOrientation = windowOrientation;
    this.atStartup = atStartup;

    // on first start, this message is displayed, along with the current version message from below
    this.welcomeMessages = [
        $L("This is a compact reference of common paper and photo print size series. Select the series by tapping on the top bar; the unit can be selected at the bottom.  Set your preferred series and unit at startup, the DPI value (for pixel sizes), and the display format for aspect ratios in the preferences."),
        "<strong>" + $L("Scroll down to see what's new in this version.") + "</strong>",
        "<em>" + $L("Dear user,") + "<br>",
        $L("I would like to publish a “finished” 1.0 version of this app soon.  Please have a look at it and send bug reports (esp. about the North American envelope sizes) or offer translations (these are done quite easily). I would be very happy to hear from you on the development forum – just follow the link in the “About” app menu entry.") + "</em>",
        "<em>" + $L("Thanks, and enjoy this app!") + "<br>Florian Jenn</em>"
    ];

    // change log
    this.changeLog = [
	{ version: "0.9.7", log: [ "Cleaned up North American envelope sizes.",
                                   "Added 2A0 and 4A0 ISO formats." ] },
	{ version: "0.9.6", log: [ "Envelope sizes (DIN/ISO and North American).",
                                   "There will be no new features before the 1.0 release.  Please submit bug reports, and see the development forum for the post-1.0 roadmap." ] },
	{ version: "0.9.5", log: [ "Pre3 support.",
                                   "App should be almost complete now – I'm waiting for your suggestions and bug reports." ] },
	{ version: "0.9.4", log: [ "Two new size series: ANSI and Arch formats.", "Short explanations in preferences." ] },
	{ version: "0.9.3", log: [ "New unit: points.",  "A few more American sizes." ] },
	{ version: "0.9.2", log: [ "New icon.", "Minor user interface changes." ] },
	{ version: "0.9.1", log: [ "New “unit”: aspect ratio – select display style (ratio 1:x or fraction x:y) in the preferences.  A few more photo sizes have been added and some wrong photo sizes fixed." ] },
	{ version: "0.9.0", log: [ "New size series: photo print sizes. Thanks to “Bag of Leaves” for the suggestion!",
                                   "Welcome message and changelog at first startup (code from Preware app – thanks!)." ] },
	{ version: "0.5.1", log: [ "Unit at startup can be selected in preferences." ] },
	{ version: "0.5.0", log: [ "Size series at startup can be selected in preferences." ] },
	{ version: "0.4.3", log: [ "DPI (for pixel sizes) can be selected in preferences." ] },
	{ version: "0.4.2", log: [ "Support and development URLs in “About” message." ] },
	{ version: "0.4.1", log: [ "Proper localisation of units." ] },
	{ version: "0.4.0", log: [ "Different units can be selected: mm, inch, pixel." ] }
    ];

    this.continueButtonDelay = 1.5;

    // command menu model
    this.cmdMenuModel =	{
	visible: false,
	items: [
	    {},                 // centering
	    {
		label: $L("Ok, I've read this. Let's continue…"),
		command: 'do-continue'
	    },
	    {}
	]
    };

    this.cookie = new Mojo.Model.Cookie("PapersizesPrefs");
}

WelcomeAssistant.prototype.setup = function() {
    /* this function is for setup tasks that have to happen when the
     * scene is first created */

    // get elements
    this.titleContainer = this.controller.get('title');
    this.messageContainer =  this.controller.get('message');
    this.changelogContainer =  this.controller.get('changelog');


    /* use Mojo.View.render to render view templates and add them to
       the scene, if needed */

    // build welcome message

    var messagehtml = "";
    for (var m = 0; m < this.welcomeMessages.length; m++) {
        messagehtml += '<div class="palm-body-text">'
            + this.welcomeMessages[m] + '</div>';
    }
    messagehtml += '<div class="palm-body-title">'
        + $L("Change Log") + '</div>';

    // build changelog
    var clhtml = "";
    for (var m = 0; m < this.changeLog.length; m++) {
	clhtml += Mojo.View.render({object: {title: "v" + this.changeLog[m].version},
                                    template: "welcome/changelog"});
	clhtml += '<ul class="palm-body-text">';
	for (var l = 0; l < this.changeLog[m].log.length; l++) {
	    clhtml += '<li>' + this.changeLog[m].log[l] + '</li>';
	}
	clhtml += '</ul>';
    }


    /* setup widgets here */

    this.controller.setupWidget(Mojo.Menu.appMenu, Papersizes.appMenuAttr,
                                Papersizes.appMenuModelRestricted);

    this.titleContainer.innerHTML = $L("Welcome to <em>Paper Sizes</em>");
    this.messageContainer.innerHTML = messagehtml;
    this.changelogContainer.innerHTML = clhtml;

    this.controller.setupWidget(Mojo.Menu.commandMenu, { menuClass: 'no-fade' }, this.cmdMenuModel);


    /* add event handlers to listen to events from widgets */
};

WelcomeAssistant.prototype.activate = function(event) {
    /* put in event handlers here that should only be in effect when
       this scene is active. For example, key handlers that are
       observing the document */

    // start continue button timer
    this.timer = this.controller.window.setTimeout(this.showContinue.bind(this),
                                                   this.continueButtonDelay * 1000);
};

WelcomeAssistant.prototype.deactivate = function(event) {
    /* remove any event handlers you added in activate and do any
       other cleanup that should happen before this scene is popped or
       another scene is pushed on top */
};

WelcomeAssistant.prototype.cleanup = function(event) {
    /* this function should do any cleanup needed before the scene is
       destroyed as a result of being popped off the scene stack */
};

WelcomeAssistant.prototype.showContinue = function() {
    // show the command menu
    this.controller.setMenuVisible(Mojo.Menu.commandMenu, true);
};

WelcomeAssistant.prototype.handleCommand = function(event) {
    if (event.type == Mojo.Event.command) {
	switch (event.command) {
	case 'do-continue':
            Papersizes.prefs.showwelcome = false;
            this.cookie.put(Papersizes.prefs);
            if (this.atStartup)
	        this.controller.stageController.swapScene("sizes-list", this.windowOrientation);
            else
                this.controller.stageController.popScene();
	    break;
	}
    }
};