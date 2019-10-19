import { handleMedia } from "./util";

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
  }
}