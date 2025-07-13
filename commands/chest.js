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
    const embed = new EmbedBuilder()
        .setTitle(`${CHEST_TIERS[tier].emoji} Chest Opening Results`)
        .setDescription(`Opened ${amount} ${CHEST_TIERS[tier].name}${amount > 1 ? 's' : ''}!`)
        .setColor(0x2c2f33);

    let rewardsText = `💰 **+${totalBeli.toLocaleString()} Beli**\n`;

    if (allItems.length > 0) {
        // Count items
        const itemCounts = {};
        allItems.forEach(item => {
            itemCounts[item] = (itemCounts[item] || 0) + 1;
        });
        
        const itemText = Object.entries(itemCounts)
            .map(([item, count]) => `📦 **${item}**${count > 1 ? ` x${count}` : ''}`)
            .join('\n');
        rewardsText += itemText + '\n';
    }

    if (allCards.length > 0) {
        // Count cards
        const cardCounts = {};
        allCards.forEach(card => {
            const key = `${card.name} (${card.rank})`;
            cardCounts[key] = (cardCounts[key] || 0) + 1;
        });
        
        const cardText = Object.entries(cardCounts)
            .map(([card, count]) => `🎴 **${card}**${count > 1 ? ` x${count}` : ''}`)
            .join('\n');
        rewardsText += cardText;
    }

    embed.addFields({ name: 'Rewards', value: rewardsText, inline: false });
    embed.addFields({ name: 'Remaining Chests', value: `${CHEST_TIERS[tier].emoji} ${user.chests[tier]}`, inline: true });
    embed.setFooter({ text: 'Chest rewards are random!' });

    return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };