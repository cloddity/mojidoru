const BOARD_ROWS = 5
const BOARD_COLUMNS = 5
const TRAY_TILE_COUNT = 6
const FALLBACK_HIRAGANA = ["あ", "い", "う", "え", "お", "ん"]

const boardElement = document.querySelector("[data-board]")
const trayElement = document.querySelector("[data-tray]")

let selectedTileId = null
let activeTileChar = null

buildBoard()
wireTrayDropzone()
loadDictionary()

function buildBoard() {
  const fragment = document.createDocumentFragment()

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let column = 0; column < BOARD_COLUMNS; column += 1) {
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

async function loadDictionary() {
  try {
    const response = await fetch("./dict2.json")

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const words = await response.json()
    const tilePool = buildTilePool(words)
    renderTray(tilePool)
  } catch (error) {
    renderTray(FALLBACK_HIRAGANA)
    console.error("Unable to load dict2.json", error)
  }
}

function buildTilePool(words) {
  const counts = new Map()

  words.forEach(word => {
    const kana = [...word.matchAll(/[ぁ-んー]/g)].map(match => match[0])
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
    tileFragment.append(createTile(character, index))
  })

  trayElement.append(tileFragment)
  refreshBoardState()
  clearSelection()
}

function createTile(character, index) {
  const tile = document.createElement("button")
  tile.type = "button"
  tile.className = "tile"
  tile.textContent = character
  tile.dataset.tileId = `tile-${index}-${character}`
  tile.dataset.character = character
  tile.draggable = true
  tile.setAttribute("aria-label", `Hiragana tile ${character}`)

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
    if (tile.parentElement?.classList.contains("board-cell")) {
      moveTileToTray(tile.dataset.tileId)
      return
    }

    if (selectedTileId === tile.dataset.tileId) {
      clearSelection()
      return
    }

    setSelectedTile(tile)
  })

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
    moveTileToCell(tileId, cell)
  }
}

function moveTileToCell(tileId, cell) {
  const tile = findTile(tileId)
  if (!tile || !cell) {
    return
  }

  const existingTile = cell.querySelector(".tile")
  if (existingTile && existingTile !== tile) {
    trayElement.append(existingTile)
  }

  cell.append(tile)
  refreshBoardState()
  clearSelection()
}

function moveTileToTray(tileId) {
  const tile = findTile(tileId)
  if (!tile) {
    return
  }

  trayElement.append(tile)
  refreshBoardState()
  clearSelection()
}

function findTile(tileId) {
  return document.querySelector(`[data-tile-id="${CSS.escape(tileId)}"]`)
}

function refreshBoardState() {
  document.querySelectorAll(".board-cell").forEach(cell => {
    cell.classList.toggle("has-tile", Boolean(cell.querySelector(".tile")))
  })
}
