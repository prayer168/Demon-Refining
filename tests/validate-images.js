const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const monsterDir = path.join(root, 'assets', 'monsters');
const context = { window: {} };
vm.createContext(context);

for (const file of ['monsters.js', 'shanhaijing-monsters.js', 'shanhaijing-expansion.js', 'monster-images.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const D = context.window.GameData;
const monsters = [...D.ORIGINAL_MONSTERS, ...D.SHANHAI_MONSTERS];
const monsterIds = monsters.map((monster) => monster.id);
const imageMap = D.MONSTER_IMAGE_MAP;
const mappedIds = Object.keys(imageMap);
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  passed += 1;
  console.log(`PASS: ${message}`);
}

function readWebPSize(file) {
  const data = fs.readFileSync(file);
  if (data.length < 30 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`${path.basename(file)} 不是有效 WebP RIFF 檔案`);
  }

  let offset = 12;
  while (offset + 8 <= data.length) {
    const type = data.toString('ascii', offset, offset + 4);
    const length = data.readUInt32LE(offset + 4);
    const chunk = offset + 8;

    if (type === 'VP8X' && chunk + 10 <= data.length) {
      return { width: data.readUIntLE(chunk + 4, 3) + 1, height: data.readUIntLE(chunk + 7, 3) + 1 };
    }
    if (type === 'VP8L' && chunk + 5 <= data.length && data[chunk] === 0x2f) {
      const bits = data.readUInt32LE(chunk + 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (type === 'VP8 ' && chunk + 10 <= data.length && data[chunk + 3] === 0x9d && data[chunk + 4] === 0x01 && data[chunk + 5] === 0x2a) {
      return { width: data.readUInt16LE(chunk + 6) & 0x3fff, height: data.readUInt16LE(chunk + 8) & 0x3fff };
    }

    offset = chunk + length + (length % 2);
  }
  throw new Error(`${path.basename(file)} 找不到可辨識的 WebP 影像區塊`);
}

assert(D.ORIGINAL_MONSTERS.length === 36, '原創妖怪為 36 種');
assert(D.SHANHAI_MONSTERS.length === 60, '山海異獸為 60 種');
assert(monsterIds.length === 96 && new Set(monsterIds).size === 96, '96 個妖怪 ID 全部唯一');
assert(mappedIds.length === 96, '圖像映射恰為 96 筆');
assert(monsterIds.every((id) => imageMap[id]), '每個妖怪 ID 都有圖像映射');
assert(mappedIds.every((id) => monsterIds.includes(id)), '圖像映射沒有未知妖怪 ID');
assert(new Set(Object.values(imageMap)).size === 96, '96 筆映射皆指向不同檔案');
assert(Object.values(imageMap).every((file) => /^assets\/monsters\/[a-z0-9_]+\.webp$/.test(file)), '所有映射皆為本機 WebP，沒有 SVG 或外部網址');

const mappedFiles = Object.values(imageMap).map((file) => path.normalize(file));
const actualFiles = fs.readdirSync(monsterDir)
  .filter((file) => file.toLowerCase().endsWith('.webp'))
  .map((file) => path.normalize(path.join('assets', 'monsters', file)));

assert(actualFiles.length === 96, 'assets/monsters 恰有 96 張 WebP');
assert(mappedFiles.every((file) => fs.existsSync(path.join(root, file))), '所有映射檔案實際存在');
assert(actualFiles.every((file) => mappedFiles.includes(file)), 'assets/monsters 沒有未映射的多餘 WebP');

const hashes = new Map();
for (const file of mappedFiles) {
  const absolute = path.join(root, file);
  const size = readWebPSize(absolute);
  assert(size.width === 512 && size.height === 512, `${path.basename(file)} 為 512×512 WebP`);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
  hashes.set(hash, [...(hashes.get(hash) || []), file]);
}

assert([...hashes.values()].every((files) => files.length === 1), '96 張 WebP 沒有重複內容');
console.log(`\n全部 ${passed} 項圖像資產驗證通過。`);
