const fs = require("fs");
const config = require("./config");
const fetch = require("node-fetch");
const discord = require("discord.js");
const client = new discord.Client();

require.extensions[".graphql"] = (module, filename) => {
  module.exports = fs.readFileSync(filename, "utf8");
};

const mediaQuery = require("./query/media_query.graphql");
const commands = {
  manga: {
    apply(contents, channel) {
      return handleMedia("MANGA", contents, channel);
    }
  },
  m: {
    apply(contents, channel) {
      return commands.manga.apply(contents, channel);
    }
  },
  anime: {
    apply(contents, channel) {
      return handleMedia("ANIME", contents, channel);
    }
  },
  a: {
    apply(contents, channel) {
      return commands.anime.apply(contents, channel);
    }
  },
};

const pattern = createPattern();
console.log("Matching pattern: " + pattern);

client.on("ready", () => console.log(`Logged in as ${client.user.tag}`));
client.on('error', console.error);
client.on("message", message => {
  if (message.author.bot)
    return;

  const match = message.content.match(pattern);
  if (!match)
    return;

  const command = commands[match[1]];
  if (!command)
    return;

  command.apply(match[2], message.channel).catch(error => message.channel.send(error.message));
});
client.login(config.token);

function getSearch(text) {
  const number = parseInt(text);
  return number ? number : text;
}

function createPattern() {
  const keys = Object.keys(commands).join("|");
  return new RegExp("(" + keys + ")\{(.+?)}");
}

function sanitizeDescription(raw) {
  raw = raw.replace(/<br>/g, "");
  if (raw.includes("~!"))
    raw = raw.substring(0, raw.indexOf("~!"));
  if (raw.length > 300)
    raw = raw.substring(0, 300) + "...";
  
  return raw;
}

function handleMedia(type, contents, channel) {
  const variables = { type };
  const search = getSearch(contents);
  if (typeof search === "string")
    variables.search = search;
  else
    variables.id = search;

  return queryAL(mediaQuery, variables).then(res => res.Media).then(media => {
    const embed = new discord.RichEmbed()
      .setAuthor(media.title.romaji, "https://anilist.co/img/logo_al.png", media.url)
      .setDescription(sanitizeDescription(media.description))
      .setThumbnail(media.image.extraLarge)
      .setColor(media.image.color || 4044018);

    channel.send(embed)
  });
}

const url = "https://graphql.anilist.co/";
const headers = {
  "Content-Type": "application/json",
  "Accept": "application/json"
};
function queryAL(query, variables) {
  return fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({ query, variables })
  }).then(res => res.json()).then(res => {
    if (res.errors)
      throw res.errors[0].message;

    return res;
  }).then(res => res.data);
}