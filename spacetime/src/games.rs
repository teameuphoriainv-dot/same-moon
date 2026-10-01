//! The games they play together.
//!
//! Four of them, all the same shape: a prompt appears, both of them answer, and
//! the answers reveal at the same moment. The simultaneous reveal is the whole
//! point, so the phase never flips to "revealed" because one side got bored,
//! only because both answers are in or somebody deliberately gave up waiting.
//!
//! The prompt decks live in the client, not here. Whoever draws a card picks
//! the text and publishes it, so both phones are looking at the same words
//! without this module needing to carry a few hundred strings.

use spacetimedb::{ReducerContext, Table, Timestamp};

/// The single live game. `kind` empty means nobody is playing.
#[spacetimedb::table(accessor = game, public)]
pub struct Game {
    #[primary_key]
    pub id: u32,
    /// "" idle, or "ama", "wyr", "nhie", "tod".
    pub kind: String,
    /// Bumped on every new prompt. Answers are scoped to it, which is what
    /// stops a late tap on the last card from landing on this one.
    pub round: u64,
    pub prompt: String,
    /// JSON array of choices for the pick-one games, "" for the open ones.
    pub options: String,
    /// "answering" or "revealed".
    pub phase: String,
    /// Whose turn it is, for the games that take turns. "" means both at once.
    pub turn: String,
    pub at: Timestamp,
}

/// One answer. Keyed by round and name together so a second tap edits the first
/// rather than stacking up, and so answers from an old round cannot collide.
#[spacetimedb::table(accessor = game_answer, public)]
pub struct GameAnswer {
    #[primary_key]
    pub key: String,
    pub round: u64,
    pub who: String,
    pub answer: String,
    pub at: Timestamp,
}

/// A running tally for the current sitting, reset whenever a new game starts.
#[spacetimedb::table(accessor = game_score, public)]
pub struct GameScore {
    #[primary_key]
    pub who: String,
    /// Rounds where they picked the same thing.
    pub matches: u64,
    pub rounds: u64,
}

const GAME_ID: u32 = 0;

const MAX_PROMPT_LEN: usize = 280;
const MAX_ANSWER_LEN: usize = 500;
const MAX_OPTIONS_LEN: usize = 1024;

/// The games where both sides pick from the same list, so "we matched" means
/// something. The open-ended ones are not scored.
fn is_scored(kind: &str) -> bool {
    kind == "wyr" || kind == "nhie"
}

pub fn init_game(ctx: &ReducerContext) {
    ctx.db.game().insert(Game {
        id: GAME_ID,
        kind: String::new(),
        round: 0,
        prompt: String::new(),
        options: String::new(),
        phase: "answering".to_string(),
        turn: String::new(),
        at: ctx.timestamp,
    });
}

fn clear_answers(ctx: &ReducerContext) {
    let keys: Vec<String> = ctx.db.game_answer().iter().map(|a| a.key).collect();
    for key in keys {
        ctx.db.game_answer().key().delete(key);
    }
}

fn clear_scores(ctx: &ReducerContext) {
    let whos: Vec<String> = ctx.db.game_score().iter().map(|s| s.who).collect();
    for who in whos {
        ctx.db.game_score().who().delete(who);
    }
}

fn put_game(ctx: &ReducerContext, row: Game) {
    if ctx.db.game().id().find(GAME_ID).is_some() {
        ctx.db.game().id().update(row);
    } else {
        ctx.db.game().insert(row);
    }
}

fn clamp(value: String, max: usize) -> String {
    if value.chars().count() > max {
        value.chars().take(max).collect()
    } else {
        value
    }
}

/// Open a game and deal the first prompt. Starting a game is a fresh sitting,
/// so the tally goes back to zero.
#[spacetimedb::reducer]
pub fn start_game(
    ctx: &ReducerContext,
    kind: String,
    prompt: String,
    options: String,
    turn: String,
) {
    if kind.is_empty() || prompt.trim().is_empty() {
        return;
    }
    if options.len() > MAX_OPTIONS_LEN {
        return;
    }
    clear_answers(ctx);
    clear_scores(ctx);
    // One game at a time. Opening a deck clears whatever board was out.
    crate::boards::put_away(ctx);
    put_game(
        ctx,
        Game {
            id: GAME_ID,
            kind,
            round: 1,
            prompt: clamp(prompt, MAX_PROMPT_LEN),
            options,
            phase: "answering".to_string(),
            turn,
            at: ctx.timestamp,
        },
    );
}

/// Deal the next prompt in the game already running.
#[spacetimedb::reducer]
pub fn next_round(ctx: &ReducerContext, prompt: String, options: String, turn: String) {
    let Some(current) = ctx.db.game().id().find(GAME_ID) else {
        return;
    };
    if current.kind.is_empty() || prompt.trim().is_empty() {
        return;
    }
    if options.len() > MAX_OPTIONS_LEN {
        return;
    }
    clear_answers(ctx);
    put_game(
        ctx,
        Game {
            id: GAME_ID,
            kind: current.kind,
            round: current.round + 1,
            prompt: clamp(prompt, MAX_PROMPT_LEN),
            options,
            phase: "answering".to_string(),
            turn,
            at: ctx.timestamp,
        },
    );
}

fn bump_score(ctx: &ReducerContext, who: &str, matched: bool) {
    match ctx.db.game_score().who().find(who.to_string()) {
        Some(mut s) => {
            s.rounds += 1;
            if matched {
                s.matches += 1;
            }
            ctx.db.game_score().who().update(s);
        }
        None => {
            ctx.db.game_score().insert(GameScore {
                who: who.to_string(),
                matches: u64::from(matched),
                rounds: 1,
            });
        }
    }
}

/// Lock in an answer. When the second one lands the round reveals itself, which
/// is what keeps either of them from seeing the other's answer early.
#[spacetimedb::reducer]
pub fn submit_answer(ctx: &ReducerContext, round: u64, who: String, answer: String) {
    if who.is_empty() || answer.trim().is_empty() {
        return;
    }
    let Some(game) = ctx.db.game().id().find(GAME_ID) else {
        return;
    };
    // A tap that was already in flight when the round moved on belongs to the
    // round it was made in, not this one.
    if game.kind.is_empty() || game.round != round || game.phase == "revealed" {
        return;
    }

    let key = format!("{round}:{who}");
    let row = GameAnswer {
        key: key.clone(),
        round,
        who: who.clone(),
        answer: clamp(answer, MAX_ANSWER_LEN),
        at: ctx.timestamp,
    };
    if ctx.db.game_answer().key().find(key).is_some() {
        ctx.db.game_answer().key().update(row);
    } else {
        ctx.db.game_answer().insert(row);
    }

    let answers: Vec<GameAnswer> = ctx
        .db
        .game_answer()
        .iter()
        .filter(|a| a.round == round)
        .collect();
    if answers.len() < 2 {
        return;
    }

    let matched = is_scored(&game.kind) && answers[0].answer == answers[1].answer;
    if is_scored(&game.kind) {
        for a in &answers {
            bump_score(ctx, &a.who, matched);
        }
    }

    put_game(
        ctx,
        Game {
            phase: "revealed".to_string(),
            at: ctx.timestamp,
            ..game
        },
    );
}

/// Show the round without waiting, for when one of them has wandered off.
#[spacetimedb::reducer]
pub fn reveal_round(ctx: &ReducerContext) {
    if let Some(game) = ctx.db.game().id().find(GAME_ID) {
        if !game.kind.is_empty() && game.phase != "revealed" {
            put_game(
                ctx,
                Game {
                    phase: "revealed".to_string(),
                    at: ctx.timestamp,
                    ..game
                },
            );
        }
    }
}

/// Put the cards away.
#[spacetimedb::reducer]
pub fn end_game(ctx: &ReducerContext) {
    put_away(ctx);
}

/// The body of `end_game`, callable from the board games, which close any
/// open deck when a board comes out.
pub fn put_away(ctx: &ReducerContext) {
    clear_answers(ctx);
    put_game(
        ctx,
        Game {
            id: GAME_ID,
            kind: String::new(),
            round: 0,
            prompt: String::new(),
            options: String::new(),
            phase: "answering".to_string(),
            turn: String::new(),
            at: ctx.timestamp,
        },
    );
}
