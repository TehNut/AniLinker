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
  anime: {
    apply(contents, channel) {
      return handleMedia("ANIME", contents, channel);
    }
  },
};

Object.entries(commands).forEach(value => {
  const shortHand = commands[value[0].charAt(0) + ""] = {};
  shortHand.apply = (contents, channel) => value[1].apply(contents, channel);
});

if (!config.maxLength)
  config.maxLength = 300;

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
  if (raw.length > config.maxLength)
    raw = raw.substring(0, config.maxLength) + "...";
  
  return raw.trim();
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
      .setColor(media.image.color || 4044018)
      .setFooter(getFooterText(media));

    channel.send(embed)
  });

  function getFooterText(media) {
    switch (type) {
      case "MANGA": {
        if (media.chapters)
          return `${media.chapters} Chapter(s)`;

        return "";
      }
      case "ANIME": {
        let ret = "";
        if (media.episodes)
          ret += `${media.episodes} Episode(s)`;

        if (media.airingSchedule && media.airingSchedule.nodes.length > 0) {
          const next = media.airingSchedule.nodes[0];
          ret += `${ret.length > 0 ? " | " : ""} ${formatTime(next.timeUntilAiring)} until episode ${next.episode}`;
        }
        return ret;
      }
      default: return "";
    }
  }
}

function parseTime(secs) {
  let seconds = parseInt(secs, 10);

  let weeks = Math.floor(seconds / (3600 * 24 * 7));
  seconds -= weeks * 3600 * 24 * 7;
  let days = Math.floor(seconds / (3600 * 24));
  seconds -= days * 3600 * 24;
  let hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  let minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;

  return { weeks, days, hours, minutes, seconds };
}

function formatTime(secs, appendSeconds) {
  const time = parseTime(secs);

  let ret = "";
  if (time.weeks > 0)
    ret += time.weeks + "w";
  if (time.days > 0)
    ret += (ret.length === 0 ? "" : " ") + time.days + "d";
  if (time.hours > 0)
    ret += (ret.length === 0 ? "" : " ") + time.hours + "h";
  if (time.minutes > 0)
    ret += (ret.length === 0 ? "" : " ") + time.minutes + "m";

  if (appendSeconds && time.seconds > 0)
    ret += (ret.length === 0 ? "" : " ") + time.seconds + "s";

  return ret;
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