const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { sagas } = require('../utils/sagas.js');

function getCurrentLocation(stage) {
    if (stage < 7) return 'Windmill Village';
    if (stage < 16) return 'Shells Town';
    if (stage < 24) return 'Orange Town';
    if (stage < 29) return 'Syrup Village';
    if (stage < 34) return 'Baratie';
    if (stage < 43) return 'Arlong Park';
    return 'East Blue Complete';
}

function getLocalStage(globalStage) {
    if (globalStage < 7) return globalStage;
    if (globalStage < 16) return globalStage - 7;
    if (globalStage < 24) return globalStage - 16;
    if (globalStage < 29) return globalStage - 24;
    if (globalStage < 34) return globalStage - 29;
    if (globalStage < 43) return globalStage - 34;
    return 0;
}

function getTotalStagesInLocation(location) {
    const stageCounts = {
        'Windmill Village': 7,
        'Shells Town': 9,
        'Orange Town': 8,
        'Syrup Village': 5,
        'Baratie': 5,
        'Arlong Park': 9
    };
    return stageCounts[location] || 0;
}

// Modern progress bar without colors
function createModernProgressBar(current, max, width = 12) {
    const percentage = Math.min(current / max, 1);
    const filled = Math.floor(percentage * width);
    const empty = width - filled;
    
    let bar = '';
    if (filled > 0) {
        bar += '▰'.repeat(filled);
    }
    if (empty > 0) {
        bar += '▱'.repeat(empty);
    }
    
    return bar;
}

const data = new SlashCommandBuilder()
    .setName('map')
    .setDescription('View your adventure progress and current location');

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

    // Determine current saga (default to East Blue)
    let sagaIndex = 0;
    if (args && args[0] && !isNaN(args[0])) {
        sagaIndex = Math.max(0, Math.min(sagas.length - 1, parseInt(args[0])));
    }
    let saga = sagas[sagaIndex];

    // Map saga to locations and stages
    const sagaLocations = {
        'East Blue': [
            { name: 'Windmill Village', stages: 7, startStage: 0 },
            { name: 'Shells Town', stages: 9, startStage: 7 },
            { name: 'Orange Town', stages: 8, startStage: 16 },
            { name: 'Syrup Village', stages: 5, startStage: 24 },
            { name: 'Baratie', stages: 5, startStage: 29 },
            { name: 'Arlong Park', stages: 9, startStage: 34 }
        ],
        'Alabasta': [
            { name: 'Reverse Mountain', stages: 7, startStage: 43 },
            { name: 'Whiskey Peak', stages: 8, startStage: 50 },
            { name: 'Little Garden', stages: 8, startStage: 58 },
            { name: 'Drum Island', stages: 9, startStage: 66 },
            { name: 'Arabasta', stages: 15, startStage: 75 }
        ]
        // Add more sagas as needed
    };
    const locations = sagaLocations[saga] || [];

    // Calculate progress for this saga
    const currentStage = user.stage || 0;
    let progressText = '';
    locations.forEach(location => {
        const locationEnd = location.startStage + location.stages;
        let progress = 0;
        if (currentStage >= locationEnd) {
            progress = location.stages;
        } else if (currentStage >= location.startStage) {
            progress = currentStage - location.startStage;
        }
        const progressBar = createModernProgressBar(progress, location.stages, 8);
        const percentage = Math.round((progress / location.stages) * 100);
        progressText += `**${location.name}**\n`;
        progressText += `${progressBar} ${progress}/${location.stages} (${percentage}%)\n\n`;
    });

    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle(`${saga} Saga Progress`)
        .setDescription(`**Current Saga:** ${saga}`)
        .addFields({ name: `${saga} Locations`, value: progressText.trim(), inline: false })
        .setFooter({ text: 'Use /explore to continue your adventure • Progress saves automatically' });

    // Add Next/Previous buttons
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('prev_saga')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(sagaIndex === 0),
        new ButtonBuilder()
            .setCustomId('next_saga')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(sagaIndex === sagas.length - 1)
    );

    const reply = await message.reply({ embeds: [embed], components: [row] });

    // Button interaction collector
    const filter = i => i.user.id === message.author.id;
    const collector = reply.createMessageComponentCollector({ filter, time: 60000 });
    collector.on('collect', async interaction => {
        let newSagaIndex = sagaIndex;
        if (interaction.customId === 'prev_saga') newSagaIndex--;
        if (interaction.customId === 'next_saga') newSagaIndex++;
        newSagaIndex = Math.max(0, Math.min(sagas.length - 1, newSagaIndex));
        // Re-run execute with new saga index
        await execute({ ...message, reply: interaction.reply.bind(interaction) }, [newSagaIndex]);
        await interaction.deferUpdate();
    });
    collector.on('end', () => {
        reply.edit({ components: [] }).catch(() => {});
    });
}

module.exports = { data, execute };
