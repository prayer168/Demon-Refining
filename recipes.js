/* 煉妖配方與完整配對規則。配方均為遊戲原創設定，並非《山海經》記載。 */
(function () {
  'use strict';

  const racePairs = {
    '獸族+獸族': ['獸族'], '獸族+羽族': ['獸族', '羽族'], '獸族+水族': ['獸族', '水族'],
    '獸族+木靈': ['木靈'], '獸族+幽族': ['獸族', '幽族'], '獸族+機關族': ['機關族', '獸族'],
    '羽族+羽族': ['羽族'], '羽族+水族': ['水族', '羽族'], '羽族+木靈': ['羽族', '木靈'],
    '羽族+幽族': ['幽族', '羽族'], '羽族+機關族': ['機關族'],
    '水族+水族': ['水族'], '水族+木靈': ['水族', '木靈'], '水族+幽族': ['幽族', '水族'],
    '水族+機關族': ['機關族', '水族'], '木靈+木靈': ['木靈'], '木靈+幽族': ['幽族', '木靈'],
    '木靈+機關族': ['機關族', '木靈'], '幽族+幽族': ['幽族'], '幽族+機關族': ['幽族', '機關族'],
    '機關族+機關族': ['機關族']
  };

  function pairKey(a, b, order) {
    if (order) return `${a}+${b}`;
    const orderMap = { 獸族: 0, 羽族: 1, 水族: 2, 木靈: 3, 幽族: 4, 機關族: 5 };
    if (orderMap[a] <= orderMap[b]) return `${a}+${b}`;
    return `${b}+${a}`;
  }

  const elements = ['火', '水', '木', '土', '風', '光', '暗', '無'];
  const elementPriority = { 火: 8, 水: 7, 木: 6, 土: 5, 風: 4, 光: 3, 暗: 2, 無: 1 };
  const elementOverrides = {
    '火+木': ['火'], '火+水': ['無', '水'], '水+土': ['土', '水'], '火+風': ['火', '風'],
    '光+暗': ['無', '光', '暗'], '水+木': ['木', '水'], '水+風': ['風', '水'], '暗+暗': ['暗'],
    '光+光': ['光'], '無+無': ['無'], '土+風': ['土', '風'], '火+土': ['火', '土']
  };
  const ELEMENT_COMBINATIONS = {};
  elements.forEach((a, i) => elements.slice(i).forEach((b) => {
    const sorted = [a, b].sort((x, y) => elementPriority[y] - elementPriority[x]);
    const key = `${sorted[0]}+${sorted[1]}`;
    ELEMENT_COMBINATIONS[key] = elementOverrides[key] || (a === b ? [a] : (a === '無' ? [b] : b === '無' ? [a] : [a, b]));
  }));

  function R(id, a, b, result, rarity, cost, minLevel, minBlood, success, hint, options) {
    options = options || {};
    return {
      id, materialA: a, materialB: b, ordered: Boolean(options.ordered), result,
      rarity, category: options.shanhai ? '山海配方' : '一般配方', cost, minLevel, minBlood,
      success, failureResult: options.failureResult || null, levelModifier: options.levelModifier || 0,
      hint, initiallyUnlocked: Boolean(options.unlocked), reward: options.reward || 30
    };
  }

  const RECIPES = [
    R('r001', 'moss_horn', 'red_sparrow', 'ember_mushroom', '普通', 35, 1, 0, 96, '苔角沾上火羽，會長出溫暖的菌傘。', { unlocked: true }),
    R('r002', 'moss_horn', 'rain_frog', 'dew_sprout', '普通', 35, 1, 0, 96, '林間的角與晨雨，喚醒沉睡嫩芽。', { unlocked: true }),
    R('r003', 'lamp_fox', 'rain_frog', 'mud_loach', '普通', 40, 2, 0, 92, '順序線索：先讓狐火烘土，再聽雨鼓。', { ordered: true, unlocked: true }),
    R('r004', 'rain_frog', 'lamp_fox', 'mist_eel', '精良', 55, 3, 5, 86, '順序線索：先降雨，再以尾燈蒸出帶電白霧。', { ordered: true }),
    R('r005', 'lamp_fox', 'dandelion_spirit', 'ember_mushroom', '普通', 35, 1, 0, 95, '火星落上絨種，燼菇從灰中探頭。', { unlocked: true }),
    R('r006', 'red_sparrow', 'dandelion_spirit', 'cloud_swallow', '精良', 50, 3, 6, 90, '赤羽乘風褪去火色，化作雲翎。'),
    R('r007', 'bronze_doll', 'moss_horn', 'stone_beetle', '普通', 40, 2, 0, 94, '青銅關節與苔角的力量，壓成六枚石輪。', { unlocked: true }),
    R('r008', 'bronze_doll', 'lamp_fox', 'furnace_gear_lion', '稀有', 100, 8, 18, 75, '無人看守的青銅身軀，等待灼熱尾燈點亮爐心。', { levelModifier: 2 }),
    R('r009', 'bronze_doll', 'rain_frog', 'water_clock_beast', '精良', 60, 4, 8, 88, '雨滴落進空心銅偶，每百滴便轉動一格。'),
    R('r010', 'bronze_doll', 'dandelion_spirit', 'wind_clock_bird', '精良', 60, 4, 8, 88, '銅片抓住一縷蒲風，樞翼開始轉動。'),
    R('r011', 'ghost_lamp', 'bronze_doll', 'paper_wraith', '精良', 55, 3, 8, 88, '順序線索：冷燈先照過青銅，殘符才會穿成紙衣。', { ordered: true }),
    R('r012', 'bronze_doll', 'ghost_lamp', 'stone_beetle', '普通', 45, 3, 8, 90, '順序線索：青銅先鎮住冷焰，只留下石輪機關。', { ordered: true }),
    R('r013', 'rain_frog', 'dandelion_spirit', 'rain_kite', '稀有', 90, 7, 18, 80, '鼓聲把絨種送上雲端，化成會彈雨絃的長尾。'),
    R('r014', 'lamp_fox', 'red_sparrow', 'ember_crab', '精良', 55, 4, 10, 89, '兩道火息沉入溫泉石縫，凝成一雙紅鉗。'),
    R('r015', 'moss_horn', 'dandelion_spirit', 'reed_owl', '精良', 50, 3, 6, 90, '苔與絨種壓成乾葉，夜裡翻頁成梟。'),
    R('r016', 'mud_loach', 'stone_beetle', 'thunder_turtle', '精良', 60, 5, 10, 87, '泥底的鬚纏住石輪，遠雷便留在新生龜甲上。'),
    R('r017', 'ghost_lamp', 'dandelion_spirit', 'grave_moss', '精良', 55, 4, 12, 88, '冷燈下的絨種不飛，安靜覆上一方無名石。'),
    R('r018', 'ghost_lamp', 'lamp_fox', 'ash_wraith', '稀有', 90, 7, 18, 79, '冷焰與狐火互相吞噬，只餘不肯熄滅的灰。'),
    R('r019', 'ghost_lamp', 'rain_frog', 'well_echo', '精良', 55, 4, 10, 88, '雨鼓落入深井，回聲替冷燈說完未竟的話。'),
    R('r020', 'ghost_lamp', 'red_sparrow', 'night_bat', '精良', 60, 5, 12, 86, '赤羽被幽焰熏黑，展成聽風的薄翼。'),
    R('r021', 'moss_horn', 'rock_tapir', 'stone_root', '精良', 60, 5, 12, 88, '苔角牽引石背沉入土中，根鬚穿過岩縫。'),
    R('r022', 'lamp_fox', 'bronze_doll', 'furnace_gear_lion', '稀有', 110, 9, 20, 74, '順序線索：尾燈先行，才喚醒爐齒鬃毛。', { ordered: true, levelModifier: 2 }),
    R('r023', 'rain_frog', 'stone_beetle', 'mud_loach', '普通', 40, 2, 0, 94, '雨水將石輪壓進泥底，長出尋水的鬚。'),
    R('r024', 'red_sparrow', 'bronze_doll', 'furnace_gear_lion', '稀有', 105, 8, 18, 76, '赤羽落進齒輪心室，點燃沉睡的機關獅。'),
    R('r025', 'cloud_swallow', 'rain_frog', 'mist_eel', '精良', 65, 6, 14, 86, '雲翎穿過鼓雨，細長電光在霧裡游動。'),
    R('r026', 'stone_beetle', 'lamp_fox', 'rock_tapir', '精良', 65, 6, 15, 87, '尾燈烘熱石輪，聚成能聽山聲的厚背。'),
    R('r027', 'reed_owl', 'ghost_lamp', 'paper_wraith', '精良', 65, 6, 15, 86, '蘆葉翻過冷燈，舊紙在夜風裡起身。'),
    R('r028', 'dew_sprout', 'cloud_swallow', 'sun_blossom', '稀有', 95, 9, 22, 78, '晨露被雲翎托到日出處，第一片曦瓣開放。'),
    R('r029', 'ink_cat', 'shadow_vine', 'dawn_bell_soul', '稀有', 110, 11, 30, 72, '兩道深影纏到盡頭，反而搖醒破曉清鈴。', { levelModifier: 1 }),
    R('r030', 'mirror_carp', 'bronze_doll', 'moon_mirror_guard', '史詩', 180, 14, 40, 65, '水中星光照進古鏡，無人的祭壇重新有了守衛。', { levelModifier: 2 }),

    R('r031', 'reed_owl', 'mist_hound', 'sj_shengsheng', '稀有', 150, 10, 32, 72, '白耳聽見林梟翻頁，長臂便沿霧奔來。', { shanhai: true, levelModifier: 2, reward: 80 }),
    R('r032', 'moon_deer', 'rock_tapir', 'sj_lushu', '史詩', 240, 14, 45, 62, '白首映月，虎文浮上厚背，赤尾唱出古老歌謠。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r033', 'thunder_turtle', 'reed_owl', 'sj_xuangui', '稀有', 170, 11, 33, 70, '劈木般的殼鳴，正等待一枚鳥首與蛇尾。', { shanhai: true, levelModifier: 2, reward: 80 }),
    R('r034', 'mirror_carp', 'mist_hound', 'sj_lu_fish', '史詩', 250, 14, 45, 61, '離水的魚影越過山陵，牛形與短翼在夏夜重生。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r035', 'ink_cat', 'moon_deer', 'sj_ninetail', '傳說', 420, 20, 68, 48, '九條影子並非天生，而是青丘血脈甦醒的證明。', { shanhai: true, levelModifier: 5, reward: 220 }),
    R('r036', 'mirror_carp', 'well_echo', 'sj_chiru', '稀有', 160, 10, 35, 72, '水鏡裡的人面聽見成雙鳥鳴，赤色鱗光便浮起。', { shanhai: true, levelModifier: 2, reward: 80 }),
    R('r037', 'rain_kite', 'mist_hound', 'sj_changyou', '史詩', 230, 13, 42, 63, '四耳同時聽見雨絃與逐霧爪，洪吟從山谷回答。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r038', 'night_bat', 'stone_root', 'sj_gudiao', '史詩', 250, 14, 44, 60, '暗翼掠過石角，嬰啼般的聲音從高處傳來。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r039', 'dawn_crane', 'mud_loach', 'sj_quru', '稀有', 180, 11, 36, 69, '白首涉水三步，人面之鳥呼出自己的名字。', { shanhai: true, levelModifier: 2, reward: 80 }),
    R('r040', 'dawn_crane', 'sun_blossom', 'sj_fenghuang', '神話', 900, 28, 88, 32, '五色之文不在羽毛多寡，而在德、義、禮、仁、信齊備。', { shanhai: true, levelModifier: 7, reward: 500 }),
    R('r041', 'ash_wraith', 'rock_tapir', 'sj_zhuyan', '史詩', 260, 15, 47, 59, '白首踏過赤色兵塵，石背也壓不住戰兆。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r042', 'ember_crab', 'wind_clock_bird', 'sj_feiyi', '史詩', 270, 15, 48, 57, '乾裂地上，六足承著四翼，赤熱蛇身不等雨來。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r043', 'moon_deer', 'cloud_swallow', 'sj_yingzhao', '傳說', 450, 20, 70, 45, '虎紋落上馬身，鳥翼將巡過四海。', { shanhai: true, levelModifier: 5, reward: 220 }),
    R('r044', 'rock_tapir', 'moon_mirror_guard', 'sj_luwu', '傳說', 480, 22, 75, 42, '九格時盤轉動，虎身九尾的守者在崑崙門前睜眼。', { shanhai: true, levelModifier: 5, reward: 220 }),
    R('r045', 'dawn_bell_soul', 'ink_cat', 'sj_dijiang', '傳說', 500, 22, 77, 40, '無面目者仍識歌舞；清鈴與墨步必須同拍。', { shanhai: true, levelModifier: 5, reward: 220 }),
    R('r046', 'red_sparrow', 'ember_mushroom', 'sj_bifang', '傳說', 430, 19, 65, 47, '燃燒的尾羽，正在尋找森林裡唯一的一隻腳。', { shanhai: true, levelModifier: 5, reward: 220 }),
    R('r047', 'rain_kite', 'red_sparrow', 'sj_shengyu', '史詩', 250, 14, 46, 61, '赤色長尾掠過魚群，洪水的預兆先發出一聲「錄」。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r048', 'mirror_carp', 'cloud_swallow', 'sj_wenyao', '史詩', 260, 15, 47, 60, '水族與羽族相遇，蒼文白首的魚在夜裡飛過兩海。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r049', 'rock_tapir', 'ink_cat', 'sj_zheng', '史詩', 240, 14, 43, 63, '石甲獸與凶獸血脈相擊，五尾一角發出擊石聲。', { shanhai: true, levelModifier: 3, reward: 120 }),
    R('r050', 'ink_cat', 'grave_moss', 'sj_huan', '史詩', 230, 13, 42, 64, '三道尾影圍住一隻金眼，百聲忽然被奪走。', { shanhai: true, levelModifier: 3, reward: 120 })
  ];

  window.GameData = window.GameData || {};
  Object.assign(window.GameData, {
    RECIPES,
    RACE_COMBINATIONS: racePairs,
    ELEMENT_COMBINATIONS,
    pairKey
  });
})();
