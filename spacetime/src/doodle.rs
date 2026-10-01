//! The shared canvas.
//!
//! One sheet of pixels that both of them can draw on at the same time. A phone
//! never sends the whole sheet, only the pixels a stroke touched, and they are
//! applied here to the one true copy. That is what lets two fingers draw at
//! once without either of them wiping out what the other just did.

use spacetimedb::{ReducerContext, Table, Timestamp};

#[spacetimedb::table(accessor = doodle, public)]
pub struct Doodle {
    #[primary_key]
    pub id: u32,
    /// Pixels along one side.
    pub size: u32,
    /// `size * size` ink characters, row by row. '.' is bare canvas.
    pub cells: String,
    /// Bumped whenever the sheet is wiped, so a stroke that was already in
    /// flight cannot land on the fresh one.
    pub sheet: u64,
    /// Something to draw, if they asked for an idea. Empty otherwise.
    pub prompt: String,
    /// Whoever touched it last.
    pub by: String,
    pub at: Timestamp,
}

const DOODLE_ID: u32 = 0;
pub const SIZE: usize = 32;
const MAX_PROMPT_LEN: usize = 120;

/// Bare canvas, or one of the twenty six inks. The colours themselves live in
/// the client; all this side needs to know is what counts as a legal pixel.
pub fn is_ink(c: char) -> bool {
    c == '.' || c.is_ascii_lowercase()
}

fn blank() -> String {
    ".".repeat(SIZE * SIZE)
}

fn current(ctx: &ReducerContext) -> Doodle {
    ctx.db.doodle().id().find(DOODLE_ID).unwrap_or(Doodle {
        id: DOODLE_ID,
        size: SIZE as u32,
        cells: blank(),
        sheet: 0,
        prompt: String::new(),
        by: String::new(),
        at: ctx.timestamp,
    })
}

fn put(ctx: &ReducerContext, row: Doodle) {
    if ctx.db.doodle().id().find(DOODLE_ID).is_some() {
        ctx.db.doodle().id().update(row);
    } else {
        ctx.db.doodle().insert(row);
    }
}

pub fn init_doodle(ctx: &ReducerContext) {
    let row = current(ctx);
    put(ctx, row);
}

fn base36(byte: u8) -> Option<usize> {
    match byte {
        b'0'..=b'9' => Some((byte - b'0') as usize),
        b'a'..=b'z' => Some((byte - b'a') as usize + 10),
        _ => None,
    }
}

/// Lay down the pixels of one stroke.
///
/// `strokes` is a run of three character records: two base 36 digits for the
/// position on the sheet, then the ink. A record that does not parse spoils
/// the whole call, because half of a stroke is worse than none of it.
#[spacetimedb::reducer]
pub fn doodle_paint(ctx: &ReducerContext, sheet: u64, who: String, strokes: String) {
    if !crate::is_one_of_us(&who) {
        return;
    }
    let mut row = current(ctx);
    if row.sheet != sheet {
        return;
    }
    let records = strokes.as_bytes();
    if records.is_empty() || records.len() % 3 != 0 || records.len() > 3 * SIZE * SIZE {
        log::warn!("doodle_paint rejected: malformed stroke");
        return;
    }

    let mut cells = row.cells.into_bytes();
    if cells.len() != SIZE * SIZE {
        cells = blank().into_bytes();
    }
    for record in records.chunks(3) {
        let (Some(hi), Some(lo)) = (base36(record[0]), base36(record[1])) else {
            log::warn!("doodle_paint rejected: bad position");
            return;
        };
        let at = hi * 36 + lo;
        if at >= cells.len() || !is_ink(record[2] as char) {
            log::warn!("doodle_paint rejected: off the sheet or not an ink");
            return;
        }
        cells[at] = record[2];
    }

    // Every byte written above is ASCII, so this cannot fail. Falling back to
    // a blank sheet rather than panicking keeps a reducer from ever trapping.
    row.cells = String::from_utf8(cells).unwrap_or_else(|_| blank());
    row.by = who;
    row.at = ctx.timestamp;
    put(ctx, row);
}

/// Wipe the sheet and start again.
#[spacetimedb::reducer]
pub fn doodle_clear(ctx: &ReducerContext, who: String) {
    if !crate::is_one_of_us(&who) {
        return;
    }
    let row = current(ctx);
    put(
        ctx,
        Doodle {
            cells: blank(),
            sheet: row.sheet + 1,
            by: who,
            at: ctx.timestamp,
            ..row
        },
    );
}

/// Set, or clear, the idea at the top of the canvas.
#[spacetimedb::reducer]
pub fn doodle_prompt(ctx: &ReducerContext, prompt: String) {
    let row = current(ctx);
    put(
        ctx,
        Doodle {
            prompt: prompt.trim().chars().take(MAX_PROMPT_LEN).collect(),
            at: ctx.timestamp,
            ..row
        },
    );
}
