// sprites
import img_log from './img/log.png';
import {transferItem, updateBusinesses} from './index.js';
import {Business} from './business.js';

const humanizedMap = {savedTime: 'second'};

class Item{
  constructor(title, description, value, icon, quantity=1){
    this.title = title;
    this.icon = icon;
    this.description = description;
    this.value = value;
    this.quantity = quantity;
  }

  get card(){
    return `<img class="inventory-item" data-item-type="${this.title}" src="${this.icon}"></img>`;
  }
}

// ###### ITEMS ###########
const itemList = {
  log: new Item("log", "Wood, in its basic form.", 50, img_log)
}
// ########################

function makeItemsDraggable(){
  $('.inventory-item').draggable({
    start: function(event, ui){
      $(this).css('z-index', 100);
    },
    revert: 'invalid',
    stop: function(event, ui){
      $(this).css('z-index', 10);
    }
  });
  // shift clicking
  $('.inventory-item').off('click');
  $('.inventory-item').on('click', function(event){
    if (event.shiftKey){
      // Priority: Popup-Inventory, Inventory-Popup, Output-Inventory, Inventory-Input, Input-Inventory
      var clickedItem = $(this);
      // figure out current location
      var itemLocation = clickedItem.closest('.inventory-slot').data('containing-inventory').split(/-(.+)/)[0];

      // figure out allowed destinations
      if (itemLocation == 'business'){
        var firstEmptySlotIndex = gameVars['inventories']['your-items'].firstEmpty;
        if (-1 < firstEmptySlotIndex){
          var destination = $(`[data-containing-inventory="inventory-your-items"][data-inventory-slot-number="${firstEmptySlotIndex}"]`);
          transferItem(clickedItem, destination);

        } else {
          floater('no space for item', $(this).offset());
        }

      } else if (itemLocation == 'inventory'){
        // if an investment card is open, it takes priority
        if (0 < $(`[id*="investment-card"]`).length){
          // check if empty and add
          // get first inventory slot w/ no children
          var destination = $(`[id*="investment-card"]`).find('.inventory-slot').filter(':empty');
          if (0 < destination.length){
            transferItem(clickedItem, destination[0]);
          } else {
            floater('no space for item', $(this).offset());
          }
        } else {
          // check if empty input inventory slot exists
          var destination = $('[id^="business-"][id$="-input"]').find('.inventory-slot').filter(':empty');

          // make sure item is allowed
          if (0 < destination.length){
            var itemTypes = $(clickedItem).attr('data-item-type');
            var allowedItems = $(destination[0]).attr('data-allowed');

            if ([itemTypes].some(x=> allowedItems.includes(x))){
              transferItem($(clickedItem), $(destination[0]));
            } else {
              floater('no allowed spaces free', $(this).offset());
            }
          } else {
            floater('no space for item', $(this).offset());
          }
        }

      } else {
        console.error('Item Shift Clicked from unknown slot.');
        console.error(clickedItem);
      }

      // transferItem
    }
  });
}

function makeSlotsDroppable(){
  // configure inventory slots
  $('.inventory-slot').droppable({
    accept: function(draggable){
      // checks parents until finding one w/ match
      // then takes allowed data element
      var allowedRaw = $(this).data('allowed');
      if (typeof allowedRaw === 'string'){
        allowedRaw = [allowedRaw];
      } else {
        console.error('Inventory slot has no allowed values');
        console.log($(this));
      }

      // deny null comers
      if (allowedRaw == [""] || allowedRaw == [null] || allowedRaw == []){
        return false;
      }

      if (allowedRaw == 'all' || 0 <= allowedRaw.indexOf('all')){
        // if it accepts all comers, let it through
        return true;
      } else if (-1 < allowedRaw.indexOf(draggable.data('item-type'))){
        // if the class is on the allowed list, let it through
        return true;
      } else {
        return false;
      }
    },

    drop: function(event, ui) {
      var droppable = $(this);
      var dropCords = $(this).offset();
      dropCords.top += $(this).height() / 2;
      dropCords.left += $(this).width() / 2;
      var dragCords = ui.draggable.offset();
      dragCords.top += ui.draggable.height()/2;
      dragCords.left += ui.draggable.width()/2;
      var deltaTop = dropCords.top - dragCords.top;
      var deltaLeft = dropCords.left - dragCords.left;
      ui.draggable.animate({
        top: '+=' + deltaTop,
        left: '+=' + deltaLeft
      }, function(){
        ui.draggable.css({top:1, left:1});
        transferItem(ui.draggable, droppable);
        ui.draggable.appendTo(droppable);
      });
    }
  });
}

function getBestConsultant(consultants, skill){
  var bestConsultant = {skills: {}};
  bestConsultant.skills[skill] = 0;
  var allConsultants = gameVars['ownedConsultants'];

  for (let consultant of Object.keys(allConsultants)){
    if (skill in allConsultants[consultant].skills){
      if (bestConsultant.skills[skill] < allConsultants[consultant].skills[skill]){
        bestConsultant = allConsultants[consultant];
      }
    }
  }
  if ('title' in bestConsultant){
    return bestConsultant;
  } else {
    return false;
  }
}


class Inventory{
  constructor(title, q, allowed=['all']){
    this.title = title;
    this.items = new Array(q).fill(null);
    this.id = title.replace(/\W+/g, '-').toLowerCase();
    if (allowed[0] == 'all'){
      this.allowed = allowed;
    } else {
      this.allowed = allowed.map(function(a){return a.title});
    }
    this.active = true;

    console.log(`created ${this.title} inventory`);
  }

  get summary(){
    var textSummary = [];
    if (!this.empty){
      var itemDict = {}

      this.items.forEach((item) => {
        if (item && !(item.title in itemDict)){
          itemDict[item.title] = [0, item.value];
        }
        itemDict[item.title][0] += 1;
      });

      var keys = Object.keys(itemDict);
      keys.sort();

      keys.forEach((itemName) => {
        textSummary.push(`${itemName}: ${itemDict[itemName][0]} (${itemDict[itemName][1]}${itemDict[itemName][0] == 1 ? ' c': ' c/ea'})`)
      });

      // itemNames.forEach(itemName){
      //   textSummary.push(`${itemName}: +${allOne.length} (${allOne[0].value}${allOne.length == 1 ? '': '/ea'})`);
      // }
      return textSummary.join('\n')
    }
  }

  get card(){
    var cardHtml = `<div id="${this.id}" class="card">`;
    cardHtml += `<div class="row m-1">`;
    for (var i=0; i<this.items.length; i++){
      // data-containing-inventory used to check the inventory object for allowed items
      // data-inventory-slot-number used to add/remove items from inventory object
      cardHtml += `<div class="inventory-slot" data-containing-inventory="${this.id}" data-allowed="${this.allowed}" data-inventory-slot-number=${i}>`
      if (this.items[i] != null){
        if (!(this.items[i] instanceof Item)){
          Object.setPrototypeOf(this.items[i], Item.prototype);
        }
        cardHtml += this.items[i].card;
      }
      cardHtml+= '</div>';
    }
    // close out whole thing and row around inventory squares.
    cardHtml += '</div></div>';
    return cardHtml;
  }

  get empty(){
    return this.items.join().replace(/,/g,'').length === 0;
  }

  clear(){
    this.items = new Array(this.items.length).fill(null)
  }

  get firstEmpty(){
    return this.items.indexOf(null);
  }

  add(item){
    // returns -1 if no null items
    if (-1 < this.firstEmpty()){
      console.log(`adding ${item.title} to ${this.title}`);
      this.items[this.items.indexOf(null)] = item;
      return true;
    } else {
      return false;
    }
  }
}



// expects either $(#id) 'id', or {left:x, top:y} co-ords
//   hint: position is relative to parent, offset is absolute
function floater(text, floaterLocation){
  var targetCoords = null;
  if (typeof floaterLocation == 'object'){
    targetCoords = floaterLocation;
  } else if (typeof floaterLocation == 'string'){
    if (floaterLocation[0] != '#'){
      floaterLocation = '#'+floaterLocation;
    }
    targetCoords = $(floaterLocation).position();
  }
  if (targetCoords == null){
    targetCoords = {left: 100, top:100};
    console.error(`Bad floater floaterLocation: ${floaterLocation}`);
  }
  $(document.body).after(`<p class='floater' style='position: absolute; z-index: 5; left: ${targetCoords.left}px; top: ${targetCoords.top}px;'>${text}</p>`);
  $(document.body).next().animate({
    opacity:0,
    left: "+=5",
    top: "-=30",
  }, 1000, function(){
    $(this).remove();
  });
}

// simplistic, does not actually pluralize complex nouns
function pluralize(x, q){
  if (q == 1){
    return x;
  } else {
    return x + "s";
  }
}


// 3 weeks 4 days 23:11:05
function formatTime(seconds){
  if (seconds < 1){
    return "<1s";
  }
  var returnStr = "";
  if (604800 <= seconds){
    returnStr += `${parseInt(seconds/604800)} ${pluralize("week", parseInt(seconds/604800))}, `;
    seconds %= 604800;
  }
  if (86400 <= seconds){
    returnStr += `${parseInt(seconds/86400)} ${pluralize("day", parseInt(seconds/86400))}, `;
    seconds %= 86400;
  }
  returnStr += ((seconds/3600 < 10) ? '0' : '') + parseInt(seconds/3600);
  seconds %= 3600;
  returnStr += ":" + ((seconds/60 < 10) ? '0' : '') + parseInt(seconds/60);
  seconds %= 60;
  returnStr += ":" + ((seconds < 10) ? '0' : '') + parseInt(seconds);
  return returnStr;
}

// call w/ something like 2d6+1d4 or 1d4-5
function rollDice(dice){
  // add a + if the first digit is not negative.  helps w/ regex.
	if (dice[0] != '-'){
  	dice = '+' + dice;
  }
  // catches all "+1d6" or "-2d8" formats
  var dieArray = [...dice.matchAll(/([+-][\dd]*)/g)];
  // remove double storage of matches
  dieArray = dieArray.map(x => x[0]);

  var sum = 0;
	for (var die of dieArray){
  	if (die.includes('d')){
      // (q, v)
    	var splitVal = die.slice(1,).split('d');
      // prevent string as int problems
      splitVal = splitVal.map(x => parseInt(x));
      for (var i = 0; i < splitVal[0]; i++){
      	if (die[0] == '+'){
          // random number 1 to splitVal[1]
          sum += Math.floor((Math.random() * splitVal[1]) + 1);
        } else if (die[0] == '-') {
          sum -= Math.floor((Math.random() * splitVal[1]) + 1);
        } else {
          // If not + or - as first digit of a die
        	console.error("Failed while rolling: " + die);
        }
       }

    } else {
    	// covers both + and -
    	sum += parseInt(die);
    }
  }
  return sum;
}

function save(){
  for (let key in gameVars){
    localStorage.setItem(key, JSON.stringify(gameVars[key]));
  }
  localStorage.setItem('lastSeen', JSON.stringify(new Date()));
}

function getBusiness(businessId){
  if (typeof businessId == 'number'){
    return gameVars.ownedBusinesses[businessId];
  } else if (typeof businessId == 'string'){
    for (let busIndex in gameVars.ownedBusinesses){
      if (gameVars.ownedBusinesses[busIndex].id == businessId){
        return gameVars.ownedBusinesses[busIndex];
      }
    }
  } else if (typeof businessId == Business){
    for (let busIndex in gameVars.ownedBusinesses){
      if (gameVars.ownedBusinesses[busIndex].id == businessId.id){
        return gameVars.ownedBusinesses[busIndex];
      }
    }
  }

  console.error(`No business found w/ businessId: ${businessId}`);
  return false
}

function sliceBefore(mainText, keyTerm){
  return mainText.slice(0, mainText.indexOf(keyTerm));
}
function sliceAfter(mainText, keyTerm){
  return mainText.slice(mainText.indexOf(keyTerm)+keyTerm.length, mainText.length);
}
function sliceAfterBefore(mainText, afterTerm, beforeTerm){
  var newText = sliceAfter(mainText, afterTerm);
  return sliceBefore(newText, beforeTerm);
}

export {Item, Inventory, floater, formatTime, rollDice, pluralize, humanizedMap, itemList, makeItemsDraggable, makeSlotsDroppable, getBestConsultant, sliceBefore, sliceAfter, sliceAfterBefore, getBusiness, save};
