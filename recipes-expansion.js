/* 完整版配方擴充：10 組一般配方與 40 組山海配方。所有合成關係皆為遊戲設定。 */
(function () {
  'use strict';

  function R(id, a, b, result, cost, minLevel, minBlood, success, hint, options) {
    options = options || {};
    return {
      id, materialA: a, materialB: b, ordered: Boolean(options.ordered), result,
      rarity: '普通', category: options.shanhai ? '山海配方' : '一般配方',
      cost, minLevel, minBlood, success, failureResult: options.failureResult || null,
      levelModifier: options.levelModifier || 0, hint,
      initiallyUnlocked: Boolean(options.unlocked), reward: options.reward || 40
    };
  }

  const recipes = [
    R('r051', 'mist_hound', 'red_sparrow', 'lamp_fox', 70, 6, 20, 86, '霧爪追上赤羽，餘火便在狐尾間點起。'),
    R('r052', 'moon_deer', 'rain_frog', 'mirror_carp', 75, 7, 22, 84, '月紋沉進雨鼓，水面凝成一片明鏡。'),
    R('r053', 'rock_tapir', 'stone_root', 'stone_beetle', 80, 7, 24, 83, '厚背壓住石根，碎岩之間響起甲足。'),
    R('r054', 'cloud_swallow', 'wind_clock_bird', 'dawn_crane', 95, 9, 28, 80, '雲翎掠過風樞，曉光沿長喙展開。'),
    R('r055', 'night_bat', 'ghost_lamp', 'well_echo', 90, 8, 26, 81, '夜翼蓋住幽燈，井底回聲便有了形體。'),
    R('r056', 'rain_kite', 'mirror_carp', 'mist_eel', 105, 10, 32, 77, '雨絃落入鏡鱗，細長電光穿霧游出。'),
    R('r057', 'ember_crab', 'furnace_gear_lion', 'bronze_doll', 120, 11, 35, 74, '炭鉗校正爐齒，青銅關節重新咬合。'),
    R('r058', 'dew_sprout', 'sun_blossom', 'dandelion_spirit', 85, 8, 24, 82, '露芽接住曦瓣，蒲絮乘著暖風醒來。'),
    R('r059', 'shadow_vine', 'grave_moss', 'ash_wraith', 115, 11, 34, 73, '影藤繞過墓苔，灰燼從無聲處聚成人形。'),
    R('r060', 'water_clock_beast', 'moon_mirror_guard', 'bronze_doll', 135, 12, 38, 70, '滴漏走完一輪月影，古偶的發條再次上緊。'),

    R('r061', 'mirror_carp', 'mist_eel', 'sj_heluo', 180, 10, 40, 75, '鏡鱗分出十道霧電水脈，一首十身的魚影回以犬吠。', { shanhai: true, levelModifier: 2, reward: 90 }),
    R('r062', 'ink_cat', 'mist_hound', 'sj_mengji', 170, 10, 38, 76, '墨影伏入霧爪留下的白痕，額紋白豹悄然現身。', { shanhai: true, levelModifier: 2, reward: 90 }),
    R('r063', 'sj_mengji', 'bronze_doll', 'sj_zhuqian', 230, 12, 58, 68, '伏豹與青銅面相合，長尾繞住唯一睜開的眼。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r064', 'night_bat', 'rain_kite', 'sj_suanyu', 225, 12, 42, 69, '兩道暗翼切開雨幕，六目蛇影以三足落地。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r065', 'red_sparrow', 'stone_root', 'sj_jingwei', 300, 14, 48, 64, '赤足鳥銜起石根碎片，一次又一次飛向東海。', { shanhai: true, levelModifier: 4, reward: 150 }),
    R('r066', 'moon_deer', 'ghost_lamp', 'sj_paoxiao', 340, 15, 55, 59, '月下羊影遮住幽燈，腋下雙目與虎齒一同張開。', { shanhai: true, levelModifier: 4, reward: 170 }),
    R('r067', 'rock_tapir', 'water_clock_beast', 'sj_zhuhuai', 255, 13, 45, 66, '厚背承住四方滴漏，四角牛影發出雁鳴。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r068', 'mist_hound', 'cloud_swallow', 'sj_ershu', 175, 9, 35, 78, '霧爪追著雲翎旋轉，兔首小獸以尾乘風。', { shanhai: true, levelModifier: 2, reward: 90 }),
    R('r069', 'sj_ershu', 'mirror_carp', 'sj_xixi', 245, 11, 58, 68, '飛尾掠過鏡水，五對羽翼的末端逐一生出鱗光。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r070', 'sj_mengji', 'cloud_swallow', 'sj_tianma', 235, 11, 58, 70, '白身伏獸追上雲翎，黑首犬形見人即飛。', { shanhai: true, levelModifier: 3, reward: 120 }),

    R('r071', 'thunder_turtle', 'mirror_carp', 'sj_yongyong', 185, 10, 38, 75, '雷殼沉入鏡水，牛形魚以低沉彘鳴回應。', { shanhai: true, levelModifier: 2, reward: 90 }),
    R('r072', 'ember_crab', 'stone_beetle', 'sj_tongtong', 190, 10, 36, 74, '炭鉗敲開石甲，珠粒沿著小豚背脊滾動。', { shanhai: true, levelModifier: 2, reward: 90 }),
    R('r073', 'sj_tongtong', 'mirror_carp', 'sj_zhubie', 235, 11, 58, 69, '豚背之珠落入鏡水，六足肺形水獸睜開眼。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r074', 'lamp_fox', 'mirror_carp', 'sj_zhunou', 225, 11, 36, 71, '狐火沉進水鏡，朱紅狐身兩側展開魚鰭。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r075', 'sj_zhunou', 'cloud_swallow', 'sj_biebie', 260, 12, 60, 65, '魚翼轉為長風，狐形振翼並發出鴻雁之音。', { shanhai: true, levelModifier: 3, reward: 130 }),
    R('r076', 'sj_ninetail', 'sj_zhuqian', 'sj_longzhi', 520, 17, 150, 43, '九尾影與獨目長尾交錯，九首虎爪在凶光中成形。', { shanhai: true, levelModifier: 5, reward: 250 }),
    R('r077', 'moon_deer', 'mist_eel', 'sj_yuanhu', 195, 10, 37, 74, '麋影踏入電霧，雙眼映出魚群側光。', { shanhai: true, levelModifier: 2, reward: 90 }),
    R('r078', 'mud_loach', 'red_sparrow', 'sj_gege', 200, 10, 34, 73, '泥鬚承住赤羽尾光，六足鯉影奔入深澤。', { shanhai: true, levelModifier: 2, reward: 90 }),
    R('r079', 'sj_tongtong', 'dew_sprout', 'sj_dangkang', 250, 12, 55, 67, '珠背小豚拱過露芽，獠牙旁長出豐年穀穗。', { shanhai: true, levelModifier: 3, reward: 130 }),
    R('r080', 'sj_zhuhuai', 'night_bat', 'sj_fei', 430, 16, 120, 49, '四角牛影被夜翼削去三角，白首獨目拖出蛇尾。', { shanhai: true, levelModifier: 5, reward: 220 }),

    R('r081', 'sj_lu_fish', 'cloud_swallow', 'sj_flyingfish', 205, 10, 55, 72, '短翼魚影借來雲翎，只憑寬鰭越過勞水。', { shanhai: true, levelModifier: 2, reward: 100 }),
    R('r082', 'ink_cat', 'sun_blossom', 'sj_feifei', 205, 10, 38, 73, '墨色狸影穿過曦瓣，白尾與短鬣帶走愁霧。', { shanhai: true, levelModifier: 2, reward: 100 }),
    R('r083', 'sj_dangkang', 'bronze_doll', 'sj_longchi', 275, 13, 58, 63, '豐年獠牙碰上青銅機括，一對厚角發出號聲。', { shanhai: true, levelModifier: 3, reward: 130 }),
    R('r084', 'sj_mengji', 'well_echo', 'sj_mafu', 300, 14, 90, 60, '伏豹聽見井中嬰啼，人面虎身從回聲裡踏出。', { shanhai: true, levelModifier: 4, reward: 150 }),
    R('r085', 'sj_lushu', 'mirror_carp', 'sj_fuzhu', 390, 15, 110, 53, '白首虎紋洗入鏡水，四角白鹿帶來洪流徵兆。', { shanhai: true, levelModifier: 4, reward: 190 }),
    R('r086', 'dew_sprout', 'bronze_doll', 'sj_jiaochong', 400, 15, 48, 54, '露芽繞著青銅雙面盤旋，群蜂在平逢山築廬。', { shanhai: true, levelModifier: 4, reward: 190 }),
    R('r087', 'red_sparrow', 'dawn_crane', 'sj_lingyao', 270, 12, 44, 65, '赤羽與曉燈交疊，青喙長尾在丹火中成形。', { shanhai: true, levelModifier: 3, reward: 130 }),
    R('r088', 'sj_lingyao', 'reed_owl', 'sj_qiezhi', 285, 13, 75, 62, '丹火長尾掠過蘆葉，赤身白首的梟影張翼禦焰。', { shanhai: true, levelModifier: 3, reward: 140 }),
    R('r089', 'reed_owl', 'paper_wraith', 'sj_qizhong', 310, 14, 40, 59, '蘆葉翻過紙衣，單足梟影拖著短短彘尾。', { shanhai: true, levelModifier: 4, reward: 150 }),
    R('r090', 'sj_paoxiao', 'red_sparrow', 'sj_yonghe', 360, 15, 120, 55, '凶獸腋目映著赤羽，黃身猿影亮起紅眼紅喙。', { shanhai: true, levelModifier: 4, reward: 180 }),

    R('r091', 'sj_fei', 'sj_gudiao', 'sj_qiongqi', 650, 18, 170, 38, '枯行獨目迎上雕形凶鳥，牛身長出遍體蝟刺。', { shanhai: true, levelModifier: 6, reward: 320 }),
    R('r092', 'sj_mengji', 'sun_blossom', 'sj_tiangou', 330, 14, 100, 58, '白伏獸走入曦光，白首狸影在陰山禦凶。', { shanhai: true, levelModifier: 4, reward: 170 }),
    R('r093', 'sj_tiangou', 'sj_dangkang', 'sj_jiao', 410, 16, 155, 50, '白首守者踏過穰歲田野，犬身浮出豹紋牛角。', { shanhai: true, levelModifier: 5, reward: 210 }),
    R('r094', 'sj_tianma', 'sj_zhuqian', 'sj_bo', 480, 17, 154, 46, '飛犬與獨目長尾相擊，鼓聲喚醒白身黑尾的獨角獸。', { shanhai: true, levelModifier: 5, reward: 240 }),
    R('r095', 'sj_heluo', 'sj_ninetail', 'sj_xiangliu', 820, 19, 175, 34, '十道魚身纏住九尾，青蛇九首在洪澤中甦醒。', { shanhai: true, levelModifier: 7, reward: 420 }),
    R('r096', 'sj_xiangliu', 'sj_fenghuang', 'sj_zhulong', 980, 20, 196, 29, '九首洪澤遇上五德火文，章尾山的直目照開九陰。', { shanhai: true, levelModifier: 8, reward: 520 }),
    R('r097', 'sj_shengyu', 'sj_yingzhao', 'sj_yinglong', 900, 19, 176, 31, '洪兆赤鳥引來巡界羽獸，南極雲雨沿龍形落下。', { shanhai: true, levelModifier: 7, reward: 470 }),
    R('r098', 'thunder_turtle', 'sj_fei', 'sj_kui', 760, 18, 118, 36, '雷殼擊破枯行疫影，流波山上一足蒼牛踏出風雨。', { shanhai: true, levelModifier: 7, reward: 400 }),
    R('r099', 'sj_paoxiao', 'sj_gege', 'sj_ba', 720, 18, 160, 37, '吞影凶獸與六足澤魚化為四色巨蛇，盤山而臥。', { shanhai: true, levelModifier: 6, reward: 380 }),
    R('r100', 'sj_luwu', 'sj_longzhi', 'sj_kaiming', 1000, 20, 180, 28, '崑崙時盤合上九首凶影，九門守者朝東睜眼。', { shanhai: true, levelModifier: 8, reward: 600 })
  ];

  window.GameData.RECIPES.push(...recipes);

  // 配方品階依完整百方錄的發現順序分級：40／25／20／10／4／1。
  const tiers = [
    ['普通', 40], ['精良', 25], ['稀有', 20],
    ['史詩', 10], ['傳說', 4], ['神話', 1]
  ];
  let cursor = 0;
  tiers.forEach(([rarity, amount]) => {
    window.GameData.RECIPES.slice(cursor, cursor + amount).forEach((recipe) => { recipe.rarity = rarity; });
    cursor += amount;
  });

  /*
   * 以一般探索池的基礎等級逐輪推演，避免配方門檻高於其材料在遊戲內
   * 能達到的值。結果仍嚴格使用 floor((A+B)/2)+配方修正值。
   */
  const all = [...window.GameData.ORIGINAL_MONSTERS, ...window.GameData.SHANHAI_MONSTERS];
  const byId = Object.fromEntries(all.map((monster) => [monster.id, monster]));
  const explorationSeeds = [
    'moss_horn', 'dandelion_spirit', 'reed_owl', 'dew_sprout', 'ember_mushroom',
    'lamp_fox', 'red_sparrow', 'ember_crab', 'rock_tapir', 'stone_beetle',
    'rain_frog', 'mud_loach', 'thunder_turtle', 'mirror_carp', 'well_echo',
    'bronze_doll', 'wind_clock_bird', 'water_clock_beast', 'ghost_lamp', 'paper_wraith',
    'grave_moss', 'ink_cat', 'night_bat', 'cloud_swallow', 'mist_hound', 'rain_kite',
    'dawn_crane', 'moon_deer', 'shadow_vine'
  ];
  const reachableLevel = Object.fromEntries(all.map((monster) => [monster.id, 0]));
  explorationSeeds.forEach((id) => { reachableLevel[id] = byId[id].level; });
  for (let pass = 0; pass < 300; pass++) {
    let changed = false;
    window.GameData.RECIPES.forEach((recipe) => {
      const a = reachableLevel[recipe.materialA]; const b = reachableLevel[recipe.materialB];
      if (!a || !b) return;
      const average = Math.floor((a + b) / 2);
      const bloodSum = byId[recipe.materialA].bloodline + byId[recipe.materialB].bloodline;
      recipe.minLevel = Math.min(recipe.minLevel, Math.max(1, average));
      recipe.minBlood = Math.min(recipe.minBlood, bloodSum);
      const resultLevel = Math.min(50, average + (recipe.levelModifier || 0));
      if (resultLevel > reachableLevel[recipe.result]) { reachableLevel[recipe.result] = resultLevel; changed = true; }
    });
    if (!changed) break;
  }
  window.GameData.RECIPE_PROGRESSION = { explorationSeeds, reachableLevel };
})();
