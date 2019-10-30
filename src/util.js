const fs = require("fs");
require.extensions[".graphql"] = (module, filename) => {
  module.exports = fs.readFileSync(filename, "utf8");
};
const config = require("../config");
const discord = require("discord.js");
const fetch = require("node-fetch");
const striptags = require("striptags");
const mediaQuery = require("./query/media_query.graphql");

export function getSearch(text) {
  const number = parseInt(text);
  return number ? number : text;
}

export function sanitizeDescription(raw, media) {
  raw = striptags(raw)
    .replace(/([\n\r])+/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/\[(.+?)]\(.*?\)/g, "$1")
    .replace(/img.*?\(.*?\)/g, "");

  if (media)
    raw = raw.substring(0, config.maxLength) + "...";
  return raw.trim();
}

export function handleMedia(type, contents, channel) {
  const variables = { type };
  const search = getSearch(contents);
  if (typeof search === "string")
    variables.search = search;
  else
    variables.id = search;

  return queryAL(mediaQuery, variables).then(res => res.Media).then(media => {
    const embed = new discord.RichEmbed()
      .setAuthor(media.title.romaji, "https://anilist.co/img/logo_al.png", media.url)
      .setDescription(sanitizeDescription(media.description, true))
      .setThumbnail(media.image.extraLarge)
      .setColor(media.image.color || 4044018)
      .setFooter(getFooterText(media));

    channel.send(embed)
  });

  function getFooterText(media) {
    switch (type) {
      case "MANGA": {
        let ret = displayify(media.format);

        if (media.format !== "ONE_SHOT" && media.chapters)
          ret = createOrAppend(ret, "•", `${media.chapters} Chapter(s)`);

        return ret;
      }
      case "ANIME": {
        let ret = displayify(media.format);
        if (media.format !== "MOVIE" && media.episodes)
          ret = createOrAppend(ret, "•", `${media.episodes} Episode(s)`);

        if (media.airingSchedule && media.airingSchedule.nodes.length > 0) {
          const next = media.airingSchedule.nodes[0];
          ret = createOrAppend(ret, "•", `${formatTime(next.timeUntilAiring)} until episode ${next.episode}`);
        }
        return ret;
      }
      default: return "";
    }
  }
}

function displayify(enumVal) {
  const words = enumVal.split("_");
  for (let i = 0; i < words.length; i++)
    words[i] = words[i].substr(0, 1) + words[i].toLowerCase().substr(1);

  return words.join(" ");
}

export function parseTime(secs) {
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

export function formatTime(secs, appendSeconds) {
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

function createOrAppend(input, splitter, append) {
  return input.length > 0 ? `${input} • ${append}` : append;
}

const url = "https://graphql.anilist.co/";
const headers = {
  "Content-Type": "application/json",
  "Accept": "application/json"
};
export function queryAL(query, variables) {
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