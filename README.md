Final Project Plan: 3D Chess AI Game
 
1. Description
The game will display a chessboard using a custom 3D renderer built with quaternions.
 
The player will be able to choose between two AI difficulties.
 
Both difficulties will use a tree with minimax and alpha beta pruning
 
Easy AI will use an evaluation function only baesd on material advantage and piece activity.
 
Hard AI will use an evaluation function with a neural network inspired by NNUE.
 
2. Technology
javascript and html for web graphics and 3d renderer
python for neural network
 
3. Features
 
Play button
Easy difficulty button
Hard difficulty button
Instructions button
3D chess board and all
AI move after player move
Camera rotation
Move validation and all the other chess rules
 
These must work for the project to count as successful:
 
Working chessboard with chess moves and all
Minimax with alpha-beta pruning
Easy AI evaluation using material and piece activity
Hard AI with neural network
 
 
These should be included after the core game works:
 
3D rendererd chess board and rotation
Menu
Sound effects
 
4. High-Level Architecture
Objects / Classes:
Game
Board
Piece
Move
AI
Renderer
Camera
Button
Minimax search
Alpha-beta pruning
Board evaluation
Scene switching
User Interaction
 
Scenes
Main Menu
Game Scene
End Scene
 
5. Timeline
 
Week 1:
finish pruning and easy evaluation function
 
Week 2:
neural network implemented and simple 3d rendered
 
Week 3:
rotation w quaternions and good user experience
