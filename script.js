const BOARD_CONFIG = window.__BOARD__ || {
  layout: [
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
  ],
  starterTiles: [{ row: 2, column: 2, character: "\u3042" }]
}

const BOARD_LAYOUT = BOARD_CONFIG.layout
const BOARD_ROWS = BOARD_LAYOUT.length
const BOARD_COLUMNS = Math.max(...BOARD_LAYOUT.map(row => row.length))
const TRAY_TILE_COUNT = 6
const STARTER_TILES = BOARD_CONFIG.starterTiles

const HIRAGANA_REGEX = /[\u3041-\u3093\u30fc]/g
const FALLBACK_HIRAGANA = [
  "\u3042",
  "\u3044",
  "\u3046",
  "\u3048",
  "\u304a",
  "\u3093",
]

const boardElement = document.querySelector("[data-board]")
const trayElement = document.querySelector("[data-tray]")
const statusElement = document.querySelector("[data-status]")
const debugElement = document.querySelector("[data-debug]")
const totalScoreElement = document.querySelector("[data-total-score]")
const turnBaseElement = document.querySelector("[data-turn-base]")
const turnMultiplierElement = document.querySelector("[data-turn-multiplier]")
const turnScoreElement = document.querySelector("[data-turn-score]")
const openSettingsButton = document.querySelector("[data-open-settings]")
const closeSettingsButton = document.querySelector("[data-close-settings]")
const settingsBackdrop = document.querySelector("[data-settings-backdrop]")
const settingsModal = document.querySelector("[data-settings-modal]")
const themeToggle = document.querySelector("[data-theme-toggle]")

let selectedTileId = null
let activeTileChar = null
let dictionaryWords = []
let dictionarySet = new Set()
let totalScore = 0
let isAnimatingScore = false

initializeTheme()
buildBoard()
wireTrayDropzone()
wireSettings()
loadDictionary()

function buildBoard() {
  const fragment = document.createDocumentFragment()
  boardElement.style.gridTemplateColumns = `repeat(${BOARD_COLUMNS}, 1fr)`
  boardElement.style.setProperty("--board-cols", String(BOARD_COLUMNS))

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let column = 0; column < BOARD_COLUMNS; column += 1) {
      const isActive = BOARD_LAYOUT[row]?.[column] === 1

      if (!isActive) {
        const cell = document.createElement("div")
        cell.className = "board-cell is-inactive"
        fragment.append(cell)
        continue
      }

      const cell = document.createElement("button")
      cell.type = "button"
      cell.className = "board-cell"
      cell.dataset.row = String(row)
      cell.dataset.column = String(column)
      cell.setAttribute("role", "gridcell")
      cell.setAttribute("aria-label", `Board square ${row + 1}-${column + 1}`)

      cell.addEventListener("dragover", handleCellDragOver)
      cell.addEventListener("dragleave", handleDropzoneDragLeave)
      cell.addEventListener("drop", handleCellDrop)
      cell.addEventListener("click", () => {
        if (selectedTileId) {
          moveTileToCell(selectedTileId, cell)
        }
      })

      fragment.append(cell)
    }
  }

  boardElement.append(fragment)
}

function wireTrayDropzone() {
  trayElement.addEventListener("dragover", event => {
    event.preventDefault()
    trayElement.classList.add("is-over")
  })

  trayElement.addEventListener("dragleave", handleDropzoneDragLeave)
  trayElement.addEventListener("drop", event => {
    event.preventDefault()
    trayElement.classList.remove("is-over")

    const tileId = event.dataTransfer?.getData("text/plain")
    if (tileId) {
      moveTileToTray(tileId)
    }
  })
}

function loadDictionary() {
  const source = Array.isArray(window.__DICT__) ? window.__DICT__ : []

  if (source.length > 0) {
    dictionaryWords = source.map(word => normalizeKana(word)).filter(Boolean)
    dictionarySet = new Set(dictionaryWords)
    placeStarterTiles(STARTER_TILES)
    renderTray(buildTilePool(dictionaryWords))
    setStatus("Starter tiles placed. Place a tile next to them and form a word.")
    setDebug([
      "dictionary loaded",
      `entries: ${dictionaryWords.length}`,
      `starters: ${STARTER_TILES.length}`,
    ])
    updateScoreDisplay({ base: 0, multiplier: 0, turn: 0 })
    return
  }

  dictionaryWords = []
  dictionarySet = new Set()
  placeStarterTiles(STARTER_TILES)
  renderTray(FALLBACK_HIRAGANA)
  setStatus("Dictionary unavailable. Demo is using fallback tiles.")
  setDebug(["dictionary unavailable", "window.__DICT__ missing or empty"])
  updateScoreDisplay({ base: 0, multiplier: 0, turn: 0 })
}

function wireSettings() {
  openSettingsButton.addEventListener("click", openSettings)
  closeSettingsButton.addEventListener("click", closeSettings)
  settingsBackdrop.addEventListener("click", closeSettings)
  themeToggle.addEventListener("change", () => {
    const nextTheme = themeToggle.checked ? "dark" : "light"
    applyTheme(nextTheme)
  })

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !settingsModal.hidden) {
      closeSettings()
    }
  })
}

function openSettings() {
  settingsBackdrop.hidden = false
  settingsModal.hidden = false
}

function closeSettings() {
  settingsBackdrop.hidden = true
  settingsModal.hidden = true
}

function initializeTheme() {
  const storedTheme = window.localStorage.getItem("theme")
  const theme = storedTheme === "dark" ? "dark" : "light"
  applyTheme(theme)
}

function applyTheme(theme) {
  document.body.dataset.theme = theme
  themeToggle.checked = theme === "dark"
  window.localStorage.setItem("theme", theme)
}

function placeStarterTiles(tiles) {
  if (!tiles || tiles.length === 0) return
  
  tiles.forEach(starter => {
    const starterCell = getCell(starter.row, starter.column)
    if (starterCell) {
      starterCell.innerHTML = ""
      starterCell.append(createBoardTile(starter.character, true))
    }
  })
  refreshBoardState()
}

function buildTilePool(words) {
  const counts = new Map()

  words.forEach(word => {
    const kana = [...word.matchAll(HIRAGANA_REGEX)].map(match => match[0])
    kana.forEach(character => {
      counts.set(character, (counts.get(character) || 0) + 1)
    })
  })

  const rankedCharacters = [...counts.entries()]
    .sort((first, second) => {
      if (second[1] !== first[1]) {
        return second[1] - first[1]
      }

      return first[0].localeCompare(second[0], "ja")
    })
    .map(([character]) => character)

  return rankedCharacters.slice(0, TRAY_TILE_COUNT)
}

function renderTray(characters) {
  trayElement.innerHTML = ""

  const tileFragment = document.createDocumentFragment()
  characters.forEach((character, index) => {
    tileFragment.append(createTrayTile(character, index))
  })

  trayElement.append(tileFragment)
  clearSelection()
}

function createTrayTile(character, index) {
  const normalizedCharacter = normalizeKana(character)
  const tile = document.createElement("button")
  tile.type = "button"
  tile.className = "tile"
  tile.textContent = normalizedCharacter
  tile.dataset.tileId = `tile-${index}-${normalizedCharacter}`
  tile.dataset.character = normalizedCharacter
  tile.draggable = true
  tile.setAttribute("aria-label", `Hiragana tile ${normalizedCharacter}`)

  tile.addEventListener("dragstart", event => {
    selectedTileId = tile.dataset.tileId
    activeTileChar = tile.dataset.character
    tile.classList.add("dragging")
    tile.classList.add("is-selected")
    event.dataTransfer?.setData("text/plain", tile.dataset.tileId)
    event.dataTransfer.effectAllowed = "move"
  })

  tile.addEventListener("dragend", () => {
    tile.classList.remove("dragging")
    document
      .querySelectorAll(".is-over")
      .forEach(element => element.classList.remove("is-over"))
  })

  tile.addEventListener("click", () => {
    if (selectedTileId === tile.dataset.tileId) {
      clearSelection()
      return
    }

    setSelectedTile(tile)
  })

  return tile
}

function createBoardTile(character, isPermanent = false) {
  const normalizedCharacter = normalizeKana(character)
  const tile = document.createElement("div")
  tile.className = `tile${isPermanent ? " permanent" : ""}`
  tile.textContent = normalizedCharacter
  tile.dataset.character = normalizedCharacter

  if (isPermanent) {
    tile.dataset.permanent = "true"
    tile.setAttribute("aria-label", `Permanent hiragana tile ${normalizedCharacter}`)
  }

  return tile
}

function setSelectedTile(tile) {
  clearVisualSelection()
  selectedTileId = tile.dataset.tileId
  activeTileChar = tile.dataset.character
  tile.classList.add("is-selected")
}

function clearSelection() {
  selectedTileId = null
  activeTileChar = null
  clearVisualSelection()
}

function clearVisualSelection() {
  document
    .querySelectorAll(".tile.is-selected")
    .forEach(tile => tile.classList.remove("is-selected"))
}

function handleCellDragOver(event) {
  event.preventDefault()
  event.currentTarget.classList.add("is-over")
}

function handleDropzoneDragLeave(event) {
  if (event.currentTarget.contains(event.relatedTarget)) {
    return
  }

  event.currentTarget.classList.remove("is-over")
}

function handleCellDrop(event) {
  event.preventDefault()
  const cell = event.currentTarget
  cell.classList.remove("is-over")

  const tileId = event.dataTransfer?.getData("text/plain")
  if (tileId) {
    void moveTileToCell(tileId, cell)
  }
}

async function moveTileToCell(tileId, cell) {
  const tile = findTrayTile(tileId)
  if (!tile || !cell || isAnimatingScore) {
    return
  }

  if (cell.querySelector(".tile")) {
    setStatus("That square is already occupied.")
    updateScoreDisplay({ base: 0, multiplier: 0, turn: 0 })
    setDebug([
      `attempt: ${normalizeKana(tile.dataset.character)} @ ${cell.dataset.row},${cell.dataset.column}`,
      "result: occupied square",
    ])
    return
  }

  const placement = evaluatePlacement(cell, normalizeKana(tile.dataset.character))

  if (!placement.valid) {
    setStatus(placement.reason)
    updateScoreDisplay({ base: 0, multiplier: 0, turn: 0 })
    setDebug(placement.debug)
    return
  }

  cell.append(createBoardTile(tile.dataset.character))
  refreshBoardState()
  clearSelection()
  setStatus(`Valid: ${placement.words.join(" / ")}`)
  setDebug(placement.debug)
  const previousTotal = totalScore
  await animateScoring(placement.occurrences)
  totalScore += placement.score.turn
  await animateTotalScore(previousTotal, totalScore, placement.score)
}

function moveTileToTray(tileId) {
  const tile = findTrayTile(tileId)
  if (!tile) {
    return
  }

  trayElement.append(tile)
  clearSelection()
}

function evaluatePlacement(cell, character) {
  if (!hasAdjacentTile(cell)) {
    return {
      valid: false,
      reason: "Place tiles next to an existing hiragana tile.",
      words: [],
      debug: [
        `attempt: ${character} @ ${cell.dataset.row},${cell.dataset.column}`,
        "adjacent: false",
        "words: none",
      ],
    }
  }

  const horizontal = collectLineWords(cell, character, 0, 1, "horizontal")
  const vertical = collectLineWords(cell, character, 1, 0, "vertical")
  const occurrences = [...horizontal.occurrences, ...vertical.occurrences]
  const formedWords = occurrences.map(occurrence => occurrence.word)
  const uniqueWords = [...new Set(formedWords)]
  const score = calculateScore(formedWords)
  const debug = [
    `attempt: ${character} @ ${cell.dataset.row},${cell.dataset.column}`,
    "adjacent: true",
    horizontal.debug,
    vertical.debug,
    `matched: ${formedWords.length ? formedWords.join(", ") : "none"}`,
    `score: base=${score.base} x W=${score.multiplier} => ${score.turn}`,
  ]

  if (uniqueWords.length === 0) {
    return {
      valid: false,
      reason: "That move must form at least one dictionary word.",
      words: [],
      score,
      occurrences,
      debug,
    }
  }

  return {
    valid: true,
    reason: "",
    words: uniqueWords,
    score,
    occurrences,
    debug,
  }
}

function collectLineWords(cell, character, rowDelta, columnDelta, label) {
  const row = Number(cell.dataset.row)
  const column = Number(cell.dataset.column)
  const line = buildLine(row, column, character, rowDelta, columnDelta)

  if (line.characters.length < 2) {
    return {
      occurrences: [],
      debug: `${label}: line=${line.characters.join("") || "(single)"} candidates=none matches=none`,
    }
  }

  const occurrences = []
  const candidates = []

  for (let start = 0; start <= line.index; start += 1) {
    for (let end = line.index; end < line.characters.length; end += 1) {
      if (end - start + 1 < 2) {
        continue
      }

      const candidate = normalizeKana(
        line.characters.slice(start, end + 1).join("")
      )
      candidates.push(candidate)

      if (dictionarySet.has(candidate)) {
        occurrences.push({
          word: candidate,
          cells: line.cells.slice(start, end + 1),
        })
      }
    }
  }

  return {
    occurrences,
    debug:
      `${label}: line=${line.characters.join("")} ` +
      `candidates=${candidates.length ? candidates.join(", ") : "none"} ` +
      `matches=${occurrences.length ? occurrences.map(occurrence => occurrence.word).join(", ") : "none"}`,
  }
}

function buildLine(row, column, character, rowDelta, columnDelta) {
  let startRow = row
  let startColumn = column

  while (true) {
    const nextRow = startRow - rowDelta
    const nextColumn = startColumn - columnDelta
    const nextCharacter = getCharacterAt(nextRow, nextColumn)

    if (!nextCharacter) {
      break
    }

    startRow = nextRow
    startColumn = nextColumn
  }

  const characters = []
  const cells = []
  let index = -1
  let currentRow = startRow
  let currentColumn = startColumn

  while (true) {
    let currentCharacter = getCharacterAt(currentRow, currentColumn)

    if (currentRow === row && currentColumn === column) {
      currentCharacter = character
      index = characters.length
    }

    if (!currentCharacter) {
      break
    }

    characters.push(currentCharacter)
    cells.push(getCell(currentRow, currentColumn))
    currentRow += rowDelta
    currentColumn += columnDelta
  }

  return { characters, cells, index }
}

function hasAdjacentTile(cell) {
  const row = Number(cell.dataset.row)
  const column = Number(cell.dataset.column)

  return [
    getCharacterAt(row - 1, column),
    getCharacterAt(row + 1, column),
    getCharacterAt(row, column - 1),
    getCharacterAt(row, column + 1),
  ].some(Boolean)
}

function getCharacterAt(row, column) {
  const cell = getCell(row, column)
  const tile = cell?.querySelector(".tile")
  return tile?.dataset.character ? normalizeKana(tile.dataset.character) : null
}

function getCell(row, column) {
  return document.querySelector(
    `.board-cell[data-row="${row}"][data-column="${column}"]`
  )
}

function findTrayTile(tileId) {
  return trayElement.querySelector(`[data-tile-id="${CSS.escape(tileId)}"]`)
}

function refreshBoardState() {
  document.querySelectorAll(".board-cell").forEach(cell => {
    cell.classList.toggle("has-tile", Boolean(cell.querySelector(".tile")))
  })
}

function setStatus(message) {
  statusElement.textContent = message
}

function updateScoreDisplay(score, totalValue = totalScore) {
  totalScoreElement.textContent = String(totalValue)
  turnBaseElement.textContent = String(score.base)
  turnMultiplierElement.textContent = String(score.multiplier)
  turnScoreElement.textContent = String(score.turn)
}

function setDebug(lines) {
  debugElement.textContent = Array.isArray(lines) ? lines.join("\n") : String(lines)
}

async function animateScoring(occurrences) {
  if (!occurrences.length) {
    return
  }

  isAnimatingScore = true
  let runningBase = 0

  updateScoreDisplay({ base: 0, multiplier: 0, turn: 0 })

  for (let index = 0; index < occurrences.length; index += 1) {
    const occurrence = occurrences[index]
    const previousBase = runningBase
    const wordScore = calculateWordScore(occurrence.word)
    runningBase += wordScore
    const turnScore = runningBase * (index + 1)

    flashWordCells(occurrence.cells)
    pulseTurnScore()
    await animateBaseCount(previousBase, runningBase, {
      multiplier: index + 1,
      turn: turnScore,
    })
    await wait(120)
  }

  isAnimatingScore = false
}

async function animateTotalScore(from, to, score) {
  const steps = Math.max(4, Math.min(12, Math.abs(to - from)))
  const duration = 320

  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps
    const totalValue = Math.round(from + (to - from) * progress)
    updateScoreDisplay(score, totalValue)
    pulseTotalScore()
    await wait(Math.round(duration / steps))
  }
}

function calculateScore(words) {
  const base = words.reduce((sum, word) => {
    return sum + calculateWordScore(word)
  }, 0)
  const multiplier = words.length
  return {
    base,
    multiplier,
    turn: base * multiplier,
  }
}

function calculateWordScore(word) {
  const length = [...normalizeKana(word)].length
  return 10 * 2 ** (length - 1)
}

function flashWordCells(cells) {
  cells.forEach(cell => {
    if (!cell) {
      return
    }

    const tile = cell.querySelector(".tile")
    cell.classList.remove("word-flash")
    tile?.classList.remove("word-pop")
    void cell.offsetWidth
    cell.classList.add("word-flash")
    tile?.classList.add("word-pop")
    setTimeout(() => {
      cell.classList.remove("word-flash")
      tile?.classList.remove("word-pop")
    }, 320)
  })
}

function pulseTurnScore() {
  turnScoreElement.classList.remove("is-counting")
  void turnScoreElement.offsetWidth
  turnScoreElement.classList.add("is-counting")
  setTimeout(() => {
    turnScoreElement.classList.remove("is-counting")
  }, 280)
}

function pulseTotalScore() {
  totalScoreElement.classList.remove("is-counting")
  void totalScoreElement.offsetWidth
  totalScoreElement.classList.add("is-counting")
  setTimeout(() => {
    totalScoreElement.classList.remove("is-counting")
  }, 280)
}

function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

async function animateBaseCount(from, to, scoreState) {
  const steps = Math.max(4, Math.min(10, to - from))
  const duration = 320

  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps
    const baseValue = Math.round(from + (to - from) * progress)
    updateScoreDisplay({
      base: baseValue,
      multiplier: scoreState.multiplier,
      turn: scoreState.turn,
    })
    await wait(Math.round(duration / steps))
  }
}

function normalizeKana(value) {
  return typeof value === "string"
    ? value.trim().normalize("NFC")
    : ""
}
