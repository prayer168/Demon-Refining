(function () {
  'use strict';

  const D = window.GameData;
  const SAVE_KEY = 'wanling-shanhai-save-v1';
  const SAVE_VERSION = 1;
  const allMonsters = [...D.ORIGINAL_MONSTERS, ...D.SHANHAI_MONSTERS];
  const monsters = Object.fromEntries(allMonsters.map((m) => [m.id, m]));
  const recipes = Object.fromEntries(D.RECIPES.map((r) => [r.id, r]));
  const rarityRank = Object.fromEntries(Object.entries(D.RARITY).map(([k, v]) => [k, v.rank]));
  let state;
  let selected = { a: null, b: null };
  let alchemyBusy = false;
  let exploreTimer = null;
  let audioCtx = null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const uid = () => `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const nowISO = () => new Date().toISOString();
  const formatTime = (iso) => new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const escapeHTML = (s) => String(s).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const randomOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function createInstance(monsterId, level, extra = {}) {
    const base = monsters[monsterId];
    return { uid: uid(), monsterId, level: clamp(level || base.level, 1, 50), locked: false, favorite: false, acquiredAt: nowISO(), ...extra };
  }

  function freshState() {
    const starterIds = ['moss_horn', 'lamp_fox', 'rain_frog', 'red_sparrow', 'dandelion_spirit', 'ghost_lamp'];
    return {
      version: SAVE_VERSION,
      player: { level: 1, exp: 0, stones: 500, capacity: 20 },
      inventory: starterIds.map((id) => createInstance(id, monsters[id].level)),
      discovered: [...starterIds], shanhaiDiscovered: [],
      discoveredRecipes: D.RECIPES.filter((r) => r.initiallyUnlocked).map((r) => r.id),
      recipeClues: 3, scrollFragments: 1, unlockedScrolls: ['南山卷'],
      items: { footprint: 0, feather: 0, scale: 0, horn: 0, bloodEssence: 0, furnaceCharm: 0 },
      alchemyLog: [], claimedQuests: [],
      stats: { alchemies: 0, successfulAlchemy: 0, explorations: 0, rareMade: 0, shanhaiRecipes: 0, maxBloodline: 0 },
      exploration: null,
      settings: { sound: true, volume: 55, reducedMotion: false, devMode: true, tutorialDone: false },
      lastPlayed: nowISO()
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== SAVE_VERSION) throw new Error('存檔版本不相容或缺少版本資訊。');
    if (!raw.player || !Array.isArray(raw.inventory) || !Array.isArray(raw.discovered)) throw new Error('存檔缺少必要欄位。');
    if (!Number.isFinite(raw.player.stones) || raw.player.stones < 0 || !Number.isFinite(raw.player.capacity)) throw new Error('玩家資源欄位無效。');
    raw.inventory.forEach((item) => {
      if (!item.uid || !monsters[item.monsterId] || !Number.isFinite(item.level)) throw new Error('妖怪庫含有無效資料。');
      item.level = clamp(Math.floor(item.level), 1, 50);
      item.locked = Boolean(item.locked); item.favorite = Boolean(item.favorite);
    });
    const base = freshState();
    return {
      ...base, ...raw,
      player: { ...base.player, ...raw.player },
      stats: { ...base.stats, ...(raw.stats || {}) },
      items: { ...base.items, ...(raw.items || {}) },
      settings: { ...base.settings, ...(raw.settings || {}) },
      alchemyLog: Array.isArray(raw.alchemyLog) ? raw.alchemyLog.slice(0, 20) : [],
      discoveredRecipes: Array.isArray(raw.discoveredRecipes) ? raw.discoveredRecipes.filter((id) => recipes[id]) : base.discoveredRecipes,
      shanhaiDiscovered: Array.isArray(raw.shanhaiDiscovered) ? raw.shanhaiDiscovered.filter((id) => monsters[id]?.sourceType === 'shanhai') : [],
      claimedQuests: Array.isArray(raw.claimedQuests) ? raw.claimedQuests : [],
      unlockedScrolls: Array.isArray(raw.unlockedScrolls) ? raw.unlockedScrolls : ['南山卷']
    };
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      state = raw ? normalizeState(JSON.parse(raw)) : freshState();
    } catch (err) {
      console.warn('存檔載入失敗，已建立安全的新存檔：', err);
      state = freshState();
      setTimeout(() => toast(`舊存檔無法讀取：${err.message}，已開啟新遊戲。`, 'error'), 300);
    }
  }

  function saveGame(showMessage = false) {
    state.lastPlayed = nowISO();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      const el = $('#save-status');
      el.textContent = '● 已自動存檔'; el.classList.remove('warning-text');
      if (showMessage) toast('進度已儲存在這部裝置。', 'success');
    } catch (err) {
      $('#save-status').textContent = '● 存檔失敗'; $('#save-status').classList.add('warning-text');
      toast(`存檔失敗：${err.message}`, 'error');
    }
  }

  function getInstance(id) { return state.inventory.find((i) => i.uid === id); }
  function countOwned(monsterId) { return state.inventory.filter((i) => i.monsterId === monsterId).length; }
  function totalExpForLevel(level) { return 100 + (level - 1) * 45; }
  function addExp(amount) {
    state.player.exp += amount;
    while (state.player.level < 50 && state.player.exp >= totalExpForLevel(state.player.level)) {
      state.player.exp -= totalExpForLevel(state.player.level); state.player.level += 1;
      toast(`煉妖師提升至 ${state.player.level} 級！`, 'success'); playSound('quest');
    }
  }

  function rarityColor(rarity) { return D.RARITY[rarity]?.color || '#999'; }
  function pairElementKey(a, b) {
    const priority = { 火: 8, 水: 7, 木: 6, 土: 5, 風: 4, 光: 3, 暗: 2, 無: 1 };
    return [a, b].sort((x, y) => priority[y] - priority[x]).join('+');
  }

  function seeded(seed, index) {
    const x = Math.sin(seed * 101.73 + index * 47.17) * 43758.5453;
    return x - Math.floor(x);
  }

  function spriteSVG(monster, large = false) {
    const p = monster.sprite.palette; const seed = monster.sprite.seed;
    const race = monster.race; const form = monster.sprite.form || '';
    let blocks = [];
    const rect = (x, y, w, h, c, o = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" opacity="${o}"/>`;
    blocks.push(rect(4, 14, 8, 1, '#000', .22), rect(3, 15, 10, 1, '#000', .12));
    if (race === '羽族') {
      blocks.push(rect(6, 5, 5, 7, p[1]), rect(4, 6, 3, 5, p[0]), rect(10, 6, 3, 5, p[0]), rect(7, 3, 3, 4, p[2]), rect(8, 5, 1, 1, '#17130e'), rect(7, 12, 1, 3, p[2]), rect(10, 12, 1, 3, p[2]));
    } else if (race === '水族') {
      blocks.push(rect(3, 7, 10, 6, p[1]), rect(1, 8, 3, 4, p[0]), rect(12, 6, 3, 3, p[2]), rect(12, 11, 3, 3, p[2]), rect(10, 8, 1, 1, '#e6dcae'), rect(13, 9, 1, 1, '#17130e'));
    } else if (race === '木靈') {
      blocks.push(rect(5, 6, 7, 8, p[1]), rect(6, 3, 2, 4, p[2]), rect(9, 2, 2, 5, p[2]), rect(3, 4, 3, 2, p[0]), rect(11, 4, 3, 2, p[0]), rect(6, 8, 1, 1, '#eee0ae'), rect(10, 8, 1, 1, '#eee0ae'));
    } else if (race === '幽族') {
      blocks.push(rect(5, 4, 7, 8, p[1]), rect(4, 7, 9, 5, p[1]), rect(5, 12, 2, 3, p[0]), rect(8, 12, 2, 2, p[0]), rect(11, 12, 2, 3, p[0]), rect(6, 7, 2, 1, p[2]), rect(10, 7, 2, 1, p[2]));
    } else if (race === '機關族') {
      blocks.push(rect(4, 5, 9, 8, p[1]), rect(6, 3, 5, 3, p[0]), rect(2, 7, 3, 3, p[2]), rect(12, 7, 3, 3, p[2]), rect(5, 13, 3, 2, p[0]), rect(10, 13, 3, 2, p[0]), rect(6, 7, 2, 2, '#d6b259'), rect(10, 7, 2, 2, '#d6b259'), rect(8, 10, 2, 1, p[2]));
    } else {
      blocks.push(rect(4, 7, 9, 6, p[1]), rect(9, 4, 5, 6, p[1]), rect(10, 2, 1, 3, p[2]), rect(13, 2, 1, 3, p[2]), rect(5, 12, 2, 3, p[0]), rect(11, 12, 2, 3, p[0]), rect(12, 6, 1, 1, '#f1dfad'), rect(13, 7, 1, 1, '#17130e'), rect(2, 8, 3, 2, p[2]));
    }
    const tailCount = form.includes('9') ? 5 : form.includes('5') ? 4 : form.includes('3') ? 3 : 0;
    for (let i = 0; i < tailCount; i++) blocks.push(rect(1 + (i % 2), 4 + i * 2, 4, 1, i % 2 ? p[2] : p[1]));
    if (form.includes('wing') || form.includes('bird')) blocks.push(rect(1, 5, 3, 2, p[2]), rect(13, 5, 3, 2, p[2]));
    if (form.includes('faceless')) blocks.push(rect(6, 5, 6, 5, p[1]));
    for (let i = 0; i < 7; i++) {
      const x = 3 + Math.floor(seeded(seed, i) * 10), y = 5 + Math.floor(seeded(seed, i + 9) * 8);
      blocks.push(rect(x, y, 1, 1, i % 2 ? p[2] : p[0], .9));
    }
    return `<svg viewBox="0 0 16 16" role="img" aria-label="${escapeHTML(monster.name)}原創像素造型" shape-rendering="crispEdges" class="${large ? 'large-sprite' : ''}">${blocks.join('')}</svg>`;
  }

  function spriteWrap(monster, large = false) {
    const imagePath = D.MONSTER_IMAGE_MAP?.[monster.id];
    if (imagePath) return `<div class="sprite-wrap has-image"><img src="${imagePath}" alt="${escapeHTML(monster.name)}原創像素造型" class="${large ? 'large-sprite' : ''}" loading="lazy" decoding="async"></div>`;
    return `<div class="sprite-wrap">${spriteSVG(monster, large)}</div>`;
  }

  function playSound(type) {
    if (!state.settings.sound || state.settings.volume <= 0) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      const profiles = { click: [220, .045, 'square'], select: [330, .08, 'square'], furnace: [90, .5, 'sawtooth'], success: [523, .35, 'square'], rare: [659, .65, 'triangle'], fail: [80, .3, 'sawtooth'], quest: [784, .4, 'square'], scroll: [440, .5, 'triangle'] };
      const [freq, duration, wave] = profiles[type] || profiles.click;
      osc.type = wave; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (type === 'success' || type === 'rare') osc.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + duration);
      gain.gain.setValueAtTime((state.settings.volume / 100) * .08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + duration);
      osc.connect(gain).connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch (_) { /* 音效不影響遊戲 */ }
  }

  function toast(message, type = '') {
    const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message;
    $('#toast-region').appendChild(el); setTimeout(() => el.remove(), 3800);
  }

  function showDialog(html) {
    $('#dialog-content').innerHTML = html; const dialog = $('#game-dialog');
    if (!dialog.open) dialog.showModal();
    const first = $('button:not(.dialog-close)', dialog); if (first) setTimeout(() => first.focus(), 0);
  }

  function confirmDialog(title, body, confirmText = '確認') {
    return new Promise((resolve) => {
      showDialog(`<h2>${escapeHTML(title)}</h2><p>${body}</p><div class="dialog-actions"><button id="dialog-cancel" class="secondary-btn" type="button">取消</button><button id="dialog-confirm" class="primary-btn" type="button">${escapeHTML(confirmText)}</button></div>`);
      $('#dialog-cancel').onclick = () => { $('#game-dialog').close(); resolve(false); };
      $('#dialog-confirm').onclick = () => { $('#game-dialog').close(); resolve(true); };
      $('#game-dialog').addEventListener('cancel', () => resolve(false), { once: true });
    });
  }

  function renderStats() {
    $('#stat-level').textContent = `Lv.${state.player.level}`;
    $('#stat-exp').textContent = `${state.player.exp} / ${totalExpForLevel(state.player.level)}`;
    $('#exp-bar').style.width = `${state.player.exp / totalExpForLevel(state.player.level) * 100}%`;
    $('#stat-stones').textContent = state.player.stones.toLocaleString('zh-TW');
    $('#stat-owned').textContent = `${state.inventory.length} / ${state.player.capacity}`;
    $('#stat-dex').textContent = `${Math.floor(state.discovered.filter((id) => monsters[id]?.sourceType === 'original').length / D.ORIGINAL_MONSTERS.length * 100)}%`;
    $('#stat-shanhai').textContent = `${Math.floor(state.shanhaiDiscovered.length / D.SHANHAI_MONSTERS.length * 100)}%`;
  }

  function showPage(name) {
    $$('.page').forEach((p) => p.classList.toggle('active', p.id === `page-${name}`));
    $$('.bottom-nav button').forEach((b) => b.classList.toggle('active', b.dataset.page === name));
    const page = $(`#page-${name}`); document.title = `${page?.dataset.title || '萬靈'}｜萬靈山海煉妖錄`;
    window.scrollTo({ top: 0, behavior: state.settings.reducedMotion ? 'auto' : 'smooth' });
    renderPage(name); playSound(name === 'scrolls' ? 'scroll' : 'click');
  }

  function renderPage(name) {
    if (name === 'alchemy') { renderAlchemy(); renderLog(); }
    if (name === 'inventory') renderInventory();
    if (name === 'dex') renderDex();
    if (name === 'shanhai') renderShanhai();
    if (name === 'recipes') renderRecipes();
    if (name === 'scrolls') renderScrolls();
    if (name === 'explore') renderExplore();
    if (name === 'quests') renderQuests();
    if (name === 'help') renderSettings();
    if (name === 'save') renderSave();
    renderStats();
  }

  function instanceCard(item, options = {}) {
    const m = monsters[item.monsterId]; const hidden = options.hidden;
    return `<article class="monster-card ${item.locked ? 'locked' : ''} ${item.favorite ? 'favorite' : ''} ${item.variant ? 'variant' : ''}" style="--rarity:${rarityColor(m.rarity)}" data-uid="${item.uid}" draggable="${item.locked ? 'false' : 'true'}">
      <button class="monster-main detail-btn" type="button" aria-label="查看${escapeHTML(m.name)}詳細資料">${spriteWrap(m)}<h3>${escapeHTML(m.name)}</h3><div class="meta">Lv.${item.level}・${m.race}・${m.element}</div><div class="meta"><span class="rarity-label">${m.rarity}</span> <span class="stars">${'★'.repeat(m.stars)}</span>${item.variant ? '・靈紋變異' : ''}</div><div class="meta">持有 ${countOwned(m.id)} 隻</div><div class="bloodline"><span>山海血脈 ${m.bloodline}</span><i><em style="width:${m.bloodline}%"></em></i></div></button>
      ${hidden ? '' : `<div class="monster-actions"><button class="lock-btn" type="button">${item.locked ? '解除鎖定' : '鎖定'}</button><button class="favorite-btn" type="button">${item.favorite ? '取消常用' : '標記常用'}</button><button class="use-btn" type="button" ${item.locked ? 'disabled' : ''}>放入煉妖陣</button></div>`}</article>`;
  }

  function showMonsterDetail(itemOrId) {
    const item = typeof itemOrId === 'string' ? getInstance(itemOrId) : null;
    const m = item ? monsters[item.monsterId] : monsters[itemOrId]; if (!m) return;
    const level = item?.level || m.level;
    showDialog(`<div class="dialog-monster" style="--rarity:${rarityColor(m.rarity)}">${spriteWrap(m, true)}<h2>${escapeHTML(m.name)}</h2><p><span class="dialog-label">${m.race}</span><span class="dialog-label">${m.element}</span><span class="dialog-label">${m.rarity}</span><span class="dialog-label">Lv.${level}</span></p>
      <div class="stat-grid"><div>生命<br><b>${m.hp}</b></div><div>攻擊<br><b>${m.attack}</b></div><div>防禦<br><b>${m.defense}</b></div><div>靈力<br><b>${m.spirit}</b></div><div>速度<br><b>${m.speed}</b></div></div>
      <p>山海血脈：<b>${m.bloodline}</b> / 100${item?.variant ? '・<b>靈紋變異</b>' : ''}</p><p>${escapeHTML(m.ecology || m.plain)}</p><p><b>技能：</b>${escapeHTML(m.skill)}</p><p><b>取得：</b>${escapeHTML(m.method)}</p></div>`);
  }

  function renderInventory() {
    const q = $('#inventory-search').value.trim(); const race = $('#inventory-race').value; const element = $('#inventory-element').value; const sort = $('#inventory-sort').value;
    let list = state.inventory.filter((i) => { const m = monsters[i.monsterId]; return (!q || m.name.includes(q)) && (!race || m.race === race) && (!element || m.element === element); });
    list.sort((a, b) => {
      const ma = monsters[a.monsterId], mb = monsters[b.monsterId];
      if (sort === 'level') return b.level - a.level;
      if (sort === 'rarity') return rarityRank[mb.rarity] - rarityRank[ma.rarity];
      if (sort === 'bloodline') return mb.bloodline - ma.bloodline;
      if (sort === 'name') return ma.name.localeCompare(mb.name, 'zh-Hant');
      return new Date(b.acquiredAt) - new Date(a.acquiredAt);
    });
    $('#inventory-grid').innerHTML = list.length ? list.map((i) => instanceCard(i)).join('') : '<p class="empty-state">沒有符合條件的妖怪。</p>';
  }

  function renderDex() {
    const found = state.discovered.filter((id) => monsters[id]?.sourceType === 'original'); $('#dex-progress').textContent = `${found.length} / ${D.ORIGINAL_MONSTERS.length}`;
    $('#dex-grid').innerHTML = D.ORIGINAL_MONSTERS.map((m) => {
      const known = state.discovered.includes(m.id);
      return `<article class="monster-card ${known ? '' : 'hidden-monster silhouette'}" style="--rarity:${known ? rarityColor(m.rarity) : '#555'}"><button class="monster-main dex-detail" data-id="${m.id}" type="button" ${known ? '' : 'disabled'}>${spriteWrap(m)}<h3>${known ? escapeHTML(m.name) : '？？？'}</h3><div class="meta">${known ? `${m.race}・${m.element}・${m.rarity}` : '尚未發現'}</div>${known ? `<p class="hidden-clue">${escapeHTML(m.ecology)}</p>` : '<p class="hidden-clue">在探索或煉妖中留下足跡。</p>'}</button></article>`;
    }).join('');
  }

  function shanhaiForm(m) {
    const form = m.sprite.form || '';
    if (form.includes('snake') || form.includes('dragon') || form.includes('sunmoon')) return '蛇';
    if (m.race === '羽族' || form.includes('bird') || form.includes('wing')) return '鳥';
    if (m.race === '水族' || form.includes('fish')) return '魚';
    if (['大荒東經', '大荒北經', '海外北經', '海內西經'].includes(m.chapter) && m.rarity === '神話') return '神靈';
    return '獸';
  }

  function renderShanhai() {
    const q = $('#shanhai-search').value.trim(); const chapter = $('#shanhai-chapter').value; const region = $('#shanhai-region').value;
    const form = $('#shanhai-form').value; const race = $('#shanhai-race').value; const element = $('#shanhai-element').value;
    const rarity = $('#shanhai-rarity').value; const filter = $('#shanhai-state').value;
    $('#shanhai-progress').textContent = `${state.shanhaiDiscovered.length} / ${D.SHANHAI_MONSTERS.length}`;
    const list = D.SHANHAI_MONSTERS.filter((m) => (!q || m.name.includes(q) || m.aliases.some((a) => a.includes(q))) && (!chapter || m.chapter === chapter) && (!region || m.region === region) && (!form || shanhaiForm(m) === form) && (!race || m.race === race) && (!element || m.element === element) && (!rarity || m.rarity === rarity) && (!filter || (filter === 'found') === state.shanhaiDiscovered.includes(m.id)));
    $('#shanhai-list').innerHTML = list.map((m) => {
      const known = state.shanhaiDiscovered.includes(m.id);
      if (!known) return `<article class="bestiary-entry hidden-entry"><div>${spriteWrap(m, true)}</div><div><h3>水墨剪影・？？？</h3><p class="reading">${m.chapter}・${m.region}</p><p>古籍線索：${escapeHTML(m.quote.replace('【古籍記載】', '').slice(0, 24))}……</p><span class="tag">未發現</span></div></article>`;
      return `<article class="bestiary-entry"><div>${spriteWrap(m, true)}</div><div><h3>${escapeHTML(m.name)} <small class="reading">${escapeHTML(m.reading)}</small></h3><p class="reading">${m.chapter}・${m.region}${m.aliases.length ? `・異名：${escapeHTML(m.aliases.join('、'))}` : ''}</p><p>${escapeHTML(m.quote)}</p><p>${escapeHTML(m.plain)}</p><p><b>形貌：</b>${escapeHTML(m.appearance)}<br><b>行為：</b>${escapeHTML(m.behavior)}<br><b>徵兆：</b>${escapeHTML(m.omen)}<br><b>象徵：</b>${escapeHTML(m.symbolism)}</p><p><b>遊戲資料：</b>${m.race}・${m.element}・${m.rarity}・血脈 ${m.bloodline}<br>${escapeHTML(m.skill)}<br>${escapeHTML(m.art)}<br>${escapeHTML(m.method)}<br>${escapeHTML(m.recipeHint)}</p><p>${escapeHTML(m.note)}</p><a href="${m.source}" target="_blank" rel="noopener">${escapeHTML(m.sourceLabel || '查閱資料來源')}</a><br><span class="tag">古籍記載</span><span class="tag">白話轉譯</span><span class="tag">合理推測</span><span class="tag">遊戲設定</span></div></article>`;
    }).join('') || '<p class="empty-state">沒有符合條件的條目。</p>';
  }

  function renderRecipes() {
    const filter = $('#recipe-state').value; const cat = $('#recipe-category').value; const rarity = $('#recipe-rarity').value;
    const race = $('#recipe-race').value; const element = $('#recipe-element').value; const order = $('#recipe-order').value;
    $('#recipe-progress').textContent = `${state.discoveredRecipes.length} / ${D.RECIPES.length}`;
    $('#use-recipe-clue').textContent = `使用線索（現有 ${state.recipeClues}）`;
    $('#use-recipe-clue').disabled = state.recipeClues < 1 || state.discoveredRecipes.length >= D.RECIPES.length;
    const list = D.RECIPES.filter((r) => (!filter || (filter === 'found') === state.discoveredRecipes.includes(r.id)) && (!cat || r.category === cat) && (!rarity || r.rarity === rarity) && (!race || monsters[r.result].race === race) && (!element || monsters[r.result].element === element) && (!order || (order === 'ordered') === r.ordered));
    $('#recipe-list').innerHTML = list.map((r) => {
      const known = state.discoveredRecipes.includes(r.id);
      return `<article class="recipe-card ${known ? '' : 'hidden-recipe'}" style="--rarity:${rarityColor(r.rarity)}"><h3>${known ? `${r.category}・${r.rarity}` : '未發現配方'}</h3><div class="recipe-equation">${known ? `${escapeHTML(monsters[r.materialA].name)} ＋ ${escapeHTML(monsters[r.materialB].name)} ${r.ordered ? '（順序）' : ''} ＝ ${escapeHTML(monsters[r.result].name)}` : '？？？ ＋ ？？？ ＝ 未知妖怪'}</div><p>${known ? escapeHTML(r.hint) : `線索：${escapeHTML(r.hint)}`}</p><small>${known ? `靈石 ${r.cost}・成功率 ${r.success}%・最低均級 ${r.minLevel}・血脈合計 ${r.minBlood}` : '以正確材料完成一次煉妖即可登錄'}</small></article>`;
    }).join('');
  }

  function useRecipeClue() {
    if (state.recipeClues < 1) return toast('目前沒有配方線索。', 'error');
    const hidden = D.RECIPES.filter((r) => !state.discoveredRecipes.includes(r.id));
    if (!hidden.length) return toast('百方錄已全數揭示。', 'success');
    const recipe = randomOf(hidden); state.recipeClues--; state.discoveredRecipes.push(recipe.id);
    if (recipe.category === '山海配方') state.stats.shanhaiRecipes++;
    saveGame(); renderRecipes(); renderQuests(); playSound('scroll');
    showDialog(`<h2>配方線索解明</h2><p class="success-text">${escapeHTML(monsters[recipe.materialA].name)} ＋ ${escapeHTML(monsters[recipe.materialB].name)}${recipe.ordered ? '（順序）' : ''} ＝ ${escapeHTML(monsters[recipe.result].name)}</p><p>${escapeHTML(recipe.hint)}</p>`);
  }

  function buyRecipeClue() {
    if (state.player.stones < 120) return toast('購買線索需要 120 枚靈石。', 'error');
    state.player.stones -= 120; state.recipeClues++; saveGame(); renderExplore(); renderStats(); toast('從山旅商手中換得一條配方線索。', 'success');
  }

  const SCROLLS = [
    { name: '南山卷', chapters: ['南山經'], scene: '青丘、丹穴、多水山谷與海岸洞窟', clues: '狌狌、鹿蜀、九尾狐、蠃魚、鳳皇等十種異獸線索。', route: '由招搖山沿南次山系推進；此路線依古籍意象重構。' },
    { name: '西山卷', chapters: ['西山經'], scene: '崑崙、玉山、赤色山脈與雲霧祭壇', clues: '朱厭、肥遺、英招、陸吾、帝江、窮奇、天狗、狡與駁等線索。', route: '沿西次山系穿過玉石與弱水意象，通往崑崙門庭。' },
    { name: '北山卷', chapters: ['北山經'], scene: '寒山、深澤、雪原古道與風蝕洞穴', clues: '何羅魚、孟極、諸犍、酸與、精衛、狍鴞等十種線索。', route: '水脈與山道交錯，部分古籍功效只作文獻記錄。' },
    { name: '東山卷', chapters: ['東山經'], scene: '日出群山、鳴石海岬、澧水與深澤', clues: '鱅鱅魚、珠蟞魚、朱獳、蠪姪、當康與蜚等十種線索。', route: '由東次山系的水澤與凶兆串成探索路徑。' },
    { name: '中山卷', chapters: ['中山經'], scene: '群山腹地、密林河谷、蜂廬與古銅礦', clues: '飛魚、朏朏、夫諸、驕蟲、竊脂、跂踵與雍和等十種線索。', route: '以中次山系山神、水道與生物記載組成連續長卷。' },
    { name: '海外卷', chapters: ['海外北經'], scene: '四海之外、崑崙北側與共工遺澤', clues: '相柳九首毒澤的主線線索；不可由一般隨機煉化取得。', route: '海外方位為古籍敘事空間，不對應現代國界。' },
    { name: '海內卷', chapters: ['海內南經', '海內西經'], scene: '巨蛇古道、崑崙九門、水系與神域守衛', clues: '巴蛇與開明獸線索，需結合足跡、獸角與指定配方。', route: '海內諸篇的方位敘事整合成遊戲路線，並非精確地圖。' },
    { name: '大荒卷', chapters: ['大荒東經', '大荒北經'], scene: '日月出入、流波海島、章尾山與極荒風雨', clues: '燭龍、應龍與夔的終局線索；神話級只由主線配方取得。', route: '以大荒篇的日月、風雨與神跡構成最終卷軸。' }
  ];
  function renderScrolls() {
    $('#scroll-pages').textContent = `古籍殘頁 ${state.scrollFragments}`;
    $('#scroll-map').innerHTML = SCROLLS.map((scroll, i) => { const open = state.unlockedScrolls.includes(scroll.name); const total = D.SHANHAI_MONSTERS.filter((m) => scroll.chapters.includes(m.chapter)).length; const found = D.SHANHAI_MONSTERS.filter((m) => scroll.chapters.includes(m.chapter) && state.shanhaiDiscovered.includes(m.id)).length; return `<article class="map-node ${open ? '' : 'locked'}"><h3>${scroll.name}</h3><p>${open ? scroll.scene : '雲霧遮蔽，需 3 張殘頁解鎖。'}</p><small>${open ? `異獸進度 ${found}／${total}` : '未知山河'}</small><button type="button" data-scroll="${scroll.name}" data-index="${i}">${open ? '查看卷軸' : '消耗 3 殘頁'}</button></article>`; }).join('');
    $('#scroll-detail').textContent = '選擇卷軸查看目前線索。遊戲地圖依古籍意象重新創作，不是精確現代地理。';
  }

  const LOCATIONS = [
    { id: 'mist_forest', name: '霧林', element: '木／風', time: [5, 9], cost: 0, pool: ['moss_horn', 'dandelion_spirit', 'reed_owl', 'dew_sprout', 'ember_mushroom', 'moon_deer'] },
    { id: 'red_valley', name: '赤岩谷', element: '火／土', time: [6, 10], cost: 15, pool: ['lamp_fox', 'red_sparrow', 'ember_crab', 'rock_tapir', 'stone_beetle'] },
    { id: 'moon_pool', name: '月影潭', element: '水／光', time: [7, 11], cost: 20, pool: ['rain_frog', 'mud_loach', 'thunder_turtle', 'mirror_carp', 'well_echo'] },
    { id: 'machine_city', name: '古機關城', element: '機關／土', time: [8, 12], cost: 25, pool: ['bronze_doll', 'stone_beetle', 'wind_clock_bird', 'water_clock_beast'] },
    { id: 'ghost_tombs', name: '幽燈荒塚', element: '暗／幽', time: [8, 13], cost: 25, pool: ['ghost_lamp', 'paper_wraith', 'grave_moss', 'ink_cat', 'night_bat', 'shadow_vine'] },
    { id: 'wind_cliff', name: '天風崖', element: '風／光', time: [9, 15], cost: 30, pool: ['cloud_swallow', 'mist_hound', 'rain_kite', 'dawn_crane', 'wind_clock_bird'] },
    { id: 'south_scroll', name: '南山卷境', scroll: '南山卷', element: '木／水', time: [8, 13], cost: 35, pool: ['sj_shengsheng', 'sj_lushu', 'sj_xuangui', 'sj_chiru', 'sj_quru'] },
    { id: 'west_scroll', name: '西山卷境', scroll: '西山卷', element: '土／光', time: [9, 14], cost: 45, pool: ['sj_zhuyan', 'sj_feiyi', 'sj_bifang', 'sj_tiangou', 'sj_jiao'] },
    { id: 'north_scroll', name: '北山卷境', scroll: '北山卷', element: '風／暗', time: [9, 14], cost: 45, pool: ['sj_mengji', 'sj_ershu', 'sj_yongyong', 'sj_tianma'] },
    { id: 'east_scroll', name: '東山卷境', scroll: '東山卷', element: '水／土', time: [9, 14], cost: 45, pool: ['sj_tongtong', 'sj_yuanhu', 'sj_gege', 'sj_dangkang'] },
    { id: 'middle_scroll', name: '中山卷境', scroll: '中山卷', element: '木／火', time: [10, 15], cost: 50, pool: ['sj_flyingfish', 'sj_feifei', 'sj_lingyao', 'sj_qiezhi'] },
    { id: 'overseas_scroll', name: '海外卷境', scroll: '海外卷', element: '水／暗', time: [10, 15], cost: 55, pool: [] },
    { id: 'inner_scroll', name: '海內卷境', scroll: '海內卷', element: '土／光', time: [10, 15], cost: 55, pool: ['sj_ba'] },
    { id: 'wilderness_scroll', name: '大荒卷境', scroll: '大荒卷', element: '光／風', time: [10, 15], cost: 60, pool: [] }
  ];

  const ITEM_NAMES = { footprint: '異獸足跡', feather: '古羽', scale: '靈鱗', horn: '獸角', bloodEssence: '山海血髓', furnaceCharm: '護爐符' };

  function renderExplore() {
    $('#explore-items').innerHTML = `<b>探索行囊</b>${Object.entries(ITEM_NAMES).map(([id, name]) => `<span>${name} ${state.items[id] || 0}</span>`).join('')}<span>古籍殘頁 ${state.scrollFragments}</span><span>配方線索 ${state.recipeClues}</span>`;
    $('#explore-locations').innerHTML = LOCATIONS.map((l) => { const open = !l.scroll || state.unlockedScrolls.includes(l.scroll); const sample = l.pool.length ? `可能發現 ${l.pool.slice(0, 3).map((id) => monsters[id].name).join('、')}等異獸` : '可取得高階配方材料與主線線索'; return `<article class="location-card ${open ? '' : 'locked'}"><h3>${l.name}</h3><p>${open ? `${sample}，也可能帶回靈石、道具或殘頁。` : `需先解鎖${l.scroll}。`}</p><div class="location-meta"><span>${l.element}</span><span>${l.time[0]}～${l.time[1]} 秒・${l.cost ? `${l.cost} 靈石` : '免費'}</span></div><button class="primary-btn explore-btn" data-location="${l.id}" type="button" ${state.exploration || !open ? 'disabled' : ''}>${open ? '派出探索' : '卷軸未開'}</button></article>`; }).join('');
    if (state.exploration) {
      const l = LOCATIONS.find((x) => x.id === state.exploration.locationId); const remain = Math.max(0, state.exploration.endAt - Date.now()); const total = state.exploration.endAt - state.exploration.startedAt; const pct = clamp((1 - remain / total) * 100, 0, 100);
      $('#explore-active').classList.remove('hidden'); $('#explore-status').textContent = `${l.name}探索中`;
      $('#explore-active').innerHTML = `<h3>${l.name}探索中</h3><p id="explore-countdown">尚餘 ${(remain / 1000).toFixed(1)} 秒</p><div class="progress-track"><i id="explore-bar" style="width:${pct}%"></i></div>${state.settings.devMode ? '<button id="finish-explore" class="secondary-btn" type="button">立即完成探索（開發）</button>' : ''}`;
      startExploreTicker();
    } else { $('#explore-active').classList.add('hidden'); $('#explore-status').textContent = '隊伍待命'; }
  }

  function startExploration(locationId) {
    if (state.exploration) return; const l = LOCATIONS.find((x) => x.id === locationId); if (!l) return;
    if (l.scroll && !state.unlockedScrolls.includes(l.scroll)) return toast(`需先解鎖${l.scroll}。`, 'error');
    if (state.player.stones < l.cost) return toast('靈石不足，無法出發。', 'error');
    state.player.stones -= l.cost; const sec = l.time[0] + Math.floor(Math.random() * (l.time[1] - l.time[0] + 1)); const startedAt = Date.now();
    state.exploration = { locationId, startedAt, endAt: startedAt + sec * 1000 }; saveGame(); renderExplore(); renderStats(); playSound('select');
  }

  function startExploreTicker() {
    clearInterval(exploreTimer); exploreTimer = setInterval(() => {
      if (!state.exploration) return clearInterval(exploreTimer);
      const remain = state.exploration.endAt - Date.now(); const total = state.exploration.endAt - state.exploration.startedAt;
      if ($('#explore-countdown')) $('#explore-countdown').textContent = `尚餘 ${Math.max(0, remain / 1000).toFixed(1)} 秒`;
      if ($('#explore-bar')) $('#explore-bar').style.width = `${clamp((1 - remain / total) * 100, 0, 100)}%`;
      if (remain <= 0) finishExploration();
    }, 100);
  }

  function finishExploration() {
    if (!state.exploration) return; clearInterval(exploreTimer);
    const l = LOCATIONS.find((x) => x.id === state.exploration.locationId); state.exploration = null; state.stats.explorations++;
    const emptyTrip = Math.random() < .06; const stoneGain = emptyTrip ? 0 : 35 + Math.floor(Math.random() * 86); state.player.stones += stoneGain; const rewards = emptyTrip ? ['遭遇山霧，空手而回'] : [`靈石 ${stoneGain}`];
    const monsterChance = l.scroll ? .26 : (state.stats.explorations <= 3 ? .95 : .58);
    if (!emptyTrip && l.pool.length && Math.random() < monsterChance && state.inventory.length < state.player.capacity) {
      const id = randomOf(l.pool); const base = monsters[id]; const level = clamp(base.level + Math.floor(Math.random() * 4) - 1, 1, 50);
      state.inventory.push(createInstance(id, level)); rewards.push(`${base.name} Lv.${level}`); discoverMonster(id);
    } else if (state.inventory.length >= state.player.capacity) rewards.push('妖怪庫已滿，足跡未能收納');
    if (!emptyTrip && Math.random() < .34) { state.recipeClues++; rewards.push('配方線索 1'); }
    if (!emptyTrip && Math.random() < (l.scroll ? .28 : .18)) { state.scrollFragments++; rewards.push('古籍殘頁 1'); }
    if (!emptyTrip && Math.random() < .52) { const item = randomOf(l.scroll ? ['footprint', 'feather', 'scale', 'horn', 'bloodEssence', 'furnaceCharm'] : ['footprint', 'feather', 'scale', 'horn']); state.items[item]++; rewards.push(`${ITEM_NAMES[item]} 1`); }
    if (!emptyTrip && Math.random() < .22) rewards.push(randomOf(['發現水墨獸影掠過山脊', '古祭壇的符紋短暫亮起', '旅商以一枚靈石指明近路', '風中傳來與配方線索相同的鳴聲']));
    addExp(18); saveGame(); renderExplore(); renderStats(); renderQuests(); playSound('success'); toast(`探索歸來：${rewards.join('、')}`, 'success');
    showDialog(`<h2>${escapeHTML(l.name)}探索歸來</h2><p class="success-text">${escapeHTML(rewards.join('、'))}</p><p>探索隊已安全返回煉妖房。</p>`);
  }

  function discoverMonster(id) {
    if (!state.discovered.includes(id)) state.discovered.push(id);
    if (monsters[id].sourceType === 'shanhai' && !state.shanhaiDiscovered.includes(id)) state.shanhaiDiscovered.push(id);
    state.stats.maxBloodline = Math.max(state.stats.maxBloodline, monsters[id].bloodline);
  }

  function findRecipe(a, b) {
    const ordered = D.RECIPES.find((r) => r.ordered && r.materialA === a.monsterId && r.materialB === b.monsterId);
    if (ordered) return ordered;
    return D.RECIPES.find((r) => !r.ordered && ((r.materialA === a.monsterId && r.materialB === b.monsterId) || (r.materialA === b.monsterId && r.materialB === a.monsterId))) || null;
  }

  function fallbackResult(a, b) {
    const ma = monsters[a.monsterId], mb = monsters[b.monsterId]; const targetLevel = Math.floor((a.level + b.level) / 2);
    const raceKey = D.pairKey(ma.race, mb.race); const races = D.RACE_COMBINATIONS[raceKey] || [ma.race, mb.race];
    const els = D.ELEMENT_COMBINATIONS[pairElementKey(ma.element, mb.element)] || [ma.element, mb.element];
    let candidates = D.ORIGINAL_MONSTERS.filter((m) => races.includes(m.race) && els.includes(m.element));
    if (!candidates.length) candidates = D.ORIGINAL_MONSTERS.filter((m) => races.includes(m.race));
    candidates.sort((x, y) => Math.abs(x.level - targetLevel) - Math.abs(y.level - targetLevel));
    const range = candidates.slice(0, Math.min(3, candidates.length)); const result = range[(ma.sprite.seed + mb.sprite.seed) % range.length];
    return { result: result.id, cost: 45 + targetLevel * 3, success: clamp(90 - Math.abs(result.level - targetLevel) * 2 + state.player.level, 58, 94), minLevel: 1, minBlood: 0, levelModifier: 0, hint: '爐紋沒有對應到已知特殊配方，將依種族與屬性自然化生。', rarity: result.rarity, category: '自然煉化', id: null };
  }

  function alchemyPrediction() {
    const a = getInstance(selected.a), b = getInstance(selected.b); if (!a || !b || a.uid === b.uid) return null;
    const recipe = findRecipe(a, b); const rule = recipe || fallbackResult(a, b); const ma = monsters[a.monsterId], mb = monsters[b.monsterId];
    const avg = Math.floor((a.level + b.level) / 2); const blood = ma.bloodline + mb.bloodline;
    const eligible = avg >= rule.minLevel && blood >= rule.minBlood;
    const boosted = Boolean($('#boost-alchemy')?.checked); const usesCharm = boosted && state.items.furnaceCharm > 0;
    const boostCost = boosted && !usesCharm ? 80 : 0; const successRate = clamp(rule.success + (boosted ? 10 : 0), 1, 99);
    return { a, b, ma, mb, rule, recipe, avg, blood, eligible, result: monsters[rule.result], boosted, usesCharm, boostCost, totalCost: rule.cost + boostCost, successRate };
  }

  function slotHTML(item, rune) {
    if (!item) return `<span class="slot-rune">${rune}</span><em>選擇妖怪</em>`;
    const m = monsters[item.monsterId]; return `${spriteWrap(m)}<b>${escapeHTML(m.name)}</b><small>Lv.${item.level}・${m.element}・血脈 ${m.bloodline}</small>`;
  }

  function renderAlchemy() {
    if (selected.a && !getInstance(selected.a)) selected.a = null; if (selected.b && !getInstance(selected.b)) selected.b = null;
    const a = getInstance(selected.a), b = getInstance(selected.b); $('#slot-a').innerHTML = slotHTML(a, '甲'); $('#slot-b').innerHTML = slotHTML(b, '乙');
    $('#slot-a').classList.toggle('selected', Boolean(a)); $('#slot-b').classList.toggle('selected', Boolean(b));
    const p = alchemyPrediction();
    $('#boost-label').lastChild.textContent = state.items.furnaceCharm > 0 ? `護爐加持（消耗護爐符，現有 ${state.items.furnaceCharm}，成功率 +10%）` : '護爐加持（80 靈石，成功率 +10%）';
    if (!p) { $('#alchemy-cost').textContent = '—'; $('#alchemy-rate').textContent = '—'; $('#alchemy-element').textContent = '—'; $('#recipe-hint').textContent = '選擇兩隻妖怪，爐紋會顯示配方線索。'; $('#alchemy-start').disabled = true; return; }
    const known = p.recipe && state.discoveredRecipes.includes(p.recipe.id);
    $('#alchemy-cost').textContent = `${p.totalCost} 枚${p.usesCharm ? '＋護爐符' : ''}`; $('#alchemy-rate').textContent = p.eligible ? `${p.successRate}%` : '條件不足';
    $('#alchemy-element').textContent = known ? `${p.result.element}・${p.result.race}` : (p.recipe ? '？？？' : p.result.element);
    $('#recipe-hint').textContent = p.eligible ? `${p.recipe && !known ? '未知配方線索：' : ''}${p.rule.hint}` : `條件不足：需平均 Lv.${p.rule.minLevel}、血脈合計 ${p.rule.minBlood}（目前 ${p.avg}／${p.blood}）。`;
    $('#alchemy-start').disabled = alchemyBusy || !p.eligible || state.player.stones < p.totalCost;
  }

  function openPicker(slot) {
    $('#picker-title').textContent = `選擇${slot === 'a' ? '左側' : '右側'}材料`;
    const other = selected[slot === 'a' ? 'b' : 'a'];
    $('#picker-grid').innerHTML = state.inventory.map((i) => {
      const disabled = i.locked || i.uid === other; const m = monsters[i.monsterId];
      return `<article class="monster-card ${i.locked ? 'locked' : ''}" style="--rarity:${rarityColor(m.rarity)}"><button class="monster-main picker-choice" data-uid="${i.uid}" type="button" ${disabled ? 'disabled' : ''}>${spriteWrap(m)}<h3>${escapeHTML(m.name)}</h3><div class="meta">Lv.${i.level}・${m.race}・${m.element}</div><div class="bloodline"><span>血脈 ${m.bloodline}</span></div></button></article>`;
    }).join('');
    $('#picker-grid').dataset.slot = slot; $('#picker-dialog').showModal();
  }

  async function startAlchemy() {
    if (alchemyBusy) return; const p = alchemyPrediction(); if (!p || !p.eligible) return toast('材料或配方條件不足。', 'error');
    if (state.player.stones < p.totalCost) return toast('靈石不足。', 'error');
    if (p.a.locked || p.b.locked || p.a.uid === p.b.uid) return toast('材料已鎖定或選到同一實體。', 'error');
    const ok = await confirmDialog('確認煉妖', `將消耗 <b>${escapeHTML(p.ma.name)} Lv.${p.a.level}</b>、<b>${escapeHTML(p.mb.name)} Lv.${p.b.level}</b> 與 <b>${p.totalCost} 枚靈石</b>${p.usesCharm ? '、<b>護爐符 1</b>' : ''}。材料煉化後不會保留。`, '投入青銅爐');
    if (!ok) return;
    const ia = state.inventory.findIndex((i) => i.uid === p.a.uid), ib = state.inventory.findIndex((i) => i.uid === p.b.uid);
    if (ia < 0 || ib < 0 || ia === ib) return toast('材料狀態已改變，請重新選擇。', 'error');
    alchemyBusy = true; $('#app').classList.add('alchemy-running', `effect-rank-${rarityRank[p.result.rarity]}`); $('#alchemy-start').disabled = true; playSound('furnace');
    state.player.stones -= p.totalCost; if (p.usesCharm) state.items.furnaceCharm--;
    state.inventory = state.inventory.filter((i) => i.uid !== p.a.uid && i.uid !== p.b.uid);
    const success = Math.random() * 100 < p.successRate; const mutation = success && !p.recipe && Math.random() < .08; const firstRecipe = Boolean(p.recipe && !state.discoveredRecipes.includes(p.recipe.id));
    const resultId = success ? p.rule.result : p.rule.failureResult; let resultInstance = null; let firstMonster = false;
    if (resultId) {
      const resultBase = monsters[resultId]; const resultLevel = clamp(Math.floor((p.a.level + p.b.level) / 2) + (p.rule.levelModifier || 0) + (Math.random() < .12 ? 1 : 0) + (mutation ? 2 : 0), 1, 50);
      resultInstance = createInstance(resultId, resultLevel, { variant: mutation }); state.inventory.push(resultInstance); firstMonster = !state.discovered.includes(resultId); discoverMonster(resultId);
    }
    if (p.recipe && success && !state.discoveredRecipes.includes(p.recipe.id)) {
      state.discoveredRecipes.push(p.recipe.id); state.player.stones += p.recipe.reward; if (p.recipe.category === '山海配方') state.stats.shanhaiRecipes++;
    }
    state.stats.alchemies++; if (success) state.stats.successfulAlchemy++;
    if (success && rarityRank[p.result.rarity] >= 3) state.stats.rareMade++;
    addExp(success ? 28 + rarityRank[p.result.rarity] * 8 : 10);
    state.alchemyLog.unshift({ id: uid(), a: p.a.monsterId, b: p.b.monsterId, result: resultId, success, mutation, firstMonster, firstRecipe, cost: p.totalCost, time: nowISO() }); state.alchemyLog = state.alchemyLog.slice(0, 20);
    selected = { a: null, b: null }; saveGame();
    const delay = state.settings.reducedMotion || $('#skip-animation').checked ? 80 : 2200;
    setTimeout(() => {
      alchemyBusy = false; $('#app').classList.remove('alchemy-running', 'effect-rank-1', 'effect-rank-2', 'effect-rank-3', 'effect-rank-4', 'effect-rank-5', 'effect-rank-6'); renderAll();
      if (success && resultInstance) {
        const m = monsters[resultInstance.monsterId]; playSound(rarityRank[m.rarity] >= 4 ? 'rare' : 'success');
        showDialog(`<div class="dialog-monster result-reveal">${spriteWrap(m, true)}<h2 class="success-text">${mutation ? '靈紋變異成功' : '煉妖成功'}</h2><h3>${escapeHTML(m.name)}・Lv.${resultInstance.level}</h3><p>${escapeHTML(m.race)}・${escapeHTML(m.element)}・${escapeHTML(m.rarity)}</p>${mutation ? '<p class="success-text">◆ 小幅隨機修正：等級額外提升 2</p>' : ''}${firstMonster ? '<p class="success-text">◆ 首次取得・圖鑑新增</p>' : ''}${firstRecipe ? `<p class="success-text">◆ 首次發現・配方登錄・獎勵 ${p.recipe.reward} 靈石</p>` : ''}<p>${escapeHTML(m.ecology || m.plain)}</p></div>`);
      } else { playSound('fail'); showDialog('<h2 class="warning-text">煉妖失敗</h2><p>爐火忽然熄滅，黑煙從獸面紋間逸散。材料已被消耗，但你仍獲得了少量煉妖經驗。</p>'); }
    }, delay);
  }

  function renderLog() {
    $('#alchemy-log').classList.toggle('empty-state', !state.alchemyLog.length);
    $('#alchemy-log').innerHTML = state.alchemyLog.length ? state.alchemyLog.map((l) => `<button class="record-row ${l.success ? '' : 'failed'}" data-log="${l.id}" type="button" title="再次放入相同組合"><span>${escapeHTML(monsters[l.a].name)} ＋ ${escapeHTML(monsters[l.b].name)} → ${l.result ? escapeHTML(monsters[l.result].name) : '黑煙散盡'}</span><b>${l.success ? (l.mutation ? '變異' : '成功') : '失敗'}${l.firstMonster ? '・首次' : ''}</b><span class="record-cost">-${l.cost} 靈石</span><time>${formatTime(l.time)}</time></button>`).join('') : '尚無煉妖紀錄。';
  }

  const QUESTS = [
    { id: 'first_alchemy', name: '青爐初鳴', desc: '完成第一次煉妖', target: 1, value: () => state.stats.alchemies, reward: ['stones', 120] },
    { id: 'five_recipes', name: '方書初成', desc: '發現 5 組配方', target: 5, value: () => state.discoveredRecipes.length, reward: ['clues', 2] },
    { id: 'ten_monsters', name: '萬靈初聚', desc: '圖鑑登錄 10 種妖怪', target: 10, value: () => state.discovered.length, reward: ['capacity', 5] },
    { id: 'six_races', name: '六族同堂', desc: '擁有六大種族', target: 6, value: () => new Set(state.inventory.map((i) => monsters[i.monsterId].race)).size, reward: ['stones', 180] },
    { id: 'three_explore', name: '踏遍近山', desc: '完成 3 次探索', target: 3, value: () => state.stats.explorations, reward: ['fragments', 1] },
    { id: 'first_rare', name: '藍光入爐', desc: '煉出第一隻稀有以上妖怪', target: 1, value: () => state.stats.rareMade, reward: ['stones', 200] },
    { id: 'first_shanhai', name: '古獸留名', desc: '取得第一隻山海異獸', target: 1, value: () => state.shanhaiDiscovered.length, reward: ['fragments', 2] },
    { id: 'first_scroll', name: '卷軸初展', desc: '開啟第一張山海卷軸', target: 1, value: () => state.unlockedScrolls.length, reward: ['clues', 1] },
    { id: 'first_shrecipe', name: '古血新方', desc: '發現第一組山海配方', target: 1, value: () => state.stats.shanhaiRecipes, reward: ['stones', 250] },
    { id: 'blood_50', name: '血脈甦醒', desc: '取得血脈達 50 的妖怪', target: 50, value: () => state.stats.maxBloodline, reward: ['clues', 2] },
    { id: 'dex_half', name: '百怪半卷', desc: '一般圖鑑完成率達 50%', target: 18, value: () => state.discovered.filter((id) => monsters[id]?.sourceType === 'original').length, reward: ['capacity', 5] },
    { id: 'light_dark', name: '明晦相生', desc: '發現帝江的光暗融合配方', target: 1, value: () => state.discoveredRecipes.includes('r045') ? 1 : 0, reward: ['stones', 300] },
    { id: 'legend', name: '金紋現世', desc: '煉出第一隻傳說妖怪', target: 1, value: () => state.inventory.some((i) => rarityRank[monsters[i.monsterId].rarity] >= 5) ? 1 : 0, reward: ['capacity', 10] },
    { id: 'south_complete', name: '南山成卷', desc: '取得首批南山經 10 種異獸', target: 10, value: () => D.SHANHAI_MONSTERS.filter((m) => m.chapter === '南山經' && state.shanhaiDiscovered.includes(m.id)).length, reward: ['stones', 600] },
    { id: 'ten_explore', name: '山徑熟客', desc: '完成 10 次探索', target: 10, value: () => state.stats.explorations, reward: ['item:footprint', 3] },
    { id: 'twenty_alchemy', name: '爐火純青', desc: '完成 20 次煉妖', target: 20, value: () => state.stats.alchemies, reward: ['item:furnaceCharm', 2] },
    { id: 'half_recipes', name: '百方半解', desc: '發現 50 組配方', target: 50, value: () => state.discoveredRecipes.length, reward: ['item:bloodEssence', 3] },
    { id: 'all_recipes', name: '百方歸一', desc: '發現全部 100 組配方', target: 100, value: () => state.discoveredRecipes.length, reward: ['monster', 'moon_mirror_guard'] },
    { id: 'dex_complete', name: '百怪全錄', desc: '完成 36 種一般妖怪圖鑑', target: 36, value: () => state.discovered.filter((id) => monsters[id]?.sourceType === 'original').length, reward: ['stones', 1200] },
    { id: 'north_complete', name: '北山成卷', desc: '取得北山經 10 種異獸', target: 10, value: () => D.SHANHAI_MONSTERS.filter((m) => m.chapter === '北山經' && state.shanhaiDiscovered.includes(m.id)).length, reward: ['item:scale', 4] },
    { id: 'east_complete', name: '東山成卷', desc: '取得東山經 10 種異獸', target: 10, value: () => D.SHANHAI_MONSTERS.filter((m) => m.chapter === '東山經' && state.shanhaiDiscovered.includes(m.id)).length, reward: ['item:horn', 4] },
    { id: 'middle_complete', name: '中山成卷', desc: '取得中山經 10 種異獸', target: 10, value: () => D.SHANHAI_MONSTERS.filter((m) => m.chapter === '中山經' && state.shanhaiDiscovered.includes(m.id)).length, reward: ['fragments', 3] },
    { id: 'myth_blood', name: '神話血醒', desc: '取得血脈 100 的神話異獸', target: 100, value: () => state.stats.maxBloodline, reward: ['item:furnaceCharm', 5] },
    { id: 'all_scrolls', name: '八卷歸爐', desc: '開啟全部 8 張山海卷軸', target: 8, value: () => state.unlockedScrolls.length, reward: ['stones', 1000] },
    { id: 'all_shanhai', name: '山海萬靈錄', desc: '取得全部 60 種山海異獸', target: 60, value: () => state.shanhaiDiscovered.length, reward: ['stones', 3000] }
  ];
  function renderQuests() {
    const completed = QUESTS.filter((q) => q.value() >= q.target).length; $('#quest-summary').textContent = `${completed} / ${QUESTS.length}`;
    $('#quest-list').innerHTML = QUESTS.map((q) => { const v = Math.min(q.target, q.value()); const complete = v >= q.target; const claimed = state.claimedQuests.includes(q.id); return `<article class="quest-card ${complete ? 'complete' : ''} ${claimed ? 'claimed' : ''}"><div><h3>${q.name}</h3><p>${q.desc}</p><span class="quest-progress">進度 ${v} / ${q.target}・獎勵：${rewardText(q.reward)}</span></div><button class="${complete && !claimed ? 'primary-btn' : 'secondary-btn'} claim-quest" data-quest="${q.id}" type="button" ${!complete || claimed ? 'disabled' : ''}>${claimed ? '已領取' : complete ? '領取' : '進行中'}</button></article>`; }).join('');
  }
  function rewardText(r) {
    if (r[0] === 'monster') return `特殊妖怪 ${monsters[r[1]].name}`;
    if (r[0].startsWith('item:')) return `${ITEM_NAMES[r[0].slice(5)]} ${r[1]}`;
    return ({ stones: '靈石', clues: '配方線索', fragments: '古籍殘頁', capacity: '妖怪庫格數' }[r[0]] || r[0]) + ` ${r[1]}`;
  }
  function claimQuest(id) {
    const q = QUESTS.find((x) => x.id === id); if (!q || q.value() < q.target || state.claimedQuests.includes(id)) return;
    state.claimedQuests.push(id); const [type, amount] = q.reward;
    if (type === 'stones') state.player.stones += amount; if (type === 'clues') state.recipeClues += amount; if (type === 'fragments') state.scrollFragments += amount; if (type === 'capacity') state.player.capacity += amount;
    if (type.startsWith('item:')) state.items[type.slice(5)] += amount;
    if (type === 'monster') { if (state.inventory.length >= state.player.capacity) state.player.capacity++; state.inventory.push(createInstance(amount, monsters[amount].level)); discoverMonster(amount); }
    saveGame(); renderAll(); playSound('quest'); toast(`成就「${q.name}」完成：${rewardText(q.reward)}`, 'success');
  }

  function renderSettings() {
    $('#setting-reduced').checked = state.settings.reducedMotion; $('#setting-volume').value = state.settings.volume; $('#setting-dev').checked = state.settings.devMode;
  }
  function applySettings() { document.body.classList.toggle('reduced-motion', state.settings.reducedMotion); $('#sound-toggle').textContent = `聲效：${state.settings.sound ? '開' : '關'}`; }
  function renderSave() {
    $('#save-version').textContent = `格式 v${state.version}`; $('#save-info').textContent = `最後遊玩：${new Date(state.lastPlayed).toLocaleString('zh-TW')}｜所有進度僅儲存在目前瀏覽器。`;
    const summary = { version: state.version, player: state.player, owned: state.inventory.length, discovered: state.discovered.length, shanhai: state.shanhaiDiscovered.length, recipes: state.discoveredRecipes.length, lastPlayed: state.lastPlayed };
    $('#save-preview').value = JSON.stringify(summary, null, 2);
  }

  function renderAll() {
    renderStats(); renderAlchemy(); renderLog();
    const active = $('.page.active')?.id.replace('page-', ''); if (active && active !== 'alchemy') renderPage(active);
  }

  function exportSave() {
    saveGame(); const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `萬靈山海煉妖錄_存檔_${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('存檔已匯出。', 'success');
  }

  async function importSave(file) {
    try { const text = await file.text(); const imported = normalizeState(JSON.parse(text)); const ok = await confirmDialog('匯入存檔', '匯入後會覆蓋目前進度。已驗證檔案格式，是否繼續？', '覆蓋並匯入'); if (!ok) return; state = imported; selected = { a: null, b: null }; saveGame(); applySettings(); renderAll(); showPage('alchemy'); toast('存檔匯入成功。', 'success'); }
    catch (err) { toast(`匯入失敗：${err.message}`, 'error'); showDialog(`<h2 class="warning-text">存檔無法匯入</h2><p>${escapeHTML(err.message)}</p><p>目前進度未被更動。</p>`); }
  }

  const TUTORIAL = [
    ['歡迎來到煉妖房', '你已有六隻初階妖怪、500 枚靈石、20 格妖怪庫、3 條配方線索與 1 張南山卷殘頁。'],
    ['取得妖怪', '前往「探索」，5～15 秒即可帶回妖怪、靈石或線索。'], ['選擇材料', '在左右法陣點選妖怪，或從妖怪庫按「放入煉妖陣」。同一實體不能使用兩次。'],
    ['材料會被消耗', '按下煉妖後會再次確認。兩隻材料與靈石都會被消耗，重要妖怪請先鎖定。'], ['保護重要妖怪', '妖怪庫的「鎖定」會阻止該實體被放入煉妖陣；「常用」可作個人標記。'],
    ['發現配方', '第一次用正確材料煉成後，配方圖鑑會登錄並獎勵靈石。少數配方在左右順序不同時會有不同結果。'], ['短程探索', '一般地點各有不同妖怪池。開發模式提供立即完成按鈕，方便驗收。'],
    ['山海卷軸', '古籍殘頁可開啟更多卷軸。地圖是依古籍意象創作，不是現代地理。'], ['古籍與遊戲設定', '山海圖鑑用標籤區分原文、白話、推測與遊戲設定，不會把原創配方說成古籍內容。'],
    ['保存進度', '遊戲會自動存入 LocalStorage。請從上方「存檔」匯出 JSON 備份，也可隨時重新開啟本引導。']
  ];
  function startTutorial() { let step = 0; const overlay = $('#tutorial-overlay'); overlay.classList.remove('hidden'); const draw = () => { $('#tutorial-count').textContent = `${step + 1} / ${TUTORIAL.length}`; $('#tutorial-title').textContent = TUTORIAL[step][0]; $('#tutorial-text').textContent = TUTORIAL[step][1]; $('#tutorial-next').textContent = step === TUTORIAL.length - 1 ? '開始遊戲' : '下一步'; }; draw(); $('#tutorial-next').onclick = () => { if (step < TUTORIAL.length - 1) { step++; draw(); playSound('click'); } else finishTutorial(); }; $('#tutorial-skip').onclick = finishTutorial; function finishTutorial() { overlay.classList.add('hidden'); state.settings.tutorialDone = true; saveGame(); } }

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-page]'); if (nav) showPage(nav.dataset.page);
      const detail = e.target.closest('.detail-btn'); if (detail) showMonsterDetail(detail.closest('[data-uid]').dataset.uid);
      const dex = e.target.closest('.dex-detail'); if (dex && !dex.disabled) showMonsterDetail(dex.dataset.id);
      const lock = e.target.closest('.lock-btn'); if (lock) { const i = getInstance(lock.closest('[data-uid]').dataset.uid); i.locked = !i.locked; if (i.locked) { if (selected.a === i.uid) selected.a = null; if (selected.b === i.uid) selected.b = null; } saveGame(); renderInventory(); renderAlchemy(); playSound('select'); }
      const fav = e.target.closest('.favorite-btn'); if (fav) { const i = getInstance(fav.closest('[data-uid]').dataset.uid); i.favorite = !i.favorite; saveGame(); renderInventory(); }
      const use = e.target.closest('.use-btn'); if (use) { const id = use.closest('[data-uid]').dataset.uid; if (!selected.a) selected.a = id; else if (!selected.b && selected.a !== id) selected.b = id; else { selected.a = id; selected.b = null; } saveGame(); renderAlchemy(); showPage('alchemy'); playSound('select'); }
      const choice = e.target.closest('.picker-choice'); if (choice && !choice.disabled) { const slot = $('#picker-grid').dataset.slot; selected[slot] = choice.dataset.uid; $('#picker-dialog').close(); renderAlchemy(); playSound('select'); }
      const explore = e.target.closest('.explore-btn'); if (explore) startExploration(explore.dataset.location);
      if (e.target.closest('#finish-explore')) { state.exploration.endAt = Date.now(); finishExploration(); }
      const claim = e.target.closest('.claim-quest'); if (claim) claimQuest(claim.dataset.quest);
      const scroll = e.target.closest('[data-scroll]'); if (scroll) handleScroll(scroll.dataset.scroll, Number(scroll.dataset.index));
      const record = e.target.closest('[data-log]'); if (record) refillFromLog(record.dataset.log);
    });
    document.addEventListener('dragstart', (e) => { const card = e.target.closest('.monster-card[data-uid]'); if (!card) return; const item = getInstance(card.dataset.uid); if (!item || item.locked) return e.preventDefault(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.uid); card.classList.add('dragging'); });
    document.addEventListener('dragend', (e) => { e.target.closest('.monster-card')?.classList.remove('dragging'); $$('.material-slot').forEach((slot) => slot.classList.remove('drag-over')); });
    ['a', 'b'].forEach((slotName) => { const slot = $(`#slot-${slotName}`); slot.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; slot.classList.add('drag-over'); }); slot.addEventListener('dragleave', () => slot.classList.remove('drag-over')); slot.addEventListener('drop', (e) => { e.preventDefault(); slot.classList.remove('drag-over'); const id = e.dataTransfer.getData('text/plain'); const item = getInstance(id); const other = selected[slotName === 'a' ? 'b' : 'a']; if (!item || item.locked) return toast('這隻妖怪不可作為材料。', 'error'); if (id === other) return toast('同一個妖怪實體不能放入兩側。', 'error'); selected[slotName] = id; renderAlchemy(); playSound('select'); }); });
    $('#slot-a').addEventListener('click', () => openPicker('a')); $('#slot-b').addEventListener('click', () => openPicker('b'));
    $('#alchemy-clear').addEventListener('click', () => { selected = { a: null, b: null }; renderAlchemy(); }); $('#alchemy-start').addEventListener('click', startAlchemy);
    $('#boost-alchemy').addEventListener('change', renderAlchemy);
    ['inventory-search', 'inventory-race', 'inventory-element', 'inventory-sort'].forEach((id) => $(`#${id}`).addEventListener('input', renderInventory));
    ['shanhai-search', 'shanhai-chapter', 'shanhai-region', 'shanhai-form', 'shanhai-race', 'shanhai-element', 'shanhai-rarity', 'shanhai-state'].forEach((id) => $(`#${id}`).addEventListener('input', renderShanhai));
    ['recipe-state', 'recipe-category', 'recipe-rarity', 'recipe-race', 'recipe-element', 'recipe-order'].forEach((id) => $(`#${id}`).addEventListener('input', renderRecipes));
    $('#use-recipe-clue').addEventListener('click', useRecipeClue); $('#buy-clue').addEventListener('click', buyRecipeClue);
    $('#expand-storage').addEventListener('click', async () => { if (state.player.stones < 200) return toast('靈石不足。', 'error'); const ok = await confirmDialog('擴充妖怪庫', '消耗 200 枚靈石，永久增加 5 格妖怪庫。', '確認擴充'); if (ok) { state.player.stones -= 200; state.player.capacity += 5; saveGame(); renderAll(); } });
    $('#sound-toggle').addEventListener('click', () => { state.settings.sound = !state.settings.sound; applySettings(); saveGame(); if (state.settings.sound) playSound('click'); });
    $('#fullscreen-btn').addEventListener('click', () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); });
    $('#setting-reduced').addEventListener('change', (e) => { state.settings.reducedMotion = e.target.checked; applySettings(); saveGame(); });
    $('#setting-volume').addEventListener('input', (e) => { state.settings.volume = Number(e.target.value); saveGame(); });
    $('#setting-dev').addEventListener('change', (e) => { state.settings.devMode = e.target.checked; saveGame(); renderExplore(); });
    $('#manual-save').addEventListener('click', () => saveGame(true)); $('#export-save').addEventListener('click', exportSave); $('#import-save').addEventListener('change', (e) => { if (e.target.files[0]) importSave(e.target.files[0]); e.target.value = ''; });
    $('#reset-save').addEventListener('click', async () => { const one = await confirmDialog('第一次確認', '這會刪除目前所有進度。請先匯出備份。', '我了解，繼續'); if (!one) return; const two = await confirmDialog('第二次確認', '重置後無法復原，確定要回到全新遊戲？', '永久重置'); if (!two) return; localStorage.removeItem(SAVE_KEY); state = freshState(); selected = { a: null, b: null }; saveGame(); renderAll(); showPage('alchemy'); startTutorial(); });
    $('#restart-tutorial').addEventListener('click', startTutorial);
    $('#game-dialog').addEventListener('click', (e) => { if (e.target === $('#game-dialog')) $('#game-dialog').close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if ($('#picker-dialog').open) $('#picker-dialog').close(); else if ($('#game-dialog').open) $('#game-dialog').close(); } });
    window.addEventListener('beforeunload', () => saveGame());
  }

  function handleScroll(name) {
    if (state.unlockedScrolls.includes(name)) { const data = SCROLLS.find((x) => x.name === name); const entries = D.SHANHAI_MONSTERS.filter((m) => data.chapters.includes(m.chapter)); const found = entries.filter((m) => state.shanhaiDiscovered.includes(m.id)); $('#scroll-detail').innerHTML = `<h3>${data.name}</h3><p>${data.scene}</p><p>${data.clues}</p><p>${data.route}</p><p><b>本卷收錄：</b>${entries.map((m) => state.shanhaiDiscovered.includes(m.id) ? escapeHTML(m.name) : '？？？').join('、')}</p><p>發現進度 ${found.length}／${entries.length}。解鎖後可在探索頁進入對應卷境。</p>`; return; }
    if (state.scrollFragments < 3) return toast('需要 3 張古籍殘頁才能解鎖。', 'error');
    state.scrollFragments -= 3; state.unlockedScrolls.push(name); saveGame(); renderScrolls(); renderStats(); playSound('scroll'); toast(`${name}已展開！`, 'success');
  }

  function refillFromLog(id) {
    const log = state.alchemyLog.find((l) => l.id === id); if (!log) return;
    const a = state.inventory.find((i) => i.monsterId === log.a && !i.locked); const b = state.inventory.find((i) => i.monsterId === log.b && !i.locked && i.uid !== a?.uid);
    if (!a || !b) return toast('妖怪庫中缺少可用的相同材料。', 'error'); selected = { a: a.uid, b: b.uid }; renderAlchemy(); window.scrollTo({ top: 0, behavior: 'smooth' }); toast('已再次放入相同組合。', 'success');
  }

  function populateFilters() {
    const raceOptions = D.RACES.map((x) => `<option>${x}</option>`).join(''); const elementOptions = D.ELEMENTS.map((x) => `<option>${x}</option>`).join('');
    ['inventory-race', 'shanhai-race', 'recipe-race'].forEach((id) => $(`#${id}`).insertAdjacentHTML('beforeend', raceOptions));
    ['inventory-element', 'shanhai-element', 'recipe-element'].forEach((id) => $(`#${id}`).insertAdjacentHTML('beforeend', elementOptions));
    const chapters = [...new Set(D.SHANHAI_MONSTERS.map((m) => m.chapter))]; const regions = [...new Set(D.SHANHAI_MONSTERS.map((m) => m.region))];
    $('#shanhai-chapter').insertAdjacentHTML('beforeend', chapters.map((x) => `<option>${x}</option>`).join('')); $('#shanhai-region').insertAdjacentHTML('beforeend', regions.map((x) => `<option>${x}</option>`).join(''));
  }

  function init() {
    loadGame(); populateFilters(); bindEvents(); applySettings(); renderAll();
    if (state.exploration) { if (state.exploration.endAt <= Date.now()) finishExploration(); else startExploreTicker(); }
    if (!state.settings.tutorialDone) setTimeout(startTutorial, 450);
    console.info(`萬靈山海煉妖錄：載入 ${D.ORIGINAL_MONSTERS.length} 種原創妖怪、${D.SHANHAI_MONSTERS.length} 種山海異獸、${D.RECIPES.length} 組配方。`);
  }

  init();
})();
