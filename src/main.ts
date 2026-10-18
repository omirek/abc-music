import * as ABCJS from 'abcjs';
import { findNoteShape, inspectABC, makeNoteToken, noteLengthSuffix, STARTER_ABC, transformNoteRanges, tuneInsertionPoint } from './abc-source';
import type { SourceRange } from './abc-source';
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
        <select id="duration" aria-label="Wartość rytmiczna">
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
        <select id="accidental" aria-label="Znak chromatyczny">
          <option value="">♮ Auto</option>
          <option value="^">♯ Krzyżyk</option>
          <option value="_">♭ Bemol</option>
          <option value="=">♮ Kasownik</option>
        </select>
      </label>
      <div class="toolbar-spacer"></div>
      <button class="icon-button delete-button" data-action="delete" title="Usuń zaznaczenie" aria-label="Usuń zaznaczenie">⌫</button>
      <button class="play-button" data-action="play" title="Odtwórz melodię"><span class="play-icon" aria-hidden="true">▶</span><span id="play-label">Odtwórz</span></button>
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
          <span class="score-hint" id="score-hint">Wybierz narzędzie, aby edytować zapis</span>
        </div>
      </section>

      <section class="code-panel" aria-label="Kod ABC">
        <div class="code-heading">
          <div class="code-title"><span class="file-mark">ABC</span><div><span class="eyebrow">ŹRÓDŁO</span><h2>Partytura.abc</h2></div></div>
          <span class="code-language">ABC NOTATION</span>
        </div>
        <div class="editor-wrap"><div class="line-numbers" id="line-numbers" aria-hidden="true"></div><textarea id="abc-editor" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Edytor tekstu ABC"></textarea></div>
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
}

function updateMetadata(): void {
  const title = /^T:\s*(.+)$/m.exec(code)?.[1]?.trim() ?? 'Nowa partytura';
  const key = /^K:\s*([^\s]+)/m.exec(code)?.[1] ?? 'C';
  document.querySelector('#piece-title')!.textContent = title;
  document.querySelector('#key-badge')!.textContent = `${key} ${key.endsWith('m') ? 'MINOR' : 'MAJOR'}`;
}

function updateLineNumbers(): void {
  const lineCount = code.split('\n').length;
  document.querySelector('#line-numbers')!.textContent = Array.from({ length: lineCount }, (_, index) => String(index + 1)).join('\n');
  document.querySelector('#line-count')!.textContent = `${lineCount} ${lineCount === 1 ? 'linia' : 'linii'}`;
}

function updateCode(nextCode: string, record = true, selection: SourceRange[] = []): void {
  code = nextCode;
  editor.value = code;
  if (record) history.push(code);
  selectedRanges = selection;
  stopPlayback();
  renderScore();
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
    select: 'Przeciągnij nutę, aby zmienić wysokość lub pozycję; przeciągnij puste miejsce, aby zaznaczyć ramką',
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
  document.querySelector('#selection-status')!.textContent = `Zaznaczono: ${element.rest ? 'pauza' : 'nuta'} · takt ${element.barNumber ?? 1}`;
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
    const ranges = selectedRanges.length > 1 && isRangeSelected(range) ? selectedRanges : [range];
    setSelectedRanges(ranges);
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
    document.querySelector('#selection-status')!.textContent = ranges.length
      ? `Zaznaczono ${ranges.length} ${ranges.length === 1 ? 'element' : ranges.length < 5 ? 'elementy' : 'elementów'}`
      : 'Nie zaznaczono elementów';
    return;
  }

  const deltaX = event.clientX - gesture.startX;
  const deltaY = event.clientY - gesture.startY;
  lockNoteDragAxis(gesture, deltaX, deltaY);
  clearDraggedNoteTransforms(gesture.ranges);
  if (!gesture.moved) {
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
      return;
    }
    const edit = transformNoteRanges(code, gesture.ranges, 0, insertion);
    if (edit.code !== code) {
      updateCode(edit.code, true, edit.ranges);
      document.querySelector('#selection-status')!.textContent = 'Zaznaczenie przeniesione';
    } else {
      document.querySelector('#selection-status')!.textContent = 'Nie można przenieść zaznaczenia w to miejsce';
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
    }
  }
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
  const nextCode = [...ranges]
    .sort((left, right) => right.start - left.start)
    .reduce((current, range) => current.slice(0, range.start) + current.slice(range.end), code);
  updateCode(nextCode);
  document.querySelector('#selection-status')!.textContent = 'Zaznaczenie usunięte';
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
  timer.start();
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
      case 'play': void togglePlayback(); break;
    }
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
  button.addEventListener('click', () => changeTool(button.dataset.tool as Tool));
});

editor.addEventListener('input', scheduleRender);
editor.addEventListener('pointerdown', () => setSelectedRanges([]));
editor.addEventListener('scroll', () => {
  document.querySelector<HTMLDivElement>('#line-numbers')!.scrollTop = editor.scrollTop;
});
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const imported = await file.text();
  history = new History(imported);
  updateCode(imported, false);
  fileInput.value = '';
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Delete' && selectedRanges.length) {
    event.preventDefault();
    deleteSelection();
    return;
  }
  const target = event.target;
  if (selectedRanges.length && !event.altKey && !event.ctrlKey && !event.metaKey
    && (event.key === 'ArrowUp' || event.key === 'ArrowDown')
    && !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLButtonElement)) {
    event.preventDefault();
    const steps = event.key === 'ArrowUp' ? -1 : 1;
    const edit = transformNoteRanges(code, selectedRanges, steps);
    if (edit.code !== code) {
      updateCode(edit.code, true, edit.ranges);
      document.querySelector('#selection-status')!.textContent = 'Zaznaczenie transponowane';
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
  });
  observer.observe(scoreScroll);
}

installResizeObserver();