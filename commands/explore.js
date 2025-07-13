const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { addCardWithTransformation } = require('../utils/cardTransformationSystem.js');
const { calculateBattleStats, calculateDamage, resetTeamHP } = require('../utils/battleSystem.js');
const { distributeXPToTeam, XP_PER_LEVEL } = require('../utils/levelSystem.js');
const { saveUserWithRetry } = require('../utils/saveWithRetry.js');
const path = require('path');
const fs = require('fs');
const { createProfessionalTeamDisplay, createEnemyDisplay, createBattleLogDisplay, createBattleStatusDisplay } = require('../utils/uiHelpers.js');

// Location data based on your specifications
const LOCATIONS = {
    'WINDMILL VILLAGE': [
        {
            type: "narrative",
            title: "Your Journey Commences",
            desc: "You ate the Gum-Gum Fruit! Your rubber powers awaken as your adventure begins in Windmill Village.",
            reward: { type: "xp", amount: 50 }
        },
        {
            type: "narrative",
            title: "Meeting Shanks",
            desc: "You encounter the legendary Red-Haired Shanks at the bar. His presence fills you with determination.",
            reward: { type: "beli", amount: 50 }
        },
        {
            type: "narrative",
            title: "Set Out to Sea",
            desc: "You prepare to leave Windmill Village behind and chase your dream of becoming Pirate King!",
            reward: { type: "xp", amount: 25 }
        },
        {
            type: "boss",
            title: "Fight with Higuma",
            desc: "The mountain bandit Higuma blocks your path!",
            enemy: { name: "Higuma", hp: 75, atk: [10, 12], spd: 50, rank: "C" },
            reward: { type: "multiple", rewards: [
                { type: "beli", amount: 100 },
                { type: "xp", amount: 50 }
            ]},
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Shanks' Sacrifice",
            desc: "The Sea King attacks! Shanks loses his arm saving you. His sacrifice strengthens your resolve.",
            reward: { type: "item", name: "Basic Potion" }
        },
        {
            type: "narrative",
            title: "Arrived at Romance Dawn",
            desc: "You finally arrive at Romance Dawn Island, ready to begin your grand adventure!",
            reward: { type: "beli", amount: 75 }
        },
        {
            type: "narrative",
            title: "Final Departure",
            desc: "With Shanks' hat on your head, you set sail to begin your grand adventure!",
            reward: { type: "xp", amount: 75 }
        }
    ],
    'SHELLS TOWN': [
        {
            type: "narrative", 
            title: "Arrival at Shells Town",
            desc: "You arrive at the Marine base town, seeking your first crew member.",
            reward: { type: "xp", amount: 30 }
        },
        {
            type: "narrative",
            title: "Meet Coby",
            desc: "You encounter the timid Coby, who dreams of becoming a Marine. He tells you about the famous pirate hunter Zoro.",
            reward: { type: "xp", amount: 30 }
        },
        {
            type: "choice",
            title: "Free Zoro?",
            desc: "You find Zoro tied up in the Marine base courtyard. Do you want to free the legendary pirate hunter?",
            choice: {
                yes: { type: "card", name: "Roronoa Zoro", rank: "C" },
                no: { type: "beli", amount: 25 }
            }
        },
        {
            type: "enemy",
            title: "Fight Helmeppo",
            desc: "The spoiled Marine captain's son challenges you!",
            enemy: { name: "Helmeppo", hp: 20, atk: [1, 2], spd: 30, rank: "D" },
            reward: { type: "multiple", rewards: [
                { type: "beli", amount: 50 },
                { type: "xp", amount: 25 }
            ]},
            loseCooldown: 30 * 60 * 1000
        },
        {
            type: "multi_enemy",
            title: "Fight Marine Squad",
            desc: "Three Marines block your escape!",
            enemies: [
                { name: "Marine Grunt #1", hp: 15, atk: [2, 4], spd: 25, rank: "D" },
                { name: "Marine Grunt #2", hp: 15, atk: [2, 4], spd: 25, rank: "D" },
                { name: "Marine Grunt #3", hp: 15, atk: [2, 4], spd: 25, rank: "D" }
            ],
            reward: { type: "multiple", rewards: [
                { type: "beli", amount: 75 },
                { type: "xp", amount: 40 }
            ]},
            loseCooldown: 45 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Gathering Strength",
            desc: "You and your crew prepare for the upcoming battle against Captain Morgan.",
            reward: { type: "item", name: "Rusty Cutlass" }
        },
        {
            type: "boss",
            title: "Captain Morgan",
            desc: "The tyrannical Axe-Hand Morgan appears to stop you!",
            enemy: { name: "Captain Morgan", hp: 100, atk: [12, 15], spd: 60, rank: "C" },
            reward: { type: "beli", amount: 200, xp: 100 },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Reached Orange Town",
            desc: "With Morgan defeated, you sail toward Orange Town where new adventures await.",
            reward: { type: "beli", amount: 100 }
        }
    ],
    'ORANGE TOWN': [
        {
            type: "narrative",
            title: "Meet Nami",
            desc: "You encounter a clever orange-haired thief named Nami. She seems interested in your crew but remains cautious.",
            reward: { type: "xp", amount: 40 }
        },
        {
            type: "narrative",
            title: "Buggy's Terror",
            desc: "The town is in chaos! Buggy the Clown's crew has been terrorizing the innocent villagers.",
            reward: { type: "beli", amount: 60 }
        },
        {
            type: "narrative",
            title: "Planning the Attack",
            desc: "You devise a strategy to take down Buggy's crew and free the town from their reign of terror.",
            reward: { type: "item", name: "Normal Potion" }
        },
        {
            type: "narrative",
            title: "Circus Preparation",
            desc: "Buggy's crew prepares for their deadly circus performance. The tension in the air is thick.",
            reward: { type: "xp", amount: 35 }
        },
        {
            type: "enemy",
            title: "Fight Cabaji",
            desc: "Buggy's acrobatic swordsman Cabaji challenges you to a duel!",
            enemy: { name: "Cabaji", hp: 70, atk: [10, 15], spd: 70, rank: "C" },
            reward: { type: "beli", amount: 120, xp: 60 },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "boss",
            title: "Buggy the Clown",
            desc: "The Devil Fruit user Buggy appears! His Chop-Chop powers make sword attacks useless!",
            enemy: { name: "Buggy", hp: 120, atk: [15, 20], spd: 65, rank: "B", ability: "sword_immunity" },
            reward: { type: "beli", amount: 300, xp: 120 },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Nami Joins!",
            desc: "Impressed by your victory over Buggy, Nami officially joins your crew as navigator!",
            reward: { type: "card", name: "Nami", rank: "C" }
        }
    ],
    'SYRUP VILLAGE': [
        {
            type: "narrative",
            title: "Peaceful Village",
            desc: "You arrive at the seemingly peaceful Syrup Village, unaware of the danger lurking beneath.",
            reward: { type: "beli", amount: 80 }
        },
        {
            type: "narrative",
            title: "Meet Usopp",
            desc: "You meet the village storyteller Usopp, who dreams of becoming a brave warrior of the sea!",
            reward: { type: "card", name: "Usopp", rank: "C" }
        },
        {
            type: "multi_enemy",
            title: "Fight Sham and Buchi",
            desc: "The cat brothers of the Black Cat Pirates attack!",
            enemies: [
                { name: "Sham", hp: 70, atk: [10, 10], spd: 55, rank: "C" },
                { name: "Buchi", hp: 70, atk: [10, 10], spd: 55, rank: "C" }
            ],
            reward: { type: "multiple", rewards: [
                { type: "beli", amount: 150 },
                { type: "xp", amount: 80 }
            ]},
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "boss",
            title: "Captain Kuro",
            desc: "The cunning Captain Kuro reveals himself! His incredible speed gives him the first strike!",
            enemy: { name: "Captain Kuro", hp: 130, atk: [17, 22], spd: 90, rank: "B", ability: "first_strike" },
            reward: { type: "beli", amount: 400, xp: 150 },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Go to Baratie",
            desc: "With Kuro defeated, you set sail for the floating restaurant Baratie!",
            reward: { type: "xp", amount: 60 }
        }
    ],
    'BARATIE': [
        {
            type: "narrative",
            title: "Speed Boost Food",
            desc: "The chefs at Baratie prepare special dishes that enhance your crew's speed!",
            reward: { type: "item", name: "Basic Potion", count: 2 }
        },
        {
            type: "narrative",
            title: "Meet Sanji",
            desc: "You meet the passionate cook Sanji, whose kicks are as fiery as his cooking!",
            reward: { type: "card", name: "Sanji", rank: "B" }
        },
        {
            type: "narrative",
            title: "Mihawk Appears",
            desc: "The World's Greatest Swordsman, Dracule Mihawk, makes a brief but intimidating appearance.",
            reward: { type: "xp", amount: 100 }
        },
        {
            type: "boss",
            title: "Don Krieg",
            desc: "The armored pirate Don Krieg attacks! His armor reflects damage back to attackers!",
            enemy: { name: "Don Krieg", hp: 150, atk: [18, 25], spd: 80, rank: "A", ability: "damage_reflection" },
            reward: { type: "beli", amount: 500, xp: 200 },
            loseCooldown: 120 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Reach Arlong Park",
            desc: "Your crew sets sail for the dangerous waters of Arlong Park, Nami's troubled past awaits.",
            reward: { type: "beli", amount: 120 }
        }
    ],
    'ARLONG PARK': [
        {
            type: "narrative",
            title: "Nami's Past",
            desc: "You learn the truth about Nami's connection to the fish-men and her tragic past.",
            reward: { type: "xp", amount: 80 }
        },
        {
            type: "narrative",
            title: "Fish-Man Supremacy",
            desc: "The fish-men boast about their superiority over humans. Their arrogance fuels your determination.",
            reward: { type: "beli", amount: 100 }
        },
        {
            type: "narrative",
            title: "Preparing for War",
            desc: "You rally the villagers and prepare for the final battle against Arlong's crew.",
            reward: { type: "item", name: "Marine Saber" }
        },
        {
            type: "enemy",
            title: "Fight Chew",
            desc: "The fish-man Chew attacks with his water-spitting abilities!",
            enemy: { name: "Chew", hp: 80, atk: [15, 15], spd: 60, rank: "C" },
            reward: { type: "beli", amount: 130, xp: 70 },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "enemy",
            title: "Fight Kuroobi",
            desc: "The ray fish-man Kuroobi demonstrates his fish-man karate!",
            enemy: { name: "Kuroobi", hp: 80, atk: [16, 16], spd: 65, rank: "C" },
            reward: { type: "beli", amount: 140, xp: 75 },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "enemy",
            title: "Fight Hachi",
            desc: "The six-sword wielding octopus fish-man Hachi blocks your path!",
            enemy: { name: "Hachi", hp: 80, atk: [17, 17], spd: 70, rank: "C" },
            reward: { type: "beli", amount: 150, xp: 80 },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "boss",
            title: "Arlong",
            desc: "The saw-shark fish-man Arlong emerges for the final battle! His reign of terror ends here!",
            enemy: { name: "Arlong", hp: 200, atk: [20, 30], spd: 85, rank: "A" },
            reward: { type: "beli", amount: 750, xp: 300 },
            loseCooldown: 120 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Alabasta Unlocked!",
            desc: "With Arlong defeated, you've completed the East Blue saga! The Grand Line awaits - Alabasta arc is now unlocked!",
            reward: { type: "saga_unlock", saga: "Alabasta" }
        }
    ],
    'REVERSE MOUNTAIN': [
        {
            type: "narrative",
            title: "Enter the Grand Line",
            desc: "The currents of Reverse Mountain pull you into the Grand Line! The adventure truly begins now!",
            reward: { type: "chest", tier: "C" }
        },
        {
            type: "narrative",
            title: "Rough Currents",
            desc: "The violent currents of Reverse Mountain test your ship's strength and your crew's resolve!",
            reward: { type: "chest", tier: "C" }
        },
        {
            type: "multi_enemy",
            title: "Fight: Sea Kings (x2)",
            desc: "Two massive Sea Kings emerge from the depths to challenge your crew!",
            enemies: [
                { name: "Sea King #1", hp: 80, atk: [10, 20], spd: 60, rank: "C" },
                { name: "Sea King #2", hp: 80, atk: [10, 20], spd: 60, rank: "C" }
            ],
            reward: { type: "beli", amount: 75 },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "boss",
            title: "Laboon Phase 1",
            desc: "The massive whale Laboon blocks your path! His sheer size makes him nearly invincible!",
            enemy: { name: "Laboon", hp: 500, atk: [1, 5], spd: 30, rank: "B" },
            reward: { type: "beli", amount: 100 },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "narrative",
            title: "You Get Swallowed by Laboon",
            desc: "Laboon swallows your ship whole! You find yourself inside the massive whale's stomach!",
            reward: { type: "beli", amount: 50 }
        },
        {
            type: "narrative",
            title: "Meet Crocus",
            desc: "Inside Laboon, you meet the mysterious doctor Crocus who has been caring for the whale for decades.",
            reward: { type: "beli", amount: 50 }
        },
        {
            type: "narrative",
            title: "Meet Vivi & Mr. 9",
            desc: "You encounter Princess Vivi and Mr. 9, who are on a secret mission to Alabasta!",
            reward: { type: "chest", tier: "C" }
        },
        {
            type: "enemy",
            title: "Fight: Mr. 9",
            desc: "Mr. 9 challenges you to prove your worth as pirates!",
            enemy: { name: "Mr. 9", hp: 100, atk: [10, 20], spd: 65, rank: "C" },
            reward: { type: "card", name: "Vivi", rank: "C" },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Obtain Log Pose",
            desc: "Crocus gives you a Log Pose, the essential navigation tool for the Grand Line!",
            reward: { type: "item", name: "Log Pose" }
        },
        {
            type: "narrative",
            title: "Escape Reverse Mountain",
            desc: "With Laboon's help, you escape through his blowhole and continue your journey!",
            reward: { type: "chest", tier: "C" }
        }
    ],
    'WHISKEY PEAK': [
        {
            type: "narrative",
            title: "Arrive at Whiskey Peak",
            desc: "You reach the mysterious Whiskey Peak, where the townspeople seem unusually friendly...",
            reward: { type: "chest", tier: "C" }
        },
        {
            type: "narrative",
            title: "Welcome Feast",
            desc: "The townspeople throw a grand feast in your honor! But something seems suspicious...",
            reward: { type: "item", name: "Basic Potion" }
        },
        {
            type: "multi_enemy",
            title: "Fight: 5 Random Bounty Hunters",
            desc: "The friendly facade drops! Five bounty hunters reveal themselves and attack!",
            enemies: [
                { name: "Bounty Hunter #1", hp: 70, atk: [10, 10], spd: 55, rank: "C" },
                { name: "Bounty Hunter #2", hp: 70, atk: [10, 10], spd: 55, rank: "C" },
                { name: "Bounty Hunter #3", hp: 70, atk: [10, 10], spd: 55, rank: "C" },
                { name: "Bounty Hunter #4", hp: 70, atk: [10, 10], spd: 55, rank: "C" },
                { name: "Bounty Hunter #5", hp: 70, atk: [10, 10], spd: 55, rank: "C" }
            ],
            reward: { type: "beli", amount: 50 },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "enemy",
            title: "Fight: Miss Monday",
            desc: "The muscular Miss Monday attacks with incredible strength!",
            enemy: { name: "Miss Monday", hp: 130, atk: [15, 25], spd: 70, rank: "C" },
            reward: { type: "item", name: "Normal Potion" },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "enemy",
            title: "Fight: Mr. 8 (Igaram)",
            desc: "Mr. 8, actually Igaram in disguise, fights to protect Vivi's secret!",
            enemy: { name: "Mr. 8 (Igaram)", hp: 160, atk: [20, 30], spd: 75, rank: "B" },
            reward: { type: "chest", tier: "C" },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "multi_enemy",
            title: "Fight: Whiskey Peak Reinforcements",
            desc: "More bounty hunters arrive to finish the job!",
            enemies: [
                { name: "Reinforcement #1", hp: 100, atk: [15, 15], spd: 60, rank: "C" },
                { name: "Reinforcement #2", hp: 100, atk: [15, 15], spd: 60, rank: "C" },
                { name: "Reinforcement #3", hp: 100, atk: [15, 15], spd: 60, rank: "C" }
            ],
            reward: { type: "beli", amount: 100 },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "enemy",
            title: "Fight: Zoro (Misunderstanding)",
            desc: "A misunderstanding leads to a brief clash with Zoro!",
            enemy: { name: "Zoro (Misunderstanding)", hp: 200, atk: [25, 35], spd: 80, rank: "B" },
            reward: { type: "beli", amount: 150 },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Robin Appears",
            desc: "The mysterious Miss All Sunday appears, watching from the shadows...",
            reward: { type: "beli", amount: 50 }
        },
        {
            type: "choice",
            title: "CHOICE: Ally or Fight Robin",
            desc: "Miss All Sunday offers you a choice: become allies or fight to the death!",
            choice: {
                yes: { type: "card", name: "Miss All Sunday", rank: "B" },
                no: { type: "card", name: "Miss All Sunday", rank: "B" }
            }
        }
    ],
    'LITTLE GARDEN': [
        {
            type: "narrative",
            title: "Arrive on the Island of Giants",
            desc: "You reach the prehistoric island of Little Garden, where dinosaurs still roam!",
            reward: { type: "chest", tier: "C" }
        },
        {
            type: "narrative",
            title: "Meet Dorry & Broggy",
            desc: "You encounter the legendary giants Dorry and Broggy, who have been fighting for 100 years!",
            reward: { type: "beli", amount: 50 }
        },
        {
            type: "multi_enemy",
            title: "Fight: Hungry Dinosaurs (x2)",
            desc: "Two massive dinosaurs attack your crew!",
            enemies: [
                { name: "Hungry Dinosaur #1", hp: 150, atk: [20, 30], spd: 70, rank: "C" },
                { name: "Hungry Dinosaur #2", hp: 150, atk: [20, 30], spd: 70, rank: "C" }
            ],
            reward: { type: "item", name: "Raw Meat" },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "enemy",
            title: "Fight: Mr. 5 (Sneak Attack)",
            desc: "Mr. 5 ambushes you with his explosive Devil Fruit powers!",
            enemy: { name: "Mr. 5", hp: 150, atk: [20, 30], spd: 75, rank: "B" },
            reward: { type: "card", name: "Mr. 5", rank: "B" },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "enemy",
            title: "Fight: Miss Valentine (Ambush)",
            desc: "Miss Valentine attacks from above with her weight-changing abilities!",
            enemy: { name: "Miss Valentine", hp: 130, atk: [15, 25], spd: 80, rank: "B" },
            reward: { type: "card", name: "Miss Valentine", rank: "B" },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Find Giant's Ale",
            desc: "You discover the legendary Giant's Ale, a powerful strength-boosting drink!",
            reward: { type: "item", name: "Giant's Ale" }
        },
        {
            type: "narrative",
            title: "Dorry Injured (Story Beat)",
            desc: "Dorry is injured in battle, showing the giants' determination and honor!",
            reward: { type: "beli", amount: 50 }
        },
        {
            type: "multi_enemy",
            title: "Fight: Dual Agents (Mr. 5 + Valentine)",
            desc: "Mr. 5 and Miss Valentine team up for a combined attack!",
            enemies: [
                { name: "Mr. 5", hp: 150, atk: [20, 30], spd: 75, rank: "B" },
                { name: "Miss Valentine", hp: 130, atk: [15, 25], spd: 80, rank: "B" }
            ],
            reward: { type: "chest", tier: "B" },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "enemy",
            title: "Fight: Exploding Trap",
            desc: "A bomb turret activates, forcing you to fight while avoiding explosions!",
            enemy: { name: "Bomb Turret", hp: 120, atk: [25, 35], spd: 60, rank: "B" },
            reward: { type: "item", name: "Explosive Bomb" },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "enemy",
            title: "Fight: Giant Strength Trial",
            desc: "Broggy tests your strength in a trial of honor!",
            enemy: { name: "Broggy (Trial)", hp: 250, atk: [30, 40], spd: 85, rank: "A" },
            reward: { type: "item", name: "Giant's Relic" },
            loseCooldown: 120 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Final Escape Countdown",
            desc: "The island begins to erupt! You must escape before it's too late!",
            reward: { type: "beli", amount: 75 }
        },
        {
            type: "narrative",
            title: "Leave for Drum Island",
            desc: "With the giants' blessing, you set sail for the snowy island of Drum!",
            reward: { type: "chest", tier: "C" }
        }
    ],
    'DRUM ISLAND': [
        {
            type: "narrative",
            title: "Cold Arrival",
            desc: "You reach a snowy island... but villagers drive you off! The cold is unbearable!",
            reward: { type: "chest", tier: "C" }
        },
        {
            type: "multi_enemy",
            title: "Fight: Island Wolves (x2)",
            desc: "Hungry wolves attack you in the snowy wilderness!",
            enemies: [
                { name: "Island Wolf #1", hp: 120, atk: [15, 25], spd: 65, rank: "C" },
                { name: "Island Wolf #2", hp: 120, atk: [15, 25], spd: 65, rank: "C" }
            ],
            reward: { type: "item", name: "Wolf Fang" },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Meet Dalton",
            desc: "A mysterious man helps you escape the wolves. He seems to know more than he lets on...",
            reward: { type: "beli", amount: 50 }
        },
        {
            type: "narrative",
            title: "Climb Drum Rockies",
            desc: "You climb up with Nami injured on your back! The mountain is treacherous!",
            reward: { type: "chest", tier: "C" }
        },
        {
            type: "multi_enemy",
            title: "Fight: Wapol's Soldiers (x3)",
            desc: "Three of Wapol's soldiers block your path to the castle!",
            enemies: [
                { name: "Wapol Soldier #1", hp: 100, atk: [15, 15], spd: 60, rank: "C" },
                { name: "Wapol Soldier #2", hp: 100, atk: [15, 15], spd: 60, rank: "C" },
                { name: "Wapol Soldier #3", hp: 100, atk: [15, 15], spd: 60, rank: "C" }
            ],
            reward: { type: "item", name: "Marine Coat" },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Meet Dr. Kureha & Chopper",
            desc: "Inside the castle, two strange doctors greet you. One is a reindeer who can talk!",
            reward: { type: "item", name: "Basic Potion" }
        },
        {
            type: "enemy",
            title: "Fight: Chopper (Mistaken Battle)",
            desc: "Chopper mistakes you for enemies and attacks! His medical knowledge makes him dangerous!",
            enemy: { name: "Chopper", hp: 200, atk: [25, 35], spd: 80, rank: "B" },
            reward: { type: "card", name: "Chopper", rank: "B" },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Learn Chopper's Backstory",
            desc: "You learn about Chopper's tragic past and his dream of becoming a great doctor!",
            reward: { type: "chest", tier: "C" }
        },
        {
            type: "enemy",
            title: "Fight: Wapol Returns",
            desc: "Wapol returns to reclaim his castle! His Devil Fruit powers make him a formidable foe!",
            enemy: { name: "Wapol", hp: 220, atk: [20, 40], spd: 85, rank: "B" },
            reward: { type: "card", name: "Wapol", rank: "B" },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "multi_enemy",
            title: "Fight: Chess + Kuromarimo (Mini-Boss Duo)",
            desc: "Wapol's two strongest subordinates attack together!",
            enemies: [
                { name: "Chess", hp: 150, atk: [20, 30], spd: 70, rank: "C" },
                { name: "Kuromarimo", hp: 170, atk: [25, 35], spd: 75, rank: "B" }
            ],
            reward: { type: "item", name: "Drum Kingdom Relic" },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Chopper Joins the Crew",
            desc: "Chopper officially joins your crew as the ship's doctor!",
            reward: { type: "beli", amount: 150 }
        },
        {
            type: "narrative",
            title: "Set Sail for Alabasta",
            desc: "With Chopper aboard, you set sail for the desert kingdom of Alabasta!",
            reward: { type: "chest", tier: "C" }
        }
    ],
    'ARABASTA': [
        {
            type: "narrative",
            title: "Arrive in Nanohana Port",
            desc: "You reach the bustling port of Nanohana in the desert kingdom of Alabasta!",
            reward: { type: "chest", tier: "C" }
        },
        {
            type: "multi_enemy",
            title: "Fight: Desert Bandits (x2)",
            desc: "Two desert bandits ambush you in the scorching heat!",
            enemies: [
                { name: "Desert Bandit #1", hp: 120, atk: [20, 30], spd: 70, rank: "C" },
                { name: "Desert Bandit #2", hp: 120, atk: [20, 30], spd: 70, rank: "C" }
            ],
            reward: { type: "chest", tier: "B" },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Cross the Desert",
            desc: "You trek through the scorching desert, facing the harsh elements!",
            reward: { type: "beli", amount: 50 }
        },
        {
            type: "enemy",
            title: "Fight: Giant Crab",
            desc: "A massive desert crab emerges from the sand to challenge you!",
            enemy: { name: "Giant Crab", hp: 250, atk: [20, 40], spd: 75, rank: "B" },
            reward: { type: "item", name: "Crab Shell" },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Meet Bon Clay (Mr. 2)",
            desc: "You encounter the mysterious Mr. 2 Bon Clay, who can imitate anyone!",
            reward: { type: "card", name: "Mr. 2", rank: "B" }
        },
        {
            type: "enemy",
            title: "Fight: Rebel Scouts",
            desc: "Rebel scouts mistake you for enemies and attack!",
            enemy: { name: "Rebel Scout", hp: 130, atk: [20, 20], spd: 65, rank: "C" },
            reward: { type: "item", name: "Desert Cloak" },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Meet Koza & Vivi's Past",
            desc: "You learn about the rebellion leader Koza and Vivi's connection to the conflict!",
            reward: { type: "chest", tier: "C" }
        },
        {
            type: "enemy",
            title: "Fight: Mr. 1 & Miss Doublefinger",
            desc: "Two of Crocodile's strongest agents attack! Mr. 1's blade powers are deadly!",
            enemy: { name: "Mr. 1", hp: 250, atk: [30, 45], spd: 85, rank: "A" },
            reward: { type: "card", name: "Mr. 1", rank: "A" },
            loseCooldown: 120 * 60 * 1000
        },
        {
            type: "multi_enemy",
            title: "Fight: Mr. 4 & Miss Merry Christmas",
            desc: "Mr. 4 and Miss Merry Christmas team up for a deadly combination attack!",
            enemies: [
                { name: "Mr. 4", hp: 220, atk: [25, 40], spd: 80, rank: "B" },
                { name: "Miss Merry Christmas", hp: 240, atk: [25, 40], spd: 80, rank: "B" }
            ],
            reward: { type: "card", name: "Mr. 4", rank: "B" },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Exploding Clock Tower Event",
            desc: "You rush to stop a bomb from destroying Alubarna! Time is running out!",
            reward: { type: "chest", tier: "A" }
        },
        {
            type: "enemy",
            title: "Fight: Crocodile Phase 1",
            desc: "The Warlord Crocodile appears! His sand powers make him nearly invincible!",
            enemy: { name: "Crocodile (Phase 1)", hp: 300, atk: [35, 50], spd: 90, rank: "A" },
            reward: { type: "item", name: "Sand Scarf" },
            loseCooldown: 120 * 60 * 1000
        },
        {
            type: "enemy",
            title: "Fight: Crocodile Phase 2",
            desc: "Crocodile returns for the final battle! This time you're ready for his tricks!",
            enemy: { name: "Crocodile (Phase 2)", hp: 350, atk: [40, 55], spd: 95, rank: "S" },
            reward: { type: "multiple", rewards: [
                { type: "beli", amount: 200 },
                { type: "card", name: "Crocodile", rank: "S" }
            ]},
            loseCooldown: 150 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Vivi's Goodbye",
            desc: "Vivi stays behind to help her kingdom rebuild. Her sacrifice is noble!",
            reward: { type: "beli", amount: 100 }
        },
        {
            type: "narrative",
            title: "Bonus Explore: Nico Robin Joins",
            desc: "Nico Robin officially joins your crew! Her knowledge of the ancient world is invaluable!",
            reward: { type: "multiple", rewards: [
                { type: "card", name: "Nico Robin", rank: "A" },
                { type: "chest", tier: "A" }
            ]}
        },
        {
            type: "narrative",
            title: "Set Sail — Saga Complete",
            desc: "With Alabasta saved, you set sail for new adventures! The Grand Line has much more in store!",
            reward: { type: "multiple", rewards: [
                { type: "item", name: "Alabasta Relic" },
                { type: "beli", amount: 300 }
            ]}
        }
    ]
};

const LOCATION_COOLDOWNS = {
    'WINDMILL VILLAGE': 1 * 60 * 1000, // 1 minute
    'SHELLS TOWN': 3 * 60 * 1000, // 3 minutes
    'ORANGE TOWN': 3 * 60 * 1000, // 3 minutes
    'SYRUP VILLAGE': 4 * 60 * 1000, // 4 minutes
    'BARATIE': 5 * 60 * 1000, // 5 minutes
    'ARLONG PARK': 6 * 60 * 1000, // 6 minutes
    'REVERSE MOUNTAIN': 7 * 60 * 1000, // 7 minutes
    'WHISKEY PEAK': 8 * 60 * 1000, // 8 minutes
    'LITTLE GARDEN': 9 * 60 * 1000, // 9 minutes
    'DRUM ISLAND': 10 * 60 * 1000, // 10 minutes
    'ARABASTA': 12 * 60 * 1000 // 12 minutes
};

const DEFEAT_COOLDOWN = 5 * 60 * 1000; // 5 minutes on defeat
const IMMUNE_USER_ID = "1257718161298690119";

// Bounty rewards for different enemy ranks
function getBountyForRank(rank) {
    const bountyMap = {
        'C': 10000,
        'B': 100000,
        'A': 300000,
        'S': 1000000
    };
    return bountyMap[rank] || 0;
}

function normalizeItemName(item) {
    return item.replace(/\s+/g, '').toLowerCase();
}

function addToInventory(user, item) {
    if (!user.inventory) user.inventory = [];
    const normItem = normalizeItemName(item);
    user.inventory.push(normItem);
    // Mark inventory as modified so Mongoose saves the changes
    user.markModified('inventory');
}

async function addXP(user, amount) {
    const xpBoost = user.activeBoosts?.find(boost => 
        boost.type === 'double_xp' && boost.expiresAt > Date.now()
    );
    const finalAmount = xpBoost ? amount * 2 : amount;

    // Award XP to user with new leveling system
    const { awardUserXP } = require('../utils/userLevelSystem.js');
    const userLevelResult = awardUserXP(user, finalAmount);

    // Store user level up information for display
    if (userLevelResult.leveledUp) {
        if (!user.recentUserLevelUps) user.recentUserLevelUps = [];
        user.recentUserLevelUps.push(userLevelResult);
    }

    // Distribute XP to team members and handle card level ups
    if (user.team && user.team.length > 0) {
        const cardLevelUpChanges = distributeXPToTeam(user, finalAmount);

        // Store card level up information for display
        if (cardLevelUpChanges && cardLevelUpChanges.length > 0) {
            if (!user.recentLevelUps) user.recentLevelUps = [];
            user.recentLevelUps.push(...cardLevelUpChanges);
        }

        // Mark the user document as modified to ensure cards array is saved
        user.markModified('cards');

        // Save the user document to persist XP changes
        try {
            await user.save();
        } catch (error) {
            console.error('Error saving user XP data:', error);
        }
    }
}

function prettyTime(ms) {
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    minutes = minutes % 60;
    seconds = seconds % 60;
    
    let out = [];
    if (hours > 0) out.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
    if (minutes > 0) out.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
    if (out.length === 0) out.push(`${seconds} seconds`);
    
    return out.join(", ");
}

function createHpBar(current, max) {
    const percentage = Math.max(0, current / max);
    const barLength = 10;
    const filledBars = Math.round(percentage * barLength);
    const emptyBars = barLength - filledBars;
    return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

function createEnhancedHealthBar(current, max) {
    const percentage = Math.max(0, current / max);
    const barLength = 20;
    const filledBars = Math.round(percentage * barLength);
    const emptyBars = barLength - filledBars;
    
    // Use different colors based on health percentage
    let healthEmoji;
    let barColor;
    if (percentage > 0.6) {
        healthEmoji = '🟢';
        barColor = '🟩';
    } else if (percentage > 0.3) {
        healthEmoji = '🟡';
        barColor = '🟨';
    } else {
        healthEmoji = '🔴';
        barColor = '🟥';
    }
    
    const healthBar = barColor.repeat(filledBars) + '⬛'.repeat(emptyBars);
    return `${healthEmoji} ${healthBar} ${current}/${max}`;
}

function createTeamDisplay(team, teamName, showStats = true) {
    if (!team || team.length === 0) {
        return `**═══${teamName}═══**\n*No active cards*`;
    }
    
    let display = `**═══${teamName}═══**\n`;
    
    team.forEach((card, index) => {
        if (card.currentHp > 0) {
            const healthBar = createEnhancedHealthBar(card.currentHp, card.maxHp || card.hp);
            const level = card.level || 1;
            const rank = card.rank || 'C';
            
            display += `\n🔸 **${card.name}** | Lv. ${level} **${rank}**\n`;
            display += `${healthBar}\n`;
            
            if (showStats) {
                const power = card.power || card.atk || 100;
                const speed = card.speed || card.spd || 50;
                display += `⚔️ ${power} PWR • ❤️ ${card.maxHp || card.hp} HP • ⚡ ${speed} SPD\n`;
            }
        }
    });
    
    return display;
}

function getCurrentLocation(stage) {
    if (stage < 7) return 'WINDMILL VILLAGE';
    if (stage < 16) return 'SHELLS TOWN';
    if (stage < 24) return 'ORANGE TOWN';
    if (stage < 29) return 'SYRUP VILLAGE';
    if (stage < 34) return 'BARATIE';
    if (stage < 43) return 'ARLONG PARK';
    if (stage < 53) return 'REVERSE MOUNTAIN';
    if (stage < 63) return 'WHISKEY PEAK';
    if (stage < 75) return 'LITTLE GARDEN';
    if (stage < 87) return 'DRUM ISLAND';
    if (stage < 102) return 'ARABASTA';
    return 'COMPLETED';
}

function getLocalStage(globalStage) {
    if (globalStage < 7) return globalStage;
    if (globalStage < 16) return globalStage - 7;
    if (globalStage < 24) return globalStage - 16;
    if (globalStage < 29) return globalStage - 24;
    if (globalStage < 34) return globalStage - 29;
    if (globalStage < 43) return globalStage - 34;
    if (globalStage < 53) return globalStage - 43;
    if (globalStage < 63) return globalStage - 53;
    if (globalStage < 75) return globalStage - 63;
    if (globalStage < 87) return globalStage - 75;
    if (globalStage < 102) return globalStage - 87;
    return 0;
}

function getNextLocation(currentLocation) {
    const locationOrder = [
        'WINDMILL VILLAGE',
        'SHELLS TOWN',
        'ORANGE TOWN',
        'SYRUP VILLAGE',
        'BARATIE',
        'ARLONG PARK',
        'REVERSE MOUNTAIN',
        'WHISKEY PEAK',
        'LITTLE GARDEN',
        'DRUM ISLAND',
        'ARABASTA'
    ];
    
    const currentIndex = locationOrder.indexOf(currentLocation);
    if (currentIndex === -1 || currentIndex >= locationOrder.length - 1) {
        return 'COMPLETED';
    }
    
    return locationOrder[currentIndex + 1];
}

// Calculate equipped item bonuses
function calculateEquippedBonuses(user) {
    // This function is deprecated - equipment bonuses are now handled 
    // by the new equipment system in battle calculations
    return { hp: 0, atk: 0, spd: 0, def: 0 };
}

// Legacy function removed - now using team-based battle system

// Check if user can use inventory items in battle
function canUseInventoryItem(user, itemName) {
    if (!user.inventory) return false;
    const normalizedItem = normalizeItemName(itemName);
    return user.inventory.some(item => normalizeItemName(item) === normalizedItem);
}

// Use inventory item in battle
function useInventoryItem(user, itemName) {
    if (!canUseInventoryItem(user, itemName)) return null;
    
    const normalizedItem = normalizeItemName(itemName);
    const itemIndex = user.inventory.findIndex(item => normalizeItemName(item) === normalizedItem);
    
    if (itemIndex === -1) return null;
    
    // Remove item from inventory
    user.inventory.splice(itemIndex, 1);
    // Mark inventory as modified so Mongoose saves the changes
    user.markModified('inventory');
    
    // Return item effects
    const itemEffects = {
        'basicpotion': { type: 'heal', percent: 10 },
        'normalpotion': { type: 'heal', percent: 20 },
        'maxpotion': { type: 'heal', percent: 30 }
    };
    
    return itemEffects[normalizedItem] || null;
}

const data = {
    name: "explore",
    description: "Begin or continue your adventure in the One Piece world!"
};



async function execute(message, args, client) {
    try {
        const userId = message.author.id;
        let user = await User.findOne({ userId });

        if (!user) {
            return message.reply('Start your journey with `op start`!');
        }

        // Initialize user progress if needed
        if (user.stage === undefined) user.stage = 0;
        if (!user.exploreStates) user.exploreStates = {};

        // Check if user is in boss fight state
        if (user.exploreStates.inBossFight) {
            return await handleBossFight(message, user, client);
        }

        // Check cooldowns
        const currentLocation = getCurrentLocation(user.stage);
        
        if (currentLocation === 'COMPLETED') {
            return message.reply('🎉 Congratulations! You have completed the East Blue Saga! More adventures await in future updates!');
        }

        // Check explore cooldown using config
        const config = require('../config.json');
        const cooldownTime = config.exploreCooldown || 120000; // 2 minutes default
        const lastExplore = user.lastExplore ? new Date(user.lastExplore).getTime() : 0;
        const timeLeft = (lastExplore + cooldownTime) - Date.now();

        if (timeLeft > 0 && userId !== IMMUNE_USER_ID) {
            return message.reply(`You need to wait ${prettyTime(timeLeft)} before exploring again!`);
        }

        // Check defeat cooldown
        if (user.exploreStates.defeatCooldown && user.exploreStates.defeatCooldown > Date.now()) {
            const defeatTimeLeft = user.exploreStates.defeatCooldown - Date.now();
            return message.reply(`<:zorosad:1390838584369746022> You were defeated! Wait ${prettyTime(defeatTimeLeft)} before trying again.`);
        }

        const localStage = getLocalStage(user.stage);
        const locationData = LOCATIONS[currentLocation];
        
        // Check if we need to move to next location
        if (!locationData || localStage >= locationData.length) {
            // Instead of showing "no more stages", automatically move to next location
            const nextLocation = getNextLocation(currentLocation);
            
            if (nextLocation === 'COMPLETED') {
                // Mark saga as completed for infinite sail eligibility
                if (!user.completedSagas) user.completedSagas = [];
                if (!user.completedSagas.includes('East Blue')) {
                    user.completedSagas.push('East Blue');
                    await saveUserWithRetry(user);
                }
                return message.reply('Congratulations! You have completed all available locations in the East Blue saga! More adventures await in future updates, use `op sail` to sail infinitely through grand line.');
            }
            
            // IMPORTANT: Actually advance the stage and save progress
            user.stage++; // Increment stage to move to first stage of next location
            user.lastExplore = new Date(); // Set cooldown
            
            // Update quest progress for exploration
            try {
                const { updateQuestProgress } = require('../utils/questSystem.js');
                await updateQuestProgress(user, 'explore', 1);
            } catch (error) {
                // Quest system is optional
            }
            
            await saveUserWithRetry(user); // Save the user's progress
            
            // Automatically transition to next location
            const embed = new EmbedBuilder()
                .setTitle(`Moving to ${nextLocation}`)
                .setDescription(`You have completed **${currentLocation}**!\n\nYour adventure continues in **${nextLocation}**...\n\n✅ **Progress saved!** Use \`op explore\` again to continue.`)
                .setColor(0x2ecc71)
                .setFooter({ text: 'Your stage has been advanced to the next location!' });
            
            await saveUserWithRetry(user);
            
            return await message.reply({ embeds: [embed] });
        }

        const stageData = locationData[localStage];
        
        // Validate stage data exists
        if (!stageData) {
            console.error(`Missing stage data for location: ${currentLocation}, stage: ${localStage}`);
            return message.reply('An error occurred with the stage data. Please try again or contact support.');
        }
        
        // Handle different stage types
        if (stageData.type === 'narrative') {
            await handleNarrative(message, user, stageData, currentLocation);
        } else if (stageData.type === 'choice') {
            await handleChoice(message, user, stageData, currentLocation, client);
        } else if (stageData.type === 'enemy' || stageData.type === 'boss' || stageData.type === 'multi_enemy') {
            await handleBattle(message, user, stageData, currentLocation, client);
        } else {
            console.error(`Unknown stage type: ${stageData.type}`);
            return message.reply('An error occurred with the stage type. Please try again or contact support.');
        }
    } catch (error) {
        console.error('Error in explore command:', error);
        return message.reply('An error occurred while exploring. Please try again. If the issue persists, contact support.');
    }
}

async function handleNarrative(message, user, stageData, currentLocation) {
    try {
        const embed = new EmbedBuilder()
            .setTitle(`🗺️ ${currentLocation} - ${stageData.title}`)
            .setDescription(stageData.desc)
            .setColor(0x3498db);

        // Apply rewards
        await applyReward(user, stageData.reward);
        
        // Add reward info to embed
        if (stageData.reward) {
            embed.addFields({ name: 'Reward', value: getRewardText(stageData.reward), inline: false });
        }

        // Set cooldown and advance stage
        user.lastExplore = new Date();
        user.stage++;
        
        // Update quest progress for exploration
        try {
            const { updateQuestProgress } = require('../utils/questSystem.js');
            await updateQuestProgress(user, 'explore', 1);
        } catch (error) {
            // Remove excessive logging - quest system is optional
            // console.log('Quest system not available');
        }
        
        await saveUserWithRetry(user);
        
        // Add footer with stage info
        embed.setFooter({ text: `Stage ${user.stage} • Use 'op map' to see your progress` });
        
        await message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in handleNarrative:', error);
        await message.reply('An error occurred during the narrative. Please try exploring again.');
    }
}

async function handleChoice(message, user, stageData, currentLocation, client) {
    const embed = new EmbedBuilder()
        .setTitle(`${currentLocation} - ${stageData.title}`)
        .setDescription(stageData.desc)
        .setColor(0xe67e22);

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('choice_yes')
                .setLabel('Yes')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('choice_no')
                .setLabel('No')
                .setStyle(ButtonStyle.Secondary)
        );

    const choiceMessage = await message.reply({ embeds: [embed], components: [row] });

    const filter = i => i.user.id === message.author.id;
    const collector = choiceMessage.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async interaction => {
        try {
            await interaction.deferUpdate();
            
            const choice = interaction.customId === 'choice_yes' ? 'yes' : 'no';
            const reward = stageData.choice[choice];
            
            await applyReward(user, reward);
            
            const resultEmbed = new EmbedBuilder()
                .setTitle(`<:check:1390838766821965955> Choice Made: ${choice.toUpperCase()}`)
                .setDescription(`You chose **${choice}**!`)
                .setColor(choice === 'yes' ? 0x2ecc71 : 0x95a5a6);
            
            if (reward) {
                resultEmbed.addFields({ name: 'Reward', value: getRewardText(reward), inline: false });
            }
            
            // Set cooldown and advance stage
            user.lastExplore = new Date();
            user.stage++;
            
            // Update quest progress for exploration
            try {
                const { updateQuestProgress } = require('../utils/questSystem.js');
                await updateQuestProgress(user, 'explore', 1);
            } catch (error) {
                // Remove excessive logging - quest system is optional
                // console.log('Quest system not available');
            }
            
            await saveUserWithRetry(user);
            
            // Add footer with stage info
            resultEmbed.setFooter({ text: `Stage ${user.stage} • Use 'op map' to see your progress` });
            
            await choiceMessage.edit({ embeds: [resultEmbed], components: [] });
        } catch (error) {
            console.error('Choice interaction error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred while processing your choice.', ephemeral: true });
            }
        }
    });

    collector.on('end', collected => {
        if (collected.size === 0) {
            choiceMessage.edit({ components: [] }).catch(() => {});
        }
    });
}

async function handleBattle(message, user, stageData, currentLocation, client) {
    try {
        // Validate user has a team set up
        if (!user.team || user.team.length === 0) {
            return message.reply('You need to set up your team first! Use `op team add <card>` to add cards to your team.');
        }

        // Validate user has cards
        if (!user.cards || user.cards.length === 0) {
            return message.reply('You don\'t have any cards! Pull some cards first with `op pull`.');
        }

        // Get user's team using the proper battle system
        const battleTeam = calculateBattleStats(user);

        if (!battleTeam || battleTeam.length === 0) {
            return message.reply('Your team is invalid or cards are missing. Please check your team with `op team` and fix any issues.');
        }

        // Initialize enemies
        let enemies = [];
        
        if (stageData.type === 'multi_enemy') {
            enemies = stageData.enemies.map(enemy => ({
                ...enemy,
                currentHp: enemy.hp,
                maxHp: enemy.hp
            }));
        } else {
            enemies = [{
                ...stageData.enemy,
                currentHp: stageData.enemy.hp,
                maxHp: stageData.enemy.hp
            }];
        }

        // Ensure battle team has proper health values
        battleTeam.forEach(card => {
            if (!card.currentHp || card.currentHp <= 0) {
                card.currentHp = card.hp || card.maxHp || 100;
            }
            if (!card.maxHp) {
                card.maxHp = card.hp || 100;
            }
        });

        // Final validation - ensure we have at least one alive team member
        const aliveCount = battleTeam.filter(card => card.currentHp > 0).length;
        if (aliveCount === 0) {
            return message.reply('Your team has no health! Please check your cards or try again.');
        }

        const battleState = {
            userTeam: battleTeam,
            enemies: enemies,
            turn: 1,
            userBoosts: {},
            isBossFight: stageData.type === 'boss'
        };

        // Initialize exploreStates if it doesn't exist
        if (!user.exploreStates) {
            user.exploreStates = {};
        }
        
        // Store battle state
        user.exploreStates.battleState = battleState;
        user.exploreStates.inBossFight = true;
        user.exploreStates.currentStage = stageData;
        user.exploreStates.currentLocation = currentLocation;
        
        await saveUserWithRetry(user);

        return await displayBattleState(message, user, client);
    } catch (error) {
        console.error('Error in handleBattle:', error);
        
        // Clean up any corrupted battle state
        try {
            if (user.exploreStates) {
                user.exploreStates.inBossFight = false;
                user.exploreStates.battleState = null;
                user.exploreStates.currentStage = null;
                await saveUserWithRetry(user);
            }
        } catch (cleanupError) {
            console.error('Error cleaning up battle state:', cleanupError);
        }
        
        return message.reply('An error occurred while initializing the battle. Please try exploring again.');
    }
}

async function handleBossFight(message, user, client) {
    return await displayBattleState(message, user, client);
}

async function displayBattleState(message, user, client) {
    const battleState = user.exploreStates.battleState;
    const stageData = user.exploreStates.currentStage;
    
    if (!battleState || !stageData) {
        // Clean up corrupted state
        user.exploreStates.inBossFight = false;
        user.exploreStates.battleState = null;
        user.exploreStates.currentStage = null;
        await saveUserWithRetry(user);
        return message.reply('Battle state corrupted. Please try exploring again.');
    }

    // Create clean battle embed
    const embed = new EmbedBuilder()
        .setTitle(stageData.title)
        .setDescription(stageData.desc)
        .setColor(0x2b2d31);

    // Use enhanced team display
    const aliveTeamMembers = battleState.userTeam.filter(card => card.currentHp > 0);
    
    // Emergency check - if no team members are alive, something went wrong
    if (aliveTeamMembers.length === 0) {
        // Reset team health as emergency fix
        battleState.userTeam.forEach(card => {
            if (!card.currentHp || card.currentHp <= 0) {
                card.currentHp = card.hp || card.maxHp || 100;
            }
        });
        const fixedTeam = battleState.userTeam.filter(card => card.currentHp > 0);
        
        if (fixedTeam.length > 0) {
            const teamDisplay = createProfessionalTeamDisplay(fixedTeam, message.author.username);
            embed.addFields({
                name: `${message.author.username}'s Team`,
                value: teamDisplay,
                inline: false
            });
        } else {
            // If still no team, clean up and restart
            user.exploreStates.inBossFight = false;
            user.exploreStates.battleState = null;
            user.exploreStates.currentStage = null;
            await saveUserWithRetry(user);
            return message.reply('Battle initialization failed. Please try exploring again with `op explore`.');
        }
    } else {
        const teamDisplay = createProfessionalTeamDisplay(aliveTeamMembers, message.author.username);
        embed.addFields({
            name: `${message.author.username}'s Team`,
            value: teamDisplay,
            inline: false
        });
    }

    // Enhanced enemy display
    const activeEnemies = battleState.enemies.filter(enemy => enemy.currentHp > 0);
    if (activeEnemies.length > 0) {
        const enemyDisplay = createEnemyDisplay(activeEnemies);
        embed.addFields({
            name: `Enemies`,
            value: enemyDisplay,
            inline: false
        });
    }



    // Create clean battle buttons
    const battleButtons = [
        new ButtonBuilder()
            .setCustomId('battle_attack')
            .setLabel('Attack')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('battle_items')
            .setLabel('Items')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('battle_flee')
            .setLabel('Flee')
            .setStyle(ButtonStyle.Secondary)
    ];

    const row = new ActionRowBuilder().addComponents(battleButtons);

    const battleMessage = await message.reply({ embeds: [embed], components: [row] });

    const filter = i => i.user.id === message.author.id;
    const collector = battleMessage.createMessageComponentCollector({ filter, time: 300000 });

    collector.on('collect', async interaction => {
        try {
            await interaction.deferUpdate();
            
            if (interaction.customId === 'battle_attack') {
                await handleBattleAttack(interaction, user, battleMessage);
            } else if (interaction.customId === 'battle_items') {
                await handleBattleItems(interaction, user, battleMessage);
            } else if (interaction.customId === 'battle_flee') {
                await handleBattleFlee(interaction, user, battleMessage);
            }
        } catch (error) {
            console.error('Battle interaction error:', error);
            // Attempt to clean up battle state on error
            try {
                user.exploreStates.inBossFight = false;
                user.exploreStates.battleState = null;
                user.exploreStates.currentStage = null;
                await saveUserWithRetry(user);
            } catch (saveError) {
                console.error('Error cleaning up battle state:', saveError);
            }
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.followUp({ content: 'An error occurred during battle. Battle state has been reset.', ephemeral: true });
            }
        }
    });

    collector.on('end', () => {
        battleMessage.edit({ components: [] }).catch(() => {});
    });
}

async function handleBattleAttack(interaction, user, battleMessage) {
    try {
        // Use the passed-in user first, only refresh if battle state is missing
        let currentUser = user;
        
        // Check if battle state exists in current user
        if (!currentUser.exploreStates || !currentUser.exploreStates.battleState) {
            // Try refreshing from database as fallback
            const freshUser = await User.findOne({ userId: interaction.user.id });
            if (!freshUser || !freshUser.exploreStates || !freshUser.exploreStates.battleState) {
                return await interaction.followUp({ 
                    content: 'Battle state lost! Please start exploring again with `op explore`.', 
                    ephemeral: true 
                });
            }
            currentUser = freshUser;
        }

        const battleState = currentUser.exploreStates.battleState;
        
        // Validate battle state has required properties
        if (!battleState.userTeam || !battleState.enemies) {
            return await interaction.followUp({ 
                content: 'Invalid battle state! Please start exploring again with `op explore`.', 
                ephemeral: true 
            });
        }

        // Get the first alive team member to attack
        const attacker = battleState.userTeam.find(card => card.currentHp > 0);
        if (!attacker) {
            return await handleBattleDefeat(interaction, currentUser, battleMessage, 'Your team is defeated!');
        }

        // Find first enemy alive
        const targetEnemy = battleState.enemies.find(e => e.currentHp > 0);
        if (!targetEnemy) {
            return await interaction.followUp({ 
                content: 'No enemies to attack!', 
                ephemeral: true 
            });
        }

        // Calculate damage using the proper battle system
        let attackDamage = calculateDamage(attacker, targetEnemy);
        
        // Apply user boosts
        if (battleState.userBoosts && battleState.userBoosts.attack_boost) {
            attackDamage += battleState.userBoosts.attack_boost.amount;
            battleState.userBoosts.attack_boost.duration--;
            if (battleState.userBoosts.attack_boost.duration <= 0) {
                delete battleState.userBoosts.attack_boost;
            }
        }
        
        targetEnemy.currentHp = Math.max(0, targetEnemy.currentHp - attackDamage);
        
        let battleLog = `${attacker.name} attacks ${targetEnemy.name} for ${attackDamage} damage!`;
        
        if (targetEnemy.currentHp <= 0) {
            battleLog += `\n${targetEnemy.name} is defeated!`;
        }

        // Check if all enemies defeated
        if (battleState.enemies.every(e => e.currentHp <= 0)) {
            return await handleBattleVictory(interaction, currentUser, battleMessage, battleLog);
        }

        // Enemy attacks back - target random team member
        const aliveEnemies = battleState.enemies.filter(e => e.currentHp > 0);
        const aliveTeamMembers = battleState.userTeam.filter(card => card.currentHp > 0);
        
        for (const enemy of aliveEnemies) {
            if (aliveTeamMembers.length === 0) break;
            
            const target = aliveTeamMembers[Math.floor(Math.random() * aliveTeamMembers.length)];
            const damage = calculateDamage(enemy, target);
            
            target.currentHp = Math.max(0, target.currentHp - damage);
            battleLog += `\n${enemy.name} attacks ${target.name} for ${damage} damage!`;
            
            if (target.currentHp <= 0) {
                battleLog += `\n${target.name} is defeated!`;
            }
        }

        // Check if all team members defeated
        if (battleState.userTeam.every(card => card.currentHp <= 0)) {
            return await handleBattleDefeat(interaction, currentUser, battleMessage, battleLog);
        }

        battleState.turn++;
        currentUser.exploreStates.battleState = battleState;
        await saveUserWithRetry(currentUser);

        // Create enhanced battle log display
        const battleLogDisplay = createBattleLogDisplay([battleLog]);
        
        // Update battle display
        const embed = new EmbedBuilder()
            .setTitle(`Turn ${battleState.turn} - Battle Continues`)
            .setColor(0x2b2d31);

        // Enhanced team display
        const aliveTeam = battleState.userTeam.filter(card => card.currentHp > 0);
        if (aliveTeam.length > 0) {
            const teamDisplay = createProfessionalTeamDisplay(aliveTeam, interaction.user.username);
            embed.addFields({
                name: `${interaction.user.username}'s Team`,
                value: teamDisplay,
                inline: false
            });
        }

        // Enhanced enemy display
        const currentEnemies = battleState.enemies.filter(enemy => enemy.currentHp > 0);
        if (currentEnemies.length > 0) {
            const enemyDisplay = createEnemyDisplay(currentEnemies);
            embed.addFields({
                name: `Enemies`,
                value: enemyDisplay,
                inline: false
            });
        }

        // Battle log display
        embed.addFields({
            name: `Recent Actions`,
            value: battleLogDisplay,
            inline: false
        });

        const battleButtons = [
            new ButtonBuilder()
                .setCustomId('battle_attack')
                .setLabel('Attack')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('battle_items')
                .setLabel('Items')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('battle_flee')
                .setLabel('Flee')
                .setStyle(ButtonStyle.Secondary)
        ];

        const row = new ActionRowBuilder().addComponents(battleButtons);

        await battleMessage.edit({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error('Error in handleBattleAttack:', error);
        return await interaction.followUp({ 
            content: 'An error occurred during the attack. Please try exploring again with `op explore`.', 
            ephemeral: true 
        });
    }
}

async function handleBattleItems(interaction, user, battleMessage) {
    try {
        // Use the passed-in user first, only refresh if battle state is missing
        let currentUser = user;
        
        // Check if battle state exists in current user
        if (!currentUser.exploreStates || !currentUser.exploreStates.battleState) {
            // Try refreshing from database as fallback
            const freshUser = await User.findOne({ userId: interaction.user.id });
            if (!freshUser || !freshUser.exploreStates || !freshUser.exploreStates.battleState) {
                return await interaction.followUp({ 
                    content: 'Battle state lost! Please start exploring again with `op explore`.', 
                    ephemeral: true 
                });
            }
            currentUser = freshUser;
        }

        const usableItems = ['basicpotion', 'normalpotion', 'maxpotion'];
        const availableItems = usableItems.filter(item => canUseInventoryItem(currentUser, item));
        
        if (availableItems.length === 0) {
            return await interaction.followUp({ content: 'You have no usable items!', ephemeral: true });
        }
        
        const itemButtons = availableItems.map(item => {
            const itemLabels = {
                'basicpotion': 'Basic Potion',
                'normalpotion': 'Normal Potion', 
                'maxpotion': 'Max Potion'
            };
            return new ButtonBuilder()
                .setCustomId(`use_${item}`)
                .setLabel(itemLabels[item] || item)
                .setStyle(ButtonStyle.Primary);
        });
        
        const itemRow = new ActionRowBuilder().addComponents(itemButtons.slice(0, 5));
        
        const itemMessage = await interaction.followUp({ 
            content: 'Choose an item to use:', 
            components: [itemRow], 
            ephemeral: true 
        });

        // Handle item selection
        const itemFilter = i => i.user.id === interaction.user.id && i.customId.startsWith('use_');
        const itemCollector = itemMessage.createMessageComponentCollector({ filter: itemFilter, time: 30000 });

        itemCollector.on('collect', async itemInteraction => {
            try {
                await itemInteraction.deferUpdate();
                
                // Use the outer currentUser directly instead of refreshing
                // This prevents battle state loss from database consistency issues
                const itemName = itemInteraction.customId.replace('use_', '');
                const effect = useInventoryItem(currentUser, itemName);
                
                if (!effect) {
                    return await itemInteraction.followUp({ content: 'Item could not be used!', ephemeral: true });
                }

                const battleState = currentUser.exploreStates.battleState;
                let effectText = '';

                // Apply item effects
                if (effect.type === 'heal') {
                    // Heal the first injured team member
                    const injuredCard = battleState.userTeam.find(card => card.currentHp < card.maxHp && card.currentHp > 0);
                    if (injuredCard) {
                        const healAmount = Math.floor(injuredCard.maxHp * (effect.percent / 100));
                        const actualHeal = Math.min(healAmount, injuredCard.maxHp - injuredCard.currentHp);
                        injuredCard.currentHp += actualHeal;
                        effectText = `Healed ${injuredCard.name} for ${actualHeal} HP (${effect.percent}% of max HP)!`;
                    } else {
                        effectText = `No injured team members to heal!`;
                    }
                } else if (effect.type === 'attack_boost') {
                    if (!battleState.userBoosts) battleState.userBoosts = {};
                    battleState.userBoosts.attack_boost = { amount: effect.amount, duration: effect.duration };
                    effectText = `Attack increased by ${effect.amount}!`;
                } else if (effect.type === 'speed_boost') {
                    if (!battleState.userBoosts) battleState.userBoosts = {};
                    battleState.userBoosts.speed_boost = { amount: effect.amount, duration: effect.duration };
                    effectText = `Speed increased by ${effect.amount}!`;
                } else if (effect.type === 'defense_boost') {
                    if (!battleState.userBoosts) battleState.userBoosts = {};
                    battleState.userBoosts.defense_boost = { amount: effect.amount, duration: effect.duration };
                    effectText = `Defense increased by ${effect.amount}!`;
                }

                await saveUserWithRetry(currentUser);

                // Update battle display with item effect
                const embed = new EmbedBuilder()
                    .setTitle(`Item Used: ${itemName.charAt(0).toUpperCase() + itemName.slice(1)}`)
                    .setDescription(effectText)
                    .setColor(0x2ecc71);

                await itemInteraction.editReply({ embeds: [embed], components: [] });

                // Continue battle
                battleState.turn++;
                await handleEnemyTurn(interaction, currentUser, battleMessage);
            } catch (error) {
                console.error('Error in item use:', error);
                await itemInteraction.followUp({ 
                    content: 'Error using item. Please try again.', 
                    ephemeral: true 
                });
            }
        });
    } catch (error) {
        console.error('Error in handleBattleItems:', error);
        return await interaction.followUp({ 
            content: 'An error occurred accessing items. Please try exploring again.', 
            ephemeral: true 
        });
    }
}

async function handleEnemyTurn(interaction, user, battleMessage) {
    try {
        // Use the passed-in user first, only refresh if battle state is missing
        let currentUser = user;
        
        // Check if battle state exists in current user
        if (!currentUser.exploreStates || !currentUser.exploreStates.battleState) {
            // Try refreshing from database as fallback
            const freshUser = await User.findOne({ userId: interaction.user.id });
            if (!freshUser || !freshUser.exploreStates || !freshUser.exploreStates.battleState) {
                return await interaction.followUp({ 
                    content: 'Battle state lost during enemy turn!', 
                    ephemeral: true 
                });
            }
            currentUser = freshUser;
        }

        const battleState = currentUser.exploreStates.battleState;
        let battleLog = '';

        // Each alive enemy attacks a random team member
        const aliveTeamMembers = battleState.userTeam.filter(card => card.currentHp > 0);
        
        for (const enemy of battleState.enemies) {
            if (enemy.currentHp <= 0 || aliveTeamMembers.length === 0) continue;

            const target = aliveTeamMembers[Math.floor(Math.random() * aliveTeamMembers.length)];
            const damage = calculateDamage(enemy, target);
            
            target.currentHp = Math.max(0, target.currentHp - damage);
            battleLog += `${enemy.name} attacks ${target.name} for ${damage} damage!\n`;

            if (target.currentHp <= 0) {
                battleLog += `${target.name} is defeated!\n`;
                // Remove defeated card from alive members array
                const index = aliveTeamMembers.indexOf(target);
                if (index > -1) aliveTeamMembers.splice(index, 1);
            }

            if (aliveTeamMembers.length === 0) {
                return await handleBattleDefeat(interaction, currentUser, battleMessage, battleLog);
            }
        }

        // Reduce boost durations
        if (battleState.userBoosts) {
            Object.keys(battleState.userBoosts).forEach(key => {
                if (battleState.userBoosts[key].duration) {
                    battleState.userBoosts[key].duration--;
                    if (battleState.userBoosts[key].duration <= 0) {
                        delete battleState.userBoosts[key];
                    }
                }
            });
        }

        await saveUserWithRetry(currentUser);

        // Create enhanced battle log display
        const battleLogDisplay = createBattleLogDisplay([battleLog]);
        
        // Update battle display with enhanced UI
        const embed = new EmbedBuilder()
            .setTitle(`Turn ${battleState.turn} - Enemy Turn`)
            .setColor(0x2b2d31);

        // Enhanced team display
        const aliveTeam = battleState.userTeam.filter(card => card.currentHp > 0);
        if (aliveTeam.length > 0) {
            const teamDisplay = createProfessionalTeamDisplay(aliveTeam, interaction.user.username);
            embed.addFields({
                name: `${interaction.user.username}'s Team`,
                value: teamDisplay,
                inline: false
            });
        }

        // Enhanced enemy display
        const remainingEnemies = battleState.enemies.filter(enemy => enemy.currentHp > 0);
        if (remainingEnemies.length > 0) {
            const enemyDisplay = createEnemyDisplay(remainingEnemies);
            embed.addFields({
                name: `Enemies`,
                value: enemyDisplay,
                inline: false
            });
        }

        // Battle log display
        embed.addFields({
            name: `Recent Actions`,
            value: battleLogDisplay,
            inline: false
        });

        const battleButtons = [
            new ButtonBuilder()
                .setCustomId('battle_attack')
                .setLabel('Attack')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('battle_items')
                .setLabel('Items')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('battle_flee')
                .setLabel('Flee')
                .setStyle(ButtonStyle.Secondary)
        ];

        const row = new ActionRowBuilder().addComponents(battleButtons);
        await battleMessage.edit({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error in handleEnemyTurn:', error);
        return await interaction.followUp({ 
            content: 'An error occurred during enemy turn. Please try exploring again.', 
            ephemeral: true 
        });
    }
}

async function handleBattleFlee(interaction, user, battleMessage) {
    try {
        // Use the passed-in user first, only refresh if needed
        let currentUser = user;
        
        // If no exploreStates, refresh from database
        if (!currentUser.exploreStates) {
            const freshUser = await User.findOne({ userId: interaction.user.id });
            if (!freshUser) {
                return await interaction.followUp({ content: 'User data not found!', ephemeral: true });
            }
            currentUser = freshUser;
        }

        // Clean up battle state properly
        currentUser.exploreStates.inBossFight = false;
        currentUser.exploreStates.battleState = null;
        currentUser.exploreStates.currentStage = null;
        
        // Set flee cooldown
        currentUser.exploreStates.defeatCooldown = Date.now() + (30 * 60 * 1000); // 30 minute cooldown for fleeing
        
        await saveUserWithRetry(currentUser);
        
        const fleeEmbed = new EmbedBuilder()
            .setTitle('🏃‍♂️ Fled from Battle!')
            .setDescription('You successfully escaped from the battle, but you\'ll need to wait before trying again.')
            .setColor(0x95a5a6);
        
        await battleMessage.edit({ embeds: [fleeEmbed], components: [] });
    } catch (error) {
        console.error('Error handling battle flee:', error);
        await interaction.followUp({ content: 'An error occurred while fleeing. Please try the command again.', ephemeral: true });
    }
}

async function handleBattleVictory(interaction, user, battleMessage, battleLog) {
    const stageData = user.exploreStates.currentStage;
    const currentLocation = user.exploreStates.currentLocation;
    
    // Clean up battle state
    user.exploreStates.inBossFight = false;
    user.exploreStates.battleState = null;
    user.exploreStates.currentStage = null;
    
    // Apply rewards
    await applyReward(user, stageData.reward);
    
    // Add bounty rewards for boss battles
    if (stageData.type === 'boss' && stageData.enemy && stageData.enemy.rank) {
        const bountyReward = getBountyForRank(stageData.enemy.rank);
        if (bountyReward > 0) {
            user.bounty = (user.bounty || 0) + bountyReward;
        }
    }
    
    // Check for item rewards
    let itemReward = null;
    try {
        const { getExplorationReward, addItemToInventory } = require('../utils/rewardSystem.js');
        itemReward = getExplorationReward(stageData.type, stageData.enemy?.rank);
        if (itemReward) {
            addItemToInventory(user, itemReward);
        }
    } catch (error) {
        // Item rewards are optional
        console.log('Reward system not available');
    }
    
    // Set cooldown and advance stage
    user.lastExplore = new Date();
    user.stage++;
    
    // Special handling for completing East Blue saga (stage 42)
    if (user.stage === 43) {
        // Give 10M bounty for completing East Blue saga
        user.bounty = (user.bounty || 0) + 10000000;
        
        // Add sailing unlock
        if (!user.completedSagas) user.completedSagas = [];
        if (!user.completedSagas.includes('East Blue')) {
            user.completedSagas.push('East Blue');
        }
    }
    
    // Update quest progress
    try {
        const { updateQuestProgress } = require('../utils/questSystem.js');
        await updateQuestProgress(user, 'explore', 1);
        if (stageData.type === 'boss') {
            await updateQuestProgress(user, 'battle_win', 1);
        }
    } catch (error) {
        // Remove excessive logging - quest system is optional
        // console.log('Quest system not available');
    }
    
    await saveUserWithRetry(user);
    
    const victoryEmbed = new EmbedBuilder()
        .setTitle('Victory!')
        .setDescription(battleLog + '\n\n<:check:1390838766821965955> **You won the battle!**')
        .setColor(0x2ecc71);
    
    // Build rewards text
    let rewardsText = '';
    if (stageData.reward) {
        rewardsText += getRewardText(stageData.reward);
    }
    
    // Add bounty rewards for boss battles
    if (stageData.type === 'boss' && stageData.enemy && stageData.enemy.rank) {
        const bountyReward = getBountyForRank(stageData.enemy.rank);
        if (bountyReward > 0) {
            if (rewardsText) rewardsText += '\n';
            rewardsText += `+${bountyReward.toLocaleString()} Bounty`;
        }
    }
    
    // Add item rewards
    if (itemReward) {
        try {
            const { formatItemReward } = require('../utils/rewardSystem.js');
            if (rewardsText) rewardsText += '\n';
            rewardsText += formatItemReward(itemReward);
        } catch (error) {
            // Fallback format
            if (rewardsText) rewardsText += '\n';
            rewardsText += `**${itemReward.name}** obtained!`;
        }
    }
    
    // Add chest rewards if applicable
    if (user.lastChestRewards && user.lastChestRewards.tier) {
        const { formatChestRewards } = require('../utils/chestSystem.js');
        if (rewardsText) rewardsText += '\n\n';
        rewardsText += formatChestRewards(user.lastChestRewards.tier, user.lastChestRewards.rewards);
        
        // Clear the chest rewards after displaying
        user.lastChestRewards = null;
    }
    
    // Add saga completion bounty
    if (user.stage === 43) {
        if (rewardsText) rewardsText += '\n';
        rewardsText += `+10,000,000 Bounty (East Blue Saga Complete!)`;
        rewardsText += '\n🌊 **Sailing Command Unlocked!**';
        rewardsText += '\n⛵ You can now sail to the Grand Line and beyond!';
        rewardsText += '\nUse `op sail` to start your next adventure!';
    }
    
    if (rewardsText) {
        victoryEmbed.addFields({ name: 'Rewards', value: rewardsText, inline: false });
    }
    
    // Add user level up notifications
    if (user.recentUserLevelUps && user.recentUserLevelUps.length > 0) {
        const { formatLevelUpRewards } = require('../utils/userLevelSystem.js');
        const userLevelUp = user.recentUserLevelUps[user.recentUserLevelUps.length - 1];
        
        if (userLevelUp.leveledUp) {
            const levelUpText = `** LEVEL UP! **\n${userLevelUp.oldLevel} → **${userLevelUp.newLevel}**\n${formatLevelUpRewards(userLevelUp.rewards)}`;
            victoryEmbed.addFields({ name: 'Pirate Level Up!', value: levelUpText.trim(), inline: false });
        }
        
        // Clear the level up notification
        user.recentUserLevelUps = [];
    }
    
    // Add card level up notifications
    if (user.recentLevelUps && user.recentLevelUps.length > 0) {
        const cardLevelUpText = user.recentLevelUps.map(change => 
            `**${change.name}** leveled up! (${change.oldLevel} → ${change.newLevel})`
        ).join('\n');
        victoryEmbed.addFields({ name: 'Card Level Ups!', value: cardLevelUpText, inline: false });
        
        // Clear card level up notifications
        user.recentLevelUps = [];
    }
    
    // Add footer with stage info
    victoryEmbed.setFooter({ text: `Stage ${user.stage} • Use 'op map' to see your progress` });
    
    await battleMessage.edit({ embeds: [victoryEmbed], components: [] });
}

async function handleBattleDefeat(interaction, user, battleMessage, battleLog) {
    const stageData = user.exploreStates.currentStage;
    
    // Clean up battle state
    user.exploreStates.inBossFight = false;
    user.exploreStates.battleState = null;
    user.exploreStates.currentStage = null;
    
    // Set defeat cooldown
    user.exploreStates.defeatCooldown = Date.now() + (stageData.loseCooldown || DEFEAT_COOLDOWN);
    
    await saveUserWithRetry(user);
    
    const defeatEmbed = new EmbedBuilder()
        .setTitle('<:zorosad:1390838584369746022> Defeat!')
        .setDescription(battleLog + '\n\n**You were defeated!**')
        .setColor(0xe74c3c)
        .setFooter({ text: `Stage ${user.stage} • Use 'op map' to see your progress` });
    
    await battleMessage.edit({ embeds: [defeatEmbed], components: [] });
}

async function applyReward(user, reward) {
    if (!reward) return;
    
    if (reward.type === 'xp') {
        await addXP(user, reward.amount);
    } else if (reward.type === 'beli') {
        user.beli = (user.beli || 0) + reward.amount;
    } else if (reward.type === 'item') {
        addToInventory(user, reward.name);
        if (reward.count && reward.count > 1) {
            for (let i = 1; i < reward.count; i++) {
                addToInventory(user, reward.name);
            }
        }
    } else if (reward.type === 'card') {
        const cardToAdd = {
            name: reward.name,
            rank: reward.rank,
            level: 1,
            experience: 0,
            timesUpgraded: 0,
            locked: false
        };
        addCardWithTransformation(user, cardToAdd);
    } else if (reward.type === 'chest') {
        const { generateChestRewards } = require('../utils/chestSystem.js');
        const chestRewards = generateChestRewards(reward.tier);
        
        // Apply beli reward
        user.beli = (user.beli || 0) + chestRewards.beli;
        
        // Apply item rewards
        chestRewards.items.forEach(item => {
            addToInventory(user, item);
        });
        
        // Apply card rewards
        chestRewards.cards.forEach(card => {
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
        
        // Store chest rewards for display
        if (!user.lastChestRewards) user.lastChestRewards = {};
        user.lastChestRewards = {
            tier: reward.tier,
            rewards: chestRewards
        };
    } else if (reward.type === 'multiple') {
        for (const subReward of reward.rewards) {
            await applyReward(user, subReward);
        }
    } else if (reward.type === 'saga_unlock') {
        if (!user.unlockedSagas) user.unlockedSagas = ['East Blue'];
        if (!user.unlockedSagas.includes(reward.saga)) {
            user.unlockedSagas.push(reward.saga);
        }
    }
}

function getRewardText(reward) {
    if (!reward) return 'None';
    
    if (reward.type === 'xp') {
        return `+${reward.amount} XP`;
    } else if (reward.type === 'beli') {
        return `+${reward.amount} Beli`;
    } else if (reward.type === 'item') {
        const count = reward.count || 1;
        return `${reward.name}${count > 1 ? ` x${count}` : ''}`;
    } else if (reward.type === 'card') {
        return `[${reward.rank}] ${reward.name}`;
    } else if (reward.type === 'chest') {
        const { CHEST_TIERS } = require('../utils/chestSystem.js');
        const chestConfig = CHEST_TIERS[reward.tier];
        return `${chestConfig.emoji} ${chestConfig.name}`;
    } else if (reward.type === 'multiple') {
        return reward.rewards.map(r => getRewardText(r)).join(', ');
    } else if (reward.type === 'saga_unlock') {
        return `${reward.saga} Saga Unlocked!`;
    }
    
    return 'Unknown reward';
}

module.exports = { data, execute };
