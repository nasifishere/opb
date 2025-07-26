const mongoose = require('mongoose');
const User = require('../db/models/User.js');
const config = require('../config.json');
const { normalize, getEvolutionChain, getXPFromDuplicate } = require('../utils/cardTransformationSystem.js');

async function removeDuplicates() {
    try {
        console.log('🔗 Connecting to database...');
        await mongoose.connect(config.mongoURI);
        console.log('✅ Connected to database');

        console.log('🔍 Finding users with cards...');
        const users = await User.find({ 
            $and: [
                { cards: { $exists: true } },
                { cards: { $ne: [] } },
                { 'cards.1': { $exists: true } } // Has at least 2 cards
            ]
        });

        console.log(`📊 Found ${users.length} users with multiple cards`);

        let totalDuplicatesRemoved = 0;
        let totalXPAwarded = 0;
        let usersProcessed = 0;

        for (const user of users) {
            if (!user.cards || user.cards.length < 2) continue;

            let duplicatesInThisUser = 0;
            let xpInThisUser = 0;
            const cardsToKeep = [];
            const processedEvolutionChains = new Set();

            // Group cards by evolution chain
            const evolutionGroups = {};
            
            for (const card of user.cards) {
                const evolutionChain = getEvolutionChain(card.name);
                const chainKey = evolutionChain.join('|');
                
                if (!evolutionGroups[chainKey]) {
                    evolutionGroups[chainKey] = [];
                }
                evolutionGroups[chainKey].push(card);
            }

            // Process each evolution chain group
            for (const [chainKey, cardsInChain] of Object.entries(evolutionGroups)) {
                if (cardsInChain.length === 1) {
                    // No duplicates in this chain, keep the card
                    cardsToKeep.push(cardsInChain[0]);
                    continue;
                }

                // Find the highest evolved card in this chain
                const evolutionChain = chainKey.split('|');
                let bestCard = null;
                let bestCardIndex = -1;

                for (const card of cardsInChain) {
                    const cardIndex = evolutionChain.findIndex(name => normalize(name) === normalize(card.name));
                    if (cardIndex > bestCardIndex) {
                        bestCardIndex = cardIndex;
                        bestCard = card;
                    }
                }

                if (!bestCard) {
                    // Fallback: keep the first card
                    bestCard = cardsInChain[0];
                }

                // Calculate total XP from duplicates
                let totalXPForThisCard = bestCard.experience || 0;
                
                for (const card of cardsInChain) {
                    if (card !== bestCard) {
                        // This is a duplicate, convert to XP
                        const xpFromDuplicate = getXPFromDuplicate(card.rank);
                        const xpFromCardLevel = (card.experience || 0);
                        totalXPForThisCard += xpFromDuplicate + xpFromCardLevel;
                        
                        duplicatesInThisUser++;
                        xpInThisUser += xpFromDuplicate;
                        
                        console.log(`  🔄 Converting duplicate [${card.rank}] ${card.name} to ${xpFromDuplicate} XP`);
                    }
                }

                // Update the best card with combined XP and level
                bestCard.experience = totalXPForThisCard;
                const newLevel = Math.floor(totalXPForThisCard / 100) + 1;
                const oldLevel = bestCard.level || 1;
                
                if (newLevel > oldLevel) {
                    bestCard.level = newLevel;
                    console.log(`  📈 [${bestCard.rank}] ${bestCard.name} leveled up from ${oldLevel} to ${newLevel}`);
                }

                cardsToKeep.push(bestCard);
            }

            if (duplicatesInThisUser > 0) {
                console.log(`👤 User ${user.username || user.userId}: Removed ${duplicatesInThisUser} duplicates, awarded ${xpInThisUser} XP`);
                
                // Update user's cards array
                user.cards = cardsToKeep;
                user.markModified('cards');
                
                // Save the user
                await user.save();
                
                totalDuplicatesRemoved += duplicatesInThisUser;
                totalXPAwarded += xpInThisUser;
                usersProcessed++;
            }
        }

        console.log('\n📊 SUMMARY:');
        console.log(`✅ Users processed: ${usersProcessed}`);
        console.log(`🗑️ Total duplicates removed: ${totalDuplicatesRemoved}`);
        console.log(`⭐ Total XP awarded: ${totalXPAwarded.toLocaleString()}`);

        if (totalDuplicatesRemoved === 0) {
            console.log('🎉 No duplicates found! All users have unique cards.');
        } else {
            console.log('🎉 Duplicate removal completed successfully!');
        }

    } catch (error) {
        console.error('❌ Error removing duplicates:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

// Run the script
console.log('🚀 Starting duplicate card removal process...');
console.log('⚠️  This will remove all duplicate cards and convert them to XP');
console.log('💾 Backup your database before running this script!\n');

removeDuplicates()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });