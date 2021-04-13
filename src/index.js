import 'bootstrap';
import './main.scss';
import log from './data/log.json';
import {Business, BusinessEvent, upgradeList} from './business.js';
import {makeItemsDraggable, formatTime, floater, pluralize, humanizedMap, Inventory, itemList, Item, makeSlotsDroppable, getBusiness, save} from './toolset.js';
import {startupScript} from './startup.js';

const SPEEDING_RATE = 7500;

function incrementTime(quantity) {
  gameVars['savedTime'] += quantity;
};

function updateStatsDisplay() {
  // Clear current stat box
  $('#currency-list').empty();

  // Each stat added here
  var statsText = `<b>Time:</b> ${formatTime(gameVars['savedTime'])}`;
  statsText += `<br><b>Coins:</b> ${gameVars['coins']}`;

  // Actual update
  $('#currency-list').append(statsText);
};

function addContinueButton(label){
  const tempId = "continue-button-" + label;
  var button =  `<input type="button" id="${tempId}" class="continue-button"/>`

  if (label == 'lumber-keep' && $("#business-tab-label").is(":hidden")){
    console.log('Generating continue button for ' + label);

    $('#time-log').append(button);

    $('#' + tempId).on("click", function(){

      $('#business-tab-label').show();

      $('#' + tempId).remove();
      gameVars['unlocked'].push('business-tab-label');
      var lumberHut = new Business("Jim's Lumber Hut", 4750, [itemList.log], [itemList.log], [upgradeList.outputSlot, upgradeList.inputSlot], 'outdoor', 'lumber', 3);

      // initial businesses on first run
      gameVars['ownedBusinesses'].push(lumberHut);
      gameVars['ownedBusinesses'].push(new Business("aaa", 5000, [], [], [], 'underground', 'mushroom_underground', 3));

      // starting events must be added after business exists
      getBusiness(lumberHut).addEvent(new BusinessEvent('Foreman\'s Assistance', "The Foreman agrees to stick around for a week to show you the ropes.", 7, ['workers', 1]));

      updateBusinesses();
    });
  }
}

function updateStoryLog(titleKey){
  // TODO: still needed?
  // fix formatting
  if (gameVars['logContents'] == 'null'){
    gameVars['logContents'] = ['intro', 'lumber-keep'];
  } else if (typeof gameVars['logContents'] == 'string') {
    gameVars['logContents'] = gameVars['logContents'].split(',');
  }

  console.log(`Updating story log`);
  console.log(`${gameVars['logContents']}`);


  $("#time-log").empty()
  for (const label in gameVars['logContents']){
    $("#time-log").append('<p">'+log[gameVars['logContents'][label]]+'</p>');

    if (log["continue-button"].includes(gameVars['logContents'][label])) {
      addContinueButton(gameVars['logContents'][label]);
    }

    $("#time-log").append('<hr>');
  }
};

function updateBusinesses(){
  gameVars['ownedBusinesses'].forEach((business) => {
    business.formatPaydays();
    business.updateCard();

    // Must occur after card added to document
    if (0 < $('.crystal').length){
      business.crystalize();
    }

    // also updates investment panel
    business.activateButtons();
  });

  makeItemsDraggable();
}


function transferItem(sourceInvItem, targetInvSlot){
  // closest $ w/ class of "inventory-slot"
  var cards = [
    sourceInvItem.closest('.inventory-slot'),
    targetInvSlot.closest('.inventory-slot')
  ];

  // Currently either 'inventory' or 'business'
  var types = [
    $(cards[0]).data('containing-inventory').split(/-(.+)/)[0],
    $(cards[1]).data('containing-inventory').split(/-(.+)/)[0]
  ];

  // your-inventory
  // jim-s-lumber-hut-output
  var titles = [
    $(cards[0]).data('containing-inventory').substring(types[0].length+1, $(cards[0]).data('containing-inventory').length),
    $(cards[1]).data('containing-inventory').substring(types[1].length+1, $(cards[1]).data('containing-inventory').length)
  ];

  // used to store js locations of items to swap
  var finalValues = {
    sourceObj: null,
    sourceKey: null,
    targetObj: null,
    targetKey: null
  }

  const refList = ['source', 'target'];
  for (var i=0; i<2; i++){
    if (types[i] == 'inventory'){
      finalValues[refList[i]+'Obj'] = gameVars['inventories'][titles[i]];
      finalValues[refList[i]+'Key'] = cards[i].data('inventory-slot-number');
    }else if(types[i] == 'business'){
      var businessName = 'business-' + titles[i].substring(0, titles[i].lastIndexOf('-'));
      var businessIndex = gameVars['ownedBusinesses'].findIndex(x => x.id === businessName);
      var businessSlot = titles[i].substring(titles[i].lastIndexOf('-') + 1, titles[i].length)+'Inventory';
      finalValues[refList[i]+'Obj'] = gameVars['ownedBusinesses'][businessIndex][businessSlot];

      // arguments[i] gives source, then target dependant on transferItem(sourceInvItem, targetInvSlot) declaration
      if ($(arguments[i]).data('inventory-slot-number') === undefined){
        finalValues[refList[i]+'Key'] = $(arguments[i]).parent().data('inventory-slot-number');
      } else { // empty slot
        finalValues[refList[i]+'Key'] = $(arguments[i]).data('inventory-slot-number');
      }

    }else{
      console.error(`inventory type not inventory or business: ${types[i]}`);
    }
  }

  var temp = finalValues['sourceObj']['items'][finalValues['sourceKey']];
  finalValues['sourceObj']['items'][finalValues['sourceKey']] = finalValues['targetObj']['items'][finalValues['targetKey']];
  finalValues['targetObj']['items'][finalValues['targetKey']] = temp;
  console.log(`Swapped ${finalValues['sourceObj']['items'][finalValues['sourceKey']]} with ${finalValues['targetObj']['items'][finalValues['targetKey']]}`);

  updateBusinesses();
  updateInventories();
}

function updateInventories(){
  if (($.isEmptyObject(gameVars['inventories'])) || (gameVars['inventories'] == null)){
    gameVars['inventories'] = {
      'your-items': new Inventory('inventory-Your Items', 10)
    };
  }

  // clear sidebar inventory, then repopulate.
  $('#inventories').empty();
  for (let [nam, inv] of Object.entries(gameVars['inventories'])){
    if (inv.active){
      if (!(inv instanceof Inventory)){
        Object.setPrototypeOf(inv, Inventory.prototype);
      }
      $('#inventories').append(inv.card);
    }
  }

  // update open investmentpanels
  var investmentCards = $("div[id$='-investment-card']");
  if (0 < investmentCards.length){
    var activeBusiness = getBusiness($(investmentCards[0]).data('parent'));

    $(`#${activeBusiness.id}-investment`).replaceWith(activeBusiness.investmentInventory.card);
  }

  makeItemsDraggable();
  makeSlotsDroppable();
}

function speedTimeBusiness(businessId, q=SPEEDING_RATE, natural=false){
  var business = getBusiness(businessId);

  var targetQ = Math.min(q, business.remainingTime, gameVars['savedTime']);
  // quantity, isNatural
  if (0 < targetQ){
    console.log(`Adding ${targetQ}s to ${business.id}`);
    business.addProgress(targetQ, natural);
    if (!natural){
      gameVars['savedTime'] -= targetQ;
    }
  }
}

function makeSpeedable(){
  // Progress items w/ class "speedable"
  $(".speedable").off('mouseover click mouseleave');

  $(".speedable").on('mouseover', function(e){
    $(this).addClass('selected');
    gameVars['selected'] = $(this).data('owner');
  });

  $(".speedable").on('mouseleave', function(){
    $(this).removeClass('selected');
    gameVars['selected'] = false;
  });
}


$(document).ready(function(){
  startupScript();

  // Cheat
  $("#soft-reset-button").on('click', function(){
    gameVars['logContents'] = ['intro', 'lumber-keep'];
    gameVars['unlocked'] = [];
    gameVars['ownedBusinesses'] = [];
    gameVars['globalEvents'] = [];
    gameVars['coins'] = 100;
    location.reload();
  })
  $("#hard-reset-button").on('click', function(){
    localStorage.removeItem('lastSeen');
    gameVars['saveOnReload'] = false;
    location.reload();
  })
  $("#add-day-to-businesses").on('click', function(){
    gameVars['ownedBusinesses'].forEach((business) => {
      business.addProgress(43200);
      business.addProgress(43200, false);
      console.log(`Day added to ${business.title}.`);
    });
  })
  $("#week-output-positive").on('click', function(){
    gameVars['ownedBusinesses'].forEach((business) => {
      Object.setPrototypeOf(business, Business.prototype);
      business.days = [];
      business.progress = 0;
      business.progressPlayer = 0;
      for (var i = 0; i < 7; i++){
        business.addProgress(86400);
        business.profit += 50;
      }
    });

  })
  $("#clear-inventory-button").on('click', function(){
    for (var inv in gameVars['inventories']){
      gameVars['inventories'][inv].clear();
    }
    updateInventories();
    console.log('inventories cleared');
  })
  $("#droppable-slots-button").on('click', function(){
    makeSlotsDroppable();
    makeItemsDraggable();
  });
  $("#give-1k-cash-button").on('click', function(){gameVars['coins'] += 1000});
  $("#print-hut-button").on('click', function(){
    gameVars['ownedBusinesses'].forEach((hut) => {
      console.log(hut);
    });
  })
  // endcheat

  // Tab functionality
  $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
    // Business tab preparation
    if ($(e.target).attr("href") == '#business-tab-content'){
      makeItemsDraggable();
      makeSlotsDroppable();
      makeSpeedable();
    }
  });

  updateStoryLog();
  updateInventories();
  updateBusinesses();


  // Repeated events
  setInterval(updateStatsDisplay, 20); //~60fps
  setInterval(function(){incrementTime(1);}, 1000); //add 1 second per second
  setInterval(function(){
    for (var business of gameVars['ownedBusinesses']){
      business.addProgress();
      business.updateProgressBar();
    }
  }, 1000) // each business gains progress each second.
  setInterval(save, 1000 * 60 * 5); // save every 5 minutes
});

window.addEventListener("beforeunload", function(e){
  if (gameVars['saveOnReload']){
    save();
  }
}, false);

function keyFunctionality(e){
  // spacebar spends time
  if (pressedKeys[32] && gameVars['selected']){
    if (gameVars['selected'].startsWith('business')){
      speedTimeBusiness(gameVars['selected']);
    } else {
      console.error(`Bad id on selected: ${gameVars['selected']}`)
    }
  }
}

// enable spending time w/ space
window.addEventListener('keydown', function(e){
  pressedKeys[e.keyCode] = true;
  keyFunctionality(e);
}, false);
window.addEventListener('keyup', function(e){
  pressedKeys[e.keyCode] = false;
}, false);

export {transferItem, updateBusinesses};
