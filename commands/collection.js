const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder  } = require('discord.js');
const fs = require('fs');
const path = require('path');
const User = require('../db/models/User.js');
const { isCardInTraining } = require('../utils/trainingSystem.js');
const { CHEST_TIERS } = require('../utils/chestSystem.js');

const MAX_STORAGE = 250;

const rankSettings = {
  C: { color: 0x2C2F33, rankName: "C", rankImage: "https://files.catbox.moe/7xzfbe.png" },
  B: { color: 0x2C2F33, rankName: "B", rankImage: "https://files.catbox.moe/d0oebp.png" },
  A: { color: 0x2C2F33, rankName: "A", rankImage: "https://files.catbox.moe/qlntg7.png" },
  S: { color: 0x2C2F33, rankName: "S", rankImage: "https://files.catbox.moe/9iq0m3.png" },
  UR: { color: 0x2C2F33, rankName: "UR", rankImage: "https://files.catbox.moe/70hwjn.png" }
};

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

function getCardByUserInstance(instance) {
  return allCards.find(c => c.name === instance.cardName || c.name === instance.name);
}

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function cardEmbed(cardInstance, cardDef, ownerName, index, total, user, duplicateCount = 1) {
  if (!cardDef) {
    return new EmbedBuilder()
      .setTitle('Card not found')
      .setDescription('This card is missing from the database.')
      .setColor(0x2C2F33);
  }

  const { calculateCardStats } = require('../utils/levelSystem.js');
  const level = cardInstance.level || (cardInstance.timesUpgraded >= 0 ? cardInstance.timesUpgraded + 1 : 1);
  let stats = calculateCardStats(cardDef, level);
  let { power, health, speed } = stats;

  // Apply equipment bonuses
  let equippedItem = user && user.equipped && user.equipped[cardDef.name];
  let boostText = '';
  if (equippedItem) {
    // Use shop system for stat boosts
    const { findShopItem } = require('../utils/battleSystem.js');
    const equipmentData = findShopItem(equippedItem);
    if (equipmentData && equipmentData.statBoost) {
      const boosts = equipmentData.statBoost;
      if (boosts.power) power = Math.ceil(power * (1 + boosts.power / 100));
      if (boosts.health) health = Math.ceil(health * (1 + boosts.health / 100));
      if (boosts.speed) speed = Math.ceil(speed * (1 + boosts.speed / 100));
      boostText = `\n**${equippedItem} equipped!**`;
    } else {
      boostText = `\n**${equippedItem} equipped!**`;
    }
  }

  const rankMultipliers = {
    'C': 0.08,
    'B': 0.10,
    'A': 0.14,
    'S': 0.17,
    'UR': 0.20
  };

  const multiplier = rankMultipliers[cardDef.rank] || 0.10;
  const baseDamage = power * multiplier;
  const attackLow = Math.floor(baseDamage * 1.0);
  const attackHigh = Math.floor(baseDamage * 1.5);

  const rankSet = rankSettings[cardDef.rank] || {};
  const lockStatus = cardInstance.locked ? ' 🔒' : '';
  const duplicateText = duplicateCount > 1 ? ` (x${duplicateCount})` : '';

  let desc =
    `**${cardDef.name}**${lockStatus}${duplicateText}\n` +
    `${cardDef.shortDesc}\n\n` +
    `**Owner:** ${ownerName}\n` +
    `**Level:** ${level}\n` +
    `**Power:** ${power}\n` +
    `**Health:** ${health}\n` +
    `**Speed:** ${speed}\n` +
    `**Attack:** ${attackLow}–${attackHigh}\n` +
    `**Type:** Combat${boostText}`;

  const embed = new EmbedBuilder()
    .setDescription(desc)
    .setColor(0x2C2F33)
    .setFooter({ text: `${ownerName}'s Collection • ${index + 1}/${total}` });

  if (cardDef.image && cardDef.image !== "placeholder" && /^https?:\/\//.test(cardDef.image)) {
    embed.setImage(cardDef.image);
  }
  if (rankSet.rankImage && /^https?:\/\//.test(rankSet.rankImage)) {
    embed.setThumbnail(rankSet.rankImage);
  }
  return embed;
}

function buildRow(cardIndex, totalCards) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('collection_prev')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(cardIndex === 0),
    new ButtonBuilder()
      .setCustomId('collection_next')
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(cardIndex === totalCards - 1),
    new ButtonBuilder()
      .setCustomId('collection_info')
      .setLabel('Info')
      .setStyle(ButtonStyle.Primary)
  );
}

const data = new SlashCommandBuilder()
  .setName('collection')
  .setDescription('View your card collection.');

async function showChestsSection(message, user) {
  // Initialize chests if they don't exist
  if (!user.chests) {
    user.chests = { C: 0, B: 0, A: 0, S: 0, UR: 0 };
  }

  const embed = new EmbedBuilder()
    .setTitle('📦 Chest Collection')
    .setDescription('Your collected chests from adventures!')
    .setColor(0x2c2f33);

  let totalChests = 0;
  let chestText = '';

  for (const [tier, count] of Object.entries(user.chests)) {
    if (count > 0) {
      const chestConfig = CHEST_TIERS[tier];
      chestText += `${chestConfig.emoji} **${chestConfig.name}**: ${count}\n`;
      totalChests += count;
    }
  }

  if (chestText === '') {
    chestText = 'No chests yet! Explore the world to find chests.';
  }

  embed.addFields(
    { name: 'Your Chests', value: chestText, inline: false },
    { name: 'Total Chests', value: totalChests.toString(), inline: true }
  );

  embed.addFields({
    name: 'How to Open Chests',
    value: 'Use `op chest open <tier> [amount]`\nExample: `op chest open A 3`',
    inline: false
  });

  embed.setFooter({ text: 'Chests contain Beli, items, and cards!' });

  return message.reply({ embeds: [embed] });
}

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) {
    return message.reply('Start your journey with `op start` first!');
  }

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  if (!Array.isArray(user.cards)) {
    return message.reply("You have no cards!");
  }

  // Filter out training cards and case cards (locked away)
  let cardInstances = user.cards.filter(ci => {
    if (!ci || typeof ci !== 'object') return false;
    if (isCardInTraining(user, ci.name)) return false;
    // Exclude cards that are in the case (locked away)
    if (user.case && user.case.find(c => c.name === ci.name)) return false;
    return true;
  });
  if (cardInstances.length === 0) {
    return message.reply("You have no cards!");
  }

  const arg = (args[0] || "").toLowerCase();
  
  // Handle chests section
  if (arg === "chests") {
    return await showChestsSection(message, user);
  }
  
  // Handle rank filtering
  if (["s", "a", "b", "c", "ur"].includes(arg)) {
    cardInstances = cardInstances.filter(ci => {
      const card = getCardByUserInstance(ci);
      return card && card.rank && card.rank.toUpperCase() === arg.toUpperCase();
    });
    if (cardInstances.length === 0) {
      return message.reply(`You have no cards of rank ${arg.toUpperCase()}!`);
    }
  }

  // Group cards by name and count duplicates
  const cardGroups = new Map();
  cardInstances.forEach(cardInstance => {
    const cardDef = getCardByUserInstance(cardInstance);
    if (cardDef) {
      const key = cardDef.name;
      if (!cardGroups.has(key)) {
        cardGroups.set(key, { instance: cardInstance, def: cardDef, count: 0 });
      }
      cardGroups.get(key).count++;
    }
  });

  // Convert to array and sort by power
  const uniqueCards = Array.from(cardGroups.values()).sort((a, b) => {
    const { calculateCardStats } = require('../utils/levelSystem.js');
    const statsA = calculateCardStats(a.def, a.instance.level || 1);
    const statsB = calculateCardStats(b.def, b.instance.level || 1);
    return statsB.power - statsA.power;
  });

  let cardIndex = 0;
  const ownerName = message.author.username;
  const total = uniqueCards.length;

  // Show first card
  const cardGroup = uniqueCards[cardIndex];
  const embed = cardEmbed(cardGroup.instance, cardGroup.def, ownerName, cardIndex, total, user, cardGroup.count);
  const msg = await message.reply({ embeds: [embed], components: [buildRow(cardIndex, total)] });

  const filter = i => i.user.id === userId;
  const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();
    if (interaction.customId === 'collection_prev' && cardIndex > 0) {
      cardIndex--;
    } else if (interaction.customId === 'collection_next' && cardIndex < total - 1) {
      cardIndex++;
    } else if (interaction.customId === 'collection_info') {
      const currentGroup = uniqueCards[cardIndex];
      const currentCard = currentGroup.instance;
      const currentCardDef = currentGroup.def;

      if (!currentCardDef) {
        await interaction.followUp({ content: 'Card information not found!', ephemeral: true });
        return;
      }

      const { calculateCardStats } = require('../utils/levelSystem.js');
      const level = currentCard.level || (currentCard.timesUpgraded >= 0 ? currentCard.timesUpgraded + 1 : 1);
      const stats = calculateCardStats(currentCardDef, level);
      let { power, health, speed } = stats;

      // Ensure stats are valid numbers
      power = (isNaN(power) || power === null || power === undefined) ? 10 : Math.floor(Number(power));
      health = (isNaN(health) || health === null || health === undefined) ? 50 : Math.floor(Number(health));
      speed = (isNaN(speed) || speed === null || speed === undefined) ? 30 : Math.floor(Number(speed));

      // Apply equipment boosts
      let normCard = normalize(currentCardDef.name);
      let equippedItem = user && user.equipped && user.equipped[normCard];
      let boostText = '';
      if (equippedItem) {
        const { findShopItem } = require('../utils/battleSystem.js');
        const equipmentData = findShopItem(equippedItem);
        if (equipmentData && equipmentData.statBoost) {
          const boosts = equipmentData.statBoost;
          if (boosts.power) power = Math.ceil(power * (1 + boosts.power / 100));
          if (boosts.health) health = Math.ceil(health * (1 + boosts.health / 100));
          if (boosts.speed) speed = Math.ceil(speed * (1 + boosts.speed / 100));
          boostText = `\n**Equipment**: ${equippedItem}`;
        } else {
          boostText = `\n**Equipment**: ${equippedItem}`;
        }
      }

      const rankMultipliers = {
        'C': 0.08,
        'B': 0.10,
        'A': 0.14,
        'S': 0.17,
        'UR': 0.20
      };

      const multiplier = rankMultipliers[currentCardDef.rank] || 0.10;
      const baseDamage = power * multiplier;
      const minDamage = Math.floor(baseDamage * 1.0);
      const maxDamage = Math.floor(baseDamage * 1.5);

      const infoText = `**${currentCardDef.name}** (${currentCardDef.rank})\n` +
        `${currentCardDef.shortDesc}\n\n` +
        `**Copies Owned**: ${currentGroup.count}\n` +
        `**Stats (Level ${level})**\n` +
        `Power: ${power}\n` +
        `Health: ${health}\n` +
        `Speed: ${speed}\n\n` +
        `**Combat**\n` +
        `Damage Range: ${minDamage} - ${maxDamage}\n` +
        `Damage Multiplier: ${multiplier}x\n` +
        `Lock Status: ${currentCard.locked ? '🔒 Locked' : 'Unlocked'}${boostText}\n\n` +
        `**Evolution**\n` +
        `${currentCardDef.evolution ? `Next: ${currentCardDef.evolution.nextId} (Level ${currentCardDef.evolution.requiredLevel})` : 'Max evolution reached'}`;

      await interaction.followUp({ content: infoText, ephemeral: true });
      return;
    }
    const updatedGroup = uniqueCards[cardIndex];
    const updatedEmbed = cardEmbed(updatedGroup.instance, updatedGroup.def, ownerName, cardIndex, total, user, updatedGroup.count);
    await msg.edit({ embeds: [updatedEmbed], components: [buildRow(cardIndex, total)] });
  });

  collector.on('end', () => {
    msg.edit({ components: [] });
  });
}

module.exports = { data, execute };