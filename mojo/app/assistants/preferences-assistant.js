var mainScene;

function PreferencesAssistant(mainScene) {
    this.mainScene = mainScene;

    this.selectorMensaAttrib = {
        label: $L("Mensa"),
        choices: [
            { label: $L("Cottbus (BTU)"), value: "CottbusBTU" },
            { label: $L("Cottbus (HL)"),  value: "CottbusHL" },
            { label: $L("Eberswalde"),    value: "Eberswalde" },
            { label: $L("Frankfurt"),     value: "Frankfurt" },
            { label: $L("Senftenberg"),   value: "Senftenberg" }
        ]
    };
    this.selectorMensaModel = {
        value: this.mainScene.mensa
    };
}



PreferencesAssistant.prototype.setup = function() {
    // supress app menu
    this.appMenuAttr = {omitDefaultItems: true};
	this.appMenuModel = {
            visible: false,
            items: []
        };
    this.controller.setupWidget(Mojo.Menu.appMenu, this.appMenuAttr, this.appMenuModel);

    // initialize preferences

    // mensa selection
    this.controller.setupWidget('selectorMensa', this.selectorMensaAttrib, this.selectorMensaModel);
    Mojo.Event.listen(this.controller.get("selectorMensa"),
                      Mojo.Event.propertyChange, this.handleMensaChange.bindAsEventListener(this));


	// show images
	this.toggleattsShowImages = {
	    trueLabel: $L('Show'),
	    falseLabel: $L('Hide')
	};
	this.togglemodelShowImages = {
        value: this.mainScene.showImages
	};
	this.controller.setupWidget("togglebuttonImg", this.toggleattsShowImages, this.togglemodelShowImages);
    Mojo.Event.listen(this.controller.get('togglebuttonImg'), Mojo.Event.propertyChange, this.togglechangeShowImages.bindAsEventListener(this));
	
	// filter food
	this.toggleattsFilterFood = {
	    trueLabel: $L('Yes'),
	    falseLabel: $L('No')
	};
	this.togglemodelFilterFood = {
        value: this.mainScene.filterFood
	};
	this.controller.setupWidget("togglebuttonFilter", this.toggleattsFilterFood, this.togglemodelFilterFood);
    Mojo.Event.listen(this.controller.get('togglebuttonFilter'), Mojo.Event.propertyChange, this.togglechangeFilterFood.bindAsEventListener(this));

	// whole words only
	this.toggleattsWholeWords = {
	    trueLabel: $L('Yes'),
	    falseLabel: $L('No')
	};
	this.togglemodelWholeWords = {
        value: this.mainScene.wholeWords
	};
	this.controller.setupWidget("togglebuttonWhole", this.toggleattsWholeWords, this.togglemodelWholeWords);
    Mojo.Event.listen(this.controller.get('togglebuttonWhole'), Mojo.Event.propertyChange, this.togglechangeWholeWords.bindAsEventListener(this));
	
    /* set the widget up here */
    var textfieldAttributes = {
        focusMode: Mojo.Widget.focusSelectMode,
        maxLength: 30,
		textCase: Mojo.Widget.steModeLowerCase
    };
    this.textfieldModel = {
        value: "standard",
        disabled: false
    };
    this.controller.setupWidget('filterListItem', textfieldAttributes, this.textfieldModel);
	
	// Set up a few models so we can test setting the widget model
	//this.wordsModel = {listTitle:$L('Words'), items: this.mainScene.filterWords};
	this.wordsModel = {listTitle:$L('Words'), items: this.mainScene.filterWords};
	
	// Set up the attributes & model for the List widget
	this.controller.setupWidget('wordsList', 
					      {	itemTemplate: 'preferences/listitem', 
						  	listTemplate: 'preferences/listcontainer', 
						 	swipeToDelete: true, 
						 	emptyTemplate: 'preferences/emptylist',
							addItemLabel: $L('Add...')},
					      this.wordsModel);
	
	// Watch relevant list events
	this.wordsList = this.controller.get('wordsList');
	Mojo.Event.listen(this.wordsList, Mojo.Event.listAdd, this.listAddHandler.bindAsEventListener(this));
	Mojo.Event.listen(this.wordsList, Mojo.Event.listChange, this.listChangeHandler.bindAsEventListener(this));
	Mojo.Event.listen(this.wordsList, Mojo.Event.listDelete, this.listDeleteHandler.bindAsEventListener(this));
}


PreferencesAssistant.prototype.handleMensaChange = function(event) {
    this.mainScene.depot.simpleAdd("mensa", this.selectorMensaModel.value);
    this.mainScene.mensa = this.selectorMensaModel.value;
    this.mainScene.clearDB();
    Mojo.Log.info("Mensa change:", this.mainScene.mensa);
};

PreferencesAssistant.prototype.togglechangeShowImages = function(event) {
    this.mainScene.depot.simpleAdd("showImages", this.togglemodelShowImages.value);
	this.mainScene.showImages = this.togglemodelShowImages.value;
};

PreferencesAssistant.prototype.togglechangeFilterFood = function(event) {
    this.mainScene.depot.simpleAdd("filterFood", this.togglemodelFilterFood.value);
	this.mainScene.filterFood = this.togglemodelFilterFood.value;
};

PreferencesAssistant.prototype.togglechangeWholeWords = function(event) {
    this.mainScene.depot.simpleAdd("wholeWords", this.togglemodelWholeWords.value);
	this.mainScene.wholeWords = this.togglemodelWholeWords.value;
};

PreferencesAssistant.prototype.activate = function(event) {
}

PreferencesAssistant.prototype.deactivate = function(event) {
}

PreferencesAssistant.prototype.cleanup = function(event) {
	Mojo.Event.stopListening(this.controller.get('togglebuttonImg'), Mojo.Event.propertyChange, this.togglechangeShowImages)	
	Mojo.Event.stopListening(this.controller.get('togglebuttonFilter'), Mojo.Event.propertyChange, this.togglechangeFilterFood)
	Mojo.Event.stopListening(this.controller.get('togglebuttonWhole'), Mojo.Event.propertyChange, this.togglechangeFilterFood)
	
	Mojo.Event.stopListening(this.wordsList, Mojo.Event.listChange, this.listChangeHandler);
	Mojo.Event.stopListening(this.wordsList, Mojo.Event.listAdd, this.listAddHandler);
	Mojo.Event.stopListening(this.wordsList, Mojo.Event.listDelete, this.listDeleteHandler);
}

PreferencesAssistant.prototype.listAddHandler = function(event) {
    var newItem = {
        data: ""
    }
    this.wordsModel.items.push(newItem);
    this.wordsList.mojo.addItems(this.wordsModel.items.length, [newItem]);

    // set focus on new item
    var len = this.wordsModel.items.length;
    this.wordsList.mojo.focusItem(this.wordsModel.items[len - 1]);
}

PreferencesAssistant.prototype.listDeleteHandler = function(event) {
    this.wordsModel.items.splice(this.wordsModel.items.indexOf(event.item), 1);

    this.processWords();
}

PreferencesAssistant.prototype.listChangeHandler = function(event) {
    if (event.originalEvent.target.tagName == "INPUT") {
        event.item.data = event.originalEvent.target.value;
    }

    this.processWords();
}

PreferencesAssistant.prototype.processWords = function() {
	this.mainScene.depot.simpleAdd("filterWords", this.wordsModel.items);
}
