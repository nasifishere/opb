const User = require('../db/models/User.js');

// Items to remove from inventories
const INVALID_ITEMS = ['treasuremapfragment', 'healingpotion'];

async function cleanupInvalidItems() {
    try {
        console.log('🧹 Starting cleanup of invalid items...');
        
        // Find all users with inventories
        const users = await User.find({ inventory: { $exists: true, $ne: [] } });
        console.log(`📊 Found ${users.length} users with inventories`);
        
        let totalRemoved = 0;
        let usersAffected = 0;
        
        for (const user of users) {
            let userInventory = user.inventory;
            let userChanged = false;
            let userRemovedCount = 0;
            
            // Handle both array and object inventory formats
            if (Array.isArray(userInventory)) {
                // Array format - filter out invalid items
                const originalLength = userInventory.length;
                user.inventory = userInventory.filter(item => {
                    const normalizedItem = String(item).toLowerCase().replace(/\s+/g, '');
                    return !INVALID_ITEMS.includes(normalizedItem);
                });
                userRemovedCount = originalLength - user.inventory.length;
                userChanged = userRemovedCount > 0;
            } else if (typeof userInventory === 'object' && userInventory !== null) {
                // Object format - remove invalid item keys
                for (const invalidItem of INVALID_ITEMS) {
                    if (userInventory[invalidItem]) {
                        userRemovedCount += userInventory[invalidItem];
                        delete userInventory[invalidItem];
                        userChanged = true;
                    }
                }
                user.inventory = userInventory;
            }
            
            if (userChanged) {
                user.markModified('inventory');
                await user.save();
                usersAffected++;
                totalRemoved += userRemovedCount;
                console.log(`🗑️  Removed ${userRemovedCount} invalid items from user ${user.username || user.userId}`);
            }
        }
        
        console.log('📈 Cleanup Summary:');
        console.log(`✅ Users processed: ${users.length}`);
        console.log(`🎯 Users affected: ${usersAffected}`);
        console.log(`🗑️  Total items removed: ${totalRemoved}`);
        console.log(`📦 Invalid items cleaned: ${INVALID_ITEMS.join(', ')}`);
        
        return { usersProcessed: users.length, usersAffected, totalRemoved };
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    }
}

module.exports = { cleanupInvalidItems };