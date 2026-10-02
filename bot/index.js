const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const autoEat = require('mineflayer-auto-eat').loader;

const bot = mineflayer.createBot({
  host: '127.0.0.1',
  port: 25566,        // ViaProxy port
  username: 'YOUR_BOT_NAME',
  version: '1.20.4'
});

// Load plugins
bot.loadPlugin(pathfinder);
bot.loadPlugin(autoEat);

let currentMode = 'idle';
let targetName = 'YOUR_USERNAME';
let isSleeping = false;

// Block name aliases for common player inputs
const BLOCK_ALIASES = {
  'wood': 'oak_log',
  'log': 'oak_log'
};

// Map blocks to the item dropped when mined without Silk Touch
const DROP_MAPPINGS = {
  'deepslate': 'cobbled_deepslate',
  'stone': 'cobblestone',
  'coal_ore': 'coal',
  'iron_ore': 'raw_iron',
  'gold_ore': 'raw_gold',
  'copper_ore': 'raw_copper',
  'diamond_ore': 'diamond',
  'emerald_ore': 'emerald',
  'lapis_ore': 'lapis_lazuli',
  'nether_quartz_ore': 'quartz'
};

const AXES = [
  'netherite_axe',
  'diamond_axe',
  'iron_axe',
  'stone_axe',
  'golden_axe',
  'wooden_axe'
];

const PICKAXES = [
  'netherite_pickaxe',
  'diamond_pickaxe',
  'iron_pickaxe',
  'stone_pickaxe',
  'golden_pickaxe',
  'wooden_pickaxe'
];

bot.once('spawn', () => {
  console.log('[+] TC-bot joined the server successfully!');

  const movements = new Movements(bot);
  bot.pathfinder.setMovements(movements);

  if (bot.autoEat) {
    bot.autoEat.options = {
      priority: 'foodPoints',
      startAt: 14,
      bannedFood: []
    };
  }

  bot.chat('TC-bot online! Commands: !follow, !goto, !mine <block> <count>, !status, !inv, !eat, !drop <item>, !wake, !afk, !stop');
});

// Helper function to eat continuously until hunger is 20/20
async function eatUntilFull() {
  if (!bot.autoEat) return;

  while (bot.food < 20) {
    try {
      await bot.autoEat.eat();
    } catch (err) {
      break;
    }
  }
}

bot.on('health', () => {
  if (bot.food <= 14) {
    eatUntilFull();
  }
});

// Helper function to handle sleeping logic
async function tryAutoSleep() {
  if (isSleeping) return;

  const timeOfDay = bot.time.timeOfDay;
  const isNight = timeOfDay >= 12541 && timeOfDay <= 23458;

  if (isNight || bot.isRaining) {
    const bedBlock = bot.findBlock({
      matching: (block) => bot.isABed(block),
      maxDistance: 16
    });

    if (bedBlock) {
      try {
        isSleeping = true;
        bot.pathfinder.setGoal(null);
        await bot.sleep(bedBlock);
        console.log('[+] Auto-sleep: Bot is now in bed.');
      } catch (err) {
        isSleeping = false;
      }
    }
  }
}

bot.on('time', () => {
  tryAutoSleep();
});

bot.on('wake', () => {
  isSleeping = false;
  console.log('[+] Bot woke up.');
});

bot.on('autoeat_started', (item) => {
  console.log(`[+] Bot started eating ${item.name}`);
});

bot.on('autoeat_finished', (item) => {
  console.log(`[+] Bot finished eating ${item.name}`);
});

// Helper function to count a specific item in inventory
function getItemCount(itemName) {
  return bot.inventory.items()
    .filter(item => item.name === itemName)
    .reduce((total, item) => total + item.count, 0);
}

async function mineBlocks(requestedBlock, targetCount) {
  const blockName = BLOCK_ALIASES[requestedBlock] || requestedBlock;
  const droppedItemName = DROP_MAPPINGS[blockName] || blockName;

  if (!bot.registry || !bot.registry.blocksByName) {
    bot.chat("Bot registry is not ready yet.");
    return;
  }

  const blockData = bot.registry.blocksByName[blockName];
  if (!blockData) {
    bot.chat(`"${requestedBlock}" is not a valid block name.`);
    return;
  }

  const isWood = blockName.includes('log') || blockName.includes('wood');
  const requiredToolList = isWood ? AXES : PICKAXES;

  if (!isWood && !bot.inventory.items().find(item => requiredToolList.includes(item.name))) {
    bot.chat('I do not have a pickaxe to mine!');
    return;
  }

  const initialItemCount = getItemCount(droppedItemName);
  let minedCount = 0;
  currentMode = 'mining';

  bot.chat(`Mining ${targetCount} ${blockName}...`);

  while (minedCount < targetCount && currentMode === 'mining') {
    // Simple find by block ID
    const target = bot.findBlock({
      matching: blockData.id,
      maxDistance: 16
    });

    if (!target) {
      bot.chat(`No ${blockName} nearby. Mined ${minedCount}/${targetCount}.`);
      break;
    }

    try {
      // Always pathfind to get next to the block
      const { x, y, z } = target.position;
      await bot.pathfinder.goto(new goals.GoalNear(x, y, z, 2));

      // Re-check block is still there
      const block = bot.blockAt(target.position);
      if (!block || block.type !== blockData.id) continue;

      // Equip tool
      const tool = bot.inventory.items().find(item => requiredToolList.includes(item.name));
      if (tool) await bot.equip(tool, 'hand');

      // Dig
      await bot.dig(block);
      minedCount++;
      console.log(`[+] Mined ${minedCount}/${targetCount} ${blockName}`);

      await bot.waitForTicks(2);

    } catch (err) {
      console.error('[!] Mine error:', err.message);
      // Don't break — try the next block
      await bot.waitForTicks(5);
    }
  }

  const itemsCollected = getItemCount(droppedItemName) - initialItemCount;
  bot.chat(`Done! Mined ${minedCount} ${blockName} (collected ${itemsCollected} ${droppedItemName}).`);
  currentMode = 'idle';
}


bot.on('chat', async (username, message) => {
  if (username === bot.username) return;

  const args = message.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (command === '!follow') {
    targetName = args[1] || username;
    const target = bot.players[targetName]?.entity;

    if (!target) {
      bot.chat(`I cannot see ${targetName} right now.`);
      return;
    }

    currentMode = 'follow';
    bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true);
    bot.chat(`Following ${targetName}.`);
  }

  else if (command === '!mine') {
    if (args.length < 3) {
      bot.chat('Usage: !mine <block_name> <count> (e.g., !mine deepslate 50)');
      return;
    }

    const blockName = args[1].toLowerCase();
    const count = parseInt(args[2], 10);

    if (isNaN(count) || count <= 0) {
      bot.chat('Please specify a valid positive number for count.');
      return;
    }

    mineBlocks(blockName, count);
  }

  else if (command === '!goto') {
    if (args.length < 4) {
      bot.chat('Usage: !goto x y z');
      return;
    }

    const x = Number(args[1]);
    const y = Number(args[2]);
    const z = Number(args[3]);

    if (![x, y, z].every(Number.isFinite)) {
      bot.chat('Coordinates must be valid numbers.');
      return;
    }

    currentMode = 'goto';
    bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, 1));
    bot.chat(`Going to ${x}, ${y}, ${z}.`);
  }

  else if (command === '!status') {
    const healthHearts = (bot.health / 2).toFixed(1);
    const foodShanks = (bot.food / 2).toFixed(1);

    bot.chat(`Status -> Health: ${healthHearts}/10 hearts | Hunger: ${foodShanks}/10 shanks`);
  }

  else if (command === '!eat') {
    if (bot.autoEat) {
      bot.chat('Eating until full...');
      eatUntilFull();
    }
  }

  else if (command === '!inventory' || command === '!inv') {
    const items = bot.inventory.items();
    if (items.length === 0) {
      bot.chat('My inventory is empty.');
      return;
    }

    const summary = items.reduce((acc, item) => {
      acc[item.name] = (acc[item.name] || 0) + item.count;
      return acc;
    }, {});

    const inventoryList = Object.entries(summary)
      .map(([name, count]) => `${name} x${count}`)
      .join(', ');

    bot.chat(`Inventory: ${inventoryList}`);
  }

  else if (command === '!drop') {
    const itemName = args[1]?.toLowerCase();

    if (!itemName) {
      bot.chat('Usage: !drop <item_name> (e.g., !drop carrot)');
      return;
    }

    const itemToDrop = bot.inventory.items().find(item => item.name.toLowerCase() === itemName);

    if (!itemToDrop) {
      bot.chat(`I don't have any "${itemName}" in my inventory.`);
      return;
    }

    try {
      await bot.tossStack(itemToDrop);
      bot.chat(`Dropped ${itemToDrop.name} x${itemToDrop.count}.`);
    } catch (err) {
      bot.chat(`Failed to drop ${itemName}: ${err.message}`);
    }
  }

  else if (command === '!wake') {
    try {
      await bot.wake();
      bot.chat('I woke up!');
    } catch (err) {
      bot.chat(`Cannot wake up: ${err.message}`);
    }
  }

  else if (command === '!afk') {
    currentMode = 'afk';
    bot.pathfinder.setGoal(null);
    bot.clearControlStates();
    bot.chat('I am staying here.');
  }

  else if (command === '!stop') {
    currentMode = 'idle';
    bot.pathfinder.setGoal(null);
    bot.clearControlStates();
    bot.chat('Movement stopped.');
  }
});

bot.on('kicked', (reason) => {
  console.log('[!] Bot was kicked:', JSON.stringify(reason));
});

bot.on('error', (error) => {
  console.error('[!] Bot error:', error);
});

bot.on('end', () => {
  console.log('[!] Bot disconnected.');
});

process.on('uncaughtException', (err) => {
  console.error('[!] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[!] Unhandled Rejection at:', promise, 'reason:', reason);
});