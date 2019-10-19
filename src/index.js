const config = require("../config");
const discord = require("discord.js");
const client = new discord.Client();
import commands from "./commands";

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

function createPattern() {
  const keys = Object.keys(commands).join("|");
  return new RegExp("(" + keys + ")\{(.+?)}");
}