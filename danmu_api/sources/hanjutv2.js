import HanjutvSource from './hanjutv.js';

// 韩剧TV极简版独立源
export default class Hanjutv2Source extends HanjutvSource {
  constructor() {
    super();
    this.sourceKey = "hanjutv2";
    this.chainMode = "xiawen";
  }

  // 独立源默认按 xiawen 解释剧集ID
  async getEpisodeDanmu(id, chain = "xiawen") {
    return super.getEpisodeDanmu(id, chain);
  }
}
