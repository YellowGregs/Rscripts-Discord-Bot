import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const rscripts_api = 'https://rscripts.net/api';

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

const stripHtml = (html) => {
    const dom = new JSDOM(html);
    return dom.window.document.body.textContent || "";
};

const cleanDescription = (description) => { // makes the description shorter since uhh.. problems 
    const strippedDescription = stripHtml(description);
    const limit = 200; // Limit description to 200 characters
    return strippedDescription.length > limit ? `${strippedDescription.substring(0, limit)}...` : strippedDescription;
};

const fetchRawScript = async (download) => { // turn download into raw script lol
    if (!download) return 'Theres no download that was found sorry';
    try {
        const response = await fetch(`https://rscripts.net/raw/${download}`);
        if (!response.ok) {
            return 'Theres no script that was found sorry';
        }
        return response.text();
    } catch (error) {
        console.error('Error fetching raw script:', error);
        return 'Theres no script that was found sorry';
    }
};

const Embed_br = (script, rawScriptContent, page, maxPages) => {
    const user = script.user && script.user[0] ? script.user[0] : { username: 'Unknown', image: null, verified: false };
    const pfp_url = user.image ? `https://rscripts.net/assets/avatars/${user.image}` : 'https://img.getimg.ai/generated/img-u1vYyfAtK7GTe9OK1BzeH.jpeg';
    const description = cleanDescription(script.description) || 'No description available';

    const fields = [
        { name: 'Game', value: script.title || 'Universal Script', inline: true },
        { name: 'Verified', value: user.verified ? '✔️ Verified' : '❌ Not Verified', inline: true },
        { name: 'ScriptType', value: script.paid ? 'Paid' : 'Free', inline: true },
        { name: 'Universal', value: script.universal ? '✔️ Universal' : '❌ Not Universal', inline: true },
        { name: 'Views', value: script.views?.toString() || '0', inline: true },
        { name: 'Likes', value: script.likes?.toString() || '0', inline: true },
        { name: 'Dislikes', value: script.dislikes?.toString() || '0', inline: true },
        { name: 'Key', value: script.keySystem ? '🔑 Requires Key' : '🆓 No Key', inline: true },
        { name: 'Key Link', value: script.key_link ? `[Key Link](${script.key_link})` : 'N/A', inline: true },
        { name: 'Patched', value: script.patched ? '❌ Patched' : '✔️ Not Patched', inline: true },
        { name: 'Mobile Ready', value: script.mobileReady ? '✔️ Mobile Ready' : '❌ Not Mobile Ready', inline: true },
        { name: 'Created At', value: script.creation || 'N/A', inline: true }
    ];

    const otherFields = fields.map(field => ({
        name: field.name,
        value: field.value || 'N/A',
        inline: field.inline
    }));

    return new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(script.title || 'No title')
        .setURL(`https://rscripts.net/script/${script.slug}`)
        .setAuthor({ name: user.username, iconURL: pfp_url })
        .setThumbnail(script.gameThumbnail || 'https://media1.tenor.com/m/j9Jhn5M1Xw0AAAAd/neuro-sama-ai.gif')
        .setDescription(description)
        .addFields(otherFields)
        .addFields(
            { name: 'The Script', value: `\`\`\`lua\n${rawScriptContent}\n\`\`\`` },
            { name: 'Links', value: `[Raw Script](https://rscripts.net/raw/${script.download || 'N/A'}) - [Script Page](https://rscripts.net/script/${script.slug})` }
        )
        .setFooter({ text: `Page ${page} of ${maxPages}` });
};

client.on('messageCreate', async message => {
    if (message.content.startsWith('!search ')) {
        const query = message.content.replace('!search ', '');
        let page = 1;

        const fetchScripts = async (page) => {
            const response = await fetch(`${rscripts_api}/scripts?q=${encodeURIComponent(query)}&page=${page}&orderBy=date&sort=desc`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        };

        try {
            const data = await fetchScripts(page);
            if (data.scripts.length > 0) {
                const script = data.scripts[0];
                const rawScriptContent = await fetchRawScript(script.download);
                const embed = Embed_br(script, rawScriptContent, page, data.info.maxPages);

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('previous')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                    );

                const msg = await message.channel.send({ embeds: [embed], components: [row] });

                const filter = i => ['previous', 'next'].includes(i.customId) && i.user.id === message.author.id;
                const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

                collector.on('collect', async i => {
                    if (i.customId === 'next') {
                        page++;
                    } else if (i.customId === 'previous' && page > 1) {
                        page--;
                    }

                    const data = await fetchScripts(page);
                    const script = data.scripts[0];
                    const rawScriptContent = await fetchRawScript(script.download);
                    const embed = Embed_br(script, rawScriptContent, page, data.info.maxPages);

                    await i.update({ embeds: [embed], components: [row] });
                });
            } else {
                message.channel.send('No scripts found for the given query.');
            }
        } catch (error) {
            console.error(error);
            message.channel.send('An error occurred while fetching the scripts.');
        }
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);
