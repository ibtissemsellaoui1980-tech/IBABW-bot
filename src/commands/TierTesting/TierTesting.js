import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';
import { getGuildConfig, updateGuildConfig } from '../../services/config/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

const GAMEMODES = [
    'sword',
    'enchanted_sword',
    'pot',
    'soup',
    'hole',
    'uhc',
    'bedwars',
    'skywars',
    'combo'
];

const DISPLAY_NAMES = {
    sword: 'Sword',
    enchanted_sword: 'Enchanted Sword',
    pot: 'Pot',
    soup: 'Soup',
    hole: 'Hole',
    uhc: 'UHC',
    bedwars: 'Bedwars',
    skywars: 'Skywars',
    combo: 'Combo'
};

function isTester(interaction, config, gamemode = null) {
    const member = interaction.member;
    const roles = member?.roles?.cache;

    if (!roles) return false;

    if (config.tiertesterRoleId && roles.has(config.tiertesterRoleId))
        return true;

    if (gamemode) {
        const roleId = config.tiertesterRoles?.[gamemode];

        if (roleId && roles.has(roleId))
            return true;
    }

    return false;
}

function getConfig(interaction, client) {
    return getGuildConfig(client, interaction.guildId);
}

export default {
    data: new SlashCommandBuilder()
        .setName('tiertesting')
        .setDescription('Manage the tier testing system.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('testerrole')
                .setDescription('Set the general tier tester role.')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The tester role.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('pingrole')
                .setDescription('Set the role pinged for tier tests.')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The ping role.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('gamerole')
                .setDescription('Set a tester role for a gamemode.')
                .addStringOption(option =>
                    option
                        .setName('gamemode')
                        .setDescription('The gamemode.')
                        .setRequired(true)
                        .addChoices(
                            ...GAMEMODES.map(mode => ({
                                name: DISPLAY_NAMES[mode],
                                value: mode
                            }))
                        )
                )
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The tester role.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('limit')
                .setDescription('Set the daily tier testing limit.')
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('Maximum tests per day.')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        ),

    category: 'tier-testing',

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral
        });

        if (!deferred) return;

        try {
            const guildConfig = await getConfig(interaction, client);
            const subcommand = interaction.options.getSubcommand();

            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return replyUserError(interaction, {
                    type: ErrorTypes.PERMISSION,
                    message: 'You need the Manage Server permission to configure Tier Testing.'
                });
            }

            const updates = {};

            if (subcommand === 'testerrole') {
                const role = interaction.options.getRole('role');

                updates.tiertesterRoleId = role.id;

                await updateGuildConfig(client, interaction.guildId, updates);

                return InteractionHelper.safeEditReply(interaction, {
                    content: `General tier tester role set to ${role}.`
                });
            }

            if (subcommand === 'pingrole') {
                const role = interaction.options.getRole('role');

                updates.tiertestPingRoleId = role.id;

                await updateGuildConfig(client, interaction.guildId, updates);

                return InteractionHelper.safeEditReply(interaction, {
                    content: `Tier testing ping role set to ${role}.`
                });
            }

            if (subcommand === 'gamerole') {
                const gamemode = interaction.options.getString('gamemode');
                const role = interaction.options.getRole('role');

                updates.tiertesterRoles = {
                    ...(guildConfig.tiertesterRoles || {}),
                    [gamemode]: role.id
                };

                await updateGuildConfig(client, interaction.guildId, updates);

                return InteractionHelper.safeEditReply(interaction, {
                    content: `${DISPLAY_NAMES[gamemode]} tester role set to ${role}.`
                });
            }

            if (subcommand === 'limit') {
                const amount = interaction.options.getInteger('amount');

                updates.tiertestDailyLimit = amount;

                await updateGuildConfig(client, interaction.guildId, updates);

                return InteractionHelper.safeEditReply(interaction, {
                    content: `Daily tier testing limit set to **${amount}**.`
                });
            }
        } catch (error) {
            logger.error('Tier Testing command failed', {
                error: error.message,
                stack: error.stack,
                guildId: interaction.guildId,
                userId: interaction.user.id
            });

            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: 'Something went wrong while managing Tier Testing.'
            });
        }
    }
};


