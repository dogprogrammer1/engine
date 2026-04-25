/*  
Project goal: 
- Chess engine that evaluates a position and find the best move
- Playable chess board

Programming Languages:
Javascript, Html

Features & Implementation:
  Separate classes:
  - board (rules/current position)
      - 64 bit LLong bitboard for each piece
      - bit flips & shifts for piece movement -> optimize efficiency
      - detects if move (x1, y1 -> x2, y2) is valid
  - Engine class (evaluation, best move)
      - imports Board class
      - evaluates position
      - Recursive tree - checks all possible moves, finds best path based on eval
      - Pruning - reduces time, if path low eval -> cut
  - Game & renderer (player interaction)
      - imports Board and Engine classes
      - draws chessboard, detects user input via click
      - Settings for engine depth (higher depth = harder)
*/
