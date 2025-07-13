const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const { isCardInTraining } = require('../utils/trainingSystem.js');
const fs = require('fs');
const path = require('path');

const cardsPath = path.resolve('data', 'cards.json');
const shopPath = path.resolve('data', 'shop.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const shopData = JSON.parse(fs.readFileSync(shopPath, 'utf8'));

// Base sell values by rank
const rankValues = {
  C: 25,
  B: 100,
  A: 250,
  S: 1000,
  UR: 5000
};

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function calculateCardValue(card, cardDef) {
  const baseValue = rankValues[cardDef?.rank] || rankValues.C;
  const level = card.level || card.timesUpgraded + 1 || 1;
  const levelBonus = (level - 1) * 10; // 10 Beli per level above 1
  
  return baseValue + levelBonus;
}

function calculateItemSellValue(itemName) {
  const normalizeItemName = str => String(str || '').replace(/\s+/g, '').toLowerCase();
  const normalized = normalizeItemName(itemName);
  // Search all shop categories for the item
  const allItems = [
    ...(shopData.items || []),
    ...(shopData.potions || []),
    ...(shopData.equipment || []),
    ...(shopData.legendary || []),
    ...(shopData.devilFruits || []),
    ...(shopData.devilfruits || [])
  ];
  const shopItem = allItems.find(item => normalizeItemName(item.name) === normalized);
  if (shopItem && shopItem.price) {
    return Math.floor(shopItem.price * 0.6);
  }
  return 10; // Default if not found
}

function fuzzyFindCard(cards, input) {
  if (!cards || cards.length === 0) return null;
  
  const normInput = normalize(input);
  
  // First try exact match
  let match = cards.find(card => normalize(card.name) === normInput);
  if (match) return match;
  
  // Then try partial matches with scoring
  let bestMatch = null;
  let bestScore = 0;

  for (const card of cards) {
    const normName = normalize(card.name);
    let score = 0;

    if (normName.includes(normInput)) score = 2;
    else if (normName.startsWith(normInput)) score = 1;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = card;
    }
  }

  return bestMatch;
}

function fuzzyFindItem(items, input) {
  if (!items || items.length === 0) return null;
  
  const normInput = normalize(input);
  
  // First try exact match
  let match = items.find(item => normalize(item) === normInput);
  if (match) return match;
  
  // Then try partial matches with scoring
  let bestMatch = null;
  let bestScore = 0;

  for (const item of items) {
    const normName = normalize(item);
    let score = 0;

    if (normName.includes(normInput)) score = 2;
    else if (normName.startsWith(normInput)) score = 1;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
}

function findCard(cardName) {
  return allCards.find(c => normalize(c.name) === normalize(cardName));
}

function findUserCard(user, cardName) {
  return fuzzyFindCard(user.cards, cardName);
}

function findUserItem(user, itemName) {
  return fuzzyFindItem(user.inventory, itemName);
}

const data = new SlashCommandBuilder()
  .setName('sell')
  .setDescription('Sell cards or items for Beli.');

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) return message.reply('Start your journey with `op start` first!');

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  if (args.length === 0) {
    return message.reply('Usage: `op sell <card/item name> [amount]`\n\nExample: `op sell Nami` or `op sell Basic Potion 10`');
  }

  // Parse amount from the last argument if it's a number
  let amount = 1;
  let itemName = args.join(' ').trim();
  
  // Check if last argument is a number
  const lastArg = args[args.length - 1];
  if (!isNaN(lastArg) && parseInt(lastArg) > 0) {
    amount = parseInt(lastArg);
    itemName = args.slice(0, -1).join(' ').trim();
  }

  if (!itemName) {
    return message.reply('Usage: `op sell <card/item name> [amount]`\n\nExample: `op sell Nami` or `op sell Basic Potion 10`');
  }

  if (amount < 1 || amount > 100) {
    return message.reply('You can only sell 1-100 items at a time.');
  }

  // First, try to find as a card
  const userCard = findUserCard(user, itemName);
  if (userCard) {
    const cardDef = findCard(userCard.name);
    
    // Check if card is in training
    if (isCardInTraining(user, userCard.name)) {
      return message.reply(`"${userCard.name}" is currently in training and cannot be sold. Use \`op untrain ${userCard.name}\` to stop training first.`);
    }
    
    // Check if card is in case (locked away)
    if (user.case && user.case.find(c => normalize(c.name) === normalize(userCard.name))) {
      return message.reply(`"${userCard.name}" is locked in your case and cannot be sold. Use \`op unlock ${userCard.name}\` to return it to your collection first.`);
    }

    // Prevent selling UR cards (optional safety measure)
    if (cardDef && cardDef.rank === 'UR') {
      return message.reply(`UR rank cards cannot be sold! "${userCard.name}" is too valuable to sell.`);
    }

    // For cards, only allow selling 1 at a time
    if (amount > 1) {
      return message.reply('You can only sell 1 card at a time.');
    }

    const sellValue = calculateCardValue(userCard, cardDef);
    
    // Remove card from user's collection
    const cardIndex = user.cards.findIndex(c => normalize(c.name) === normalize(userCard.name));
    user.cards.splice(cardIndex, 1);
    
    // Remove from team if present
    const teamIndex = user.team?.findIndex(teamCard => normalize(teamCard) === normalize(userCard.name));
    if (teamIndex !== -1) {
      user.team.splice(teamIndex, 1);
    }
    
    // Add Beli
    user.beli = (user.beli || 0) + sellValue;
    
    await user.save();
    
    const embed = new EmbedBuilder()
      .setTitle('<:money:1390838687104897136> Card Sold!')
      .setDescription(`You sold **${userCard.name}** for ${sellValue} Beli.`)
      .addFields(
        { name: 'Card', value: `[${cardDef?.rank || 'Unknown'}] ${userCard.name}`, inline: true },
        { name: 'Level', value: `${userCard.level || 1}`, inline: true },
        { name: 'Sell Price', value: `${sellValue} Beli`, inline: true },
        { name: 'Total Beli', value: `${user.beli}`, inline: false }
      )
      .setColor(0x2ecc40);
    
    if (cardDef && cardDef.image && cardDef.image !== "placeholder") {
      embed.setThumbnail(cardDef.image);
    }
    
    return message.reply({ embeds: [embed] });
  }

  // Try to find as an item
  const userItem = findUserItem(user, itemName);
  if (userItem) {
    // Check for special items that shouldn't be sold
    const normalizedItem = normalize(userItem);
    
    // Count how many of this item the user has
    const itemCount = user.inventory.filter(i => normalize(i) === normalize(userItem)).length;
    
    if (itemCount < amount) {
      return message.reply(`You only have ${itemCount} "${userItem}" but are trying to sell ${amount}.`);
    }
    
    const sellValue = calculateItemSellValue(userItem);
    const totalSellValue = sellValue * amount;
    
    // Remove items from inventory
    let removedCount = 0;
    for (let i = user.inventory.length - 1; i >= 0 && removedCount < amount; i--) {
      if (normalize(user.inventory[i]) === normalize(userItem)) {
        user.inventory.splice(i, 1);
        removedCount++;
      }
    }
    
    // Add Beli
    user.beli = (user.beli || 0) + totalSellValue;
    
    await user.save();
    
    const embed = new EmbedBuilder()
      .setTitle('<:money:1390838687104897136> Item Sold!')
      .setDescription(`You sold **${amount}x ${userItem}** for ${totalSellValue} Beli.`)
      .addFields(
        { name: 'Item', value: `${amount}x ${userItem}`, inline: true },
        { name: 'Sell Price', value: `${totalSellValue} Beli`, inline: true },
        { name: 'Total Beli', value: `${user.beli}`, inline: false }
      )
      .setColor(0x2ecc40);
    
    return message.reply({ embeds: [embed] });
  }

  // Item not found
      return message.reply(`❌ You don't own "${itemName}". Check your collection and inventory to see what you can sell.`);
}


module.exports = { data, execute };