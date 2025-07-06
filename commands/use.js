const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');
const { loadShopData } = require('../utils/rewardSystem.js');

const USABLE_ITEMS = {
  'timecrystal': {
    name: 'Time Crystal',
    description: 'Instantly removes all exploration cooldowns',
    effect: 'clear_explore_cooldowns',
    consumable: true
  },
  'energypotion': {
    name: 'Energy Potion',
    description: 'Removes defeat cooldown',
    effect: 'clear_defeat_cooldown',
    consumable: true
  },
  'energydrink': {
    name: 'Energy Drink',
    description: 'Temporary speed boost for your team',
    effect: 'speed_boost',
    consumable: true,
    duration: 60 * 60 * 1000 // 1 hour
  },
  'resettoken': {
    name: 'Reset Token',
    description: 'Resets your pull statistics and gives you a fresh start',
    effect: 'reset_pulls',
    consumable: true
  }
};

const data = new SlashCommandBuilder()
  .setName('use')
  .setDescription('Use consumable items from your inventory.');

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('Start your journey with `op start` first!')
      .setFooter({ text: 'Use op start to begin your adventure' });
    
    return message.reply({ embeds: [embed] });
  }

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  if (!args.length) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('Use Item')
      .setDescription('Use consumable items from your inventory.')
      .addFields(
        { name: 'Usage', value: '`op use <item name>`', inline: false },
        { name: 'Usable Items', value: 'Time Crystal • Energy Potion • Energy Drink • Reset Token', inline: false }
      )
      .setFooter({ text: 'Use items to gain various effects' });
    
    return message.reply({ embeds: [embed] });
  }

  const shopData = loadShopData();
  const allShopItems = [];
  ['potions', 'equipment', 'legendary', 'items', 'devilfruits'].forEach(category => {
    if (shopData[category]) {
      shopData[category].forEach(item => allShopItems.push(item));
    }
  });

  const itemName = args.join(' ').trim().toLowerCase().replace(/\s+/g, '');
  const shopItem = allShopItems.find(i => i.name.toLowerCase().replace(/\s+/g, '') === itemName);
  if (!shopItem) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription("That item cannot be used or doesn't exist!")
      .setFooter({ text: 'Check your inventory for usable items' });
    return message.reply({ embeds: [embed] });
  }

  // Object-based inventory
  if (!user.inventory || typeof user.inventory !== 'object') user.inventory = {};
  // Find the actual key in inventory that matches the normalized key (robust fuzzy match)
  let actualInventoryKey = Object.keys(user.inventory).find(k => {
    const normK = normalize(k);
    return normK === itemName || normK.includes(itemName) || itemName.includes(normK);
  });
  if (!actualInventoryKey || user.inventory[actualInventoryKey] < 1) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`You don't have any ${shopItem.name}!`)
      .setFooter({ text: 'Item not found in inventory' });
    return message.reply({ embeds: [embed] });
  }

  // Apply item effect
  let effectMessage = '';
  const now = Date.now();

  switch (shopItem.effect) {
    case 'clear_explore_cooldowns':
      user.locationCooldowns = new Map();
      effectMessage = 'All exploration cooldowns have been cleared!';
      break;
    case 'clear_defeat_cooldown':
      user.exploreLossCooldown = 0;
      effectMessage = 'Defeat cooldown has been removed!';
      break;
    case 'speed_boost':
      if (!user.activeBoosts) user.activeBoosts = [];
      user.activeBoosts.push({
        type: 'speed_boost',
        expiresAt: now + shopItem.duration,
        multiplier: 1.5
      });
      effectMessage = 'Your team gains a speed boost for 1 hour!';
      break;
    case 'reset_pulls':
      // Reset pull statistics
      if (!user.pullData) {
        user.pullData = {
          dailyPulls: 0,
          lastReset: Date.now()
        };
      } else {
        user.pullData.dailyPulls = 0;
        user.pullData.lastReset = Date.now();
      }
      if (user.pulls) {
        user.pulls = [];
      }
      effectMessage = 'Your pull statistics have been reset! You can now pull cards again.';
      break;
  }

  // After use, decrement inventory
  user.inventory[actualInventoryKey]--;
  if (user.inventory[actualInventoryKey] <= 0) delete user.inventory[actualInventoryKey];

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(`Used ${shopItem.name}`)
    .setDescription(`${shopItem.description}\n\n${effectMessage}`)
    .setColor(0x2b2d31)
    .setFooter({ text: 'Item effect applied' });

  return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };