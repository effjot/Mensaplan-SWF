/* Based on Setup scene from Preware app:
   http://git.webos-internals.org/applications/preware/
   GPL v2 license */

function WelcomeAssistant(atStartup) {
    /* this is the creator function for your scene assistant
       object. It will be passed all the additional parameters (after
       the scene name) that were passed to pushScene. The reference to
       the scene controller (this.controller) has not be established
       yet, so any initialization that needs the scene controller
       should be done in the setup function below. */

    this.atStartup = atStartup;

    // on first start, this message is displayed, along with the current version message from below
    this.welcomeMessages = [
        $L("This app displays student dining hall (Mensa) menus for various universities in Brandenburg, Germany which are operated by the Studentenwerk Frankfurt/Oder: Cottbus (BTU and HL), Senftenberg, Eberswalde, Frankfurt.  Includes a filtering option – you can hide meals using arbitrary keywords.  Menus for the current and next week are stored on your device, so you don't need internet connection after updating the database."),
        "<strong>" + $L("Scroll down to see what's new in this version.") + "</strong>",
        "<em>" + $L("Dear user,") + "<br>",
        $L("I would like to publish a “finished” 1.0 version of this app soon.  Please have a look at it and send bug reports or other suggestions. I would be very happy to hear from you on the development forum – just follow the link in the “About” app menu entry.") + "</em>",
        "<em>" + $L("This app builds upon the “MensaPlan BTU” app by ")
            + "<a href='http://code-devils.de'>code-devils.de</a>"
            + $L(", which had no longer been maintained and didn't work any more.  I didn't manage to get into contact with the author by various means and for a long time, so I finally decided to fork his code (GPLv2) and to publish my extensions.") + "</em>",
        "<em>" + $L("Thanks, and enjoy this app!") + "<br>Florian Jenn</em>"
    ];

    // change log
    this.changeLog = [
	{ version: "0.9.0", log: [ "Pre3 support",
                                   "Welcome message and changelog at first startup (code from Preware app – thanks!) and from About info.",
                                   "Aiming for a stable 1.0 release." ] },
	{ version: "0.6.1", log: [ "Translation for new “organic food” category." ] },
	{ version: "0.6.0", log: [ "Published on Homebrew and App Catalog.",
                                   "Removed Studentenwerk logo from icon because I didn't get any reply to my request if I may use it." ] },
	{ version: "0.5.5", log: [ "“Today” button." ] },
	{ version: "0.5.4", log: [ "Meal categories translated to English." ] },
	{ version: "0.5.2", log: [ "New icon." ] },
	{ version: "0.5.1", log: [ "Support for remaining mensas: Frankfurt, Senftenberg, Eberswalde." ] },
	{ version: "0.5.0", log: [ "Offers both mensas in Cottbus (BTU and HL).",
                                   "Renamed to “Mensa Menu Studentenwerk Frankfurt”, new app ID.",
                                   "Code cleanup." ] },
	{ version: "0.4.4", log: [ "Code more flexible: is able to get menus of different mensas (besides BTU Cottbus)." ] },
	{ version: "0.4.2", log: [ "Flick left/right to change days.", "Code cleanup." ] },
	{ version: "0.4.1", log: [ "Adapted parser to new Studentenwerk website." ] },
	{ version: "0.3.3", log: [ "Internationalisation and German localisation." ] },
	{ version: "0.3.2", log: [ "Last published version of “MensaPlan BTU” by code-devils.de." ] }
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

//    this.controller.setupWidget(Mojo.Menu.appMenu, Papersizes.appMenuAttr,
  //                              Papersizes.appMenuModelRestricted);

    this.titleContainer.innerHTML = $L("Welcome to <em>Mensa Menu SWF</em>");
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
            Mensaplan.prefs.showwelcome = false;
            Mensaplan.storePrefs();
            if (this.atStartup)
	        this.controller.stageController.swapScene("main");
            else
                this.controller.stageController.popScene();
	    break;
	}
    }
};