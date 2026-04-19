import json
import os

def generate_board():
    # ---------------------------------------------------------
    # 1. CUSTOMIZE YOUR BOARD SHAPE HERE
    # '#' represents an active playable square.
    # '.' represents an inactive empty square.
    # The grid will automatically size itself based on the longest row.
    # ---------------------------------------------------------
    board_shape = [
        "...######...",
        "..########..",
        ".##########.",
        "############",
        "############",
        "############",
        "############",
        "############",
        "############",
        ".##########.",
        "..########..",
    ]

    # Convert the string shape into the 1s and 0s the game expects
    layout = []
    for row in board_shape:
        layout.append([1 if char == '#' else 0 for char in row])

    # ---------------------------------------------------------
    # 2. SPECIFY YOUR STARTER TILES
    # Note: Rows and Columns are 0-indexed (0 is the first row)
    # ---------------------------------------------------------
    starter_tiles = [
        {"row": 5, "column": 5, "character": "あ"},
        {"row": 5, "column": 6, "character": "あ"}
    ]

    board_config = {
        "layout": layout,
        "starterTiles": starter_tiles
    }

    # Write the config to board.js
    file_path = os.path.join(os.path.dirname(__file__), "board.js")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(f"window.__BOARD__ = {json.dumps(board_config, indent=2, ensure_ascii=False)};\n")

    print(f"Successfully generated custom board layout in {file_path}")

if __name__ == "__main__":
    generate_board()
