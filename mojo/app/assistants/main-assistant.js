function MainAssistant() {
    this.current = -1;
    this.maximum = -1;
    this.days;
    this.noDataString = $L("No Data – Press Update");
    this.xmlHttp;
    this.keys = new Array();
    this.menus = new Array();
    this.timer = null;
}


MainAssistant.prototype.setup = function() {

    // title
    this.controller.get('essenDatum').innerText = this.noDataString;

    // update button (disabled at startup; will be enabled and shown by dbGetKeysSuccess)
    this.buttonAttributes = {};
    this.buttonModel = { label: $L('Update'), buttonClass: 'primary', disabled: true };
    this.controller.setupWidget("buttonUpdate", this.buttonAttributes, this.buttonModel);
    this.updateHandler = this.update.bindAsEventListener(this);

    // app menu
    this.controller.setupWidget(Mojo.Menu.appMenu, Mensaplan.appMenuAttr,
                                Mensaplan.appMenuModel);

    // command menu
    this.commandMenuModel = {
        items:	[ { icon: "back",       command: "go-prev",  disabled: true },
                  { label: $L("today"), command: "go-today", disabled: true },
                  { icon: "forward",    command: "go-next",  disabled: true }]
        };
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.commandMenuModel);

    // spinner
    this.spinner = this.controller.get('spin-scrim');
    this.spinner.hide();
    this.spinnerAttrs = {
        spinnerSize: 'large'
    }
    this.spinnerModel = {
            spinning: false
    };
    this.controller.setupWidget('feedSpinner', this.spinnerAttrs, this.spinnerModel);

    // flick event for next/prev date
    this.flickHandler = this.flickNextPrev.bindAsEventListener(this);
}


MainAssistant.prototype.activate = function() {
    Mensaplan.depot.get("keys", this.dbGetKeysSuccess.bind(this), this.dbGetKeysFailure.bind(this));
    this.updateCommandMenu();
    Mojo.Event.listen(this.controller.get('buttonUpdate'),
                      Mojo.Event.tap, this.updateHandler);
    Mojo.Event.listen(this.controller.document,
                      Mojo.Event.flick, this.flickHandler);
}


MainAssistant.prototype.deactivate = function() {
    Mojo.Event.stopListening(this.controller.get('buttonUpdate'),
                             Mojo.Event.tap, this.updateHandler);
    Mojo.Event.stopListening(this.controller.document,
                             Mojo.Event.flick, this.flickHandler);
}


MainAssistant.prototype.cleanup = function() {
}


/* Update database (from app menu or button) */

MainAssistant.prototype.update = function(event) {
    var myapp = this;

    // test if internet connection is available
    new Mojo.Service.Request('palm://com.palm.connectionmanager', {
        method: 'getstatus',
        onSuccess: function(data) {
            if (data.isInternetConnectionAvailable) {
                myapp.timer = myapp.controller.window.setTimeout(
                    myapp.cancelDownload.bind(myapp), 30000);
                myapp.hasInternet(); // start the update proper
            } else {
                Mojo.Controller.errorDialog($L("No internet connection available."));
            }
        },
        onFailure: function() {}
    });
}

MainAssistant.prototype.cancelDownload = function() {
    this.xmlHttp.abort();
    this.indicateUpdateIsRunning(false);
    Mojo.Controller.errorDialog($L("Timeout reached. Couldn't download data."));
}

MainAssistant.prototype.hasInternet = function() {
    // disable buttons
    this.indicateUpdateIsRunning(true);

    // clear old data
    // FIXME: check for error in sendRequest, keep old menu if download failed
    this.keys.length = 0;
    this.menus.length = 0;

    // send request for first page
    if (window.XMLHttpRequest) {
        this.xmlHttp = new XMLHttpRequest();
    }
    var week = this.getKalenderwoche(0); // get current calendar week (ISO 8601)
    this.sendRequest(this.getMensaBaseURL(Mensaplan.prefs.mensa) + week, true);
}

MainAssistant.prototype.getKalenderwoche = function(offsetWeek) {
    function donnerstag (datum) {
	var Do = new Date();
	Do.setTime(datum.getTime() + (3 - ((datum.getDay() + 6) % 7)) * 86400000);
	return Do;
    }

    var Datum = new Date();
    Datum.setTime(Datum.getTime() + (offsetWeek * 604800000));
    var DoDat = donnerstag(Datum);
    var kwjahr = DoDat.getFullYear();
    var DoKW1 = donnerstag(new Date(kwjahr, 0, 4));
    var millisek = DoDat.getTime();
    var kw = Math.floor(1.5 + (millisek - DoKW1.getTime()) / 86400000 / 7);
    return kw;
}

MainAssistant.prototype.sendRequest = function(url, firstRun) {
    var myapp = this;
    Mojo.Log.info("sendRequest(): url =", url, "firstRun =", firstRun);

    if (this.xmlHttp) {

        this.xmlHttp.open('GET', url, true);

        this.xmlHttp.onreadystatechange = function() {

            if (myapp.xmlHttp.readyState == 4) {

                if (myapp.xmlHttp.status == 200) {

                    var rootdiv = new Element('div');
                    rootdiv.innerHTML = myapp.xmlHttp.responseText;

                    var weeklist = rootdiv.getElementsByTagName('TD');
                    Mojo.Log.info("len weeklist =", weeklist.length);

                    function Meal(title, desc, img) {
                        // helper for database construction below
                        this.title = title;
                        this.desc  = desc;
                        this.img = img;
                    }

                    // iterate over days
                    for (var i = 0; i < weeklist.length; i++) {
                        Mojo.Log.info("days: i =", i);

                        var essenArray = new Array();

                        // find date
                        var fulldate = myapp.getElementsByTagAndClass(weeklist[i],
                                                                      'DIV', 'speiseplanTag');
                        if (fulldate.length != 1) {
                            myapp.controller.window.clearTimeout(myapp.timer);
                            Mojo.Controller.errorDialog($L("Malformed website content: no date field found."));
                            myapp.indicateUpdateIsRunning(false);
                            return;
                        }
                        var numericdate = fulldate[0].firstChild.nodeValue.slice(-10);
                        Mojo.Log.info("numericdate =", numericdate);

                        // find and parse meals
                        var meals = myapp.getElementsByTagAndClass(weeklist[i], 'DIV',
                                                                      'essenBlock');
                        Mojo.Log.info("len meals =", meals.length);

                        if (meals.length > 0) {
                            // iterate over meals
                            for (var j = 0; j < meals.length; j++) {
                                //Mojo.Log.info("meals j =", j);
                                var meal = meals[j];
                                var mealcategory = meal.firstChild.nextSibling.nodeValue;
                                var ind = mealcategory.lastIndexOf(":");
                                if (ind > 0) {
                                    mealcategory = mealcategory.slice(0, ind);
                                }
                                var mealdesc = meal.childNodes[3].innerText;
                                //Mojo.Log.info("mealcategory =", mealcategory);
                                //Mojo.Log.info("mealdesc =", mealdesc);
                                var imgstring = meal.firstChild.getAttribute('SRC');
                                ind = imgstring.lastIndexOf("/");
                                var mealimg = imgstring.slice(ind + 1);
                                var mealrecord = new Meal(mealcategory, mealdesc, mealimg);
                                essenArray.push(mealrecord);
                            }
                        } else {
                            // no meals (Mensa closed?)
                            Mojo.Log.info("no meals");
                            // maybe message in date div?
                            var message = $L("No menu – Mensa closed?");
                            if (fulldate[0].childnodes)
                                message = fulldate[0].childNodes[1].firstChild.innerText;
                            Mojo.Log.info("no meals message =", message);
                            var mealrecord = new Meal("", message, "warning-icon.png");
                            essenArray.push(mealrecord);
                        }

                        // add meals for a specified day to array
                        myapp.menus[numericdate] = essenArray;

                        // add date to keys
			myapp.keys.push(numericdate);
                    }

                }
                else {
		    myapp.controller.window.clearTimeout(myapp.timer);
                    Mojo.Controller.errorDialog($L("Webpage couldn't be found."));
                    myapp.indicateUpdateIsRunning(false);
                    return;
                }

		if (firstRun) {
                    // get next week
		    var week = myapp.getKalenderwoche(1);
                    myapp.sendRequest(myapp.getMensaBaseURL(Mensaplan.prefs.mensa) + week, false);
		} else {
		    // cancel timout
		    myapp.controller.window.clearTimeout(myapp.timer);

		    // add to db
		    Mensaplan.depot.add("keys", myapp.keys);
                    Mensaplan.depot.add("menus", myapp.menus);

		    // refresh view
		    Mensaplan.depot.get("keys", myapp.dbGetKeysSuccess.bind(myapp),
                                    myapp.dbGetKeysFailure.bind(myapp));
		}
            }
        };
        this.xmlHttp.send(null);
    }
}

MainAssistant.prototype.dbConnectionSuccess = function() {
    Mojo.Log.info("DB successfully loaded.");
}

MainAssistant.prototype.dbConnectionFailure = function(transaction, result) {
    Mojo.Controller.errorDialog("Can't open feed database (#" + result.message + ").");
}

MainAssistant.prototype.dbGetKeysSuccess = function(result) {
    Mojo.Log.info("Keys successfully read: " + result);
    if ((result != null) && (result != "")) {
        this.current = this.indexOfToday(result);

        if (this.current == -1) {
            // current date not in DB, so show the last entry
	    this.current = result.length - 1;
        } else {
            this.maximum = result.length;
            this.days = result;
            this.displayEntry();
        }
    } else {
        this.controller.get('buttonUpdate').setAttribute("class", "show");
    }
    this.indicateUpdateIsRunning(false);
}

MainAssistant.prototype.displayEntry = function() {
    var daylist = Mojo.Locale.getDayNames('long');
    var currentDay = this.days[this.current];
    var dateArray = currentDay.split(".");
    var dateDay = dateArray[0];
    var dateMonth = dateArray[1];
    var dateYear = dateArray[2];
    var resultDate = new Date(dateYear, dateMonth - 1, dateDay);
    var weekday = resultDate.getDay();

    this.controller.get('essenListe').innerHTML = "";
    this.controller.get('essenDatum').innerText = daylist[weekday] + ", " + currentDay;

    Mensaplan.depot.get("menus", this.dbDisplayEntry.bind(this),
                   function(error) {
                       Mojo.Controller.errorDialog("Can't get values (#" + error.message + ").");
                   });
}

MainAssistant.prototype.dbDisplayEntry = function(result) {
    if (result != null) {
        var menu = result[this.days[this.current]];
        Mojo.Log.info("dbDisplayEntry(): result =", result, "menu =", menu);
        for (var i = 0; i < menu.length; i++) {
            var essen = menu[i];
            var titlestring = $L(essen.title);
            var descstring = essen.desc;
            var imgstring = essen.img;

	    // test for filter
	    if (Mensaplan.prefs.filterFood) {
		var found = false;
		for (var j = 0; j < Mensaplan.prefs.filterWords.length; j++) {
		    var filterWord = Mensaplan.prefs.filterWords[j].data;
		    if (Mensaplan.prefs.wholeWords)
			filterWord = "\\b" + filterWord + "\\b";
		    var expression = new RegExp(filterWord, "i");
		    // search in description
		    if (descstring.search(expression) != -1)
			found = true;
		    // search in image file name
		    if (imgstring.search(expression) != -1)
			found = true;
		}
		if (found)
		    continue;
	    }

            var imgHTML = (Mensaplan.prefs.showImages && imgstring.toLowerCase() != "frei.gif" ) ?
                '<div class="food-icon">' +
                '<img src="images/' +
                imgstring +
                '">' +
                '</img>' +
                '</div>'
                : '';
            this.controller.get('essenListe').innerHTML +=
            '<div class="palm-group">' +
                '<div class="palm-group-title">' +
                titlestring +
                '</div>' +
                '<div class="palm-list">' +
                '<div class="palm-row last">' +
                '<div class="palm-row-wrapper">' +
                imgHTML +
	        '<div class="palm-body-text">' +
	        descstring +
	        '</div>' +
    	        '</div>' +
        	'</div>' +
            	'</div>' +
            	'</div>';
        }

	// scroll to top
	var scroller = Mojo.View.getScrollerForElement(this.controller.get('essenListe'));
	scroller.mojo.revealTop(0);

	// update command menu
	this.updateCommandMenu();

	// hide update button
        this.controller.get('buttonUpdate').setAttribute("class", "hide");
    }
}

MainAssistant.prototype.dbGetKeysFailure = function(error) {
    Mojo.Controller.errorDialog("Can't get keys (#" + error.message + ").");
}

MainAssistant.prototype.dbDiscardSuccess = function() {
    Mojo.Log.info("Key successfully discarded from DB.");
}

MainAssistant.prototype.dbDiscardFailure = function(transaction, result){
    Mojo.Controller.errorDialog("Can't discard key from DB (#" + result.message + ").");
}


/* Command handler */

MainAssistant.prototype.handleCommand = function(event) {
    if (event.type == Mojo.Event.command) {
	this.cmd = event.command;

	switch(this.cmd) {
        case "do-update":
            this.update();
            break;

	case "do-clear-db":
	    this.controller.showAlertDialog({
                onChoose: function(value) {
                    if (value)
                        this.clearDB();
                },
                title: $L("Clear Database"),
                message: $L("Delete downloaded menus?"),
                choices:[
                    {label: $L("Yes"), value:true, type:"affirmative"},
                    {label: $L("No"), value:false, type:"negative"}
                ]
            });
            break;

        case "do-prefs":
            Mojo.Controller.stageController.pushScene("preferences", this);
            break;

	case "go-prev":
	    this.displayNewDate(-1);
            break;

	case "go-next":
	    this.displayNewDate(+1);
            break;

        case "go-today":
            this.current = this.indexOfToday(this.days);
            this.displayEntry();
            break;

	default:
	    break;

	}
    }
}


MainAssistant.prototype.updateCommandMenu = function() {
    if (this.current <= 0) {
        this.commandMenuModel.items[0].disabled = true;
    } else {
        this.commandMenuModel.items[0].disabled = false;
    }
    if (this.current >= this.maximum - 1) {
        this.commandMenuModel.items[2].disabled = true;
    } else {
        this.commandMenuModel.items[2].disabled = false;
    }
    if (this.indexOfToday(this.days) < 0) {
        this.commandMenuModel.items[1].disabled = true;
    } else {
        this.commandMenuModel.items[1].disabled = false;
    }
    this.controller.modelChanged(this.commandMenuModel);
}


/* When update is running: hide/disable "Update" button and menu
   command; disable "Clear DB" menu command; show spinner */

MainAssistant.prototype.indicateUpdateIsRunning = function(status) {
    Mojo.Log.info("indicateUpdateIsRunning(", status, ")");

    // button
    Mojo.Log.info("indicateUpdateIsRunning(): button");
    this.buttonModel.disabled = status;
    this.controller.modelChanged(this.buttonModel, this);

    // menu
    Mojo.Log.info("indicateUpdateIsRunning(): menu; ignore spurious warning logged below!");
    Mensaplan.appMenuModel.items[0].disabled = status;
    Mensaplan.appMenuModel.items[1].disabled = status;
    this.controller.modelChanged(Mensaplan.appMenuModel, this);

    // spinner
    Mojo.Log.info("indicateUpdateIsRunning(): spinner");
    if (status)
        this.spinner.show();
    else
        this.spinner.hide();
    this.spinnerModel.spinning = status;
    this.controller.modelChanged(this.spinnerModel, this);
}



/* Helper functions */

MainAssistant.prototype.getElementsByTagAndClass = function(element, tag, class) {
    var elements = element.getElementsByTagName(tag), i;
    var results = new Array();
    for (i in elements) {
        if ((" "+elements[i].className+" ").indexOf(" " + class + " ") > -1) {
            results.push(elements[i]);
        }
    }
    return results;
}


MainAssistant.prototype.clearDB = function() {
    Mensaplan.depot.discard("keys", this.dbDiscardSuccess, this.dbDiscardFailure);
    Mensaplan.depot.discard("menus", this.dbDiscardSuccess, this.dbDiscardFailure);
    this.keys.length = 0;
    this.menus.length = 0;
    this.controller.get("essenListe").innerHTML = "";
    this.controller.get("essenDatum").innerText = this.noDataString;
    this.current = -1;
    this.maximum = -1;
    this.days = [];
    // scroll to top
    var scroller = Mojo.View.getScrollerForElement(this.controller.get("essenListe"));
    scroller.mojo.revealTop(0);
    this.updateCommandMenu();

    // show button
    this.controller.get('buttonUpdate').setAttribute("class", "show");
}


MainAssistant.prototype.indexOfToday = function(database) {
    Mojo.Log.info("Looking for index of today in database:");
    if (database == undefined) {
        Mojo.Log.info("no database");
        return -1;
    }

    var today = new Date();
    for (var i = 0; i < database.length; i++) {
	var dateArray = database[i].split(".");
	var dateDay   = dateArray[0];
	var dateMonth = dateArray[1];
	var dateYear  = dateArray[2];
	var databaseDate = new Date(dateYear, dateMonth - 1, dateDay, 23, 59, 59);
        Mojo.Log.info("i =", i, "databaseDate =", databaseDate);

        if (databaseDate.getTime() >= today.getTime()) {
            Mojo.Log.info("today at i =", i);
            return i;
        }
    }
    Mojo.Log.info("today not found");
    return -1;
}

MainAssistant.prototype.getMensaBaseURL = function(mensa) {
    // valid mensas: CottbusBTU, CottbusHL, Senftenberg, Frankfurt, Eberswalde

    return "http://www.studentenwerk-frankfurt.de/2011/lang_de/StandortAlle/"
        + "Gastronomie.StandortAlle/Drucken.Gastronomie.StandortAlle.php?Stadt="
        + mensa + "&TimeStamp=";
}




MainAssistant.prototype.displayNewDate = function(offset) {
    var newDate = this.current + offset;
    if ((newDate >= 0) && (newDate < this.maximum)) {
	this.commandMenuModel.items[0].disabled = true;
	this.commandMenuModel.items[1].disabled = true;
	this.commandMenuModel.items[2].disabled = true;
	this.controller.modelChanged(this.commandMenuModel);
        this.current = newDate;
        this.displayEntry();
    }
}


MainAssistant.prototype.flickNextPrev = function(event) {
    if (event.velocity.x < 0) {
        Mojo.Log.info("Event flick <0");
        this.displayNewDate(+1);
    } else {
        Mojo.Log.info("Event flick >0");
        this.displayNewDate(-1);
    }
};
