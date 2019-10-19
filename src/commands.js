const fs = require("fs");
require.extensions[".graphql"] = (module, filename) => {
  module.exports = fs.readFileSync(filename, "utf8");
};
const discord = require("discord.js");
const userQuery = require("./query/user_query.graphql");
import { handleMedia, getSearch, queryAL, sanitizeDescription } from "./util";

export default {
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
  user: {
    apply(contents, channel) {
      const variables = {};
      const search = getSearch(contents);
      if (typeof search === "string")
        variables.name = search;
      else
        variables.id = search;

      return queryAL(userQuery, variables).then(res => res.User).then(user => {
        const about = user.about ? user.about.replace(/(~~~|\*\*\*|#{2,})/g, "") : "";

        const embed = new discord.RichEmbed()
          .setAuthor(user.name, "https://anilist.co/img/logo_al.png", user.url)
          .setDescription(sanitizeDescription(about, true))
          .setColor(getColor(user.options.profileColor))
          .setThumbnail(user.avatar.large)
          .setFooter(`${user.statistics.anime.episodesWatched} Episodes watched (${Math.round((user.statistics.anime.minutesWatched / 60 / 24) * 10) / 10} days) | ${user.statistics.manga.chaptersRead} Chapters read`);

        channel.send(embed);
      });

      function getColor(color) {
        switch (color) {
          case "blue": return "#3DB4F2";
          case "purple": return "#C063FF";
          case "green": return "#4CCA51";
          case "orange": return "#EF881A";
          case "red": return "#E13333";
          case "pink": return "#FC9FD6";
          case "gray": return "#677B94";
          default: return color;
        }
      }
    }
  }
}