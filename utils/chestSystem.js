const fs = require('fs');
const path = require('path');

// Load shop data for chest rewards
let shopData = {};
try {
    const shopPath = path.join(__dirname, '../data/shop.json');
    const shopContent = fs.readFileSync(shopPath, 'utf8');
    shopData = JSON.parse(shopContent);
} catch (error) {
    console.error('Error loading shop data for chest system:', error);
}

// Chest tier definitions
const CHEST_TIERS = {
    'C': {
        name: 'Common Chest',
        emoji: '📦',
        beliRange: [80, 120],
        itemChance: 0.3,
        cardChance: 0.1,
        itemRarity: 'common',
        cardRarity: 'C'
    },
    'B': {
        name: 'Uncommon Chest',
        emoji: '🎁',
        beliRange: [800, 1200],
        itemChance: 0.6,
        cardChance: 0.2,
        itemRarity: 'uncommon',
        cardRarity: 'B'
    },
    'A': {
        name: 'Rare Chest',
        emoji: '💎',
        beliRange: [2000, 3000],
        itemChance: 0.8,
        cardChance: 0.3,
        itemRarity: 'rare',
        cardRarity: 'A'
    },
    'S': {
        name: 'Epic Chest',
        emoji: '🏆',
        beliRange: [5000, 8000],
        itemChance: 0.9,
        cardChance: 0.4,
        itemRarity: 'epic',
        cardRarity: 'S'
    },
    'UR': {
        name: 'Legendary Chest',
        emoji: '👑',
        beliRange: [10000, 15000],
        itemChance: 1.0,
        cardChance: 0.5,
        itemRarity: 'legendary',
        cardRarity: 'UR'
    }
};

// Get random item from shop data based on rarity
function getRandomItemByRarity(rarity) {
    const allItems = [];
    
    // Collect all items from different categories
    if (shopData.potions) {
        allItems.push(...shopData.potions);
    }
    if (shopData.equipment) {
        allItems.push(...shopData.equipment);
    }
    if (shopData.items) {
        allItems.push(...shopData.items);
    }
    if (shopData.consumables) {
        allItems.push(...shopData.consumables);
    }
    if (shopData.special) {
        allItems.push(...shopData.special);
    }
    
    // Filter by rarity
    const itemsOfRarity = allItems.filter(item => item.rarity === rarity);
    
    if (itemsOfRarity.length === 0) {
        // Fallback to common items if no items of specified rarity
        const commonItems = allItems.filter(item => item.rarity === 'common');
        if (commonItems.length === 0) {
            // If no common items, return any item
            return allItems[0] || null;
        }
        return commonItems[Math.floor(Math.random() * commonItems.length)];
    }
    
    return itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];
}

// Get random card by rarity
function getRandomCardByRarity(rarity) {
    // Load cards data
    let cardsData = [];
    try {
        const cardsPath = path.join(__dirname, '../data/cards.json');
        const cardsContent = fs.readFileSync(cardsPath, 'utf8');
        cardsData = JSON.parse(cardsContent);
    } catch (error) {
        console.error('Error loading cards data for chest system:', error);
        return null;
    }
    
    // Filter cards by rarity
    const cardsOfRarity = cardsData.filter(card => card.rank === rarity);
    
    if (cardsOfRarity.length === 0) {
        // Fallback to C rank cards
        return cardsData.filter(card => card.rank === 'C')[0] || null;
    }
    
    return cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
}

// Generate chest rewards
function generateChestRewards(tier) {
    const chestConfig = CHEST_TIERS[tier];
    if (!chestConfig) {
        console.error(`Invalid chest tier: ${tier}`);
        return { beli: 100 };
    }
    
    const rewards = {
        beli: Math.floor(Math.random() * (chestConfig.beliRange[1] - chestConfig.beliRange[0] + 1)) + chestConfig.beliRange[0],
        items: [],
        cards: []
    };
    
    // Generate item reward
    if (Math.random() < chestConfig.itemChance) {
        const item = getRandomItemByRarity(chestConfig.itemRarity);
        if (item) {
            rewards.items.push(item.name);
        }
    }
    
    // Generate card reward
    if (Math.random() < chestConfig.cardChance) {
        const card = getRandomCardByRarity(chestConfig.cardRarity);
        if (card) {
            rewards.cards.push({
                name: card.name,
                rank: card.rank
            });
        }
    }
    
    return rewards;
}

// Format chest rewards for display
function formatChestRewards(tier, rewards) {
    const chestConfig = CHEST_TIERS[tier];
    let text = `${chestConfig.emoji} **${chestConfig.name}**\n`;
    text += `💰 +${rewards.beli.toLocaleString()} Beli\n`;
    
    if (rewards.items.length > 0) {
        text += `📦 **${rewards.items.join(', ')}**\n`;
    }
    
    if (rewards.cards.length > 0) {
        rewards.cards.forEach(card => {
            text += `🎴 **[${card.rank}] ${card.name}**\n`;
        });
    }
    
    return text;
}

// Get chest tier by name
function getChestTierByName(name) {
    const tierMap = {
        'C': 'C',
        'B': 'B', 
        'A': 'A',
        'S': 'S',
        'UR': 'UR',
        'common': 'C',
        'uncommon': 'B',
        'rare': 'A',
        'epic': 'S',
        'legendary': 'UR'
    };
    
    return tierMap[name] || 'C';
}

module.exports = {
    CHEST_TIERS,
    generateChestRewards,
    formatChestRewards,
    getChestTierByName
};