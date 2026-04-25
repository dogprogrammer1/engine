# 3D Chess AI - Project Plan

### 1. Description
The game will show a chessboard using a custom 3D renderer built with quaternions. The player will be able to choose between two AI difficulties. Both difficulties will use a tree with minimax and alpha beta pruning.

* **Easy:** will use an evaluation function only baesd on material advantage and piece activity.
* **Hard:** will use an evaluation function with a neural network inspired by NNUE.

### 2. Technology
* **Graphics:** javascript and html w custom 3d renderer (quaternions)
* **AI:** Python (TensorFlow) for training neural network which can be exported through json to run in browser.

### 3. Features
* **Main Menu:** Easy and Hard difficulty selection
* **Game Scene:** 3D board with rotation and piece movement and AI
* **End Scene:** Game results and restart option


### 4. Version Plan
* **V1:** Full chess rules, minimax search with alpha beta pruning, and a basic 3D board.
* **V2:** Evaluation function through material advantage and piece activity and Camera rotation.
* **V3:** NNUE inspired neural network evaluation and sounds.

### 5. Architecture
**Main Classes:**
* Game
* Board
* Piece
* Move
* AI
* Renderer
* Camera
* Button

**Other important methods/classes:**
* Minimax
* alpha beta
* Board Evaluation

**Scenes:**
* Main Menu
* Game
* End Screen

### 6. Timeline
* **Week 1:** alpha beta pruning and easy ai
* **Week 2:** neural network implementation and basic 3d view
* **Week 3:** quaternions rotation and better user experience

