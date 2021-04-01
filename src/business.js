import 'jquery-ui/ui/widgets/draggable';
import 'jquery-ui/ui/widgets/droppable';

import {Inventory, makeItemsDraggable, makeSlotsDroppable, formatTime, rollDice, floater, itemList, getBestConsultant, sliceAfterBefore} from './toolset.js';
import globalMods from './data/modifiers.json';
import skillRelations from './data/skill_relations';

// handlebars templates
const Handlebars = require('handlebars');
var bc = require('./templates/business-card.hbs')();
var businessCard = Handlebars.compile(bc);
var ic = require('./templates/investment-card.hbs')();
var investmentCard = Handlebars.compile(ic);
var um = require('./templates/upgrade-modal.hbs')();
var upgradeModal = Handlebars.compile(um);
var uc = require('./templates/upgrade-card.hbs')();
var upgradeCard = Handlebars.compile(uc);
var im = require('./templates/investment-modal.hbs')();
var investmentModal = Handlebars.compile(im);

// sprites/images
import crystal_1 from './img/crystal_1.png';
import img_coins from './img/coins.png';

var CRYSTALCHANCE = 0.001;
var CRYSTALMAX = 10;

function spawnCrystal(containingElement, business=null){
  console.log('spawning crystal on ' + containingElement);
  var containerPosition = $(`#${containingElement}`).position();
  if (containerPosition == undefined){
    containerPosition = {
      left: 100,
      top: 100
    }
  }
  var y = $(`#${containingElement}`).height();
  var x = $(`#${containingElement}`).width();
  var crystalCSS = {
    'left': containerPosition.left,
    'top': containerPosition.top,
  };
  var choice = Math.floor(Math.random() * 4);
  switch(choice){
    case(0): // top border
      crystalCSS['left'] += Math.random() * x;
      break;
    case(1): // right border
      crystalCSS['left'] += x;
      crystalCSS['top'] += Math.random() * y;
      break;
    case(2): // bottom border
      crystalCSS['left'] += Math.random() * x;
      crystalCSS['top'] += y;
      break;
    case(3): // left border
      crystalCSS['top'] += Math.random() * y;
      break;
  }

  var cID = `${containingElement}-crystal-${Date.now()}`;
  var crystal = `<img id="${cID}" src="${crystal_1}" class="crystal" style="postion: absolute; z-index: 1; left: ${crystalCSS.left}px; top: ${crystalCSS.top}px;"/>`;
  $(`#${containingElement}`).append(crystal);
  $(`#${cID}`).on('mouseover', function(){
    var crystalGain = parseInt(Math.ceil(Math.random()*(CRYSTALCHANCE**-0.75)));
    floater(`+${crystalGain} seconds`, `#${cID}`);

    if (business){
      business.crystals -= 1;
    }
    gameVars['savedTime'] += crystalGain;
    $(this).remove();
  });
}


class BusinessUpgrade{
  constructor(title, description, cost, prereqs, onActivate, starting=0, maximum=1){
    this.title = title;
    this.description = description;
    this.cost = cost;
    this.prereqs = prereqs;
    this.onActivate = onActivate;
    this.id = 'upgrade-' + title.replace(/\W+/g, '-').toLowerCase();
    this.maximum = maximum;
    this.quantity = starting;
  }

  purchasable(business){
    // must have remaining upgrades to purchase
    if (this.maximum <= this.quantity){
      return 'no upgrades remaining';
    }
    // must have enough free value for the upgrade
    if (business.value - business.upgradeValue < this.cost){
      return 'Not enough business value, try increasing investment.';
    }
    // otherwise, two requirements are met.
    return 'all good';
  }

  purchase(){
    this.quantity += 1;
  }

  get card(){
    var cardHTML = upgradeCard(this);
    if (this.quantity < this.maximum){
      cardHTML = cardHTML.replace('XXXCOSTXXX', this.cost)
    } else {
      cardHTML = cardHTML.replace('XXXDISABLEDXXX', "disabled=true");
      cardHTML = cardHTML.replace('XXXCOSTXXX', 'Purchased');
    }
    return cardHTML;
  }
}

// ###### UPGRADES ###########
const upgradeList = {
  outputSlot: new BusinessUpgrade('Output Inventory', 'Make room for additional products produced throughout the week', 500, [], 'output slot', 1, 5),
  inputSlot: new BusinessUpgrade('Input Inventory', 'Make room for additional inputs to be consumed over the day or week', 500, [], 'input slot', 1, 7),
}
// ###########################


function businessInvestmentPopup(money, business){
  // pre-checks
  Object.setPrototypeOf(business.investmentInventory, Inventory.prototype);
  makeSlotsDroppable();
  if (money < 0 || (money == 0 && business.investmentInventory.empty)){
    console.error("Illegal Investment");
    return -1
  }

  var popUp = investmentModal({});
  var skillsText = "";
  var outcomeText = "";
  var cashValue = 0;
  var materialValue = 0;

  var consultants = gameVars['consultants'];

  // set to false if not needed
  var barterer = 0 < money ? getBestConsultant(consultants, 'barter') : false;
  var constructor = business.investmentInventory.empty ? false : getBestConsultant(consultants, 'construction');

  if (barterer || constructor){
    skillsText += "Relevant Skills:";

    if (barterer){
      skillsText += `
        ${barterer.title}:
          Barter ${barterer.skills.barter}`
    }
    if (constructor){
      if (constructor != barterer){
        skillsText += `
          ${constructor.title}:`
      }
      skillsText += `
          Construction ${constructor.skills.construction}`;
    }

    skillsText += `
    <hr/>`;
  }

  if (0 < money){
    var doshRoll = rollDice('1d20');
    outcomeText += `${money} coins (Barter ${doshRoll}`
    if (barterer){
      outcomeText += `(+${barterer.skills.barter})`;
      doshRoll += barterer.skills.barter;
    }
    cashValue = Math.floor((money/2) * (1+(doshRoll/20)));
    outcomeText += `): +${cashValue} value`;
  }

  if (!business.investmentInventory.empty){
    // compile item values and titles
    var itemNames = [];
    var rawMaterialValue = 0;
    business.investmentInventory.items.forEach((item, index) => {
      if (item){
        itemNames.push(item.title);
        rawMaterialValue += item.value;
        console.log(`${item.title} added to investment total`);
      }
    });


    var constructionRoll = rollDice('1d20');
    var rawMaterial= business.investmentInventory.items[0];
    outcomeText += `
    <br>[${itemNames.join(', ')}] (material worth: ${rawMaterialValue}) (Construction ${constructionRoll}`;
    if (constructor){
      outcomeText += `(+${constructor.skills.construction + 5})`;
      constructionRoll += constructor.skills.construction;
    } else {
      outcomeText += `(+5)`;
    }
    materialValue = Math.ceil((rawMaterialValue/2) * (1+((5+constructionRoll)/20)))
    outcomeText += `): +${materialValue} value`;
  }

  popUp = popUp.replace('XXXINVESTMENTRESULTSKILLSXXX', skillsText);
  popUp = popUp.replace('XXXINVESTMENTRESULTSUMMARY', outcomeText);

  $(popUp).appendTo('body');
  $('#investment-modal').modal('show');
  $("#investment-modal").on('hidden.bs.modal', function () {
    $("#investment-modal").remove();
  });

  // remove invested items from existance
  gameVars['coins'] -= money;
  business.investmentInventory.clear();
  business.value += cashValue + materialValue;

  // visual remove fees
  business.updateCard();


}

class Business{
  constructor(title, value, inputs, outputs, upgrades=[], type, specific, workers, workersMin=3, workersMax=5){
    this.title = title;
    this.id = 'business-' + title.replace(/\W+/g, '-').toLowerCase();
    this.value = value;

    this.inputs = inputs;
    this.outputs = outputs;
    // single items should be in a list
    if (!(Array.isArray(this.outputs))){
      this.outputs = [this.outputs];
    }

    this.upgrades = upgrades;
    this.workers = workers;
    this.workersMin = workersMin;
    this.workersMax = workersMax;
    this.type = type;
    this.specific = specific;

    this.upgradeValue = 5000 + this.calcUpgradeValue();
    this.progress = 0;
    this.progressPlayer = 0;
    this.manager = false;
    this.days = new Array();
    this.modifiers = globalMods[type]; //{aa: -3, bb: +5}
    this.profit = 0;
    this.currentDay = {"player": false};
    this.playerDays = 0;
    this.crystals = 0;
    this.inputInventory = new Inventory(`${this.id}-input`, 1, this.inputs);
    this.outputInventory = new Inventory(`${this.id}-output`, 1, []);
    this.investmentInventory = new Inventory(`${this.id}-investment`, 5, [itemList.log]);
    this.dailyReport = "";
    this.weekSummary = "";

    console.log(this.title + " created!");
  }

  get remainingTime(){
    return parseInt(604800 - this.progress - this.progressPlayer);
  }

  get card(){
    var businessTemplate = businessCard(this);
    Object.setPrototypeOf(this.inputInventory, Inventory.prototype);
    Object.setPrototypeOf(this.outputInventory, Inventory.prototype);
    businessTemplate = businessTemplate.replace('XXXINPUTXXX', this.inputInventory.card);
    businessTemplate = businessTemplate.replace('XXXOUTPUTXXX', this.outputInventory.card);

    if (0 < this.upgrades.length){
      businessTemplate = businessTemplate.replace('XXXUPGRADESXXX', '');
    } else {
      businessTemplate = businessTemplate.replace('XXXUPGRADESXXX', 'disabled');
    }

    if (this.days.length < 7){
      businessTemplate = businessTemplate.replace('XXXNEWWEEKXXX', 'disabled');
    } else {
      businessTemplate = businessTemplate.replace('XXXNEWWEEKXXX', '');
    }

    return businessTemplate;
  }

  activateButtons(){
    var upgradeButtonLabel = `#${this.id}-upgrade-button`;
    var investButtonLabel = `#${this.id}-invest-button`;
    var staffButtonLabel = `#${this.id}-worker-button`;
    var resetButtonLabel = `#${this.id}-week-reset-button`;
    var coinBoxLabel = `#${this.id}-investment-coins-input`;
    var investCardLabel = `#${this.id}-investment-card`;
    var containerLabel = `#${this.id}-container`;
    var businessId = this.id;
    var thisBusiness = this;

    // Add button functionality
    $(upgradeButtonLabel).unbind('click');
    $(upgradeButtonLabel).on('click', function(){
      thisBusiness.businessUpgradePopup();
    });


    // investment panel
    var investPanel = investmentCard(this);
    Object.setPrototypeOf(this.investmentInventory, Inventory.prototype);
    investPanel = investPanel.replace('XXXMATERIALSXXX', this.investmentInventory.card);

    $(investButtonLabel).unbind('click');
    $(investButtonLabel).on('click', function(event){
      $(investCardLabel).remove();
      $(containerLabel).append(investPanel);
      makeSlotsDroppable();
      makeItemsDraggable();

      // auto-adjusts entered coin amount to boundary when outside of it
      $(coinBoxLabel).change(function() {
        var maxVal = gameVars['coins'];
        if (maxVal < $(this).val()){
          $(this).val(maxVal);
        } else if ($(this).val() < 0){
          $(this).val(0);
        }
      });

      $(`#${businessId}-exit-button`).on('click', function(){
        $(`#${businessId}-investment-card`).remove();
      });
      $(`#${businessId}-invest-submit-button`).on('click', function(){
        var coinValue = $(coinBoxLabel).val();

        if (coinValue < 0){
          coinValue = 0;
        } else if (gameVars['coins'] < coinValue){
          coinValue = gameVars['coins'];
        }

        if (0 < coinValue || !thisBusiness.investmentInventory.empty){
          businessInvestmentPopup(coinValue, thisBusiness);
        }
      })
      makeItemsDraggable();
      makeSlotsDroppable();
    });

    $(resetButtonLabel).on('click', function(event){
      thisBusiness.newWeek();
    });
  }

  // used to add text to the business popup, useful for resetting when changes are made
  businessUpgradePopupText(){
    var container = upgradeModal(this);

    // add in each upgrade
    var upgradesText = "";
    for (var upgrade of this.upgrades){
      Object.setPrototypeOf(upgrade, BusinessUpgrade.prototype);
      upgradesText += upgrade.card;
    }
    container = container.replace('XXXUPGRADESXXX', upgradesText);

    // add built modal to document
    $(container).appendTo('body');
  }

  // upgrade panel
  businessUpgradePopup(){
    var thisBusiness = this;

    // set content
    thisBusiness.businessUpgradePopupText();

    // activate exit button
    $(`#${thisBusiness.id}-exit-button`).on('click', function(){
      $(`#${thisBusiness.id}-upgrade-card`).remove();
    });

    // activate purchase buttons
    // without forEach, all "upgrade" variable default to last in loop
    thisBusiness.upgrades.forEach((upgrade) => {
      $(`#${upgrade.id}-purchase-button`).on('click', function(){
        // this refers to button, not underlying upgrade

        // check to see if can purchase, returns (true, 'all good') or (false, <reason>)
        var purchasableInfo = upgrade.purchasable(thisBusiness);
        if (purchasableInfo == 'all good'){
          console.log(`${this.title} purchased`)

          // TODO: figure out how to dynamically include function in upgrade instantiation/use
          if (upgrade.onActivate == 'output slot'){
            thisBusiness.outputInventory.items.push(null);
            thisBusiness.updateCard();
          } else if (upgrade.onActivate == 'input slot'){
            thisBusiness.inputInventory.items.push(null);
            thisBusiness.updateCard();
          } else {
            console.log(`NO UPGRADE INSTRUCTIONS FOR <${this.title}>, ONLY: <${this.onActivate}>`);
          }

          upgrade.purchase();
          thisBusiness.upgradeValue = 5000 + thisBusiness.calcUpgradeValue();

          // refresh card
          $(`#${thisBusiness.id}-upgrade-card`).remove();
          thisBusiness.businessUpgradePopup();
          makeSlotsDroppable();
          makeItemsDraggable();

        } else {
          floater(purchasableInfo, `#${this.id}`)
        }
      });
    });


  }


  // TODO: make actually update instead of replace
  updateCard(){
    if (0 < $(`#${this.id}-container`).length){
      var freshCard = this.card;

      var inputText = sliceAfterBefore(freshCard, '<!-- Input Output -->', '<!-- Input Output End -->');
      var rightText = sliceAfterBefore(freshCard, '<!-- Right Side -->', '<!-- Right Side End -->');

      $(`#${this.id}-container`).find('.input-side').replaceWith(inputText);
      $(`#${this.id}-container`).find('.right-side').replaceWith(rightText);

    } else {
      $('#business-tab-content').append(this.card);
    }

    this.activateButtons();
    makeItemsDraggable();
    makeSlotsDroppable();
  }

  calcUpgradeValue(){
    var totVal = 0;
    this.upgrades.forEach((upgrade) => {
      totVal += upgrade.cost * (upgrade.quantity - 1);
    });

    return totVal;
  }

  formatPaydays(){
    if (this.days.length < 1){
      // shouldn't really happen, but nbd
      this.dailyReport = '<p>...</p>';
    } else {
      var modifiers = (day) => day['mod'].totVal != 0;
      modifiers = this.days.some(modifiers);
      var multipliers = (day) => day['mult'].totVal != 1;
      multipliers = this.days.some(multipliers);

      var htmlString = `
        <table class="table table-condensed">
          <thread>
            <tr>
              <th scope="col">day</th>
              <th scope="col">roll</th>`;

      if (modifiers){
        htmlString += '<th scope="col">mod</th>'
      }
      if (multipliers){
        htmlString += '<th scope="col">multiplier</th>'
      }
      if (modifiers || multipliers){
        htmlString += '<th scope="col">total</th>'
      }
      htmlString += `
              <th scope="col">outcome</th>
            </tr>
          </thread>
          <tbody>`;

      // Add each day, formatted w/ mods + mults if needed
      for (var day of this.days){
        htmlString += `
            <tr>
              <th scope="row">${day.dayNum}</th>
              <td>${day.roll}</td>`
        if (modifiers){
          htmlString += `<td>${day.mod.totVal}</td>`
        }
        if (multipliers){
          htmlString += `<td>${day.mult.totVal}</td>`
        }
        if (modifiers || multipliers){
          htmlString += `<td>${day.finalRoll}</td>`
        }
        htmlString += `
              <td>${day.outcome}</td>
            </tr>`;
      }

      //close off table
      htmlString += `
          </tbody>
        </table>`

      // Set the values
      this.dailyReport = htmlString;
    }

    this.updateCard();
  }

  generateOutputItems(){
    // Not sure why parsing and stringifying, happens elsewhere, TODO: delete?
    var goodList = JSON.parse(JSON.stringify(this.outputs));

    // put list in order of expense
    goodList.sort((a, b) => (a.value > b.value) ? 1:-1);

    // first, try to fill all output slots
    for (var i=0; i<this.outputInventory.items.length; i++){
      // cut goodList down until only valid items remain
      while ((0 < goodList.length) && (this.profit < goodList[0].value)){
        goodList.shift();
      }
      if (0 < goodList.length){
        this.outputInventory.items[i] = goodList[0];
        makeItemsDraggable();
        this.profit -= goodList[0].value;
      } else {
        break;
      }
    }
  }

  endOfWeek(){
    // end of week inventory generation
    var summary = `
        <div>`
    if (this.days.length == 7){
      if (this.profit < 0){
        summary += `
          <p>You lost ${this.profit} coins this week.</p>`;
      } else if (this.profit == 0){
        summary += `
          <p>You completly covered your costs this week.</p>`;
      } else {
        summary += `
          <p>Week's total production: ${this.profit} value.</p>`;

        // sets the output items
        this.generateOutputItems();
        // describe items produced
        summary += `
          <p>${this.outputInventory.summary}</p>`;

        // extra dosh
        if (0 < this.profit){
          summary += `
          <p>Additional production: +${this.profit} coins</p>`;

        }
      }

      // Reset business's profit
      gameVars['coins'] += this.profit;
      this.profit = 0;
    } else {
      console.error('endOfWeek called prematurely');
    }

    summary += `
        </div>`;
    this.weekSummary = summary;

    this.updateCard();
  }

  newWeek(){
    var thisBusiness = this;
    var allBusinesses = gameVars['ownedBusinesses'];
    var thisIndex = 0;


    console.log('new week for ' + this.title);
    this.progress = 0;
    this.progressPlayer = 0;
    this.days = new Array();
    this.playerDays = 0;
    this.dailyReport = "";
    this.weekSummary = "";

    this.formatPaydays();
    this.updateCard();

    makeItemsDraggable();
    makeSlotsDroppable();
  }

  newDay(){
    this.currentDay.dayNum = "D" + (this.days.length + 1);
    this.currentDay.roll = rollDice('1d100');

    // ########## MODIFIER #############
    // dependant on player contribution, manager skills, and events like weather
    this.currentDay.mod = {totVal: 0, modList: []};
    if (this.manager){
      for (var specificSkill in skillRelations[this.specific]){
        if (specificSkill in this.manager['skills']){
          // multiply skill level of manager by modifier on job
          var manageModded = Math.ceil(this.manager['skills'][specificSkill] * skillRelations[this.specific][specificSkill]);
          this.currentDay.mod.totVal += manageModded
          // transparency for user
          this.currentDay.mod.modList.push('manager skill: +' + manageModded + ` (${this.manager.skills[specificSkill]} skill level * ${skillRelations[this.specific][specificSkill]} business applicability)`);
        }
      }
    }

    // heavy storm: 20, ect
    for (var event in gameVars['globalEvents']){
      if (event in this.modifiers){
        this.currentDay.mod.totVal += this.modifiers[gameVars['globalEvents'][event]];
        this.currentDay.mod.modList.push(event + ": " + gameVars['globalEvents'][event]);
      }
    }

    // Input item consumption
    Object.setPrototypeOf(this.inputInventory, Inventory.prototype);
    var postline = 0;
    if (!this.inputInventory.empty){
      // only consume one of each type
      var consumedToday = [];
      for (var i=0; i<this.inputInventory.items.length; i++){
        if (this.inputInventory.items[i] && consumedToday.indexOf(this.inputInventory.items[i].title) == -1) {
          this.currentDay.mod.totVal += 1;
          this.currentDay.mod.modList.push(`${this.inputInventory.items[i].title} input: +1`);
          this.profit += this.inputInventory.items[i].value;
          postline += this.inputInventory.items[i].value;
          consumedToday.push(this.inputInventory.items[i].title);
          this.inputInventory.items[i] = null;
        }
      }
      if (this.inputs.length != 1 && consumedToday.length == this.inputs.length){
        this.currentDay.mod.totVal += this.inputs.length;
        this.currentDay.mod.modList.push(`All inputs supplied: +${this.inputs.length}`)
      }

    }

    // gauge player involvement
    this.currentDay.progPlayer = this.progressPlayer;
    if (this.days.length == 0){
      if (43200 < this.progressPlayer){
        this.playerDays = 1;
        this.currentDay.mod.totVal += 1;
        this.currentDay.mod.modList.push('player involvement: +' + this.playerDays);
      }
    } else {
      if (43200 < this.progressPlayer - this.days[this.days.length - 1].progPlayer){
        this.playerDays += 1;
        this.currentDay.mod.totVal += this.playerDays;
        this.currentDay.mod.modList.push('player involvement: +' + this.playerDays);
      }
    }
    // ######### END MODIFIER #############

    // ######### MULTIPLIER ###############
    // negative modifier for not having enough value
    this.currentDay.mult = {totVal: 1, multList: []};
    if (this.value < this.upgradeValue){
      this.currentDay.mult.totVal *= (this.value/this.upgradeValue);
      this.currentDay.mult.multList.push(`${this.value} of needed ${this.upgradeValue} value: *${(this.value/this.upgradeValue).toFixed(2)}`);
    }
    // negative modifier for not having enough workers
    if (this.workers < this.workersMin){
      this.currentDay.mult.totVal *= (this.workers/this.workersMin);
      this.currentDay.mult.totVal.push(`${this.workers} of needed ${this.workersMin} workers: *${(this.workers.this.workersMin).toFixed(2)}`);
    }
    // ######## END MULTIPLIER #############

    // Outcome
    this.currentDay.finalRoll = Math.ceil((this.currentDay.roll + this.currentDay.mod.totVal) * this.currentDay.mult.totVal);
    var maint = Math.ceil(this.upgrades.length + this.value/1000 + this.workers);
    this.currentDay.outcome = '';
    switch(true) {
      case (this.currentDay.finalRoll < 0):
        this.currentDay.outcome += `catastropic losses: -${Math.floor(maint * 5)}`;
        this.profit -= Math.floor(maint * 5);
        break;
      case (this.currentDay.finalRoll < 20):
        this.currentDay.outcome += `heavy losses: -${Math.floor(maint * 2)}`;
        this.profit -= Math.floor(maint * 2);
        break;
      case (this.currentDay.finalRoll < 30):
        this.currentDay.outcome += `losses: -${maint}`;
        this.profit -= maint;
        break;
      case (this.currentDay.finalRoll < 40):
        this.currentDay.outcome += `minor losses: -${Math.floor(maint * .5)}`;
        this.profit -= Math.floor(maint * .5);
        break;
      case (this.currentDay.finalRoll < 60):
        this.currentDay.outcome += `broke even: +0`;
        break;
      case (this.currentDay.finalRoll < 80):
        var tempRoll = rollDice('1d6');
        this.currentDay.outcome += `minor profit: (1d6: ${tempRoll} * ${Math.floor(this.value/1000)}): +${tempRoll * Math.floor(this.value/1000)}`;
        this.profit += tempRoll * Math.floor(this.value/1000);
        break;
      case (this.currentDay.finalRoll < 90):
        var tempRoll = rollDice('2d8');
        this.currentDay.outcome += `good profit: (2d8: ${tempRoll} * ${Math.floor(this.value/1000)}): +${tempRoll * Math.floor(this.value/1000)}`;
        this.profit += tempRoll * Math.floor(this.value/1000);
        break;
      case (90 <= this.currentDay.finalRoll):
        var tempRoll = rollDice('3d10');
        this.currentDay.outcome += `huge profit: (3d10: ${tempRoll} * ${Math.floor(this.value/1000)}): +${tempRoll * Math.floor(this.value/1000)}`;
        this.profit += tempRoll * Math.floor(this.value/1000);
        break;
    }

    //This covers displaying that input items become money
    if (postline){
      this.currentDay.outcome += ` (+${postline} from input)`;
    }

    // Add today to the day list
    this.days.push(JSON.parse(JSON.stringify(this.currentDay)));

    if (this.currentDay.dayNum == 'D7'){
      this.endOfWeek();
    }
  }

  missingCrystals(deltaT){
    this.crystals += parseInt(deltaT*CRYSTALCHANCE);
  }

  crystalize(){
    console.log(`crystalizing ${this.title} ${this.crystals}`);
    for (var i=0; i<this.crystals; i++){
      spawnCrystal(this.id+'-container', this);
    }
  }

  catchUp(deltaT){
    this.addProgress(deltaT);
  }

  addProgress(q=(this.workers/this.workersMin), natural=true){
    if (natural){
      this.progress += q;
    } else {
      this.progressPlayer += q;
    }

    // The week is over
    if ((604800 < this.progress + this.progressPlayer) && (6 < this.days.length)){
      // Crystal generation here.
      if (Math.random() < CRYSTALCHANCE){
        if (this.crystals < CRYSTALMAX){
          spawnCrystal(this.id + '-container', this);
          this.crystals += 1;
        } else {
          gameVars['savedTime'] += Math.ceil(Math.random()*(CRYSTALCHANCE**-0.75)/2);
        }
      }

    // If total seconds is enough to make a new day
    } else {
      while (parseInt((this.progress + this.progressPlayer) / 86400) > this.days.length) {
        this.newDay();
        this.formatPaydays();
      }
    }
  }


  updateProgressBar(){
    $('#'+this.id+'-progress-natural').css("width", `${parseInt(this.progress/6048)}%`);
    $('#'+this.id+'-progress-player').css("width", `${parseInt(this.progressPlayer/6048)}%`);

    var innerStr = `[${parseInt(this.progress+this.progressPlayer)}/604800]  ||  `+((this.progress+this.progressPlayer)/6048).toFixed(2) + "%  ||  "

    if (this.remainingTime < 0){
      innerStr += 'Done';
    } else {
      innerStr += formatTime((this.remainingTime)/(this.workers/this.workersMin));
    }

    $('#'+this.id+'-progress-label').text(innerStr);
  }
}

export {Business, CRYSTALCHANCE, upgradeList};
