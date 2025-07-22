const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const { distributeXPToTeam } = require('../utils/levelSystem.js');
const { CHEST_TIERS } = require('../utils/chestSystem.js');

function normalize(str) {
    return String(str || '').replace(/\s+/g, '').toLowerCase();
}

// Enhanced daily rewards with valuable randomized items and better scaling
const dailyRewards = [
  { 
    beli: 500, 
    xp: 100, 
    items: ['Basic Potion', 'Energy Potion'], 
    randomCount: 1,
    bonusChance: 0.1 // 10% chance for bonus reward
  }, // Day 1
  { 
    beli: 1000, 
    xp: 200, 
    items: ['Normal Potion', 'Basic Potion', 'Energy Drink'], 
    randomCount: 1,
    bonusChance: 0.15 
  }, // Day 2
  { 
    beli: 2000, 
    xp: 350, 
    items: ['Max Potion', 'Normal Potion', 'Rusty Cutlass'], 
    randomCount: 2,
    bonusChance: 0.2 
  }, // Day 3
  { 
    beli: 3500, 
    xp: 500, 
    items: ['Silver Cutlass', 'Max Potion', 'Energy Drink', 'Time Crystal'], 
    randomCount: 2,
    bonusChance: 0.25 
  }, // Day 4
  { 
    beli: 6000, 
    xp: 750, 
    items: ['Golden Cutlass', 'Time Crystal', 'Max Potion', 'Reset Token'], 
    randomCount: 3,
    bonusChance: 0.3 
  }, // Day 5
  { 
    beli: 10000, 
    xp: 1200, 
    items: ['Diamond Ring', 'Time Crystal', 'Reset Token', 'Energy Drink'], 
    randomCount: 3,
    bonusChance: 0.4,
    guaranteedBounty: 50000 
  }, // Day 6
  { 
    beli: 20000, 
    xp: 2500, 
    items: ['Legendary Sword', 'Time Crystal', 'Reset Token', 'Diamond Ring'], 
    randomCount: 4,
    bonusChance: 0.5,
    guaranteedBounty: 150000 
  }  // Day 7 (Premium)
];

// Enhanced bonus reward pools for high streaks
const bonusRewardPools = {
  lowTier: ['Basic Potion', 'Normal Potion', 'Energy Potion'],
  midTier: ['Max Potion', 'Energy Drink', 'Silver Cutlass', 'Time Crystal'],
  highTier: ['Reset Token', 'Golden Cutlass', 'Diamond Ring'],
  premiumTier: ['Legendary Sword', 'Mythical Blade', 'Phoenix Feather']
};

const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily reward!');

// Add proper time formatting function
function prettyTime(ms) {
    if (ms <= 0) return "Ready";

    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);

    seconds = seconds % 60;
    minutes = minutes % 60;
    hours = hours % 24;

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (parts.length === 0 && seconds > 0) parts.push(`${seconds}s`);
    if (parts.length === 0) return "Ready";

    return parts.join(" ");
}

async function execute(message, args) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });

  if (!user) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('Start your journey with `op start` first!')
      .setFooter({ text: 'Use op start to begin your adventure' });
    
    return message.reply({ embeds: [embed] });
  }

  // Initialize daily reward data if needed
  if (!user.dailyReward) {
    user.dailyReward = {
      lastClaimed: null,
      streak: 0
    };
  }

  const now = Date.now();
  const lastClaimed = user.dailyReward.lastClaimed;
  
  // Check if user can claim today - prevent infinite claiming
  if (lastClaimed && typeof lastClaimed === 'number') {
    const timeDiff = now - lastClaimed;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    // Strict 24 hour cooldown - must wait full 24 hours
    if (hoursDiff < 24) { 
      const nextClaim = lastClaimed + (24 * 60 * 60 * 1000);
      const timeLeft = nextClaim - now;
      
      const embed = new EmbedBuilder()
        .setTitle('Daily Reward on Cooldown')
        .setDescription(`You've already claimed your daily reward!\n\nNext reward available in **${prettyTime(timeLeft)}**`)
        .setColor(0x2b2d31)
        .setFooter({ text: 'Daily rewards reset every 24 hours' });
      
      return message.reply({ embeds: [embed] });
    }
    
    // Check if streak should continue (claimed within 48 hours)
    if (hoursDiff > 48) {
      user.dailyReward.streak = 0; // Reset streak
    }
  }

  // Increment streak and set claim time BEFORE applying rewards
  user.dailyReward.streak = Math.min(user.dailyReward.streak + 1, 7);
  user.dailyReward.lastClaimed = now;

  // Save user data immediately to prevent multiple claims
  await user.save();

  // Get reward for current streak day
  const rewardIndex = (user.dailyReward.streak - 1) % 7;
  const reward = dailyRewards[rewardIndex];

  // Apply base rewards
  user.beli = (user.beli || 0) + reward.beli;
  // Award a C chest for daily claim
  if (!user.chests) user.chests = { C: 0, B: 0, A: 0, S: 0, UR: 0 };
  user.chests.C = (user.chests.C || 0) + 1;
  user.markModified('chests');
  // Award a random bonus chest (B, A, S, or UR) with decreasing probability
  const chestTiers = ['UR', 'S', 'A', 'B'];
  const chestChances = [0.01, 0.03, 0.07, 0.15]; // 1% UR, 3% S, 7% A, 15% B
  for (let i = 0; i < chestTiers.length; i++) {
    if (Math.random() < chestChances[i]) {
      user.chests[chestTiers[i]] = (user.chests[chestTiers[i]] || 0) + 1;
      user.markModified('chests');
      break; // Only one bonus chest per daily
    }
  }
  
  // Add guaranteed bounty for higher streaks
  if (reward.guaranteedBounty) {
    user.bounty = (user.bounty || 0) + reward.guaranteedBounty;
  }
  
  // Award XP to user with new leveling system
  const { awardUserXP } = require('../utils/userLevelSystem.js');
  const userLevelResult = awardUserXP(user, reward.xp);

  // Distribute XP to team cards
  const levelUpChanges = distributeXPToTeam(user, reward.xp);

  // Randomized item rewards
  if (!user.inventory) user.inventory = [];
  const rewardedItems = [];
  
  if (reward.items && reward.randomCount) {
    // Shuffle items and pick random count
    const shuffled = [...reward.items].sort(() => 0.5 - Math.random());
    const selectedItems = shuffled.slice(0, reward.randomCount);
    
    for (const item of selectedItems) {
      user.inventory.push(normalize(item));
      rewardedItems.push(item);
    }
  }
  
  // Bonus reward chance (increases with streak)
  const bonusRoll = Math.random();
  if (bonusRoll < reward.bonusChance) {
    let bonusPool;
    if (user.dailyReward.streak >= 7) bonusPool = bonusRewardPools.premiumTier;
    else if (user.dailyReward.streak >= 5) bonusPool = bonusRewardPools.highTier;
    else if (user.dailyReward.streak >= 3) bonusPool = bonusRewardPools.midTier;
    else bonusPool = bonusRewardPools.lowTier;
    
    const bonusItem = bonusPool[Math.floor(Math.random() * bonusPool.length)];
    user.inventory.push(normalize(bonusItem));
    rewardedItems.push(`${bonusItem} (BONUS!)`);
  }
  
  // Check for additional daily item rewards from reward system
  let bonusItemReward = null;
  try {
    const { getDailyReward, addItemToInventory } = require('../utils/rewardSystem.js');
    bonusItemReward = getDailyReward();
    if (bonusItemReward) {
      addItemToInventory(user, bonusItemReward);
    }
  } catch (error) {
    // Item rewards are optional
    console.log('Reward system not available');
  }

  // Save final rewards
  await user.save();

  // Build item display
  let itemDisplay = rewardedItems.length > 0 ? rewardedItems.join('\n') : 'None';
  if (bonusItemReward) {
    try {
      const { formatItemReward } = require('../utils/rewardSystem.js');
      itemDisplay = itemDisplay === 'None' ? 
        formatItemReward(bonusItemReward) : 
        `${itemDisplay}\n${formatItemReward(bonusItemReward)}`;
    } catch (error) {
      // Fallback format
      itemDisplay = itemDisplay === 'None' ? 
        `**${bonusItemReward.name}** obtained!` : 
        `${itemDisplay}\n**${bonusItemReward.name}** obtained!`;
    }
  }

  // Prepare embed
  const embed = new EmbedBuilder()
    .setTitle('Daily Reward Claimed!')
    .setColor(0x2b2d31)
    .setDescription(`You claimed your daily reward for day **${user.dailyReward.streak}**!\n\n**+${reward.beli} Beli**\n**+${reward.xp} XP**\n**+1 Common Chest**`)
    .setFooter({ text: `Streak: ${user.dailyReward.streak}/7 days • Next reward in 24 hours • Higher streaks = Better rewards!` });

  // Build reward fields
  const rewardFields = [
    { name: 'Beli', value: `+${reward.beli.toLocaleString()}`, inline: true },
    { name: 'XP', value: `+${reward.xp.toLocaleString()}`, inline: true }
  ];
  
  if (reward.guaranteedBounty) {
    rewardFields.push({ name: 'Bounty', value: `+${reward.guaranteedBounty.toLocaleString()}`, inline: true });
  }
  
  rewardFields.push({ name: 'Items', value: itemDisplay, inline: false });
  
  embed.addFields(rewardFields);
  
  // Add user level up notifications
  if (userLevelResult.leveledUp) {
    const { formatLevelUpRewards } = require('../utils/userLevelSystem.js');
    const levelUpText = `**LEVEL UP!**\n${userLevelResult.oldLevel} → **${userLevelResult.newLevel}**\n${formatLevelUpRewards(userLevelResult.rewards)}`;
    embed.addFields({ name: 'Pirate Level Up!', value: levelUpText.trim(), inline: false });
  }

  // Add card level up notifications if any cards leveled up
  if (levelUpChanges && levelUpChanges.length > 0) {
    const levelUpText = levelUpChanges.map(change => 
      `**${change.name}** leveled up! (${change.oldLevel} → ${change.newLevel})`
    ).join('\n');
    embed.addFields({ name: 'Card Level Ups!', value: levelUpText, inline: false });
  }

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
