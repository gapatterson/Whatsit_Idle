import {Business} from './business.js';
import {Inventory, formatTime} from './toolset.js';

// expect this to grow
function catchUp(){
  // current date minus saved "last seen" date
  gameVars['lastSeen'] = new Date(gameVars['lastSeen']);
  var now = new Date();
  var deltaT = (now - gameVars['lastSeen'])/1000;
  console.log(`${formatTime(deltaT)} since last seen.`);

  // time added to each owned business
  gameVars['ownedBusinesses'].forEach((individualBusiness) => {
    individualBusiness.catchUp(deltaT);
  });

  // time added to savedTime
  gameVars['savedTime'] += deltaT;
  gameVars['lastSeen'] = new Date();
}

function startupScript(){
  $('#version-number').text('\t' + __VERSION__);

  // set prototypes for everything
  gameVars['ownedBusinesses'].forEach((business) => {
    Object.setPrototypeOf(business, Business.prototype);
  })
  for (let key in gameVars['inventories']){
    Object.setPrototypeOf(gameVars['inventories'][key], Inventory.prototype);
  }

  // reveal unlocked items
  gameVars['unlocked'].forEach((tag) => {
    console.log(`${tag} already unlocked`);
    $(`${tag}`).show();
  });

  // progress time for everything
  catchUp();

  console.log(`Startup Complete`);
}


export {startupScript};
