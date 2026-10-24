import * as ABCJS from 'abcjs';
import { findNoteShape, inspectABC, makeNoteToken, normalizeLineEndings, noteLengthSuffix, removeSourceRanges, STARTER_ABC, transformNoteRanges, tuneInsertionPoint } from './abc-source';
import type { NoteShape, SourceRange } from './abc-source';
import { History } from './history';
import './styles.css';

type Tool = 'select' | 'note' | 'rest';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="studio-shell">
    <header class="topbar">
      <a class="wordmark" href="#" aria-label="ABC Studio">abc<span>.</span></a>
      <span class="workspace-label">STUDIO ZAPISU</span>
      <div class="topbar-spacer"></div>
      <span class="save-state" id="save-state">Gotowe do edycji</span>
      <button class="button button-quiet" data-action="open" title="Otwórz plik ABC" aria-label="Otwórz plik ABC"><span aria-hidden="true">↥</span><span class="button-text">Otwórz</span></button>
      <button class="button button-primary" data-action="export" title="Eksportuj plik ABC"><span aria-hidden="true">↓</span><span class="button-text">Eksportuj</span></button>
      <input id="file-input" type="file" accept=".abc,.txt,text/plain" hidden />
    </header>

    <section class="toolbar" aria-label="Narzędzia edycji">
      <div class="tool-group history-tools" aria-label="Historia zmian">
        <button class="icon-button" data-action="undo" title="Cofnij (Ctrl+Z)" aria-label="Cofnij">↶</button>
        <button class="icon-button" data-action="redo" title="Ponów (Ctrl+Shift+Z)" aria-label="Ponów">↷</button>
      </div>
      <span class="toolbar-divider"></span>
      <div class="segmented" role="group" aria-label="Narzędzie">
        <button class="segment active" data-tool="select" title="Zaznacz i przeciągaj nuty">↖ <span>Zaznacz</span></button>
        <button class="segment" data-tool="note" title="Wstaw nutę na pięciolinii">♩ <span>Nuta</span></button>
        <button class="segment" data-tool="rest" title="Wstaw pauzę na pięciolinii">𝄽 <span>Pauza</span></button>
      </div>
      <span class="toolbar-divider"></span>
      <label class="control-label">Wartość
        <select id="duration" aria-label="Wartość rytmiczna zaznaczonej nuty lub nowej nuty">
          <option value="1">Cała</option>
          <option value="0.5">Półnuta</option>
          <option value="0.25" selected>Ćwierćnuta</option>
          <option value="0.125">Ósemka</option>
          <option value="0.0625">Szesnastka</option>
          <option value="0.75">Półnuta z kropką</option>
          <option value="0.375">Ćwierćnuta z kropką</option>
        </select>
      </label>
      <label class="control-label">Oktawa
        <select id="octave" aria-label="Oktawa">
          <option value="auto" selected>Auto</option>
          <option value="-1">Niższa</option>
          <option value="0">Środkowa</option>
          <option value="1">Wyższa</option>
          <option value="2">Najwyższa</option>
        </select>
      </label>
      <label class="control-label accidental-control">Znak
        <select id="accidental" aria-label="Znak chromatyczny zaznaczonej nuty lub nowej nuty">
          <option value="">♮ Auto</option>
          <option value="^">♯ Krzyżyk</option>
          <option value="_">♭ Bemol</option>
          <option value="=">♮ Kasownik</option>
        </select>
      </label>
      <div class="toolbar-spacer"></div>
      <button class="button button-quiet" data-action="remove-arc" title="Usuń łuk z zaznaczonych nut" aria-label="Usuń łuk" disabled>Usuń łuk</button>
      <button class="button button-quiet" data-action="tie" title="Dodaj łuk łączący do dwóch kolejnych nut tej samej wysokości" aria-label="Dodaj łuk łączący" disabled>Łuk łączący</button>
      <button class="button button-quiet" data-action="slur" title="Dodaj łuk frazowy do kolejnych nut" aria-label="Dodaj łuk frazowy" disabled>Łuk frazowy</button>
      <button class="button button-quiet merge-button" data-action="merge" title="Połącz dwie sąsiadujące nuty o tej samej wysokości" aria-label="Połącz zaznaczone nuty" disabled>Połącz</button>
      <button class="icon-button delete-button" data-action="delete" title="Usuń zaznaczenie" aria-label="Usuń zaznaczenie">⌫</button>
      <button class="play-button" data-action="play" title="Odtwórz od początku lub od zaznaczonej nuty"><span class="play-icon" aria-hidden="true">▶</span><span id="play-label">Odtwórz</span></button>
    </section>

    <div class="workbench">
      <section class="score-panel" aria-label="Partytura">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">PARTYTURA</span>
            <h1 id="piece-title">Morning at the Harbor</h1>
          </div>
          <span class="key-badge" id="key-badge">G MAJOR</span>
        </div>
        <div class="score-scroll" id="score-scroll">
          <div class="score-paper" id="score" aria-label="Edytowalny zapis nutowy"></div>
        </div>
        <div class="score-footer">
          <span class="selection-status" id="selection-status">Gotowe do edycji</span>
          <span class="score-hint" id="score-hint">Kliknij nutę, aby odsłuchać; Shift-klik dodaje nutę do zaznaczenia; strzałki lewo/prawo zmieniają nutę; spacja odtwarza; przeciągnij nutę, aby zmienić wysokość lub pozycję; przeciągnij puste miejsce, aby zaznaczyć ramką</span>
        </div>
      </section>

      <section class="code-panel" aria-label="Kod ABC">
        <div class="code-heading">
          <div class="code-title"><span class="file-mark">ABC</span><div><span class="eyebrow">ŹRÓDŁO</span><h2>Partytura.abc</h2></div></div>
          <span class="code-language">ABC NOTATION</span>
        </div>
        <div class="editor-wrap"><div class="line-numbers" id="line-numbers" aria-hidden="true"></div><textarea id="abc-editor" wrap="soft" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Edytor tekstu ABC"></textarea></div>
        <div class="validation" id="validation" role="status" aria-live="polite"></div>
        <div class="editor-footer"><span id="line-count">0 linii</span><span>ABC · UTF-8</span></div>
      </section>
    </div>
  </main>
`;

const editor = document.querySelector<HTMLTextAreaElement>('#abc-editor')!;
const score = document.querySelector<HTMLDivElement>('#score')!;
const scoreScroll = document.querySelector<HTMLDivElement>('#score-scroll')!;
const fileInput = document.querySelector<HTMLInputElement>('#file-input')!;
const validation = document.querySelector<HTMLDivElement>('#validation')!;
const durationControl = document.querySelector<HTMLSelectElement>('#duration')!;
const octaveControl = document.querySelector<HTMLSelectElement>('#octave')!;
const accidentalControl = document.querySelector<HTMLSelectElement>('#accidental')!;
const selectionStatus = document.querySelector<HTMLSpanElement>('#selection-status')!;
const mergeButton = document.querySelector<HTMLButtonElement>('[data-action="merge"]')!;
const tieButton = document.querySelector<HTMLButtonElement>('[data-action="tie"]')!;
const slurButton = document.querySelector<HTMLButtonElement>('[data-action="slur"]')!;
const removeArcButton = document.querySelector<HTMLButtonElement>('[data-action="remove-arc"]')!;
const ABCJS_PITCH_STEP = 30 * 93 / 720;
let history = new History(STARTER_ABC);
let code = STARTER_ABC;
let tool: Tool = 'select';
let selectedRanges: SourceRange[] = [];
let visualObjects: ABCJS.TuneObject[] = [];
let renderTimer = 0;
let historyTimer = 0;
let playback: ABCJS.TimingCallbacks | null = null;
let audioContext: AudioContext | null = null;
let highlightedElements: HTMLElement[] = [];
let scoreGesture: ScoreGesture | null = null;

type ScoreGesture =
  | { kind: 'box'; pointerId: number; startX: number; startY: number; moved: boolean; box: HTMLDivElement }
  | { kind: 'notes'; pointerId: number; startX: number; startY: number; moved: boolean; axis: 'horizontal' | 'vertical' | null; selectable: ABCJS.Selectable; ranges: SourceRange[] };

editor.value = code;
score.addEventListener('click', onEmptyScoreClick);
score.addEventListener('pointerdown', onScorePointerDown, true);
document.addEventListener('pointermove', onScorePointerMove, true);
document.addEventListener('pointerup', onScorePointerUp, true);
document.addEventListener('pointercancel', onScorePointerCancel, true);
score.addEventListener('touchstart', suppressScoreTouch, true);
score.addEventListener('touchmove', suppressScoreTouch, { capture: true, passive: false });
score.addEventListener('touchend', suppressScoreTouch, true);
renderScore();

function renderScore(): void {
  score.replaceChildren();
  validation.replaceChildren();
  const messages = inspectABC(code);
  for (const message of messages) {
    const item = document.createElement('div');
    item.className = 'validation-message';
    item.textContent = message;
    validation.append(item);
  }
  updateMetadata();
  updateLineNumbers();

  try {
    visualObjects = ABCJS.renderAbc(score, code, {
      add_classes: true,
      responsive: 'resize',
      selectTypes: true,
      dragging: true,
      selectionColor: '#d95b42',
      dragColor: '#218476',
      clickListener: onScoreElement,
    });
    for (const warning of visualObjects[0]?.warnings ?? []) {
      const item = document.createElement('div');
      item.className = 'validation-message';
      item.textContent = warning;
      validation.append(item);
    }
  } catch (error) {
    visualObjects = [];
    const message = error instanceof Error ? error.message : 'Nie można odczytać zapisu ABC.';
    const item = document.createElement('div');
    item.className = 'render-error';
    item.textContent = `Nie można wyświetlić partytury: ${message}`;
    score.append(item);
  }
  applySelectionStyles();
  refreshSelectionControls();
}

function updateMetadata(): void {
  const title = /^T:\s*(.+)$/m.exec(code)?.[1]?.trim() ?? 'Nowa partytura';
  const key = /^K:\s*([^\s]+)/m.exec(code)?.[1] ?? 'C';
  document.querySelector('#piece-title')!.textContent = title;
  document.querySelector('#key-badge')!.textContent = `${key} ${key.endsWith('m') ? 'MINOR' : 'MAJOR'}`;
}

function updateLineNumbers(): void {
  const lineNumbers = document.querySelector<HTMLDivElement>('#line-numbers')!;
  const lineCount = code.split('\n').length;
  const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight);
  const mirror = document.createElement('div');
  const editorStyle = getComputedStyle(editor);
  Object.assign(mirror.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    boxSizing: 'border-box',
    width: `${editor.clientWidth}px`,
    padding: editorStyle.padding,
    font: editorStyle.font,
    lineHeight: editorStyle.lineHeight,
    letterSpacing: editorStyle.letterSpacing,
    tabSize: editorStyle.tabSize,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    wordBreak: editorStyle.wordBreak,
    visibility: 'hidden',
  });
  document.body.append(mirror);
  const visualLineNumbers = code.split('\n').flatMap((line, index) => {
    const lineElement = document.createElement('div');
    lineElement.style.minHeight = `${lineHeight}px`;
    const textNode = document.createTextNode(line || '\u200b');
    lineElement.append(textNode);
    mirror.append(lineElement);
    const range = document.createRange();
    range.selectNodeContents(lineElement);
    const wrappedLines = Math.max(1, range.getClientRects().length);
    return [String(index + 1), ...Array.from({ length: wrappedLines - 1 }, () => '')];
  });
  mirror.remove();
  lineNumbers.textContent = visualLineNumbers.join('\n');
  lineNumbers.scrollTop = editor.scrollTop;
  document.querySelector('#line-count')!.textContent = `${lineCount} ${lineCount === 1 ? 'linia' : 'linii'}`;
}

function updateCode(nextCode: string, record = true, selection: SourceRange[] = []): void {
  code = normalizeLineEndings(nextCode);
  editor.value = code;
  if (record) history.push(code);
  selectedRanges = selection;
  stopPlayback();
  renderScore();
  selectEditorRanges(selection);
  document.querySelector('#save-state')!.textContent = 'Gotowe do edycji';
}

function scheduleRender(): void {
  code = editor.value;
  selectedRanges = [];
  updateLineNumbers();
  document.querySelector('#save-state')!.textContent = 'Niezapisane zmiany';
  window.clearTimeout(renderTimer);
  window.clearTimeout(historyTimer);
  renderTimer = window.setTimeout(renderScore, 180);
  historyTimer = window.setTimeout(() => history.push(code), 500);
}

function flushTextHistory(): void {
  window.clearTimeout(historyTimer);
  history.push(code);
}

function changeTool(nextTool: Tool): void {
  tool = nextTool;
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === tool);
  });
  const hints: Record<Tool, string> = {
    select: 'Kliknij nutę, aby odsłuchać; Shift-klik dodaje nutę do zaznaczenia; strzałki lewo/prawo zmieniają nutę; spacja odtwarza; przeciągnij nutę, aby zmienić wysokość lub pozycję; przeciągnij puste miejsce, aby zaznaczyć ramką',
    note: 'Kliknij partyturę, aby wstawić nutę',
    rest: 'Kliknij partyturę, aby wstawić pauzę',
  };
  document.querySelector('#score-hint')!.textContent = hints[tool];
  score.classList.toggle('insert-mode', tool !== 'select');
}

function onScoreElement(
  element: ABCJS.AbcElem,
  _tuneNumber: number,
  _classes: string,
  _analysis: ABCJS.ClickListenerAnalysis,
  drag: ABCJS.ClickListenerDrag,
): void {
  const elementType = element.el_type as string;
  const start = element.startChar;
  const end = element.endChar;
  if (start === undefined || end === undefined || start < 0 || end <= start) return;

  if (tool !== 'select') {
    if (elementType !== 'note') return;
    const isRest = Boolean(element.rest);
    const sourceShape = isRest ? null : findNoteShape(code.slice(start, end));
    const token = tool === 'rest'
      ? `z${noteLengthSuffix(code, Number(durationControl.value))}`
      : makeNoteToken(
          sourceShape?.letter ?? 'C',
          selectedOctave(sourceShape?.octave ?? 0),
          accidentalControl.value || sourceShape?.accidental || '',
          noteLengthSuffix(code, Number(durationControl.value)),
        );
    insertAt(start, token);
    return;
  }

  const range = { start, end };
  if (drag.step !== 0 && element.el_type === 'note' && (element.pitches?.length ?? 1) === 1) {
    const ranges = isRangeSelected(range) ? selectedRanges : [range];
    const updated = transformNoteRanges(code, ranges, drag.step);
    if (updated.code !== code) updateCode(updated.code, true, updated.ranges);
    return;
  }

  if (selectedRanges.length > 1 && isRangeSelected(range)) {
    document.querySelector('#selection-status')!.textContent = `Zaznaczono ${selectedRanges.length} elementów`;
    return;
  }
  setSelectedRanges([range]);
  editor.focus();
  editor.setSelectionRange(start, end);
  document.querySelector('#selection-status')!.textContent = element.rest
    ? `Zaznaczono: pauza · takt ${element.barNumber ?? 1}`
    : `${selectedNoteDescription()} · takt ${element.barNumber ?? 1}`;
}

function getSelectableRange(selectable: ABCJS.Selectable): SourceRange | null {
  const element = selectable.absEl.abcelem;
  const { startChar: start, endChar: end } = element;
  if (element.el_type !== 'note' || start === undefined || end === undefined || start < 0 || end <= start) return null;
  return { start, end };
}

function isRangeSelected(range: SourceRange): boolean {
  return selectedRanges.some((selected) => selected.start === range.start && selected.end === range.end);
}

function setSelectedRanges(ranges: SourceRange[]): void {
  selectedRanges = [...new Map(ranges.map((range) => [`${range.start}:${range.end}`, range])).values()]
    .sort((left, right) => left.start - right.start);
  applySelectionStyles();
  refreshSelectionControls();
}

function refreshSelectionControls(): void {
  const notes = selectedRanges
    .map((range) => findNoteShape(code.slice(range.start, range.end)))
    .filter((shape): shape is NonNullable<typeof shape> => shape !== null);
  mergeButton.disabled = !canMergeSelectedNotes();
  tieButton.disabled = !canAddTie();
  slurButton.disabled = !canAddSlur();
  removeArcButton.disabled = !findSelectedArcMarkers().length;
  if (notes.length === 1 && selectedRanges.length === 1) {
    const duration = noteDuration(code, notes[0].length);
    const matchingOption = [...durationControl.options].find((option) =>
      option.value !== 'mixed' && Math.abs(Number(option.value) - duration) < 0.0001);
    durationControl.querySelector('[data-current-duration]')?.remove();
    if (matchingOption) {
      durationControl.value = matchingOption.value;
    } else {
      const option = document.createElement('option');
      option.dataset.currentDuration = 'true';
      option.value = String(duration);
      option.textContent = `Wartość własna (${duration})`;
      durationControl.append(option);
      durationControl.value = option.value;
    }

    setAccidentalControl(notes[0].accidental);
    return;
  }
  if (notes.length > 1 && notes.length === selectedRanges.length) {
    const durations = notes.map((shape) => noteDuration(code, shape.length));
    const sameDuration = durations.every((duration) => Math.abs(duration - durations[0]) < 0.0001);
    if (sameDuration) {
      const matchingOption = [...durationControl.options].find((option) =>
        option.value !== 'mixed' && Math.abs(Number(option.value) - durations[0]) < 0.0001);
      durationControl.querySelector('[data-current-duration]')?.remove();
      if (matchingOption) durationControl.value = matchingOption.value;
      else {
        const option = document.createElement('option');
        option.dataset.currentDuration = 'true';
        option.value = String(durations[0]);
        option.textContent = `Wartość własna (${durations[0]})`;
        durationControl.append(option);
        durationControl.value = option.value;
      }
    } else {
      showMixedDuration();
    }
    setAccidentalControl(notes.every((shape) => shape.accidental === notes[0].accidental) ? notes[0].accidental : 'mixed');
    return;
  }
  if (durationControl.value === 'mixed') durationControl.value = '0.25';
  if (accidentalControl.value === 'mixed') accidentalControl.value = '';
}

interface SelectedScoreNote {
  range: SourceRange;
  selectable: ABCJS.Selectable;
  shape: NoteShape;
}

function getContiguousSelectedNotes(): SelectedScoreNote[] | null {
  if (selectedRanges.length < 2) return null;
  const notes: SelectedScoreNote[] = [];
  for (const range of selectedRanges) {
    const selectable = (visualObjects[0]?.getSelectableArray() ?? []).find((item) => {
      const itemRange = getSelectableRange(item);
      return itemRange?.start === range.start && itemRange.end === range.end;
    });
    const shape = findNoteShape(code.slice(range.start, range.end));
    if (!selectable || !shape || selectable.absEl.abcelem.pitches?.length !== 1
      || selectable.absEl.abcelem.rest) return null;
    notes.push({ range, selectable, shape });
  }
  const voice = getSelectableVoice(notes[0].selectable);
  if (voice === null || notes.some((note) => getSelectableVoice(note.selectable) !== voice)) return null;
  const voiceNotes = (visualObjects[0]?.getSelectableArray() ?? [])
    .filter((item) => getSelectableVoice(item) === voice && getSelectableRange(item))
    .sort((left, right) => (getSelectableRange(left)?.start ?? 0) - (getSelectableRange(right)?.start ?? 0));
  const selectedIndexes = notes.map((note) => voiceNotes.findIndex((item) => {
    const range = getSelectableRange(item);
    return range?.start === note.range.start && range.end === note.range.end;
  })).sort((left, right) => left - right);
  if (selectedIndexes.some((index) => index < 0)
    || selectedIndexes.some((index, offset) => offset > 0 && index !== selectedIndexes[offset - 1] + 1)) return null;
  return notes.sort((left, right) => left.range.start - right.range.start);
}

function getNoteMidiPitch(range: SourceRange): number | null {
  const tune = visualObjects[0];
  if (!tune) return null;
  const note = tune.setUpAudio({}).tracks.flat().find((item): item is ABCJS.AudioTrackNoteItem =>
    item.cmd === 'note' && item.startChar === range.start && item.endChar === range.end);
  return note?.pitch ?? null;
}

function canAddTie(): boolean {
  const notes = getContiguousSelectedNotes();
  if (!notes || notes.length !== 2) return false;
  const [first, second] = notes;
  const firstPitch = getNoteMidiPitch(first.range);
  const secondPitch = getNoteMidiPitch(second.range);
  if (firstPitch === null || firstPitch !== secondPitch) return false;
  return findTieMarker(notes) === null;
}

function canAddSlur(): boolean {
  const notes = getContiguousSelectedNotes();
  return notes !== null && findSlurMarkers(notes).length === 0;
}

function findTieMarker(notes: SelectedScoreNote[]): number | null {
  if (notes.length !== 2) return null;
  const firstTokenEnd = notes[0].range.start + notes[0].shape.matchEnd;
  const gap = code.slice(firstTokenEnd, notes[1].range.start);
  const marker = gap.indexOf('-');
  return marker < 0 ? null : firstTokenEnd + marker;
}

function findSlurMarkers(notes: SelectedScoreNote[]): number[] {
  if (notes.length < 2) return [];
  const firstTokenStart = notes[0].range.start + notes[0].shape.matchStart;
  const lastTokenEnd = notes[notes.length - 1].range.start + notes[notes.length - 1].shape.matchEnd;
  const markers: number[] = [];
  if (code[firstTokenStart - 1] === '(') markers.push(firstTokenStart - 1);
  if (code[lastTokenEnd] === ')') markers.push(lastTokenEnd);
  return markers.length === 2 ? markers : [];
}

function findSelectedArcMarkers(): number[] {
  const notes = getContiguousSelectedNotes();
  if (!notes) return [];
  const tieMarker = findTieMarker(notes);
  const slurMarkers = findSlurMarkers(notes);
  return [...(tieMarker === null ? [] : [tieMarker]), ...slurMarkers];
}

function insertNotationMarkers(markers: Array<{ position: number; text: string }>): void {
  let nextCode = code;
  for (const marker of [...markers].sort((left, right) => right.position - left.position)) {
    nextCode = nextCode.slice(0, marker.position) + marker.text + nextCode.slice(marker.position);
  }
  const ranges = selectedRanges.map((range) => {
    let start = range.start;
    let end = range.end;
    for (const marker of markers) {
      if (marker.position <= start) {
        start += marker.text.length;
        end += marker.text.length;
      } else if (marker.position < end) {
        end += marker.text.length;
      }
    }
    return { start, end };
  });
  updateCode(nextCode, true, ranges);
}

function addTie(): void {
  if (!canAddTie()) {
    selectionStatus.textContent = 'Wybierz dwie kolejne nuty tej samej wysokości w jednym głosie';
    return;
  }
  const notes = getContiguousSelectedNotes();
  if (!notes) return;
  const first = notes[0];
  insertNotationMarkers([{ position: first.range.start + first.shape.matchEnd, text: '-' }]);
  selectionStatus.textContent = 'Dodano łuk łączący';
}

function addSlur(): void {
  if (!canAddSlur()) {
    selectionStatus.textContent = 'Wybierz co najmniej dwie kolejne nuty w jednym głosie';
    return;
  }
  const notes = getContiguousSelectedNotes();
  if (!notes) return;
  const first = notes[0];
  const last = notes[notes.length - 1];
  insertNotationMarkers([
    { position: first.range.start + first.shape.matchStart, text: '(' },
    { position: last.range.start + last.shape.matchEnd, text: ')' },
  ]);
  selectionStatus.textContent = 'Dodano łuk frazowy';
}

function removeSelectedArcs(): void {
  const markers = findSelectedArcMarkers();
  if (!markers.length) {
    selectionStatus.textContent = 'W zaznaczeniu nie znaleziono łuku do usunięcia';
    return;
  }
  let nextCode = code;
  for (const position of [...markers].sort((left, right) => right - left)) {
    nextCode = nextCode.slice(0, position) + nextCode.slice(position + 1);
  }
  const ranges = selectedRanges.map((range) => ({
    start: range.start - markers.filter((position) => position < range.start).length,
    end: range.end - markers.filter((position) => position < range.end).length,
  }));
  updateCode(nextCode, true, ranges);
  selectionStatus.textContent = 'Usunięto łuk';
}

function navigateSelectedNote(direction: -1 | 1): boolean {
  if (!selectedRanges.length) return false;
  const anchorRange = direction < 0 ? selectedRanges[0] : selectedRanges[selectedRanges.length - 1];
  const anchor = (visualObjects[0]?.getSelectableArray() ?? []).find((selectable) => {
    const range = getSelectableRange(selectable);
    return range?.start === anchorRange.start && range.end === anchorRange.end;
  });
  if (!anchor) return false;
  const voice = getSelectableVoice(anchor);
  if (voice === null) return false;
  const voiceNotes = (visualObjects[0]?.getSelectableArray() ?? [])
    .filter((selectable) => getSelectableVoice(selectable) === voice)
    .flatMap((selectable) => {
      const range = getSelectableRange(selectable);
      const shape = range ? findNoteShape(code.slice(range.start, range.end)) : null;
      return range && shape && selectable.absEl.abcelem.pitches?.length === 1 && !selectable.absEl.abcelem.rest
        ? [{ selectable, range }]
        : [];
    })
    .sort((left, right) => left.range.start - right.range.start);
  const index = voiceNotes.findIndex(({ range }) => range.start === anchorRange.start && range.end === anchorRange.end);
  if (index < 0) return false;
  const next = voiceNotes[index + direction];
  if (!next) return true;
  setSelectedRanges([next.range]);
  editor.focus();
  editor.setSelectionRange(next.range.start, next.range.end);
  const element = next.selectable.absEl.abcelem;
  selectionStatus.textContent = `Zaznaczono nutę · takt ${element.barNumber ?? 1}`;
  return true;
}

function showMixedDuration(): void {
  durationControl.querySelector('[data-current-duration]')?.remove();
  let mixed = [...durationControl.options].find((option) => option.value === 'mixed');
  if (!mixed) {
    mixed = document.createElement('option');
    mixed.value = 'mixed';
    mixed.textContent = 'Wartości różne';
    mixed.disabled = true;
    durationControl.append(mixed);
  }
  durationControl.value = 'mixed';
}

function setAccidentalControl(value: string): void {
  accidentalControl.querySelector('[data-current-accidental]')?.remove();
  if (value === 'mixed') {
    const option = document.createElement('option');
    option.dataset.currentAccidental = 'true';
    option.value = 'mixed';
    option.textContent = 'Znaki różne';
    option.disabled = true;
    accidentalControl.append(option);
    accidentalControl.value = option.value;
  } else {
    const matchingOption = [...accidentalControl.options].find((option) => option.value === value);
    if (matchingOption) {
      accidentalControl.value = value;
    } else {
      const option = document.createElement('option');
      option.dataset.currentAccidental = 'true';
      option.value = value;
      option.textContent = value === '^^' ? '♯♯ Podwójny krzyżyk' : '♭♭ Podwójny bemol';
      accidentalControl.append(option);
      accidentalControl.value = value;
    }
  }
}

function noteDuration(source: string, suffix: string): number {
  const unitMatch = /^L:\s*(\d+)\s*\/\s*(\d+)/m.exec(source);
  const unit = unitMatch ? Number(unitMatch[1]) / Number(unitMatch[2]) : 1 / 8;
  if (!suffix) return unit;
  if (/^\d+(?:\/\d+)?$/.test(suffix)) {
    const [numerator, denominator = '1'] = suffix.split('/');
    return unit * Number(numerator) / Number(denominator);
  }
  const numerator = /^(\d+)\/$/.exec(suffix)?.[1];
  if (numerator) return unit * Number(numerator) / 2;
  if (/^\/+$/.test(suffix)) return unit / (2 ** suffix.length);
  const denominator = /^\/(\d+)$/.exec(suffix)?.[1];
  return denominator ? unit / Number(denominator) : unit;
}

function canMergeSelectedNotes(): boolean {
  if (selectedRanges.length !== 2) return false;
  const [first, second] = selectedRanges;
  const selected = (visualObjects[0]?.getSelectableArray() ?? [])
    .filter((selectable) => {
      const range = getSelectableRange(selectable);
      return range && selectedRanges.some((item) => item.start === range.start && item.end === range.end);
    });
  if (selected.length !== 2 || getSelectableVoice(selected[0]) === null
    || getSelectableVoice(selected[0]) !== getSelectableVoice(selected[1])) return false;
  const firstShape = findNoteShape(code.slice(first.start, first.end));
  const secondShape = findNoteShape(code.slice(second.start, second.end));
  if (!firstShape || !secondShape || firstShape.letter !== secondShape.letter
    || firstShape.octave !== secondShape.octave || firstShape.accidental !== secondShape.accidental) return false;
  const voice = getSelectableVoice(selected[0]);
  const between = (visualObjects[0]?.getSelectableArray() ?? [])
    .filter((selectable) => getSelectableVoice(selectable) === voice)
    .map(getSelectableRange)
    .filter((range): range is SourceRange => range !== null && range.start >= first.end && range.end <= second.start
      && !selectedRanges.some((selectedRange) => selectedRange.start === range.start && selectedRange.end === range.end));
  return between.length === 0;
}

function mergeSelectedNotes(): void {
  if (!canMergeSelectedNotes()) {
    selectionStatus.textContent = 'Wybierz dwie sąsiadujące nuty o tej samej wysokości w jednym głosie';
    return;
  }
  const [first, second] = selectedRanges;
  const firstShape = findNoteShape(code.slice(first.start, first.end));
  const secondShape = findNoteShape(code.slice(second.start, second.end));
  if (!firstShape || !secondShape) return;
  const mergedLength = noteLengthSuffix(code, noteDuration(code, firstShape.length) + noteDuration(code, secondShape.length));
  const firstTokenStart = first.start + firstShape.matchStart;
  const firstTokenEnd = first.start + firstShape.matchEnd;
  const secondTokenStart = second.start + secondShape.matchStart;
  const secondTokenEnd = second.start + secondShape.matchEnd;
  const mergedToken = makeNoteToken(firstShape.letter, firstShape.octave, firstShape.accidental, mergedLength);
  let nextCode = code.slice(0, secondTokenStart) + code.slice(secondTokenEnd);
  nextCode = nextCode.slice(0, firstTokenStart) + mergedToken + nextCode.slice(firstTokenEnd);
  const newFirst = { start: first.start, end: first.end + mergedToken.length - (firstTokenEnd - firstTokenStart) };
  updateCode(nextCode, true, [newFirst]);
  selectionStatus.textContent = 'Nuty połączone';
}

function editSelectedNotes(change: (shape: NonNullable<ReturnType<typeof findNoteShape>>) => string): void {
  const replacements = selectedRanges.flatMap((range) => {
    const sourceShape = findNoteShape(code.slice(range.start, range.end));
    if (!sourceShape) return [];
    const tokenStart = range.start + sourceShape.matchStart;
    const tokenEnd = range.start + sourceShape.matchEnd;
    const token = change(sourceShape);
    return [{ range, tokenStart, tokenEnd, token }];
  });
  if (!replacements.length) {
    selectionStatus.textContent = 'Zaznacz nutę, aby zmienić jej wartość lub znak';
    return;
  }
  let nextCode = code;
  for (const replacement of [...replacements].reverse()) {
    nextCode = nextCode.slice(0, replacement.tokenStart) + replacement.token
      + nextCode.slice(replacement.tokenEnd);
  }
  let offset = 0;
  const nextRanges = replacements.map(({ range, tokenStart, tokenEnd, token }) => {
    const nextRange = {
      start: range.start + offset,
      end: range.end + offset + token.length - (tokenEnd - tokenStart),
    };
    offset += token.length - (tokenEnd - tokenStart);
    return nextRange;
  });
  if (nextCode !== code) updateCode(nextCode, true, nextRanges);
}

function accidentalLabel(accidental: string): string {
  return ({ '': '♮', '^': '♯', '_': '♭', '=': '♮', '^^': '♯♯', '__': '♭♭' } as Record<string, string>)[accidental] ?? '';
}

function selectedNoteDescription(): string {
  const shape = selectedRanges.length === 1
    ? findNoteShape(code.slice(selectedRanges[0].start, selectedRanges[0].end))
    : null;
  if (!shape) return `Zaznaczono ${selectedRanges.length} elementów`;
  const duration = durationControl.selectedOptions[0]?.textContent ?? 'Wartość';
  return `Zaznaczono nutę · wartość: ${duration} · znak: ${accidentalLabel(shape.accidental)}`;
}

function selectEditorRanges(ranges: SourceRange[]): void {
  if (ranges.length === 0) return;
  const first = ranges[0];
  const last = ranges[ranges.length - 1];
  editor.setSelectionRange(first.start, last.end);
}

function editorSelectionMatchesNotes(): boolean {
  return selectedRanges.length > 0
    && editor.selectionStart === selectedRanges[0].start
    && editor.selectionEnd === selectedRanges[selectedRanges.length - 1].end;
}

function syncScoreSelectionFromEditor(): void {
  if (document.activeElement !== editor) return;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  if (selectedRanges.length > 1
    && start === selectedRanges[0].start
    && end === selectedRanges[selectedRanges.length - 1].end) return;
  const ranges = start === end
    ? []
    : (visualObjects[0]?.getSelectableArray() ?? [])
      .map((selectable) => getSelectableRange(selectable))
      .filter((range): range is SourceRange => range !== null && range.start < end && range.end > start);
  setSelectedRanges(ranges);
  if (ranges.length > 0) {
    document.querySelector('#selection-status')!.textContent = `Zaznaczono ${ranges.length} ${ranges.length === 1 ? 'element' : ranges.length < 5 ? 'elementy' : 'elementów'}`;
  } else {
    document.querySelector('#selection-status')!.textContent = 'Gotowe do edycji';
  }
}

function applySelectionStyles(): void {
  for (const selectable of visualObjects[0]?.getSelectableArray() ?? []) {
    const range = getSelectableRange(selectable);
    selectable.svgEl.classList.toggle('abcjs-selected-item', Boolean(range && isRangeSelected(range)));
  }
}

function selectableFromTarget(target: Element): ABCJS.Selectable | null {
  const item = target.closest('[selectable]');
  if (!item) return null;
  const index = Number(item.getAttribute('data-index'));
  return Number.isInteger(index) ? visualObjects[0]?.getSelectableArray()[index] ?? null : null;
}

function onScorePointerDown(event: PointerEvent): void {
  if (tool !== 'select' || event.button !== 0 || scoreGesture) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const selectable = selectableFromTarget(target);
  const range = selectable ? getSelectableRange(selectable) : null;
  if (selectable && range) {
    const ranges = event.shiftKey
      ? [...selectedRanges, range]
      : selectedRanges.length > 1 && isRangeSelected(range) ? selectedRanges : [range];
    setSelectedRanges(ranges);
    selectEditorRanges(selectedRanges);
    scoreGesture = {
      kind: 'notes',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      axis: null,
      selectable,
      ranges,
    };
    score.classList.add('score-interacting');
    event.preventDefault();
    event.stopPropagation();
    score.setPointerCapture(event.pointerId);
  } else {
    const box = document.createElement('div');
    box.className = 'score-selection-box';
    document.body.append(box);
    scoreGesture = {
      kind: 'box',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      box,
    };
  }
  score.classList.add('score-interacting');
  if (scoreGesture.kind === 'box') {
    score.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }
}

function suppressScoreTouch(event: TouchEvent): void {
  if (tool !== 'select') return;
  if (event.type === 'touchmove') event.preventDefault();
  event.stopPropagation();
}

function onScorePointerMove(event: PointerEvent): void {
  const gesture = scoreGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - gesture.startX;
  const deltaY = event.clientY - gesture.startY;
  if (Math.hypot(deltaX, deltaY) > 5) gesture.moved = true;
  if (gesture.kind === 'notes') lockNoteDragAxis(gesture, deltaX, deltaY);
  if (gesture.kind === 'box') {
    const left = Math.min(gesture.startX, event.clientX);
    const top = Math.min(gesture.startY, event.clientY);
    gesture.box.style.left = `${left}px`;
    gesture.box.style.top = `${top}px`;
    gesture.box.style.width = `${Math.abs(deltaX)}px`;
    gesture.box.style.height = `${Math.abs(deltaY)}px`;
    event.preventDefault();
    event.stopPropagation();
  } else {
    for (const selectable of visualObjects[0]?.getSelectableArray() ?? []) {
      const range = getSelectableRange(selectable);
      if (!range || !gesture.ranges.some((item) => item.start === range.start && item.end === range.end)) continue;
      const svg = selectable.svgEl.ownerSVGElement;
      const scaleX = svg?.viewBox.baseVal.width && svg.clientWidth
        ? svg.viewBox.baseVal.width / svg.clientWidth
        : 1;
      const scaleY = svg?.viewBox.baseVal.height && svg.clientHeight
        ? svg.viewBox.baseVal.height / svg.clientHeight
        : 1;
      const moveX = gesture.axis === 'horizontal' ? deltaX * scaleX : 0;
      const moveY = gesture.axis === 'horizontal' ? 0 : deltaY * scaleY;
      selectable.svgEl.setAttribute('transform', `translate(${moveX},${moveY})`);
    }
    event.preventDefault();
    event.stopPropagation();
  }
}

function onScorePointerUp(event: PointerEvent): void {
  const gesture = scoreGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  scoreGesture = null;
  score.classList.remove('score-interacting');

  if (gesture.kind === 'box') {
    event.preventDefault();
    event.stopPropagation();
    gesture.box.remove();
    if (!gesture.moved) {
      setSelectedRanges([]);
      document.querySelector('#selection-status')!.textContent = 'Gotowe do edycji';
      return;
    }
    const box = {
      left: Math.min(gesture.startX, event.clientX),
      right: Math.max(gesture.startX, event.clientX),
      top: Math.min(gesture.startY, event.clientY),
      bottom: Math.max(gesture.startY, event.clientY),
    };
    const ranges = (visualObjects[0]?.getSelectableArray() ?? [])
      .filter((selectable) => {
        const range = getSelectableRange(selectable);
        const rect = selectable.svgEl.getBoundingClientRect();
        return range !== null && rect.width > 0 && rect.height > 0
          && rect.right >= box.left && rect.left <= box.right
          && rect.bottom >= box.top && rect.top <= box.bottom;
      })
      .map((selectable) => getSelectableRange(selectable))
      .filter((range): range is SourceRange => range !== null);
    setSelectedRanges(ranges);
    selectEditorRanges(ranges);
    document.querySelector('#selection-status')!.textContent = ranges.length
      ? selectedRanges.length === 1 ? selectedNoteDescription() : `Zaznaczono ${ranges.length} elementów`
      : 'Nie zaznaczono elementów';
    return;
  }

  const deltaX = event.clientX - gesture.startX;
  const deltaY = event.clientY - gesture.startY;
  lockNoteDragAxis(gesture, deltaX, deltaY);
  clearDraggedNoteTransforms(gesture.ranges);
  if (!gesture.moved) {
    void previewSelectedNotes(gesture.ranges);
    if (gesture.ranges.length > 1) {
      document.querySelector('#selection-status')!.textContent = `Zaznaczono ${gesture.ranges.length} elementów`;
      return;
    }
    const range = gesture.ranges[0];
    editor.focus();
    editor.setSelectionRange(range.start, range.end);
    const element = gesture.selectable.absEl.abcelem;
    document.querySelector('#selection-status')!.textContent = `Zaznaczono: ${element.rest ? 'pauza' : 'nuta'} · takt ${element.barNumber ?? 1}`;
    return;
  }

  if (gesture.axis === 'horizontal') {
    const insertion = findDropInsertion(event.clientX, event.clientY, gesture.selectable, gesture.ranges);
    if (!insertion) {
      document.querySelector('#selection-status')!.textContent = 'Nie można przenieść zaznaczenia w to miejsce';
      void previewDroppedNote(gesture.ranges);
      return;
    }
    const edit = transformNoteRanges(code, gesture.ranges, 0, insertion);
    if (edit.code !== code) {
      updateCode(edit.code, true, edit.ranges);
      document.querySelector('#selection-status')!.textContent = 'Zaznaczenie przeniesione';
      void previewDroppedNote(edit.ranges);
    } else {
      document.querySelector('#selection-status')!.textContent = 'Nie można przenieść zaznaczenia w to miejsce';
      void previewDroppedNote(gesture.ranges);
    }
    return;
  }

  const svg = gesture.selectable.svgEl.ownerSVGElement;
  const stepHeight = svg ? getStaffStepHeight(svg) : null;
  const steps = stepHeight ? Math.round(deltaY / stepHeight) : 0;
  if (steps !== 0) {
    const edit = transformNoteRanges(code, gesture.ranges, steps);
    if (edit.code !== code) {
      updateCode(edit.code, true, edit.ranges);
      document.querySelector('#selection-status')!.textContent = 'Zaznaczenie transponowane';
      void previewDroppedNote(edit.ranges);
      return;
    }
  }
  void previewDroppedNote(gesture.ranges);
}

function previewDroppedNote(ranges: SourceRange[]): Promise<void> {
  return ranges.length === 1 ? previewSelectedNotes(ranges) : Promise.resolve();
}

function lockNoteDragAxis(
  gesture: Extract<ScoreGesture, { kind: 'notes' }>,
  deltaX: number,
  deltaY: number,
): void {
  if (Math.abs(deltaX) >= 24 && Math.abs(deltaX) > Math.abs(deltaY)) {
    gesture.axis = 'horizontal';
    return;
  }
  if (gesture.axis !== null) return;
  if (Math.abs(deltaY) > 5 && Math.abs(deltaY) >= Math.abs(deltaX)) {
    gesture.axis = 'vertical';
  }
}

function onScorePointerCancel(event: PointerEvent): void {
  if (!scoreGesture || scoreGesture.pointerId !== event.pointerId) return;
  if (scoreGesture.kind === 'box') scoreGesture.box.remove();
  else clearDraggedNoteTransforms(scoreGesture.ranges);
  scoreGesture = null;
  score.classList.remove('score-interacting');
}

function clearDraggedNoteTransforms(ranges: SourceRange[]): void {
  for (const selectable of visualObjects[0]?.getSelectableArray() ?? []) {
    const range = getSelectableRange(selectable);
    if (range && ranges.some((item) => item.start === range.start && item.end === range.end)) {
      selectable.svgEl.removeAttribute('transform');
    }
  }
}

function getSelectableVoice(selectable: ABCJS.Selectable): number | null {
  const voice = /(?:^|\s)abcjs-v(\d+)(?:\s|$)/.exec(selectable.svgEl.getAttribute('class') ?? '')?.[1];
  return voice === undefined ? null : Number(voice);
}

function findDropInsertion(
  clientX: number,
  clientY: number,
  anchor: ABCJS.Selectable,
  selected: SourceRange[],
): { position: number; after: boolean } | undefined {
  const voice = getSelectableVoice(anchor);
  if (voice === null) return undefined;
  const selectedSelectables = (visualObjects[0]?.getSelectableArray() ?? [])
    .filter((selectable) => {
      const range = getSelectableRange(selectable);
      return range && selected.some((item) => item.start === range.start && item.end === range.end);
    });
  if (selectedSelectables.some((selectable) => getSelectableVoice(selectable) !== voice)) return undefined;
  const nearest = (visualObjects[0]?.getSelectableArray() ?? [])
    .map((selectable) => ({ selectable, range: getSelectableRange(selectable), rect: selectable.svgEl.getBoundingClientRect() }))
    .filter(({ selectable, range, rect }) => range !== null && rect.width > 0 && rect.height > 0
      && getSelectableVoice(selectable) === voice
      && !selected.some((item) => item.start === range?.start && item.end === range?.end))
    .sort((left, right) => {
      const leftX = (left.rect.left + left.rect.right) / 2;
      const leftY = (left.rect.top + left.rect.bottom) / 2;
      const rightX = (right.rect.left + right.rect.right) / 2;
      const rightY = (right.rect.top + right.rect.bottom) / 2;
      return Math.hypot(clientX - leftX, clientY - leftY) - Math.hypot(clientX - rightX, clientY - rightY);
    })[0];
  if (!nearest?.range) return undefined;
  const center = (nearest.rect.left + nearest.rect.right) / 2;
  return {
    position: clientX < center ? nearest.range.start : nearest.range.end,
    after: clientX >= center,
  };
}

function getStaffStepHeight(svg: SVGSVGElement): number | null {
  const screenScale = svg.getScreenCTM()?.d;
  if (screenScale === undefined || !Number.isFinite(screenScale) || screenScale === 0) return null;
  return ABCJS_PITCH_STEP * Math.abs(screenScale);
}

function selectedOctave(staffOctave: number): number {
  const value = octaveControl.value;
  return value === 'auto' ? staffOctave : Number(value);
}

function insertAt(position: number, token: string): void {
  updateCode(code.slice(0, position) + token + ' ' + code.slice(position));
  document.querySelector('#selection-status')!.textContent = tool === 'rest' ? 'Pauza wstawiona' : 'Nuta wstawiona';
}

function onEmptyScoreClick(event: MouseEvent): void {
  if (tool === 'select') return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target || target.closest('.abcjs-note, .abcjs-rest, [data-name="note"], [data-name="rest"]')) return;
  const svg = target.closest('svg');
  if (!(svg instanceof SVGSVGElement)) return;
  const staffPitch = getStaffPitch(svg, event.clientY);
  if (!staffPitch) return;
  const token = tool === 'rest'
    ? `z${noteLengthSuffix(code, Number(durationControl.value))}`
    : makeNoteToken(staffPitch.letter, selectedOctave(staffPitch.octave), accidentalControl.value, noteLengthSuffix(code, Number(durationControl.value)));
  const selectableNotes = visualObjects[0]?.getSelectableArray()
    .filter((selectable) => selectable.absEl.abcelem.el_type === 'note') ?? [];
  const nearest = selectableNotes
    .map((selectable) => ({ selectable, rect: selectable.svgEl.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0)
    .sort((left, right) => Math.abs(event.clientX - (left.rect.left + left.rect.right) / 2) - Math.abs(event.clientX - (right.rect.left + right.rect.right) / 2))[0];
  const nearestNote = nearest?.selectable.absEl.abcelem;
  const insertionPoint = nearestNote?.startChar !== undefined && nearestNote.endChar !== undefined
    ? event.clientX < (nearest!.rect.left + nearest!.rect.right) / 2 ? nearestNote.startChar : nearestNote.endChar
    : tuneInsertionPoint(code, 0);
  updateCode(code.slice(0, insertionPoint) + ` ${token}` + code.slice(insertionPoint));
  document.querySelector('#selection-status')!.textContent = tool === 'rest' ? 'Pauza wstawiona' : 'Nuta wstawiona';
}

function getStaffPitch(svg: SVGSVGElement, clientY: number): { letter: string; octave: number } | null {
  const lineYs = [...svg.querySelectorAll<SVGGraphicsElement>('.abcjs-staff path')]
    .map((line) => line.getBoundingClientRect().top + line.getBoundingClientRect().height / 2)
    .filter(Number.isFinite)
    .map((y) => Math.round(y));
  const uniqueYs = [...new Set(lineYs)].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const y of uniqueYs) {
    const current = groups[groups.length - 1];
    if (!current || y - current[current.length - 1] > 22) groups.push([y]);
    else current.push(y);
  }
  const candidates = groups
    .filter((group) => group.length >= 5)
    .map((group) => group.slice(0, 5))
    .filter((group) => clientY >= group[0] - 24 && clientY <= group[4] + 24)
    .sort((a, b) => Math.abs(clientY - (a[0] + a[4]) / 2) - Math.abs(clientY - (b[0] + b[4]) / 2));
  const lines = candidates[0];
  if (!lines) return null;
  const spacing = (lines[4] - lines[0]) / 4;
  if (!spacing) return null;
  const pitchIndex = 10 + Math.round((lines[0] - clientY) / (spacing / 2));
  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const octave = Math.floor(pitchIndex / 7);
  return { letter: letters[((pitchIndex % 7) + 7) % 7], octave };
}

function undo(): void {
  flushTextHistory();
  const previous = history.undo();
  if (previous !== null) updateCode(previous, false);
}

function redo(): void {
  flushTextHistory();
  const next = history.redo();
  if (next !== null) updateCode(next, false);
}

function deleteSelection(): void {
  const ranges = selectedRanges.length ? selectedRanges : editor.selectionStart !== editor.selectionEnd
    ? [{ start: editor.selectionStart, end: editor.selectionEnd }]
    : [];
  if (!ranges.length) {
    document.querySelector('#selection-status')!.textContent = 'Zaznacz nutę lub fragment kodu';
    return;
  }
  const deletion = removeSourceRanges(code, ranges);
  if (deletion.code !== code) updateCode(deletion.code);
  document.querySelector('#selection-status')!.textContent = deletion.skipped
    ? `Pominięto ${deletion.skipped} zakresów obejmujących nagłówek lub podział wiersza ABC`
    : deletion.code === code ? 'Nie znaleziono poprawnych zakresów do usunięcia' : 'Zaznaczenie usunięte';
}

function exportABC(): void {
  const title = /^T:\s*(.+)$/m.exec(code)?.[1]?.trim() ?? 'partytura';
  const filename = `${title.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '') || 'partytura'}.abc`;
  const url = URL.createObjectURL(new Blob([code], { type: 'text/vnd.abc;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function stopPlayback(): void {
  playback?.stop();
  playback = null;
  if (audioContext && audioContext.state !== 'closed') void audioContext.close();
  audioContext = null;
  for (const element of highlightedElements) element.classList.remove('abcjs-playing');
  highlightedElements = [];
  document.querySelector('#play-label')!.textContent = 'Odtwórz';
  document.querySelector('.play-icon')!.textContent = '▶';
}

async function previewSelectedNotes(ranges: SourceRange[]): Promise<void> {
  const tune = visualObjects[0];
  if (!tune) return;
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) {
    document.querySelector('#selection-status')!.textContent = 'Ta przeglądarka nie obsługuje Web Audio';
    return;
  }
  if (playback) stopPlayback();

  audioContext ??= new AudioContextConstructor();
  const context = audioContext;
  try {
    await context.resume();
  } catch (error) {
    document.querySelector('#selection-status')!.textContent = error instanceof Error
      ? `Nie można odtworzyć dźwięku: ${error.message}`
      : 'Nie można odtworzyć dźwięku';
    return;
  }

  const selected = ranges;
  const pitches = tune.setUpAudio({}).tracks.flat()
    .filter((item): item is ABCJS.AudioTrackNoteItem => item.cmd === 'note'
      && selected.some((range) => item.startChar === range.start && item.endChar === range.end));
  if (pitches.length === 0) {
    document.querySelector('#selection-status')!.textContent = 'Nie znaleziono dźwięku dla zaznaczonej nuty';
    return;
  }
  for (const pitch of pitches) playTone(context, pitch.pitch, 0.35);
}

async function togglePlayback(): Promise<void> {
  if (playback) {
    stopPlayback();
    return;
  }
  const tune = visualObjects[0];
  if (!tune) {
    document.querySelector('#selection-status')!.textContent = 'Brak poprawnej partytury do odtworzenia';
    return;
  }
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) {
    document.querySelector('#selection-status')!.textContent = 'Ta przeglądarka nie obsługuje Web Audio';
    return;
  }
  if (audioContext && audioContext.state !== 'closed') void audioContext.close();
  audioContext = new AudioContextConstructor();
  await audioContext.resume();
  const context = audioContext;
  tune.setUpAudio({});
  let timer: ABCJS.TimingCallbacks;
  timer = new ABCJS.TimingCallbacks(tune, {
    eventCallback(event) {
      for (const element of highlightedElements) element.classList.remove('abcjs-playing');
      highlightedElements = [];
      if (!event) {
        stopPlayback();
        return 'continue';
      }
      highlightedElements = (event.elements ?? []).flat();
      for (const element of highlightedElements) element.classList.add('abcjs-playing');
      const eventIndex = timer.noteTimings.indexOf(event);
      const next = timer.noteTimings[eventIndex + 1];
      const noteDuration = Math.min(1.8, Math.max(0.09, ((next?.milliseconds ?? event.milliseconds + 250) - event.milliseconds) / 1000 * 0.88));
      for (const pitch of event.midiPitches ?? []) playTone(context, pitch.pitch, noteDuration);
      return 'continue';
    },
  });
  playback = timer;
  const selection = selectedRanges;
  const selectedEvent = timer.noteTimings.find((event) => event.type === 'event'
    && selection.some((range) => {
      const starts = event.startCharArray ?? (event.startChar === undefined ? [] : [event.startChar]);
      const ends = event.endCharArray ?? (event.endChar === undefined ? [] : [event.endChar]);
      return starts.some((start, index) => start === range.start
        || (ends[index] !== undefined && start < range.end && ends[index] > range.start));
    }));
  timer.start(selectedEvent ? selectedEvent.milliseconds / 1000 : 0, 'seconds');
  document.querySelector('#play-label')!.textContent = 'Zatrzymaj';
  document.querySelector('.play-icon')!.textContent = '■';
}

function playTone(context: AudioContext, midiPitch: number, duration: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime;
  const end = start + duration;
  oscillator.type = 'triangle';
  oscillator.frequency.value = 440 * (2 ** ((midiPitch - 69) / 12));
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.075, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(start + 0.04, end));
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    switch (button.dataset.action) {
      case 'open': fileInput.click(); break;
      case 'export': exportABC(); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'delete': deleteSelection(); break;
      case 'merge': mergeSelectedNotes(); break;
      case 'tie': addTie(); break;
      case 'slur': addSlur(); break;
      case 'remove-arc': removeSelectedArcs(); break;
      case 'play': void togglePlayback(); break;
    }
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
  button.addEventListener('click', () => changeTool(button.dataset.tool as Tool));
});

editor.addEventListener('input', scheduleRender);
durationControl.addEventListener('change', () => {
  const duration = Number(durationControl.value);
  if (!selectedRanges.length || !Number.isFinite(duration)) return;
  editSelectedNotes((shape) => makeNoteToken(
    shape.letter,
    shape.octave,
    shape.accidental,
    noteLengthSuffix(code, duration),
  ));
});
accidentalControl.addEventListener('change', () => {
  if (!selectedRanges.length || accidentalControl.value === 'mixed') return;
  editSelectedNotes((shape) => makeNoteToken(
    shape.letter,
    shape.octave,
    accidentalControl.value,
    shape.length,
  ));
});
editor.addEventListener('select', syncScoreSelectionFromEditor);
editor.addEventListener('pointerdown', () => setSelectedRanges([]));
editor.addEventListener('scroll', () => {
  document.querySelector<HTMLDivElement>('#line-numbers')!.scrollTop = editor.scrollTop;
});
document.addEventListener('selectionchange', syncScoreSelectionFromEditor);
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const imported = normalizeLineEndings(await file.text());
  history = new History(imported);
  updateCode(imported, false);
  fileInput.value = '';
});

document.addEventListener('keydown', (event) => {
  const target = event.target;
  const isTypingTarget = target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target instanceof HTMLButtonElement
    || (target instanceof HTMLElement && target.isContentEditable);
  const isSelectedNoteInEditor = target === editor && editorSelectionMatchesNotes();
  if ((event.code === 'Space' || event.key === ' ') && !event.repeat
    && !event.altKey && !event.ctrlKey && !event.metaKey && (!isTypingTarget || isSelectedNoteInEditor)) {
    event.preventDefault();
    void togglePlayback();
    return;
  }
  if (event.key === 'Delete' && selectedRanges.length) {
    event.preventDefault();
    deleteSelection();
    return;
  }
  if (selectedRanges.length && !event.altKey && !event.ctrlKey && !event.metaKey
    && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    && !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLButtonElement)
    && (!(target instanceof HTMLTextAreaElement) || (target === editor && editorSelectionMatchesNotes()))) {
    if (navigateSelectedNote(event.key === 'ArrowLeft' ? -1 : 1)) {
      event.preventDefault();
      return;
    }
  }
  if (selectedRanges.length && !event.altKey && !event.ctrlKey && !event.metaKey
    && (event.key === 'ArrowUp' || event.key === 'ArrowDown')
    && !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLButtonElement)) {
    event.preventDefault();
    const steps = event.key === 'ArrowUp' ? -1 : 1;
    const edit = transformNoteRanges(code, selectedRanges, steps);
    if (edit.code !== code) {
      updateCode(edit.code, true, edit.ranges);
      document.querySelector('#selection-status')!.textContent = 'Zaznaczenie transponowane';
      void previewSelectedNotes(edit.ranges);
    }
    return;
  }
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (key === 'z' && event.shiftKey) {
    event.preventDefault();
    redo();
  } else if (key === 'z') {
    event.preventDefault();
    undo();
  } else if (key === 'y') {
    event.preventDefault();
    redo();
  }
});

function installResizeObserver(): void {
  const observer = new ResizeObserver(() => {
    score.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => svg.setAttribute('preserveAspectRatio', 'xMinYMin meet'));
    updateLineNumbers();
  });
  observer.observe(scoreScroll);
  observer.observe(editor);
}

installResizeObserver();