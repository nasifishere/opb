const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { CHEST_TIERS, generateChestRewards, formatChestRewards } = require('../utils/chestSystem.js');

const data = new SlashCommandBuilder()
    .setName('chest')
    .setDescription('View your chest collection and open chests')
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('View all your chests'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('open')
            .setDescription('Open a chest')
            .addStringOption(option =>
                option.setName('tier')
                    .setDescription('The tier of chest to open (C, B, A, S, UR)')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Common (C)', value: 'C' },
                        { name: 'Uncommon (B)', value: 'B' },
                        { name: 'Rare (A)', value: 'A' },
                        { name: 'Epic (S)', value: 'S' },
                        { name: 'Legendary (UR)', value: 'UR' }
                    ))
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('Number of chests to open (default: 1)')
                    .setRequired(false)
                    .setMinValue(1)
                    .setMaxValue(10)));

async function execute(message, args) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });

    if (!user) {
        return message.reply('Start your journey with `op start` first!');
    }

    // Initialize chests if they don't exist
    if (!user.chests) {
        user.chests = { C: 0, B: 0, A: 0, S: 0, UR: 0 };
    }

    const subcommand = args[0]?.toLowerCase();

    if (subcommand === 'list' || !subcommand) {
        return await showChestList(message, user);
    } else if (subcommand === 'open') {
        const tier = args[1]?.toUpperCase();
        const amount = parseInt(args[2]) || 1;

        if (!tier || !['C', 'B', 'A', 'S', 'UR'].includes(tier)) {
            return message.reply('Usage: `op chest open <tier> [amount]`\nTiers: C, B, A, S, UR\nExample: `op chest open A 3`');
        }

        if (amount < 1 || amount > 10) {
            return message.reply('You can only open 1-10 chests at a time.');
        }

        return await openChests(message, user, tier, amount);
    } else {
        return message.reply('Usage: `op chest list` or `op chest open <tier> [amount]`');
    }
}

async function showChestList(message, user) {
    const embed = new EmbedBuilder()
        .setTitle('Chest Inventory')
        .setDescription('Collected from your adventures')
        .setColor(0x1a1a1a);

    let totalChests = 0;
    let hasChests = false;

    // Create a clean list of chest counts
    const chestFields = [];
    
    for (const tier of Object.keys(CHEST_TIERS)) {
        const count = user.chests[tier] || 0;
        const chestConfig = CHEST_TIERS[tier];
        totalChests += count;
        
        if (count > 0) {
            hasChests = true;
        }
        
        // Create a clean, minimal display
        const tierDisplay = tier === 'UR' ? 'Legendary' : chestConfig.name.replace(' Chest', '');
        chestFields.push({
            name: tierDisplay,
            value: `\`${count.toString().padStart(2, '0')}\``,
            inline: true
        });
    }

    if (!hasChests) {
        embed.setDescription('No chests collected yet.\nExplore, sail, or claim daily rewards to find chests.');
        embed.setColor(0x36393f);
    } else {
        embed.addFields(chestFields);
        
        // Add summary section
        embed.addFields({
            name: '\u200b',
            value: `**Total:** \`${totalChests}\` chest${totalChests === 1 ? '' : 's'}`,
            inline: false
        });
    }

    // Clean usage information
    embed.addFields({
        name: 'Usage',
        value: '```\nop chest open <tier> [amount]\n```\n**Example:** `op chest open A 3`',
        inline: false
    });

    embed.setFooter({ text: 'Contains: Beli • Items • Cards' });

    return message.reply({ embeds: [embed] });
}

async function openChests(message, user, tier, amount) {
    if (user.chests[tier] < amount) {
        return message.reply(`You don't have enough ${CHEST_TIERS[tier].name}s! You have ${user.chests[tier]}, but need ${amount}.`);
    }

    // Deduct chests
    user.chests[tier] -= amount;

    // Generate rewards for all chests
    let totalBeli = 0;
    let allItems = [];
    let allCards = [];

    for (let i = 0; i < amount; i++) {
        const rewards = generateChestRewards(tier);
        totalBeli += rewards.beli;
        allItems.push(...rewards.items);
        allCards.push(...rewards.cards);
    }

    // Apply rewards
    user.beli = (user.beli || 0) + totalBeli;

    // Add items to inventory
    const { normalizeInventory } = require('../utils/inventoryUtils.js');
    user.inventory = normalizeInventory(user.inventory);
    
    allItems.forEach(item => {
        const normalizedItem = item.replace(/\s+/g, '').toLowerCase();
        user.inventory.push(normalizedItem);
    });

    // Add cards
    const { addCardWithTransformation } = require('../utils/cardTransformationSystem.js');
    allCards.forEach(card => {
        const cardToAdd = {
            name: card.name,
            rank: card.rank,
            level: 1,
            experience: 0,
            timesUpgraded: 0,
            locked: false
        };
        addCardWithTransformation(user, cardToAdd);
    });

    await user.save();

    // Create reward display
    const tierDisplay = tier === 'UR' ? 'Legendary' : CHEST_TIERS[tier].name.replace(' Chest', '');
    const embed = new EmbedBuilder()
        .setTitle('Chest Opened')
        .setDescription(`**${tierDisplay}** × ${amount}`)
        .setColor(0x1a1a1a);

    // Clean reward sections
    const rewardSections = [];
    
    // Beli section
    rewardSections.push({
        name: 'Beli',
        value: `\`+${totalBeli.toLocaleString()}\``,
        inline: true
    });

    if (allItems.length > 0) {
        // Count items
        const itemCounts = {};
        allItems.forEach(item => {
            itemCounts[item] = (itemCounts[item] || 0) + 1;
        });
        
        const itemText = Object.entries(itemCounts)
            .map(([item, count]) => `**${item}**${count > 1 ? ` ×${count}` : ''}`)
            .join('\n');
        
        rewardSections.push({
            name: 'Items',
            value: itemText,
            inline: true
        });
    }

    if (allCards.length > 0) {
        // Count cards
        const cardCounts = {};
        allCards.forEach(card => {
            const key = `[${card.rank}] ${card.name}`;
            cardCounts[key] = (cardCounts[key] || 0) + 1;
        });
        
        const cardText = Object.entries(cardCounts)
            .map(([card, count]) => `**${card}**${count > 1 ? ` ×${count}` : ''}`)
            .join('\n');
        
        rewardSections.push({
            name: 'Cards',
            value: cardText,
            inline: true
        });
    }

    embed.addFields(rewardSections);
    
    // Add remaining chest count
    embed.addFields({
        name: '\u200b',
        value: `**Remaining:** \`${user.chests[tier]}\` ${tierDisplay.toLowerCase()} chest${user.chests[tier] === 1 ? '' : 's'}`,
        inline: false
    });
    
    embed.setFooter({ text: 'Rewards are randomly generated' });

    return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };