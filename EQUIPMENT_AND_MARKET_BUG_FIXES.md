# Bug Fixes and New Training System Summary

## Issues Identified and Fixed

### Bug #1: Equipment Not Showing for Some Users

**Problem**: Users reported that equipment was working for some users but not others. The equipment would appear equipped but not show properly in commands.

**Root Cause**: 
1. In `commands/unequip.js`, when unequipping items, the item name was added directly to inventory without normalization
2. However, when equipping items, they are normalized (lowercase, no spaces) before being stored
3. This created a mismatch where the inventory would contain non-normalized item names that couldn't be found by the equip command
4. Missing `markModified('equipped')` call could also cause save issues with the Mixed type

**Files Fixed**:
- `commands/unequip.js`

**Changes Made**:
- Added proper normalization when returning items to inventory: `user.inventory.push(normalize(equippedItem))`
- Added missing `markModified` calls for both `equipped` and `inventory` fields
- Improved error handling and code consistency

### Bug #2: Market Purchase Not Giving Items to Buyers

**Problem**: A user bought a level 2 S rank card from the market but didn't receive it in their collection.

**Root Cause**:
1. In `commands/market.js` purchase function, when adding cards to buyer's collection, the card object was missing required properties:
   - Missing `experience: 0` field
   - Missing `locked: false` field
2. Missing `markModified` calls for `cards` and `inventory` arrays, which are required when modifying arrays in Mongoose Mixed types
3. Inconsistency between market purchase implementations

**Files Fixed**:
- `commands/market.js` (both `handleMarketBuy` and `handleMarketUnlist` functions)

**Changes Made**:
- Added missing card properties when creating card objects:
  ```javascript
  user.cards.push({
      name: listing.itemName,
      rank: listing.itemRank,
      level: listing.itemLevel || 1,
      experience: 0,           // Added
      timesUpgraded: 0,
      locked: false            // Added
  });
  ```
- Added proper `markModified` calls for arrays:
  ```javascript
  user.markModified('cards');
  user.markModified('inventory');
  ```

## Testing Recommendations

1. **Equipment Testing**:
   - Equip an item to a card
   - Unequip the item
   - Verify the item appears in inventory with proper normalization
   - Re-equip the same item to ensure it works

2. **Market Testing**:
   - List a card on the market
   - Purchase the card with a different user
   - Verify the card appears in buyer's collection with all properties
   - Check that the card shows up in `op collection` and `op mycard` commands

## Notes

- These fixes ensure data consistency across the equipment and market systems
- The normalization approach keeps items consistent throughout the codebase
- Proper `markModified` calls are crucial for Mongoose Mixed types and arrays
- All card objects now include required fields preventing undefined property issues

## Additional Fixes Applied

During the investigation, I found similar missing property issues in other commands that create cards:

### Fixed Files:
- `commands/chest.js` - Added missing `locked: false` property
- `commands/pull.js` - Added missing `level: 1`, `experience: 0`, and `locked: false` properties
- `utils/MarketSystem.js` - Added missing `experience: 0` property in both purchase and unlist functions

### Cards Created Without Proper Schema:
These fixes ensure all card objects have the complete schema as defined in the User model:
```javascript
{
    name: String,
    rank: String, 
    level: Number (default: 1),
    experience: Number (default: 0),
    timesUpgraded: Number (default: 0),
    locked: Boolean (default: false)
}
```

## New Feature: Training System

### Overview
Added a complete training system that allows players to train cards to gain experience while they're away from the game.

### Key Features:
- **XP Rate**: 1 XP per minute of training
- **Capacity**: Maximum 3 cards can be trained simultaneously  
- **Duration Limit**: Cards auto-untrain after 1 week with notification
- **Accessibility**: Training cards cannot be accessed through any other commands

### Implementation:
- **New Database Schema**: Added `training` array to User model
- **Core System**: `utils/trainingSystem.js` handles all training logic
- **Commands**:
  - `op train <card>` - Start training a card
  - `op untrain <card>` - Stop training and get card back with accumulated XP
  - `op train` (no args) - View current training status
- **Integration**: Auto-untrain functionality integrated into existing reset system
- **Protection**: Updated commands to prevent interaction with training cards:
  - `team.js` - Cannot add training cards to team
  - `sell.js` - Cannot sell training cards  
  - `collection.js` - Training cards hidden from collection view

### Files Created/Modified:
- `db/models/User.js` - Added training schema
- `utils/trainingSystem.js` - Core training functionality
- `utils/resetSystem.js` - Added auto-untrain cleanup
- `commands/train.js` - Training command
- `commands/untrain.js` - Untrain command
- `commands/team.js` - Added training card protection
- `commands/sell.js` - Added training card protection
- `commands/collection.js` - Filter out training cards
- `commands/help.js` - Added training commands to help

## Impact

These fixes and new features provide:
- Equipment not showing properly for users ✅ **FIXED**
- Market purchases failing to deliver items ✅ **FIXED** 
- Data inconsistency issues between different commands ✅ **FIXED**
- Potential save issues with Mongoose Mixed types ✅ **FIXED**
- Cards created with incomplete schemas causing undefined property errors ✅ **FIXED**
- Consistency across all card creation points in the codebase ✅ **FIXED**
- **NEW**: Complete training system for late-game progression ✅ **ADDED**
- **NEW**: Automatic cleanup of expired training sessions ✅ **ADDED**