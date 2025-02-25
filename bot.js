import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const Rscripts = 'https://rscripts.net/api/v2';

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

const strip = (html) => {
  const dom = new JSDOM(html);
  return dom.window.document.body.textContent || "";
};

const Descriptions = (description) => {
  const stripped = strip(description || '');
  const limit = 200;
  return stripped.length > limit ? `${stripped.substring(0, limit)}...` : stripped;
};

const Raw_Script = async (raw_scripts) => {
  if (!raw_scripts) return 'No raw script URL provided.';
  try {
    const response = await fetch(raw_scripts);
    if (!response.ok) {
      console.error(`Failed to fetch raw script: ${response.statusText}`);
      return 'Error fetching script content.';
    }
    const text = await response.text();
    return text.length > 900 ? `${text.substring(0, 900)}...` : text;
  } catch (error) {
    console.error('Error fetching raw script:', error);
    return 'Error fetching script content.';
  }
};

const Embeds = (script, raw_content, page, maxPages) => {
  const user = script.user || { username: 'Unknown', image: null, verified: false };
  const pfpUrl = user.image || 'https://img.getimg.ai/generated/img-u1vYyfAtK7GTe9OK1BzeH.jpeg';
  const description = Descriptions(script.description || 'No description available');

  const gameTitle = (script.game && script.game.title) || script.title || 'Universal Script';

  const keyFieldValue = script.keySystem ? '🔑 Requires Key' : '🆓 No Key';

  const fields = [
    { name: 'Game', value: gameTitle, inline: true },
    { name: 'Verified', value: user.verified ? '✔️ Verified' : '❌ Not Verified', inline: true },
    { name: 'Script Type', value: script.paid ? 'Paid' : 'Free', inline: true },
    { name: 'Universal', value: script.universal ? '✔️ Universal' : '❌ Not Universal', inline: true },
    { name: 'Views', value: script.views?.toString() || '0', inline: true },
    { name: 'Likes', value: script.likes?.toString() || '0', inline: true },
    { name: 'Dislikes', value: script.dislikes?.toString() || '0', inline: true },
    { name: 'Key', value: keyFieldValue, inline: true },
    { name: 'Patched', value: script.patched ? '❌ Patched' : '✔️ Not Patched', inline: true },
    { name: 'Mobile Ready', value: script.mobileReady ? '✔️ Mobile Ready' : '❌ Not Mobile Ready', inline: true },
    { name: 'Created At', value: script.createdAt ? new Date(script.createdAt).toLocaleString() : 'N/A', inline: true }
  ];

  return new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(script.title || 'No Title')
    .setURL(`https://rscripts.net/script/${script.slug || script._id}`)
    .setAuthor({ name: user.username, iconURL: pfpUrl })
    .setThumbnail((script.game && script.game.imgurl) || script.image || 'https://media1.tenor.com/m/j9Jhn5M1Xw0AAAAd/neuro-sama-ai.gif')
    .setDescription(description)
    .addFields(fields)
    .addFields(
      { name: 'The Script', value: `\`\`\`lua\n${raw_content}\n\`\`\`` },
      { name: 'Links', value: `[Raw Script](${script.rawScript || 'N/A'}) - [Script Page](https://rscripts.net/script/${script.slug || script._id})` }
    )
    .setFooter({ text: `Page ${page} of ${maxPages}` });
};

const fetchScripts = async (query, page = 1) => {
  try {
    const url = `${Rscripts}/scripts?q=${encodeURIComponent(query)}&page=${page}&orderBy=date&sort=desc`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    const data = await response.json();
    if (!data.scripts || data.scripts.length === 0) {
      return { scripts: [], info: { currentPage: page, maxPages: page } };
    }
    return data;
  } catch (error) {
    console.error('Error fetching scripts:', error);
    throw error;
  }
};

const Actions = (currentPage, maxPages) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('first')
      .setLabel('⏪ First')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 1),
    new ButtonBuilder()
      .setCustomId('previous')
      .setLabel('◀️ Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId('page')
      .setLabel(`Page ${currentPage} of ${maxPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('next')
      .setLabel('▶️ Next')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage >= maxPages),
    new ButtonBuilder()
      .setCustomId('last')
      .setLabel('⏭️ Last')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === maxPages)
  );

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith('!search ')) {
    const query = message.content.slice(8).trim();
    if (!query) {
      return message.channel.send('Please provide a search query.');
    }
    let page = 1;
    let data;

    try {
      data = await fetchScripts(query, page);
    } catch (error) {
      return message.channel.send('An error occurred while fetching scripts.');
    }

    if (!data.scripts.length) {
      return message.channel.send('No scripts found for the given query.');
    }

    let script = data.scripts[0];
    const raw_scripts = script.rawScript || (script.download ? `https://rscripts.net/raw/${script.download}` : null);
    const raw_content = await Raw_Script(raw_scripts);
    let embed = Embeds(script, raw_content, page, data.info.maxPages);
    let row = Actions(page, data.info.maxPages);

    const msg = await message.channel.send({ embeds: [embed], components: [row] });
    const filter = i => ['first', 'previous', 'next', 'last'].includes(i.customId) && i.user.id === message.author.id;
    const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
      try {
        if (i.customId === 'first') {
          page = 1;
        } else if (i.customId === 'previous' && page > 1) {
          page--;
        } else if (i.customId === 'next') {
          page++;
        } else if (i.customId === 'last') {
          const tempData = await fetchScripts(query, page);
          page = tempData.info.maxPages;
        }

        const newData = await fetchScripts(query, page);
        if (!newData.scripts.length) {
          return i.reply({ content: 'No scripts found on this page.', ephemeral: true });
        }
        script = newData.scripts[0];
        const new_raw_scripts = script.rawScript || (script.download ? `https://rscripts.net/raw/${script.download}` : null);
        const new_raw_content = await Raw_Script(new_raw_scripts);
        embed = Embeds(script, new_raw_content, page, newData.info.maxPages);
        row = Actions(page, newData.info.maxPages);
        await i.update({ embeds: [embed], components: [row] });
      } catch (err) {
        console.error('Error during pagination:', err);
        await i.reply({ content: 'An error occurred while updating the script.', ephemeral: true });
      }
    });

    collector.on('end', () => {
      msg.edit({ components: [] });
    });
  }
});

client.login(process.env.BOT_TOKEN);
