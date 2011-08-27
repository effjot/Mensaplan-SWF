function Essen(title, desc, img) {
    this.title = title;
    this.desc  = desc;
    this.img = img;
}

function getMensaBaseURL(mensa) {
    /* valid mensas: CottbusBTU, CottbusHL, Senftenberg, Frankfurt, Eberswalde */

    return "http://www.studentenwerk-frankfurt.de/2011/lang_de/StandortAlle/"
        + "Gastronomie.StandortAlle/Drucken.Gastronomie.StandortAlle.php?Stadt="
        + mensa + "&TimeStamp=";
}


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
    // allows free orientation of application
    this.controller.stageController.setWindowOrientation("free");

    Mojo.Log.info("setup");

    // create db
    var dboptions = {name: "dbmensaplanswff", replace: false};
    this.depot = new Mojo.Depot(dboptions, this.dbConnectionSuccess, this.dbConnectionFailure);

    // title
    this.controller.get('essenDatum').innerText = this.noDataString;

    // update button
    this.buttonAttributes = {};
    this.buttonModel = {label: $L('Update'), buttonClass: 'primary', disabled: true};
    this.controller.setupWidget("buttonUpdate", this.buttonAttributes, this.buttonModel);
    this.updateHandler = this.update.bind(this);

    // possibility to show command menu on request (tap)
    //Mojo.Event.listen(this.controller.get('essenListe'), Mojo.Event.tap, this.listtap.bind(this));
    
	// create menu    
    this.appMenuAttr = {omitDefaultItems: true};
	this.appMenuModel = {
            visible: true,
            items: [
                { label: $L('Update'), command: 'do-update' },
                { label: $L('Clear DB'), command: 'do-clear-db' },
                { label: $L("Preferences..."), command: 'do-prefs' },
                { label: $L('About...'), command: 'do-about' }
            ]
        };
	this.controller.setupWidget(Mojo.Menu.appMenu, this.appMenuAttr, this.appMenuModel);
    
    // command menu
    this.commandMenuModel = {
            items:	[{icon: 'back', command:'cmd-1', disabled: false},
                     {icon: 'forward', command:'cmd-2', disabled: false}]
        };
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.commandMenuModel);
    this.controller.setMenuVisible(Mojo.Menu.commandMenu, true);

    // read preferences
    this.depot.simpleGet("mensa", this.getPrefMensa.bind(this), function() {});
    this.depot.simpleGet("showImages", this.getPrefShowImagesOK.bind(this), function() {});
    this.depot.simpleGet("filterFood", this.getPrefFilterFoodOK.bind(this), function() {});
    this.depot.simpleGet("filterWords", this.getPrefFilterWordsOK.bind(this), function() {});
    this.depot.simpleGet("wholeWords", this.getPrefWholeWordsOK.bind(this), function() {});

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
    this.flickHandler = this.flickNextPrev.bind(this)

}


MainAssistant.prototype.displayNewDate = function(offset) {
    var newDate = this.current + offset;
    if ((newDate >= 0) && (newDate < this.maximum)) {
	this.commandMenuModel.items[0].disabled = true;
	this.commandMenuModel.items[1].disabled = true;
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

/* // possibility to show command menu on request
MainAssistant.prototype.listtap = function(event) {
    if (this.controller.getMenuVisible(Mojo.Menu.commandMenu) == true)
        this.controller.setMenuVisible(Mojo.Menu.commandMenu, false);
    else
        this.controller.setMenuVisible(Mojo.Menu.commandMenu, true);
}
*/

MainAssistant.prototype.update = function(event) {
    var myapp = this;

    // test if internet connection is available
    new Mojo.Service.Request('palm://com.palm.connectionmanager', {
        method: 'getstatus',
        onSuccess: function(data){
            if ((data.wan.state == "disconnected") &&
                    // no internet over bluetooth yet
                    /*(data.btpan.state == "disconnected") &&*/
                    (data.wifi.state == "disconnected")) {
                Mojo.Controller.errorDialog($L("No internet connection available."));
            }
            else {
                myapp.timer = myapp.controller.window.setTimeout(myapp.cancelDownload.bind(myapp), 30000);
                //Mojo.Controller.errorDialog("DB successfully loaded.");
                myapp.hasInternet().bind(myapp);
            }
        },
        onFailure: function(data){}
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
    this.depot.removeAll(this.dbRemoveAllSuccess.bind(this), this.dbConnectionFailure.bind(this));

    if (window.XMLHttpRequest) {
        this.xmlHttp = new XMLHttpRequest();
    }

    // send request for first page
    this.keyArray = new Array();

    // get current calendar week (ISO 8601)
    var week = this.getKalenderwoche(0);

    // calc for current week
    this.sendRequest(getMensaBaseURL(this.mensa) + week, true);
}

MainAssistant.prototype.getKalenderwoche = function(offsetWeek) {
	function donnerstag(datum) {
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
                                var mealrecord = new Essen(mealcategory, mealdesc, mealimg);
                                essenArray.push(mealrecord);
                            }
                        } else {
                            // no meals (Mensa closed?) --> message is in date div
                            var message = fulldate[0].childNodes[1].firstChild.innerText;
                            Mojo.Log.info("no meals; message =", message);
                            var mealrecord = new Essen("", message, "warning-icon.png");
                            essenArray.push(mealrecord);
                        }

                        // add meals for a specified day to db
			myapp.depot.add(numericdate, essenArray);

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
		    var week = myapp.getKalenderwoche(1);
                    myapp.sendRequest(getMensaBaseURL(myapp.mensa) + week, false);
		} else {
		    // cancel timout
		    myapp.controller.window.clearTimeout(myapp.timer);

		    // add to db
		    myapp.depot.add("keys", myapp.keyArray);

		    // refresh view
		    myapp.depot.get("keys", myapp.dbGetKeysSuccess.bind(myapp),
                                    myapp.dbGetKeysFailure.bind(myapp));
		}
            }
        };
        this.xmlHttp.send(null);
	}
}

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

MainAssistant.prototype.activate = function(event) {
    this.depot.get("keys", this.dbGetKeysSuccess.bind(this), this.dbGetKeysFailure.bind(this));
    this.updateCommandMenu();
    //this.setButtonStatus(false);
    Mojo.Event.listen(this.controller.get('buttonUpdate'), Mojo.Event.tap, this.updateHandler);
    Mojo.Event.listen(this.controller.document, Mojo.Event.flick, this.flickHandler);
}

MainAssistant.prototype.deactivate = function(event) {
    Mojo.Event.stopListening(this.controller.get('buttonUpdate'), Mojo.Event.tap, this.updateHandler);
    Mojo.Event.stopListening(this.controller.document, Mojo.Event.flick, this.flickHandler);
}

MainAssistant.prototype.cleanup = function(event) {
    Mojo.Event.stopListening(this.controller.get('buttonUpdate'), Mojo.Event.tap, this.update);
}

MainAssistant.prototype.dbConnectionSuccess = function(){  
    //Mojo.Controller.errorDialog("DB successfully loaded."); 
}

MainAssistant.prototype.dbConnectionFailure = function(transaction, result){  
    Mojo.Controller.errorDialog("Can't open feed database (#" + result.message + ")."); 
}

MainAssistant.prototype.dbGetKeysSuccess = function(result) {
    //Mojo.Controller.errorDialog("Keys successfully read: " + result);
    if ((result != null) && (result != "")) {
        //var datum = this.getDatum();
		var actDate = new Date();
		
		for (var i = 0; i < result.length; i++) {
			var dateArray = result[i].split(".");
			var dateDay = dateArray[0];
			var dateMonth = dateArray[1];
			var dateYear = dateArray[2];
			var resultDate = new Date(dateYear, dateMonth - 1, dateDay, 23, 59, 59);
			
            if (resultDate.getTime() >= actDate.getTime()) {
                this.current = i;
                break;
            }
        }
        
        if (this.current == -1) {
            // not current date in db, so show the last entry
			//this.current = result.length - 1;
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
    // clear essenListe
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
 	        
    this.depot.get(this.days[this.current], this.dbDisplayEntry.bind(this),
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
        } // for
		
		// scroll to top
	    var scroller = Mojo.View.getScrollerForElement(this.controller.get('essenListe'));
	    scroller.mojo.revealTop(0);
	    
	    // update command menu
	    this.updateCommandMenu();
	    
	    // hide update button
	    this.controller.get('buttonUpdate').style.display = "none";
    } // if
}

MainAssistant.prototype.dbGetKeysFailure = function(error) {
    Mojo.Controller.errorDialog("Can't get keys (#" + error.message + ")."); 
}

MainAssistant.prototype.dbRemoveAllSuccess = function(){
    //Mojo.Controller.errorDialog("DB successfully cleared.");
}

MainAssistant.prototype.dbRemoveAllFailure = function(transaction, result){
    Mojo.Controller.errorDialog("Can't clear database (#" + result.message + ")."); 
}

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
                title: $L("Clear DB"),
                message: $L("Clear database?"),
                choices:[
                    {label: $L("Yes"), value:true, type:'affirmative'},
                    {label: $L("No"), value:false, type:'negative'}
                ]
            });
            break;

        case 'do-prefs':
            Mojo.Controller.stageController.pushScene('preferences', this);
            break;

        case 'do-about':
            this.controller.showAlertDialog({
                onChoose: function(value) {},
                title: $L(Mojo.Controller.appInfo.title) + " "
                    + Mojo.Controller.appInfo.version,
                message: $L("Copyright 2011 code-devils.de and") + " "
                    + Mojo.Controller.appInfo.vendor
                    + ".<br><a href='" + Mojo.Controller.appInfo.vendorurl + "'>"
                    + Mojo.Controller.appInfo.vendorurl + "</a>",
                allowHTMLMessage: true,
                choices:[
                    {label:$L("OK"), value:""}
                ]
            });
            break;

	    //TODO: fast switch of days leads to incorrect display
	    //disable buttons before displayEntry(); in updateCommandMenu, they are enabled later
	case 'cmd-1':
	    this.displayNewDate(-1);
            break;

	case 'cmd-2':
	    this.displayNewDate(+1);
            break;

	default:
	    break;

	} //switch
    } //if
}

MainAssistant.prototype.updateCommandMenu = function() {
    if (this.current <= 0) {
        this.commandMenuModel.items[0].disabled = true;
    }
    else {
        this.commandMenuModel.items[0].disabled = false;
    }
    if (this.current >= this.maximum - 1) {
        this.commandMenuModel.items[1].disabled = true;
    }
    else {
        this.commandMenuModel.items[1].disabled = false;
    }
    this.controller.modelChanged(this.commandMenuModel);
}

MainAssistant.prototype.setButtonStatus = function(status) {
	// button
	this.buttonModel.disabled = status;
	this.controller.modelChanged(this.buttonModel);
	
    // menu
    this.appMenuModel.items[0].disabled = status;
    this.appMenuModel.items[1].disabled = status;
    this.controller.modelChanged(this.appMenuModel);
    
    // spinner
    if (status)
        this.spinner.show();
    else
        this.spinner.hide();
    this.spinnerModel.spinning = status;
    this.controller.modelChanged(this.spinnerModel, this);
}



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
    this.depot.removeAll(this.dbRemoveAllSuccess, this.dbConnectionFailure);
    this.controller.get('essenListe').innerHTML = "";
    this.controller.get('essenDatum').innerText = this.noDataString;
    this.current = -1;
    this.maximum = -1;
    // scroll to top
    var scroller = Mojo.View.getScrollerForElement(this.controller.get('essenListe'));
    scroller.mojo.revealTop(0);
    this.updateCommandMenu();
    this.controller.get('buttonUpdate').style.display = "block";
}
