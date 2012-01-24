function MainAssistant() {
    this.current = -1;
    this.maximum = -1;
    this.days;
    this.noDataString = $L("No Data – Press Update");
    this.xmlHttp;
    this.keyArray = new Array();
    this.mensa = "CottbusBTU";  // Mensa to display
    this.showImages = true;
    this.filterFood = false;
    this.filterWords = new Array();
    this.wholeWords = true;
    this.timer = null;
}


MainAssistant.prototype.setup = function() {

    // create db
    //var dboptions = { name: "dbmensaplanswf", replace: false };
    //this.depot = new Mojo.Depot(dboptions, this.dbConnectionSuccess, this.dbConnectionFailure);

    // title
    this.controller.get('essenDatum').innerText = this.noDataString;

    // update button
    this.buttonAttributes = {};
    this.buttonModel = { label: $L('Update'), buttonClass: 'primary', disabled: true };
    this.controller.setupWidget("buttonUpdate", this.buttonAttributes, this.buttonModel);
    this.updateHandler = this.update.bindAsEventListener(this);

    // app menu
    this.appMenuAttr = { omitDefaultItems: true };
    this.appMenuModel = {
        items: [
            { label: $L('Update'), command: 'do-update', disabled: true },
            { label: $L('Clear Database'), command: 'do-clear-db', disabled: false },
            { label: $L("Preferences"), command: 'do-prefs', disabled: false },
            { label: $L('About'), command: 'do-about', disabled: false }
        ]
    };
    this.controller.setupWidget(Mojo.Menu.appMenu, this.appMenuAttr, this.appMenuModel);

    // command menu
    this.commandMenuModel = {
        items:	[ { icon: "back",       command: "go-prev",  disabled: true },
                  { label: $L("today"), command: "go-today", disabled: true },
                  { icon: "forward",    command: "go-next",  disabled: true }]
        };
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.commandMenuModel);

    // read preferences
    Mensaplan.depot.simpleGet("mensa", this.getPrefMensa.bind(this), function() {});
    Mensaplan.depot.simpleGet("showImages", this.getPrefShowImagesOK.bind(this), function() {});
    Mensaplan.depot.simpleGet("filterFood", this.getPrefFilterFoodOK.bind(this), function() {});
    Mensaplan.depot.simpleGet("filterWords", this.getPrefFilterWordsOK.bind(this), function() {});
    Mensaplan.depot.simpleGet("wholeWords", this.getPrefWholeWordsOK.bind(this), function() {});

    // spinner
    this.spinner = this.controller.get('spin-scrim');
    this.spinner.show();
    this.spinnerAttrs = {
        spinnerSize: 'large'
    }
    this.spinnerModel = {
            spinning: true
    };
    this.controller.setupWidget('feedSpinner', this.spinnerAttrs, this.spinnerModel);

    // flick event for next/prev date
    this.flickHandler = this.flickNextPrev.bindAsEventListener(this);
}


MainAssistant.prototype.activate = function() {
    Mensaplan.depot.get("keys", this.dbGetKeysSuccess.bind(this), this.dbGetKeysFailure.bind(this));
    this.updateCommandMenu();
    //this.setButtonStatus(false);
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



/* Preferences */

MainAssistant.prototype.getPrefMensa = function(result) {
    if (result != null)
        this.mensa = result;
    else
        this.mensa = "CottbusBTU";
}

MainAssistant.prototype.getPrefShowImagesOK = function(result) {
    if (result != null)
        this.showImages = result;
    else
	this.showImages = true;
}

MainAssistant.prototype.getPrefFilterFoodOK = function(result) {
    if (result != null)
        this.filterFood = result;
    else
	this.filterFood = false;
}

MainAssistant.prototype.getPrefFilterWordsOK = function(result) {
    if (result != null)
        this.filterWords = result;
}

MainAssistant.prototype.getPrefWholeWordsOK = function(result) {
    if (result != null)
        this.wholeWords = result;
    else
	this.wholeWords = true;
}


/* Update database (from app menu or button) */

MainAssistant.prototype.update = function(event) {
    var myapp = this;

    // test if internet connection is available
    new Mojo.Service.Request('palm://com.palm.connectionmanager', {
        method: 'getstatus',
        onSuccess: function(data) {
            if ((data.wan.state == "disconnected") &&
                    // no internet over bluetooth yet
                    /*(data.btpan.state == "disconnected") &&*/
                    (data.wifi.state == "disconnected")) {
                Mojo.Controller.errorDialog($L("No internet connection available."));
            } else {
                myapp.timer = myapp.controller.window.setTimeout(
                    myapp.cancelDownload.bind(myapp), 30000);
                myapp.hasInternet().bind(myapp);
            }
        },
        onFailure: function(data) {}
    });
}

MainAssistant.prototype.cancelDownload = function() {
    this.xmlHttp.abort();
    this.setButtonStatus(false);
    Mojo.Controller.errorDialog($L("Timeout reached. Couldn't download data."));
}

MainAssistant.prototype.hasInternet = function() {
    // disable buttons
    this.setButtonStatus(true);

    // clean db
    Mensaplan.depot.removeAll(this.dbRemoveAllSuccess.bind(this),
                         this.dbConnectionFailure.bind(this));

    if (window.XMLHttpRequest) {
        this.xmlHttp = new XMLHttpRequest();
    }

    // send request for first page
    this.keyArray = new Array();

    // get current calendar week (ISO 8601)
    var week = this.getKalenderwoche(0);

    // request current week
    this.sendRequest(this.getMensaBaseURL(this.mensa) + week, true);
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

    if (this.xmlHttp) {

        this.xmlHttp.open('GET', url, true);

        this.xmlHttp.onreadystatechange = function () {

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
                            myapp.setButtonStatus(false);
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
                                Mojo.Log.info("meals j =", j);
                                var meal = meals[j];
                                var mealcategory = meal.firstChild.nextSibling.nodeValue;
                                var ind = mealcategory.lastIndexOf(":");
                                if (ind > 0) {
                                    mealcategory = mealcategory.slice(0, ind);
                                }
                                var mealdesc = meal.childNodes[3].innerText;
                                Mojo.Log.info("mealcategory =", mealcategory);
                                Mojo.Log.info("mealdesc =", mealdesc);
                                var imgstring = meal.firstChild.getAttribute('SRC');
                                ind = imgstring.lastIndexOf("/");
                                var mealimg = imgstring.slice(ind + 1);
                                var mealrecord = new Meal(mealcategory, mealdesc, mealimg);
                                essenArray.push(mealrecord);
                            }
                        } else {
                            // no meals (Mensa closed?) --> message is in date div
                            var message = fulldate[0].childNodes[1].firstChild.innerText;
                            Mojo.Log.info("no meals; message =", message);
                            var mealrecord = new Meal("", message, "warning-icon.png");
                            essenArray.push(mealrecord);
                        }

                        // add meals for a specified day to db
			Mensaplan.depot.add(numericdate, essenArray);

                        // add date to keys
			myapp.keyArray.push(numericdate);
                    }

                }
                else {
		    myapp.controller.window.clearTimeout(myapp.timer);
                    Mojo.Controller.errorDialog($L("Webpage couldn't be found."));
                    myapp.setButtonStatus(false);
                    return;
                }

		if (firstRun) {
                    // get next week
		    var week = myapp.getKalenderwoche(1);
                    myapp.sendRequest(myapp.getMensaBaseURL(myapp.mensa) + week, false);
		} else {
		    // cancel timout
		    myapp.controller.window.clearTimeout(myapp.timer);

		    // add to db
		    Mensaplan.depot.add("keys", myapp.keyArray);

		    // refresh view
		    Mensaplan.depot.get("keys", myapp.dbGetKeysSuccess.bind(myapp),
                                    myapp.dbGetKeysFailure.bind(myapp));
		}
            }
        };
        this.xmlHttp.send(null);
    }
}


/* TODO: still necessary??? */
MainAssistant.prototype.getDatum = function() {
    var date = new Date();
    var dd = date.getDate();
    var mm = date.getMonth() + 1;
    var yy = date.getFullYear();
    var day = date.getDay();
//    var daylist = new Array("Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag");
    var daylist = Mojo.Locale.getDayNames('long');
    var datumString = daylist[day] + ", " + dd + "." + mm + "." + yy;
    return datumString;
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
	    this.setButtonStatus(false);
	    return;
        }

        this.maximum = result.length;
        this.days = result;
        this.displayEntry();
    }

    this.setButtonStatus(false);
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

    Mensaplan.depot.get(this.days[this.current], this.dbDisplayEntry.bind(this),
                   function(error) {
                       Mojo.Controller.errorDialog("Can't get values (#" + error.message + ").");
                   });
}

MainAssistant.prototype.dbDisplayEntry = function(result) {
    if (result != null) {
        for (var i = 0; i < result.length; i++) {
            var essen = result[i];
            var titlestring = $L(essen.title);
            var descstring = essen.desc;
            var imgstring = essen.img;

	    // test for filter
	    if (this.filterFood) {
		var found = false;
		for (var j = 0; j < this.filterWords.length; j++) {
		    var filterWord = this.filterWords[j].data;
		    if (this.wholeWords)
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

            var imgHTML = (this.showImages && imgstring.toLowerCase() != "frei.gif" ) ?
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
	this.controller.get('buttonUpdate').style.display = "none";
    }
}

MainAssistant.prototype.dbGetKeysFailure = function(error) {
    Mojo.Controller.errorDialog("Can't get keys (#" + error.message + ")."); 
}

MainAssistant.prototype.dbRemoveAllSuccess = function() {
    Mojo.Log.info("DB successfully cleared.");
}

MainAssistant.prototype.dbRemoveAllFailure = function(transaction, result){
    Mojo.Controller.errorDialog("Can't clear database (#" + result.message + ")."); 
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

MainAssistant.prototype.setButtonStatus = function(status) {
    Mojo.Log.info("setButtonStatus(", status, ")");

    // button
    Mojo.Log.info("setButtonStatus(): button");

    this.buttonModel.disabled = status;
    this.controller.modelChanged(this.buttonModel, this);

    // menu
    Mojo.Log.info("setButtonStatus(): menu; ignore spurious warning logged below!");
    this.appMenuModel.items[0].disabled = status;
    this.appMenuModel.items[1].disabled = status;
    this.controller.modelChanged(this.appMenuModel, this);

    // spinner
    Mojo.Log.info("setButtonStatus(): spinner");
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
    Mensaplan.depot.removeAll(this.dbRemoveAllSuccess, this.dbConnectionFailure);
    this.controller.get("essenListe").innerHTML = "";
    this.controller.get("essenDatum").innerText = this.noDataString;
    this.current = -1;
    this.maximum = -1;
    this.days = [];
    // scroll to top
    var scroller = Mojo.View.getScrollerForElement(this.controller.get("essenListe"));
    scroller.mojo.revealTop(0);
    this.updateCommandMenu();
    this.controller.get("buttonUpdate").style.display = "block";
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
