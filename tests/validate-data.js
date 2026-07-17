const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.createContext(context);
for (const file of ['monsters.js', 'shanhaijing-monsters.js', 'shanhaijing-expansion.js', 'recipes.js', 'recipes-expansion.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const D = context.window.GameData;
let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  passed += 1;
  console.log(`PASS: ${message}`);
}

assert(D.ORIGINAL_MONSTERS.length === 36, '原創妖怪恰為 36 種');
assert(D.SHANHAI_MONSTERS.length === 60, '山海異獸恰為 60 種');
assert(D.RECIPES.length === 100, '可運作配方恰為 100 組');
assert(D.RECIPES.filter((r) => r.category === '一般配方').length === 40, '一般配方 40 組');
assert(D.RECIPES.filter((r) => r.category === '山海配方').length === 60, '山海配方 60 組');
const rarityTarget = { 普通: 40, 精良: 25, 稀有: 20, 史詩: 10, 傳說: 4, 神話: 1 };
assert(Object.entries(rarityTarget).every(([rarity, amount]) => D.RECIPES.filter((r) => r.rarity === rarity).length === amount), '百方錄品階分布為 40／25／20／10／4／1');

const all = [...D.ORIGINAL_MONSTERS, ...D.SHANHAI_MONSTERS];
const ids = all.map((m) => m.id);
assert(new Set(ids).size === ids.length, '妖怪 ID 全部唯一');
assert(new Set(D.RECIPES.map((r) => r.id)).size === D.RECIPES.length, '配方 ID 全部唯一');

const monsterFields = ['id', 'name', 'race', 'element', 'level', 'stars', 'rarity', 'hp', 'attack', 'defense', 'spirit', 'speed', 'bloodline', 'skill', 'method', 'sprite'];
assert(all.every((m) => monsterFields.every((f) => m[f] !== undefined)), '所有妖怪具備必要結構化欄位');
assert(all.every((m) => m.bloodline >= 0 && m.bloodline <= 100), '所有山海血脈值介於 0～100');
assert(all.every((m) => m.level >= 1 && m.level <= 50), '所有基礎等級介於 1～50');
assert(D.SHANHAI_MONSTERS.every((m) => /^【古籍記載】/.test(m.quote) && /^【白話轉譯】/.test(m.plain) && /^【遊戲設定】/.test(m.skill)), '山海條目分離古籍、白話與遊戲設定');
assert(D.SHANHAI_MONSTERS.every((m) => /^https:\/\/ctext\.org\//.test(m.source) && m.note.includes('【考證備註】')), '山海條目均有來源連結與考證備註');

const idSet = new Set(ids);
assert(D.RECIPES.every((r) => idSet.has(r.materialA) && idSet.has(r.materialB) && idSet.has(r.result)), '每組配方的材料與結果均存在');
assert(D.RECIPES.every((r) => r.cost >= 0 && r.success > 0 && r.success <= 100 && r.minLevel >= 1), '配方成本、成功率與最低等級有效');
assert(D.SHANHAI_MONSTERS.every((m) => D.RECIPES.some((r) => r.result === m.id)), '60 種山海異獸皆有實際取得配方');
assert(D.RECIPES.every((r) => D.RECIPE_PROGRESSION.reachableLevel[r.result] > 0), '100 組配方均可由探索素材與前置配方實際到達');

assert(Object.keys(D.RACE_COMBINATIONS).length === 21, '六大種族完整涵蓋 21 種無序配對');
assert(Object.keys(D.ELEMENT_COMBINATIONS).length === 36, '八屬性完整涵蓋 36 種無序配對');
for (const a of D.RACES) for (const b of D.RACES) {
  assert(Boolean(D.RACE_COMBINATIONS[D.pairKey(a, b)]), `種族配對可查：${a}＋${b}`);
}

const ordered = D.RECIPES.filter((r) => r.ordered);
assert(ordered.length >= 4, '含有多組明確標示的順序配方');
assert(ordered.some((r) => ordered.some((x) => x.materialA === r.materialB && x.materialB === r.materialA && x.result !== r.result)), 'A＋B 與 B＋A 的順序配方可產生不同結果');

const unordered = D.RECIPES.filter((r) => !r.ordered);
const unorderedKeys = unordered.map((r) => [r.materialA, r.materialB].sort().join('+'));
assert(new Set(unorderedKeys).size === unorderedKeys.length, '非順序配方沒有互相矛盾的反向重複');

for (const file of ['index.html', 'style.css', 'game.js', 'monsters.js', 'shanhaijing-monsters.js', 'shanhaijing-expansion.js', 'recipes.js', 'recipes-expansion.js']) {
  assert(fs.existsSync(path.join(root, file)) && fs.statSync(path.join(root, file)).size > 0, `交付檔案存在：${file}`);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert((html.match(/data-page="(alchemy|inventory|dex|shanhai|recipes|scrolls|explore|quests|help)"/g) || []).length >= 9, '底部九大導覽頁籤齊全');
assert(!/https?:\/\/(?:cdn|unpkg|jsdelivr|fonts\.)/i.test(html), 'index.html 不依賴外部 CDN 或字體');

console.log(`\n全部 ${passed} 項資料與結構驗證通過。`);
