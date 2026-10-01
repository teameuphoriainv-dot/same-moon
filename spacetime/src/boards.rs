//! The board games: tic-tac-toe, four in a row, and pairs. The shared canvas
//! counts as one too, so that opening it brings the other person along.
//!
//! The card decks in `games.rs` trust the phone that drew the card. These
//! cannot, because two people tapping the same board at the same moment is the
//! normal case, not a rare one. So the rules live here. A phone only ever says
//! "I would like to play this square", and this module decides whether that is
//! a legal move, whose turn is next, and whether anybody has won. Reducers run
//! one at a time, so there is never a second move racing the first.
//!
//! There is one board, because there are two people.

use spacetimedb::rand::seq::SliceRandom;
use spacetimedb::{ReducerContext, Table, Timestamp};

/// The board on the table. `kind` empty means nothing is being played.
#[spacetimedb::table(accessor = board, public)]
pub struct Board {
    #[primary_key]
    pub id: u32,
    /// "" idle, or "ttt", "four", "pairs", "doodle".
    pub kind: String,
    /// Bumped on every new match. A move names the round it was made in, which
    /// is what stops a late tap from landing on the rematch.
    pub round: u64,
    /// One character per square, row by row. '.' is empty, 'a' belongs to
    /// whoever went first and 'b' to the other one.
    pub cells: String,
    /// Pairs only: what is showing on each card. '.' is face down.
    pub faces: String,
    /// Whose move it is.
    pub turn: String,
    /// Who opened this match, and so plays 'a'.
    pub first: String,
    pub second: String,
    /// "" while it is being played, then a name, or "draw".
    pub winner: String,
    /// The winning squares, comma separated, so they can be lit up.
    pub line: String,
    pub moves: u32,
    /// Pairs only: cards turned over and not yet matched, comma separated.
    pub open: String,
    /// Pairs only: how many pairs each of them has found.
    pub score_first: u32,
    pub score_second: u32,
    pub at: Timestamp,
}

/// Where the pairs layout is kept. This table is deliberately not public, so
/// no phone can read where the cards are. A face only ever reaches a phone
/// through `Board::faces`, after the card has been turned over.
#[spacetimedb::table(accessor = board_secret)]
pub struct BoardSecret {
    #[primary_key]
    pub id: u32,
    pub deck: String,
}

/// Wins that outlast the match, so there is a running score to argue about.
#[spacetimedb::table(accessor = board_tally, public)]
pub struct BoardTally {
    /// "kind:name", or "kind:draw".
    #[primary_key]
    pub key: String,
    pub kind: String,
    pub who: String,
    pub wins: u64,
}

const BOARD_ID: u32 = 0;

const EMPTY: u8 = b'.';
const FIRST: u8 = b'a';
const SECOND: u8 = b'b';

const FOUR_COLS: usize = 7;
const FOUR_ROWS: usize = 6;
const PAIR_FACES: &str = "AABBCCDDEEFFGGHH";

const TTT_LINES: [[usize; 3]; 8] = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];

fn square_count(kind: &str) -> Option<usize> {
    match kind {
        "ttt" => Some(9),
        "four" => Some(FOUR_COLS * FOUR_ROWS),
        "pairs" => Some(PAIR_FACES.len()),
        // The canvas has no squares and no turns. It is here so that it is
        // the thing on the table, and both phones open to it together.
        "doodle" => Some(0),
        _ => None,
    }
}

fn idle(ctx: &ReducerContext, round: u64) -> Board {
    Board {
        id: BOARD_ID,
        kind: String::new(),
        round,
        cells: String::new(),
        faces: String::new(),
        turn: String::new(),
        first: String::new(),
        second: String::new(),
        winner: String::new(),
        line: String::new(),
        moves: 0,
        open: String::new(),
        score_first: 0,
        score_second: 0,
        at: ctx.timestamp,
    }
}

fn put(ctx: &ReducerContext, row: Board) {
    if ctx.db.board().id().find(BOARD_ID).is_some() {
        ctx.db.board().id().update(row);
    } else {
        ctx.db.board().insert(row);
    }
}

fn put_secret(ctx: &ReducerContext, deck: String) {
    let row = BoardSecret { id: BOARD_ID, deck };
    if ctx.db.board_secret().id().find(BOARD_ID).is_some() {
        ctx.db.board_secret().id().update(row);
    } else {
        ctx.db.board_secret().insert(row);
    }
}

pub fn init_board(ctx: &ReducerContext) {
    let row = idle(ctx, 0);
    put(ctx, row);
}

/// Clear the table. Used when they stop, and when a card deck is opened
/// instead, so only one game is ever running.
pub fn put_away(ctx: &ReducerContext) {
    let round = ctx.db.board().id().find(BOARD_ID).map(|b| b.round).unwrap_or(0);
    put(ctx, idle(ctx, round));
    put_secret(ctx, String::new());
}

fn join(squares: &[usize]) -> String {
    squares
        .iter()
        .map(|s| s.to_string())
        .collect::<Vec<_>>()
        .join(",")
}

fn split(list: &str) -> Vec<usize> {
    list.split(',').filter_map(|s| s.parse().ok()).collect()
}

fn piece_of(board: &Board, who: &str) -> u8 {
    if who == board.first { FIRST } else { SECOND }
}

fn bump_tally(ctx: &ReducerContext, kind: &str, who: &str) {
    let key = format!("{kind}:{who}");
    match ctx.db.board_tally().key().find(key.clone()) {
        Some(mut row) => {
            row.wins += 1;
            ctx.db.board_tally().key().update(row);
        }
        None => {
            ctx.db.board_tally().insert(BoardTally {
                key,
                kind: kind.to_string(),
                who: who.to_string(),
                wins: 1,
            });
        }
    }
}

/// Close the match out. `winner` is a name, or "draw".
fn finish(ctx: &ReducerContext, mut board: Board, winner: String, mut line: Vec<usize>) {
    line.sort_unstable();
    line.dedup();
    bump_tally(ctx, &board.kind, &winner);
    board.winner = winner;
    board.line = join(&line);
    board.at = ctx.timestamp;
    put(ctx, board);
}

fn pass_turn(ctx: &ReducerContext, mut board: Board) {
    board.turn = crate::partner_of(&board.turn).to_string();
    board.at = ctx.timestamp;
    put(ctx, board);
}

/// Start a match, or a rematch.
///
/// A rematch of the same game hands the opening move to whoever did not have
/// it last time, so nobody goes first twice in a row.
#[spacetimedb::reducer]
pub fn board_start(ctx: &ReducerContext, kind: String, who: String) {
    if !crate::is_one_of_us(&who) {
        return;
    }
    let Some(squares) = square_count(&kind) else {
        log::warn!("board_start rejected: unknown game {kind}");
        return;
    };

    let previous = ctx.db.board().id().find(BOARD_ID);
    let first = match &previous {
        Some(p) if p.kind == kind && !p.first.is_empty() => crate::partner_of(&p.first).to_string(),
        _ => who,
    };
    let second = crate::partner_of(&first).to_string();
    let round = previous.map(|p| p.round).unwrap_or(0) + 1;

    let deck = if kind == "pairs" {
        let mut cards: Vec<char> = PAIR_FACES.chars().collect();
        cards.shuffle(&mut ctx.rng());
        cards.into_iter().collect()
    } else {
        String::new()
    };
    put_secret(ctx, deck);

    // One game at a time. Opening a board closes whatever deck was out.
    crate::games::put_away(ctx);

    put(
        ctx,
        Board {
            faces: if kind == "pairs" { ".".repeat(squares) } else { String::new() },
            cells: ".".repeat(squares),
            turn: first.clone(),
            first,
            second,
            kind,
            ..idle(ctx, round)
        },
    );
}

/// Play a square. For four in a row `pos` is the column the piece is dropped
/// into; for the others it is the square itself.
#[spacetimedb::reducer]
pub fn board_move(ctx: &ReducerContext, round: u64, who: String, pos: u32) {
    let Some(board) = ctx.db.board().id().find(BOARD_ID) else {
        return;
    };
    if board.kind.is_empty() || board.round != round || !board.winner.is_empty() {
        return;
    }
    if who != board.first && who != board.second {
        return;
    }
    let pos = pos as usize;
    match board.kind.as_str() {
        "ttt" => move_ttt(ctx, board, &who, pos),
        "four" => move_four(ctx, board, &who, pos),
        "pairs" => move_pairs(ctx, board, &who, pos),
        _ => {}
    }
}

fn move_ttt(ctx: &ReducerContext, mut board: Board, who: &str, pos: usize) {
    if board.turn != who {
        return;
    }
    let mut cells = board.cells.clone().into_bytes();
    if pos >= cells.len() || cells[pos] != EMPTY {
        return;
    }
    let piece = piece_of(&board, who);
    cells[pos] = piece;
    board.moves += 1;
    let full = !cells.contains(&EMPTY);
    let won = TTT_LINES
        .iter()
        .find(|line| line.iter().all(|&i| cells[i] == piece))
        .map(|line| line.to_vec());
    board.cells = String::from_utf8(cells).unwrap_or_default();

    match won {
        Some(line) => finish(ctx, board, who.to_string(), line),
        None if full => finish(ctx, board, "draw".to_string(), Vec::new()),
        None => pass_turn(ctx, board),
    }
}

fn move_four(ctx: &ReducerContext, mut board: Board, who: &str, col: usize) {
    if board.turn != who || col >= FOUR_COLS {
        return;
    }
    let mut cells = board.cells.clone().into_bytes();
    if cells.len() != FOUR_COLS * FOUR_ROWS {
        return;
    }
    // The piece falls to the lowest free square. A full column is not a move.
    let Some(row) = (0..FOUR_ROWS)
        .rev()
        .find(|&r| cells[r * FOUR_COLS + col] == EMPTY)
    else {
        return;
    };
    let piece = piece_of(&board, who);
    cells[row * FOUR_COLS + col] = piece;
    board.moves += 1;

    let square = |r: i32, c: i32| -> Option<usize> {
        if r < 0 || c < 0 || r >= FOUR_ROWS as i32 || c >= FOUR_COLS as i32 {
            None
        } else {
            Some(r as usize * FOUR_COLS + c as usize)
        }
    };

    // Only lines through the piece that just landed can be new, so that is all
    // that gets checked: across, down, and the two diagonals.
    let mut won: Vec<usize> = Vec::new();
    for (dr, dc) in [(0i32, 1i32), (1, 0), (1, 1), (1, -1)] {
        let mut run = vec![row * FOUR_COLS + col];
        for sign in [1i32, -1] {
            let mut r = row as i32 + dr * sign;
            let mut c = col as i32 + dc * sign;
            while let Some(i) = square(r, c) {
                if cells[i] != piece {
                    break;
                }
                run.push(i);
                r += dr * sign;
                c += dc * sign;
            }
        }
        if run.len() >= 4 {
            won.extend(run);
        }
    }

    let full = !cells.contains(&EMPTY);
    board.cells = String::from_utf8(cells).unwrap_or_default();

    if !won.is_empty() {
        finish(ctx, board, who.to_string(), won);
    } else if full {
        finish(ctx, board, "draw".to_string(), Vec::new());
    } else {
        pass_turn(ctx, board);
    }
}

/// Turn two cards that did not match back over, and hand the turn across.
fn turn_back(board: &mut Board) {
    let mut faces = board.faces.clone().into_bytes();
    for at in split(&board.open) {
        if at < faces.len() {
            faces[at] = EMPTY;
        }
    }
    board.faces = String::from_utf8(faces).unwrap_or_default();
    board.open = String::new();
    board.turn = crate::partner_of(&board.turn).to_string();
}

fn move_pairs(ctx: &ReducerContext, mut board: Board, who: &str, pos: usize) {
    // Two cards that did not match stay face up for a moment so both of them
    // can see what they were. If the next player taps before that moment is
    // over, their tap is what turns the cards back.
    if split(&board.open).len() >= 2 {
        if who != crate::partner_of(&board.turn) {
            return;
        }
        turn_back(&mut board);
    }
    if board.turn != who {
        return;
    }

    let deck = ctx
        .db
        .board_secret()
        .id()
        .find(BOARD_ID)
        .map(|s| s.deck)
        .unwrap_or_default()
        .into_bytes();
    let mut cells = board.cells.clone().into_bytes();
    let mut faces = board.faces.clone().into_bytes();
    if deck.len() != cells.len() || faces.len() != cells.len() || pos >= cells.len() {
        return;
    }
    let mut open = split(&board.open);
    // Already matched, or already the card they just turned over.
    if cells[pos] != EMPTY || open.contains(&pos) {
        return;
    }

    faces[pos] = deck[pos];
    open.push(pos);
    board.moves += 1;

    if open.len() == 2 && deck[open[0]] == deck[open[1]] {
        let piece = piece_of(&board, who);
        cells[open[0]] = piece;
        cells[open[1]] = piece;
        if piece == FIRST {
            board.score_first += 1;
        } else {
            board.score_second += 1;
        }
        open.clear();
    }

    let done = !cells.contains(&EMPTY);
    board.cells = String::from_utf8(cells).unwrap_or_default();
    board.faces = String::from_utf8(faces).unwrap_or_default();
    board.open = join(&open);
    board.at = ctx.timestamp;

    if done {
        let winner = if board.score_first > board.score_second {
            board.first.clone()
        } else if board.score_second > board.score_first {
            board.second.clone()
        } else {
            "draw".to_string()
        };
        finish(ctx, board, winner, Vec::new());
    } else {
        // A match keeps the turn. A miss keeps it too, until the cards have
        // been turned back, which is what `board_settle` is for.
        put(ctx, board);
    }
}

/// Turn a missed pair back over once both of them have had a look.
///
/// Either phone may call this, and both will. `moves` pins it to the exact
/// position it was asked about, so the second call finds nothing left to do.
#[spacetimedb::reducer]
pub fn board_settle(ctx: &ReducerContext, round: u64, moves: u32) {
    let Some(mut board) = ctx.db.board().id().find(BOARD_ID) else {
        return;
    };
    if board.kind != "pairs" || board.round != round || board.moves != moves {
        return;
    }
    if !board.winner.is_empty() || split(&board.open).len() < 2 {
        return;
    }
    turn_back(&mut board);
    board.at = ctx.timestamp;
    put(ctx, board);
}

/// Put the board away.
#[spacetimedb::reducer]
pub fn board_end(ctx: &ReducerContext) {
    put_away(ctx);
}
