const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const data = new SlashCommandBuilder()
  .setName('tutorial')
  .setDescription('View the complete game tutorial guide.');

async function execute(message) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });
  if (!user) {
    return message.reply('Start your journey with `op start` first!');
  }

  const embed = new EmbedBuilder()
    .setTitle('🏴‍☠️ One Piece Bot Tutorial')
    .setDescription('Welcome to the One Piece Bot! Here\'s everything you need to know to start your pirate adventure:')
    .setColor(0x2b2d31)
    .addFields([
      {
        name: '🚀 Getting Started',
        value: '• Use `op start` to create your account and begin your adventure\n• You only need to do this once!',
        inline: false
      },
      {
        name: '🃏 Card System',
        value: '• Use `op collection` to see all your cards\n• Use `op pull` to get new cards (free daily pulls!)\n• Use `op mycard <card>` to view detailed card stats\n• Cards gain XP from battles and can level up',
        inline: false
      },
      {
        name: '⚔️ Battles & Exploration',
        value: '• Use `op explore` to go on adventures and find rare items\n• Use `op duel @user` to battle other players\n• Use `op team` to set up your battle team\n• Use `op team add <card>` to add cards to your team',
        inline: false
      },
      {
        name: '🎒 Inventory & Items',
        value: '• Use `op inventory` to see your items\n• Use `op shop` to buy useful items\n• Potions can be used in battles to heal your cards\n• Items are automatically organized by category',
        inline: false
      },
      {
        name: '⚙️ Equipment System',
        value: '• Use `op equip <item> <card>` to equip weapons/armor\n• Use `op eat <fruit> <card>` to feed devil fruits (permanent!)\n• Equipment provides stat bonuses in battles\n• View equipped items with `op equip`',
        inline: false
      },
      {
        name: '🌟 Card Evolution',
        value: '• Some cards can evolve into stronger forms\n• Use `op evolve <card>` to upgrade when requirements are met\n• Evolution requires specific levels and sometimes items\n• Evolved cards have better stats and abilities',
        inline: false
      },
      {
        name: '🗺️ Progress Tracking',
        value: '• Use `op map` to see your adventure progress\n• Use `op progress` for a quick status overview\n• Complete locations to unlock new areas\n• Each saga has unique rewards and challenges',
        inline: false
      },
      {
        name: '🎯 Quests & Daily Activities',
        value: '• Use `op quest` to see daily and weekly quests\n• Use `op daily` to claim daily rewards\n• Complete quests for bonus XP, items, and beli\n• Daily activities reset every 24 hours',
        inline: false
      },
      {
        name: '⛵ Advanced Features',
        value: '• Use `op sail` to explore the Grand Line (unlocked after East Blue)\n• Use `op chest` to open treasure chests you find\n• Use `op bounty` to see top bounty rankings\n• Use `op help` for a complete command list',
        inline: false
      },
      {
        name: '💡 Pro Tips',
        value: '• Keep your team balanced with different card types\n• Save rare items for important battles\n• Level up cards evenly for best team synergy\n• Explore regularly to find new cards and items\n• Join the community for tips and strategies!',
        inline: false
      }
    ])
    .setFooter({ text: 'Good luck on your pirate adventure, Captain! Use op help for more commands.' });

  try {
    // Send tutorial to DMs
    const dm = await message.author.createDM();
    await dm.send({ embeds: [embed] });
    await message.reply('📖 Tutorial sent to your DMs! Check your direct messages for the complete guide.');
    
    // Mark tutorial as completed and give starter rewards
    if (!user.tutorial || !user.tutorial.completed) {
      user.tutorial = { completed: true };
      
      // Give starter rewards
      if (!user.inventory) user.inventory = [];
      user.inventory.push('basicpotion');
      user.xp = (user.xp || 0) + 50;
      
      await user.save();
    }
  } catch (error) {
    // If DMs are disabled, send in channel
    await message.reply({ embeds: [embed] });
  }
}

module.exports = { data, execute };
