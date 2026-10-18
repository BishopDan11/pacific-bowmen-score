/* Pacific Bowmen - Scorecard v1.4.9. Scores and photos stay on device. */
(() => {
  'use strict';
  const STORAGE_KEY = 'pacific-bowmen-two-arrow-v1';
  const SHOOT_TYPES = ['Club', 'Casual'];
  const HISTORY_KEY = 'pacific-bowmen-history-v1';
  const ROUNDS = 20;
  const FORMATS = ['PB2', 'ABA3'];
  const arrowLimit = (data = state) => data.format === 'ABA3' ? 3 : 2;
  const maxScore = (data = state) => data.format === 'ABA3' ? 400 : 800;
  const valueFor = (letter, index, data = state) => data.format === 'ABA3' ? ({A:[20,14,8], B:[18,12,6], C:[16,10,4], M:[0,0,0]})[letter][index] : SCORES[letter];
  const isFinished = (r, data = state) => data.format === 'ABA3' ? r.some(v => v !== null && v !== 'M') || r.every(v => v === 'M') : r.every(v => v !== null);
  const isSkipped = (r, index, data = state) => data.format === 'ABA3' && r.slice(0,index).some(v => v !== null && v !== 'M');
  const nextArrowIndex = (r, data = state) => {
    if (isFinished(r,data)) return 0;
    return r.findIndex(v => v === null);
  };
  const SCORES = Object.freeze({A: 20, B: 18, C: 16, M: 0});

  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  let toastTimer;
  let state = readState();
  let activeRound = 0;
  let activeArrow = 0;
  let undo = null;
  let history = readHistory();

  function blankRounds(format = state?.format || 'PB2') { return Array.from({length: ROUNDS}, () => Array(format === 'ABA3' ? 3 : 2).fill(null)); }
  function makeId() { return globalThis.crypto?.randomUUID?.() || `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
  function newState() { return {version: 1, shootDate: new Date().toISOString(), shootType: 'Club', format: 'PB2', archers: [], selectedArcherId: null}; }
  function cleanState(value) {
    if (!value || !Array.isArray(value.archers) || value.archers.length > 200) throw Error('Invalid scorecard');
    const seen = new Set();
    const archers = value.archers.map((archer, index) => {
      if (!archer || typeof archer.name !== 'string' || !archer.name.trim() || archer.name.length > 100) throw Error('Invalid archer');
      const name = archer.name.trim().slice(0, 50);
      const id = typeof archer.id === 'string' && archer.id.length < 120 && !seen.has(archer.id) ? archer.id : `restored-${index}-${makeId()}`;
      seen.add(id);
      const format = FORMATS.includes(value.format) ? value.format : 'PB2';
      const rounds = blankRounds(format);
      if (!Array.isArray(archer.rounds) || archer.rounds.length !== ROUNDS) throw Error('Invalid rounds');
      for (let r = 0; r < ROUNDS; r++) {
        if (!Array.isArray(archer.rounds[r]) || archer.rounds[r].length !== (format === 'ABA3' ? 3 : 2)) throw Error('Invalid arrow count');
        rounds[r] = archer.rounds[r].map(arrow => { if (arrow !== null && !Object.hasOwn(SCORES, arrow)) throw Error('Invalid score'); return arrow; });
        if (format === 'ABA3') {
          let hit = false;
          for (const arrow of rounds[r]) {
            if (hit && arrow !== null) throw Error('ABA scores cannot follow a hit');
            if (arrow !== null && arrow !== 'M') hit = true;
          }
        }
      }
      const photo = typeof archer.photo === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]{1,120000}$/.test(archer.photo) ? archer.photo : null;
      return {id, name, rounds, photo};
    });
    const selectedArcherId = archers.some(a => a.id === value.selectedArcherId) ? value.selectedArcherId : (archers[0]?.id ?? null);
    return {version: 1, shootDate: Number.isFinite(Date.parse(value.shootDate)) ? value.shootDate : new Date().toISOString(), shootType: SHOOT_TYPES.includes(value.shootType) ? value.shootType : 'Club', format: FORMATS.includes(value.format) ? value.format : 'PB2', archers, selectedArcherId};
  }
  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? cleanState(JSON.parse(raw)) : newState();
    } catch (err) {
      console.warn('Unable to load saved scores', err);
      return newState();
    }
  }
  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (!Array.isArray(value)) return [];
      return value.slice(0, 120).filter(v => v && typeof v.id === 'string' && v.data).map(v => ({
        id: v.id, savedAt: v.savedAt, data: cleanState(v.data)
      }));
    } catch (error) { console.warn('Unable to read history', error); return []; }
  }
  function persistHistory(next) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); history = next; return true; }
    catch (error) { console.warn('Not enough storage for history', error); toast('Device storage full — export to Files first'); return false; }
  }
  function shootId(data) { return data.shootDate; }
  function archiveShoot(data = state) {
    if (!data.archers.length) return true;
    const safe = cleanState(data);
    const id = shootId(safe);
    const next = [{id, savedAt: new Date().toISOString(), data: safe}, ...history.filter(h => h.id !== id)];
    return persistHistory(next);
  }
  function shootStats(data) {
    const shots = data.archers.reduce((sum, a) => sum + arrowCount(a), 0);
    const capacity = data.archers.length * ROUNDS * arrowLimit(data);
    return {shots, capacity, complete: capacity > 0 && data.archers.every(a => a.rounds.every(r => isFinished(r,data)))};
  }
  function shootTitle(data = state) {
    const date = new Date(data.shootDate);
    const month = new Intl.DateTimeFormat('en-AU', {month:'long'}).format(date);
    return (data.shootType === 'Casual') ? 'Casual Shoot' : `${month} Club Shoot`;
  }
  function fullShootDate(date) {
    return new Intl.DateTimeFormat('en-AU', {day:'numeric',month:'long',year:'numeric'}).format(new Date(date));
  }
  function formattedDate(date) {
    return new Intl.DateTimeFormat('en-AU', {day:'numeric', month:'short', year:'numeric'}).format(new Date(date));
  }
  function makeJsonFile(data) {
    return new File([JSON.stringify(data, null, 2)], `Pacific_Bowmen_${new Date(data.shootDate).toISOString().slice(0,10)}.json`, {type:'application/json'});
  }
  async function saveToFiles(data = state) {
    if (!data.archers.length) return toast('Add archers before saving a shoot');
    const file = makeJsonFile(data);
    if (navigator.share && navigator.canShare?.({files: [file]})) {
      try { await navigator.share({title: 'Pacific Bowmen shoot backup', files: [file]}); return; }
      catch (error) { if (error?.name === 'AbortError') return; console.warn('File share failed', error); }
    }
    download(file.name, JSON.stringify(data, null, 2), 'application/json');
    toast('Shoot downloaded — save JSON in Files');
  }
  function saveShoot() {
    if (!state.archers.length) return toast('No archers to save');
    if (archiveShoot()) toast('Shoot saved to History on this device');
  }
  function showHistory() {
    const entries = history.map(h => {
      const stats = shootStats(h.data);
      const status = stats.complete ? 'Complete' : `In progress · ${stats.shots} arrows entered`;
      return `<div class="history-entry"><div class="history-details"><strong>${esc(shootTitle(h.data))}</strong><span>${esc(formattedDate(h.data.shootDate))}</span><span>${h.data.archers.length} archers · ${esc(status)}</span></div><div class="history-buttons"><button type="button" class="outline-btn" data-action="view-history" data-id="${esc(h.id)}">View</button><button type="button" class="outline-btn" data-action="export-history" data-id="${esc(h.id)}">Files</button></div></div>`;
    }).join('');
    showModal('Shoot History', `<div class="history-list"><p>Previous shoots saved on this device. Open an entry to view its results without changing the current shoot. You can also import a JSON shoot from Files.</p>${entries || '<p>No archived shoots yet. Tap Save Shoot, or begin a new shoot to archive the existing scores.</p>'}<button type="button" class="primary-btn" data-action="load-past-shoot">Load from Files</button><div class="clear-history-footer"><button type="button" class="clear-history-btn" data-action="clear-history" ${history.length ? '' : 'disabled'}>Clear History${history.length ? ` (${history.length})` : ''}</button></div></div>`);
  }
  function clearHistory() {
    const count = history.length;
    if (!count) return;
    if (!confirm(`Permanently delete ${count} archived shoot${count === 1 ? '' : 's'} from this device?\n\nThe current shoot and exported JSON backups will not be affected. This cannot be undone.`)) return;
    if (!persistHistory([])) return;
    showHistory();
    toast(`${count} archived shoot${count === 1 ? '' : 's'} deleted`);
  }
  function viewHistory(id) {
    const entry = history.find(h => h.id === id); if (!entry) return;
    const data = entry.data;
    const rows = [...data.archers].sort((a,b)=>points(b,data)-points(a,data)).map(a => {
      const perRound = a.rounds.map((r,i) => `<span>R${i+1}: ${r.map(v=>v === null?'—':v === 'M'?'Miss':v).join(' / ')} (${roundPoints(r,data)})</span>`).join('');
      return `<details class="history-archer"><summary><strong>${esc(a.name)}</strong><span>${points(a,data)} / ${maxScore(data)} · ${completeRounds(a,data)}/20 rounds</span></summary><div class="history-rounds">${perRound}</div></details>`;
    }).join('');
    showModal(`${shootTitle(data)} · ${formattedDate(data.shootDate)}`, `<div class="history-view"><p>Read-only archived results · ${data.archers.length} archers</p>${rows}<div class="history-footer"><button class="outline-btn" type="button" data-action="export-history" data-id="${esc(id)}">Save to Files</button><button class="outline-btn" type="button" data-action="activate-history" data-id="${esc(id)}">Restore for editing</button><button class="outline-btn" type="button" data-action="history">Back to History</button></div></div>`);
  }
  function activateHistory(id) {
    const entry = history.find(h => h.id === id); if (!entry) return;
    if (!confirm('Restore this historical shoot for editing? The current shoot will be archived first and then replaced.')) return;
    if (!archiveShoot()) return;
    state = cleanState(entry.data); undo = null; resumeShootPosition();
    if (!save()) return toast('Could not store restored shoot');
    closeModal(); render(); toast('Historical shoot restored');
  }
  async function importPastShoot(file) {
    if (!file) return;
    if (file.size > 12_000_000) return toast('File too large');
    let data;
    try { data = cleanState(JSON.parse(await file.text())); }
    catch (error) { return toast('Invalid Pacific Bowmen JSON file'); }
    if (!data.archers.length) return toast('This file has no archers');
    if (history.some(h => h.id === shootId(data)) && !confirm('Replace the existing archived version of this shoot?')) return;
    if (!archiveShoot(data)) return;
    showHistory(); toast('Past shoot added to History');
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); $('#storage-alert').hidden = true; return true; }
    catch (err) { $('#storage-alert').hidden = false; console.warn(err); return false; }
  }
  const selected = () => state.archers.find(archer => archer.id === state.selectedArcherId) || null;
  const arrowCount = archer => archer.rounds.flat().filter(v => v !== null).length;
  const roundPoints = (r, data = state) => r.reduce((sum, v, i) => sum + (v === null ? 0 : valueFor(v,i,data)), 0);
  const points = (archer, data = state) => archer.rounds.reduce((sum,r) => sum + roundPoints(r,data), 0);
  const completeRounds = (archer,data = state) => archer.rounds.filter(r => isFinished(r,data)).length;
  const avatar = (archer, extraClass = '') => {
    const initials = archer.name.trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase() ?? '').join('');
    return `<span class="archer-avatar ${extraClass}">${archer.photo ? `<img src="${archer.photo}" alt="">` : esc(initials)}</span>`;
  };

  function ranks() {
    return [...state.archers].sort((a,b) => points(b) - points(a) || a.name.localeCompare(b.name));
  }
  function toast(message) {
    const node = $('#toast'); node.textContent = message; node.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('visible'), 2100);
  }
  function moveToRound(round) {
    activeRound = Math.min(ROUNDS - 1, Math.max(0, round));
    const r = selected()?.rounds[activeRound];
    activeArrow = r ? Math.max(0,nextArrowIndex(r)) : 0;
  }
  function resumeShootPosition() {
    // After re-opening the installed app, resume the earliest unscored
    // arrow in round-then-archer order instead of overwriting Round 1.
    for (let r = 0; r < ROUNDS; r++) {
      for (const archer of state.archers) {
        if (!isFinished(archer.rounds[r])) {
          state.selectedArcherId = archer.id;
          moveToRound(r);
          return;
        }
      }
    }
    if (state.archers.length) { activeRound = ROUNDS - 1; activeArrow = arrowLimit() - 1; }
  }
  function selectArcher(id) {
    if (!state.archers.some(a => a.id === id)) return;
    state.selectedArcherId = id;
    const archer = selected();
    const firstIncomplete = archer.rounds.findIndex(round => !isFinished(round));
    moveToRound(firstIncomplete < 0 ? ROUNDS - 1 : firstIncomplete);
    save(); render();
  }
  function focusScoring({smooth = true} = {}) {
    if (!matchMedia('(max-width: 690px)').matches || !state.archers.length) return;
    if (!$('#modal-backdrop').hidden) return;
    const panel = $('#score-panel');
    if (!panel) return;
    // Anchor the panel below the browser chrome, without shifting after every score.
    const top = window.scrollY + panel.getBoundingClientRect().top - 10;
    window.scrollTo({top: Math.max(0, top), behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant'});
  }
  function addArcher(name) {
    name = name.trim().replace(/\s+/g, ' ').slice(0, 50);
    if (!name) return toast('Enter an archer name');
    if (state.archers.some(a => a.name.toLowerCase() === name.toLowerCase())) return toast('That archer is already on the scorecard');
    const archer = {id: makeId(), name, rounds: blankRounds(), photo: null};
    // Keep the first archer selected while creating the shooting order.
    const firstArcher = state.archers.length === 0;
    state.archers.push(archer);
    if (firstArcher || !selected()) { state.selectedArcherId = archer.id; activeRound = 0; activeArrow = 0; }
    undo = null;
    save(); render(); toast(`${name} added`);
    $('#quick-name').value = '';
    closeModal();
    // Stay on the Participants panel while the scorer adds the shooting group.
  }
  // Shoot in roster order: both arrows for archer 1, then both for archer 2,
  // and so on. Only advance the round once everyone has completed that round.
  // Using insertion order instead of score rank keeps the shooting line stable.
  function advanceAfterPair(archerId, roundIndex) {
    const currentIndex = state.archers.findIndex(a => a.id === archerId);
    // Finish every archer in the current round before starting the next one.
    // The last archer's second arrow ALWAYS ends the round.
    for (let step = 1; step < state.archers.length; step++) {
      const next = state.archers[(currentIndex + step) % state.archers.length];
      if (!isFinished(next.rounds[roundIndex])) {
        state.selectedArcherId = next.id;
        moveToRound(roundIndex);
        return {archer: next, roundCompleted: false};
      }
    }
    // This round is complete. Go to archer 1 in the next unfinished round.
    // Normally that is roundIndex + 1; older unfilled gaps are still recoverable.
    for (let step = 1; step < ROUNDS; step++) {
      const targetRound = (roundIndex + step) % ROUNDS;
      const next = state.archers.find(a => !isFinished(a.rounds[targetRound]));
      if (next) {
        state.selectedArcherId = next.id;
        moveToRound(targetRound);
        return {archer: next, roundCompleted: true};
      }
    }
    // All arrows in the shoot have been entered. Leave the last arrow visible.
    activeRound = ROUNDS - 1;
    activeArrow = arrowLimit() - 1;
    return {archer: null, roundCompleted: true, shootCompleted: true};
  }
  function recordScore(letter) {
    const archer = selected();
    if (!archer || !Object.hasOwn(SCORES, letter)) return;
    const round = archer.rounds[activeRound];
    if (isSkipped(round, activeArrow)) return toast('Arrow not shot — previous arrow scored');
    const wasEmpty = round[activeArrow] === null;
    const oldValue = archer.rounds[activeRound][activeArrow];
    undo = {archerId: archer.id, round: activeRound, arrow: activeArrow, value: oldValue, previousRound: [...round]};
    archer.rounds[activeRound][activeArrow] = letter;
    // In ABA, changing an earlier miss to a hit invalidates every later arrow.
    if (state.format === 'ABA3' && letter !== 'M') {
      for (let i = activeArrow + 1; i < round.length; i++) round[i] = null;
    }
    const completed = isFinished(archer.rounds[activeRound]);
    let advance = null;
    if (wasEmpty && completed) {
      advance = advanceAfterPair(archer.id, activeRound);
    } else if (wasEmpty && !completed) {
      activeArrow = Math.max(0,nextArrowIndex(archer.rounds[activeRound]));
    }
    // Edits to previously scored arrows do not unexpectedly change archer.
    save(); render();
    if (advance?.shootCompleted) toast('Shoot complete — all 20 rounds finished!');
    else if (advance?.roundCompleted) toast(`Round complete! Starting Round ${activeRound + 1}`);
    else if (advance?.archer) toast(`Next: ${advance.archer.name} · Round ${activeRound + 1}`);
  }
  function undoShot() {
    if (!undo) return;
    const archer = state.archers.find(a => a.id === undo.archerId);
    if (!archer) return;
    if (undo.previousRound) archer.rounds[undo.round] = undo.previousRound;
    else archer.rounds[undo.round][undo.arrow] = undo.value;
    state.selectedArcherId = archer.id;
    activeRound = undo.round; activeArrow = undo.arrow;
    undo = null; save(); render(); toast('Last arrow undone');
  }
  function clearArrow() {
    const archer = selected();
    if (!archer || archer.rounds[activeRound][activeArrow] === null) return;
    undo = {archerId: archer.id, round: activeRound, arrow: activeArrow, value: archer.rounds[activeRound][activeArrow]};
    archer.rounds[activeRound][activeArrow] = null;
    save(); render(); toast('Arrow cleared');
  }
  function render() {
    $('#shoot-heading').textContent = shootTitle();
    $('#session-date').textContent = fullShootDate(state.shootDate);
    $('#archer-count').textContent = state.archers.length;
    $('#format-arrows').textContent = `${arrowLimit()} ARROWS`;
    $('#format-max').textContent = `${maxScore()} MAX`;
    $('#page-footer').textContent = state.format === 'ABA3' ? 'Pacific Bowmen · ABA 3-arrow: first scoring arrow counts · v1.4.9' : 'Pacific Bowmen · A = 20 · B = 18 · C = 16 · Miss = 0 · Both arrows score equally · v1.4.9';
    $('#app').classList.toggle('has-archers', state.archers.length > 0);
    const ranking = ranks();
    const position = new Map(ranking.map((archer, i) => [archer.id, i + 1]));
    // Keep cards in shooting order; scores/ranks update without moving cards around.
    const leaderboard = state.archers;
    $('#archer-list').innerHTML = leaderboard.map((archer, index) => {
      const total = points(archer), count = arrowCount(archer), active = state.selectedArcherId === archer.id;
      return `<button type="button" class="archer-card ${active ? 'selected' : ''}" data-action="select-archer" data-id="${esc(archer.id)}" aria-current="${active ? 'true' : 'false'}">
        <div class="archer-rank">${position.get(archer.id)}</div>${avatar(archer, 'list-avatar')}<div><div class="archer-name">${esc(archer.name)}</div><div class="archer-progress">${count} arrows · ${completeRounds(archer)}/20 rounds</div><div class="archer-progress-mobile">${completeRounds(archer)}/20 rounds</div></div>
        <div class="archer-points-wrap"><div class="archer-points">${total}</div><div class="archer-points-sub">/ ${maxScore()} pts</div></div></button>`;
    }).join('') || `<div class="archer-empty">No archers yet.<br>Enter a name above to start scoring.</div>`;
    const archer = selected();
    if (!archer) {
      $('#score-panel').innerHTML = `<div class="empty-shoot"><div class="empty-art" aria-hidden="true"></div><div class="panel-kicker">READY WHEN YOU ARE</div><h2>Let’s start scoring.</h2><p>Add your first archer to track 20 rounds, ${arrowLimit()} arrows per round. Every score saves automatically.</p></div>`;
      return;
    }
    const total = points(archer), count = arrowCount(archer), finished = completeRounds(archer);
    const currentRound = archer.rounds[activeRound];
    const roundSum = roundPoints(currentRound);
    $('#score-panel').innerHTML = `
      <div class="score-top"><div class="archer-heading">${avatar(archer)}<div><div class="selected-label">NOW SCORING · ARCHER ${state.archers.findIndex(a => a.id === archer.id) + 1} OF ${state.archers.length}</div><h2>${esc(archer.name)}</h2></div></div>
        <div class="minor-actions"><button class="tiny-action" data-action="photo-archer" type="button">${archer.photo ? 'Edit photo' : '+ Photo'}</button><button class="tiny-action" data-action="rename-archer" type="button">Rename</button><button class="tiny-action" data-action="delete-archer" type="button">Remove</button></div></div>
      <div class="total-strip"><div class="total-stat"><div class="total-label">TOTAL SCORE</div><div class="total-number">${total}<small> / ${maxScore()}</small></div></div><div class="total-stat"><div class="total-label">ROUNDS DONE</div><div class="total-number">${finished}<small> / 20</small></div></div><div class="total-stat"><div class="total-label">ARROWS SHOT</div><div class="total-number">${count}<small>${state.format === 'ABA3' ? ' entered' : ` / ${ROUNDS * arrowLimit()}`}</small></div></div></div>
      <div class="total-progress" aria-label="${count} arrows entered"><span style="width:${(completeRounds(archer) / ROUNDS) * 100}%"></span></div>
      <div class="score-content"><div class="round-heading"><div><h3>Round ${activeRound+1} <span style="font-weight:500;color:#9daa9f">of 20</span></h3><p>${state.format === 'ABA3' ? 'Stop at first hit (maximum 3 arrows)' : 'Two arrows each, then the next archer'}</p></div>
      <div class="round-nav"><button type="button" data-action="prev-round" aria-label="Previous round" ${activeRound === 0 ? 'disabled' : ''}>‹</button><button type="button" data-action="next-round" aria-label="Next round" ${activeRound === 19 ? 'disabled' : ''}>›</button></div></div>
      <div class="arrow-row ${state.format === 'ABA3' ? 'three-arrows' : ''}">${currentRound.map((letter, index) => `<button type="button" data-action="select-arrow" data-index="${index}" class="arrow-box ${index === activeArrow ? 'active' : ''} ${isSkipped(currentRound,index) ? 'skipped' : ''}" aria-pressed="${index === activeArrow}" ${isSkipped(currentRound,index) ? 'disabled' : ''}><div><div class="arrow-title">ARROW ${index+1}</div><div class="arrow-value ${letter === null ? 'blank' : ''}">${isSkipped(currentRound,index) ? 'Not shot' : letter === null ? 'Not scored' : letter === 'M' ? 'Miss' : letter}</div></div><div class="arrow-score ${letter === null ? 'blank' : ''}">${isSkipped(currentRound,index) ? '—' : letter === null ? '—' : `${valueFor(letter,index)} pts`}</div></button>`).join('')}</div>
      <div class="score-instruction"><span>${esc(archer.name)} · <strong>ARROW ${activeArrow+1}</strong></span><span>Tap to score</span></div>
      <div class="score-choices"><button class="choice choice-a" type="button" data-action="score" data-letter="A"><span class="choice-letter">A</span><span class="choice-points">${valueFor('A',activeArrow)} pts</span></button><button class="choice choice-b" type="button" data-action="score" data-letter="B"><span class="choice-letter">B</span><span class="choice-points">${valueFor('B',activeArrow)} pts</span></button><button class="choice choice-c" type="button" data-action="score" data-letter="C"><span class="choice-letter">C</span><span class="choice-points">${valueFor('C',activeArrow)} pts</span></button><button class="choice choice-m" type="button" data-action="score" data-letter="M"><span class="choice-letter">Miss</span><span class="choice-points">0 pts</span></button></div>
      <div class="score-actions"><span class="round-score">Round score: <strong>${roundSum} / ${state.format === 'ABA3' ? 20 : 40}</strong><span class="round-status">${!isFinished(currentRound) ? 'Incomplete' : 'Complete'}</span></span><div><button class="clear-btn" type="button" data-action="undo" ${undo ? '' : 'disabled'}>Undo</button><button class="clear-btn" type="button" data-action="clear-arrow" ${currentRound[activeArrow] === null ? 'disabled' : ''}>Clear arrow</button></div></div>
      <div class="section-divider"></div><div class="rounds-section-head"><h3>All 20 rounds</h3><span>Select any round to edit</span></div>
      <div class="rounds-grid">${archer.rounds.map((r, i) => {
        const shots = r.filter(v => v !== null).length;
        return `<button type="button" data-action="select-round" data-index="${i}" class="round-cell ${i === activeRound ? 'is-selected' : ''} ${isFinished(r) ? 'is-complete' : shots > 0 ? 'is-partial' : ''}" aria-label="Round ${i+1}: ${shots} arrows entered, ${roundPoints(r)} points" aria-pressed="${i === activeRound}"><span class="round-id">R${String(i+1).padStart(2,'0')}</span><span class="round-total ${!shots ? 'empty' : ''}">${shots === 0 ? '—' : `${roundPoints(r)}${!isFinished(r) ? '*' : ''}`}</span></button>`;
      }).join('')}</div>
      ${state.archers.length && state.archers.every(a => completeRounds(a) === ROUNDS) ? `<div class="completed-banner">✓ Shoot complete — all 20 rounds and all archers finished. Final results are ready to export.</div>` : ''}
      ${completeRounds(archer) === ROUNDS ? `<div class="completed-banner">✓ ${esc(archer.name)} has completed all 20 rounds — final score ${total} / ${maxScore()}.</div>` : ''}</div>`;
  }
  function showModal(title, html) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = html;
    $('#modal-backdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => $('#modal-body input')?.focus());
  }
  function closeModal() {
    $('#modal-backdrop').hidden = true;
    document.body.style.overflow = '';
  }
  function download(name, data, type) {
    const url = URL.createObjectURL(new Blob([data], {type}));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  function slugDate() { return new Date(state.shootDate).toLocaleDateString('en-CA', {year:'numeric',month:'2-digit',day:'2-digit'}); }
  function emailSubject() {
    const date = new Date(state.shootDate);
    const day = new Intl.DateTimeFormat('en-AU', {day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
    return `${shootTitle()} - ${day}`;
  }
  function makeCSV() {
    const header = ['Shoot Date', 'Shoot Type', 'Format', 'Archer', 'Round', 'Arrow 1', 'Arrow 2', 'Arrow 3', 'Round Points', 'Running Total', 'Final Total', 'Arrows Scored'];
    const rows = [header];
    for (const archer of ranks()) {
      let running = 0;
      for (let r = 0; r < ROUNDS; r++) {
        const shots = archer.rounds[r]; running += roundPoints(shots);
        rows.push([slugDate(), state.shootType, state.format, archer.name, r+1, ...Array.from({length:3},(_,i) => i>=shots.length || isSkipped(shots,i) ? 'Not shot' : shots[i] === null ? '' : shots[i] === 'M' ? 'Miss' : shots[i]), roundPoints(shots), running, points(archer), arrowCount(archer)]);
      }
    }
    return '\ufeff' + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  }
  function exportCSV() {
    if (!state.archers.length) return toast('Add an archer before exporting');
    download(`pacific-bowmen-scores-${slugDate()}.csv`, makeCSV(), 'text/csv;charset=utf-8');
    toast('CSV downloaded');
  }
  function emailSummary() {
    return `${shootTitle()}\nDate: ${slugDate()}\n${state.format === 'ABA3' ? '20 targets · ABA 3-arrow first-hit system · A/B/C: 20/18/16, 14/12/10, 8/6/4 · Max 400' : '20 rounds × 2 arrows | A=20 B=18 C=16 Miss=0 | Max 800'}\n\n` +
      ranks().map((a, i) => `${i+1}. ${a.name}: ${points(a)}/${maxScore()} (${completeRounds(a)}/20 rounds)`).join('\n') +
      '\n\nScores recorded locally using Pacific Bowmen Scorecard.';
  }
  async function emailResults() {
    if (!state.archers.length) return toast('Add an archer before emailing results');
    // Use the iOS/Android share sheet: selecting Mail attaches the CSV.
    // Apple Mail and Outlook may override the suggested subject.
    const file = new File([makeCSV()], `pacific-bowmen-scores-${slugDate()}.csv`, {type:'text/csv'});
    if (navigator.share && navigator.canShare?.({files:[file]})) {
      try {
        await navigator.share({title:emailSubject(),text:emailSummary(),files:[file]});
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
        console.warn('Unable to share CSV', error);
      }
    }
    // Desktop or older browsers: download the attachment for later use.
    download(file.name, makeCSV(), 'text/csv;charset=utf-8');
    toast('CSV downloaded — sharing attachments is unavailable in this browser');
  }
  function backup() {
    download(`pacific-bowmen-backup-${slugDate()}.json`, JSON.stringify(state, null, 2), 'application/json');
    toast('Backup downloaded');
  }
  function openPhotoOptions() {
    const archer = selected(); if (!archer) return;
    showModal('Archer headshot', `<div class="photo-modal">
      <div class="photo-preview">${avatar(archer, 'preview-avatar')}</div>
      <p><strong>${esc(archer.name)}</strong> — optional. Photos are resized and saved only on this device. They are included in a JSON backup, but not in emailed CSV results.</p>
      <div class="photo-actions"><button type="button" class="primary-btn" data-action="take-photo">Take a photo</button><button type="button" class="outline-btn" data-action="choose-photo">Choose photo</button></div>
      ${archer.photo ? '<button type="button" class="remove-photo" data-action="remove-photo">Remove photo</button>' : ''}
    </div>`);
  }
  async function processPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return toast('Choose an image file');
    if (file.size > 25_000_000) return toast('Photo is too large (25 MB maximum)');
    const archerId = selected()?.id;
    if (!archerId) return;
    let img, bitmapURL;
    try {
      // File input and browser image decoding process the photo locally; nothing is uploaded.
      bitmapURL = URL.createObjectURL(file);
      img = new Image();
      img.src = bitmapURL;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 160; canvas.height = 160;
      const context = canvas.getContext('2d');
      if (!context) throw Error('Canvas unavailable');
      context.fillStyle = '#f6f8fd'; context.fillRect(0, 0, 160, 160);
      const scale = Math.min(160 / img.naturalWidth, 160 / img.naturalHeight);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      context.drawImage(img, (160-w)/2, (160-h)/2, w, h);
      let photo = canvas.toDataURL('image/jpeg', 0.68);
      if (photo.length > 32000) photo = canvas.toDataURL('image/jpeg', 0.52);
      if (photo.length > 120000) throw Error('Compressed image too large');
      const archer = state.archers.find(a => a.id === archerId);
      if (!archer) return;
      const previous = archer.photo;
      archer.photo = photo;
      // Avoid silently losing a photo because local storage quota is full.
      if (!save()) { archer.photo = previous; save(); return toast('Not enough device storage for photo'); }
      closeModal(); render(); toast('Archer photo saved');
    } catch (error) { console.warn('Unable to process archer photo', error); toast('Unable to use that photo. Try a JPEG.'); }
    finally { if (bitmapURL) URL.revokeObjectURL(bitmapURL); }
  }
  function removePhoto() {
    const archer = selected(); if (!archer) return;
    archer.photo = null;
    save(); closeModal(); render(); toast('Photo removed');
  }
  function newShoot() {
    showModal('Start New Shoot', `<div class="shoot-type-choices"><p>Select the type of shoot. The current shoot will be saved in History before starting fresh.</p><button class="shoot-type-btn" type="button" data-action="choose-shoot-type" data-type="Club"><strong>🏆 Club Shoot</strong><span>${esc(new Intl.DateTimeFormat('en-AU',{month:'long'}).format(new Date()))} Club Shoot</span></button><button class="shoot-type-btn" type="button" data-action="choose-shoot-type" data-type="Casual"><strong>◎ Casual Shoot</strong><span>Casual Shoot</span></button></div>`);
  }
  function chooseShootType(type) {
    if (!SHOOT_TYPES.includes(type)) return;
    showModal('Choose Scoring Format', `<div class="shoot-type-choices"><p>${esc(type)} Shoot — select the arrow format.</p><button class="shoot-type-btn" type="button" data-action="start-shoot" data-type="${esc(type)}" data-format="PB2"><strong>2-arrow Pacific Bowmen</strong><span>20 rounds · both arrows count · max 800</span></button><button class="shoot-type-btn" type="button" data-action="start-shoot" data-type="${esc(type)}" data-format="ABA3"><strong>3-arrow ABA</strong><span>20 targets · stop at first hit · max 400</span></button></div>`);
  }
  function startShoot(type, format) {
    if (!SHOOT_TYPES.includes(type) || !FORMATS.includes(format)) return;
    if (state.archers.length && !confirm(`Start a new ${type.toLowerCase()} shoot? Current scores and photos will be archived, then all archers cleared.`)) return;
    if (!archiveShoot()) return;
    const next = newState(); next.shootType = type; next.format = format;
    // Save the replacement before switching the active in-memory session.
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch (error) { toast('Unable to save new shoot. Check device storage.'); return; }
    state = next;
    activeRound = 0; activeArrow = 0; undo = null;
    closeModal(); render(); toast(`${shootTitle()} started`);
  }
  function deleteArcher() {
    const archer = selected(); if (!archer) return;
    if (!confirm(`Remove ${archer.name} and all their scores? This cannot be undone.`)) return;
    state.archers = state.archers.filter(a => a.id !== archer.id);
    state.selectedArcherId = state.archers[0]?.id ?? null;
    activeRound = 0; activeArrow = 0; undo = null;
    save(); render(); toast('Archer removed');
  }
  function openHelp() {
    showModal('How scoring works', `<div class="help-steps"><p><strong>1.</strong> Add each archer using the name field. Tap their name to switch between scorecards.</p>
    <p><strong>2.</strong> Each archer scores 20 rounds with 2 arrows per round (40 arrows). Tap A (20), B (18), C (16) or Miss (0). Both arrows count equally.</p>
    <p><strong>3.</strong> In 2-arrow mode, after scoring both arrows, the app automatically selects the next archer in the order you added them. ABA 3-arrow mode stops at the first scoring hit (or after three misses). After the last archer finishes, the app moves to the next round and starts with Archer 1.</p>
    <p><strong>4.</strong> Tap an archer, round or arrow to correct a score. Undo also works after switching archers. Editing an existing score will not automatically move to another archer. Empty arrows are not misses.</p>
    <p><strong>5.</strong> Add an optional photo using the + Photo button. Images stay on the device; a backup includes them.</p>
    <p><strong>6.</strong> Tap Save Shoot to archive the current shoot, History to review past shoots, Save to Files to share JSON, or Load from Files to import one. New Shoot lets you choose Club or Casual, then 2-arrow or ABA 3-arrow, and automatically archives the current shoot before clearing archers.</p><p><strong>7.</strong> Tap Email results to share the CSV attached through the phone Share menu (the mail app may ignore the suggested subject). Backup/Restore preserves scores and photos.</p>
    <div class="modal-note"><strong>Install on a phone:</strong> Open the hosted HTTPS site in Safari on iPhone, then Share → Add to Home Screen. On Android, open it in Chrome, then choose Install app or Add to Home screen. After the first load, it works offline. Scores stay on this device unless you export a backup.</div></div>`);
  }
  document.addEventListener('click', event => {
    if (event.target === $('#modal-backdrop')) { closeModal(); return; }
    const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
    const action = button.dataset.action;
    switch (action) {
      case 'select-archer': selectArcher(button.dataset.id); break;
      case 'add-archer': showModal('Add an archer', `<form id="modal-name-form"><label class="sr-only" for="modal-name">Archer name</label><input id="modal-name" name="name" maxlength="50" autocomplete="off" placeholder="Archer name" required><button type="submit" class="primary-btn">Add to scorecard</button></form>`); break;
      case 'rename-archer': showModal('Rename archer', `<form id="modal-rename-form"><label class="sr-only" for="modal-name">Archer name</label><input id="modal-name" name="name" maxlength="50" value="${esc(selected().name)}" required><button type="submit" class="primary-btn">Save name</button></form>`); break;
      case 'close-modal': closeModal(); break;
      case 'select-arrow': activeArrow = Number(button.dataset.index); render(); break;
      case 'select-round': moveToRound(Number(button.dataset.index)); render(); break;
      case 'prev-round': moveToRound(activeRound - 1); render(); break;
      case 'next-round': moveToRound(activeRound + 1); render(); break;
      case 'score': recordScore(button.dataset.letter); break;
      case 'clear-arrow': clearArrow(); break;
      case 'undo': undoShot(); break;
      case 'new-shoot': newShoot(); break;
      case 'choose-shoot-type': chooseShootType(button.dataset.type); break;
      case 'start-shoot': startShoot(button.dataset.type,button.dataset.format); break;
      case 'delete-archer': deleteArcher(); break;
      case 'export-csv': exportCSV(); break;
      case 'email-results': emailResults(); break;
      case 'photo-archer': openPhotoOptions(); break;
      case 'take-photo': $('#take-photo-file').click(); break;
      case 'choose-photo': $('#choose-photo-file').click(); break;
      case 'remove-photo': removePhoto(); break;
      case 'backup': backup(); break;
      case 'save-shoot': saveShoot(); break;
      case 'save-files': saveToFiles(); break;
      case 'history': showHistory(); break;
      case 'clear-history': clearHistory(); break;
      case 'load-past-shoot': $('#history-file').click(); break;
      case 'view-history': viewHistory(button.dataset.id); break;
      case 'export-history': { const h=history.find(h=>h.id===button.dataset.id); if(h) saveToFiles(h.data); break; }
      case 'activate-history': activateHistory(button.dataset.id); break;
      case 'restore': $('#restore-file').click(); break;
      case 'help': openHelp(); break;
    }
  });
  document.addEventListener('submit', event => {
    if (!['quick-add','modal-name-form','modal-rename-form'].includes(event.target.id)) return;
    event.preventDefault();
    const name = new FormData(event.target).get('name')?.toString()?.trim() || '';
    if (event.target.id === 'modal-rename-form') {
      const archer = selected(); if (!archer) return closeModal();
      if (!name) return toast('Enter an archer name');
      if (state.archers.some(a => a.id !== archer.id && a.name.toLowerCase() === name.toLowerCase())) return toast('That archer already exists');
      archer.name = name.slice(0, 50); save(); render(); closeModal(); toast('Name updated');
    } else addArcher(name);
  });
  for (const picker of ['#take-photo-file', '#choose-photo-file']) {
    $(picker).addEventListener('change', async event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (file) await processPhoto(file);
    });
  }
  $('#history-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    await importPastShoot(file);
  });
  $('#restore-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 12_000_000) return toast('Backup file is too large');
    let restored;
    try { restored = cleanState(JSON.parse(await file.text())); }
    catch (error) { return toast('Not a valid Pacific Bowmen backup'); }
    if (!confirm(`Restore a backup with ${restored.archers.length} archer(s)? This replaces all scores currently on this device.`)) return;
    state = restored; undo = null;
    const archer = selected();
    moveToRound(Math.max(0, archer?.rounds.findIndex(round => !isFinished(round)) ?? 0));
    save(); render(); toast('Backup restored');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#modal-backdrop').hidden) closeModal();
  });
  if ('serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Offline registration failed', err)));
  }
  resumeShootPosition(); save(); render();
  // Standalone iOS PWAs can restore an obsolete scroll offset on launch.
  // Never auto-scroll the installed app to the scoring panel: start at the
  // header and allow the archer list and scorecard to scroll naturally.
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.addEventListener('load', () => {
      window.requestAnimationFrame(() => window.scrollTo({top: 0, left: 0, behavior: 'instant'}));
    }, {once: true});
  } else if (state.archers.length) {
    window.addEventListener('load', () => setTimeout(() => focusScoring({smooth:false}), 100), {once:true});
  }
})();
