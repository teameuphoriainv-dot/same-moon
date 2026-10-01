//! Same Moon: the nightly call streak for two people, the Moon and the Star.
//!
//! SpacetimeDB is the whole backend. Every night either of them marks is a row
//! here, and both phones subscribe to the same table, so a night logged on one
//! shows up on the other without a refresh and without any polling.
//!
//! There are exactly two people, so the module instance is the room. No board
//! ids, no tenancy, no partitioning.

mod boards;
mod calls;
mod couple;
mod doodle;
mod games;
mod pulse;
mod scrap;

use spacetimedb::{ReducerContext, Table, Timestamp};

/// The two people, as every table stores them. Their real names live in
/// `couple`, so they can change without touching any other row.
const STAR: &str = "Star";
const MOON: &str = "Moon";

/// The newer reducers only take a name they recognise. The older ones below
/// accept whatever they are handed, and are left that way on purpose: changing
/// what they reject would change how the rows already in the database behave.
pub fn is_one_of_us(name: &str) -> bool {
    name == STAR || name == MOON
}

/// The other half of the pair.
pub fn partner_of(name: &str) -> &'static str {
    if name == MOON { STAR } else { MOON }
}

/// One logged night. `day` is a local calendar key, "YYYY-MM-DD", produced by
/// the client so it matches the phone's own idea of what night it is.
#[spacetimedb::table(accessor = night, public)]
pub struct Night {
    #[primary_key]
    pub day: String,
    /// "called" or "clouded". A clouded night bridges a gap without earning credit.
    pub kind: String,
    pub note: String,
    /// "Moon" or "Star", whoever was signed in when it was marked.
    pub by: String,
    pub at: Timestamp,
}

/// Single-row table holding the night they started counting.
#[spacetimedb::table(accessor = meta, public)]
pub struct Meta {
    #[primary_key]
    pub id: u32,
    pub started_on: String,
}

const META_ID: u32 = 0;

#[spacetimedb::reducer(init)]
pub fn init(ctx: &ReducerContext) {
    ctx.db.meta().insert(Meta { id: META_ID, started_on: String::new() });
    calls::init_call(ctx);
    games::init_game(ctx);
    boards::init_board(ctx);
    doodle::init_doodle(ctx);
    log::info!("same moon: ready");
}

#[spacetimedb::reducer(client_connected)]
pub fn identity_connected(_ctx: &ReducerContext) {}

/// A closed socket is somebody leaving, so whoever was checked in on it is
/// marked as gone straight away instead of waiting to go quiet.
#[spacetimedb::reducer(client_disconnected)]
pub fn identity_disconnected(ctx: &ReducerContext) {
    pulse::drop_connection(ctx);
}

/// Keep `started_on` pinned to the earliest night on record.
fn touch_started_on(ctx: &ReducerContext, day: &str) {
    let current = ctx
        .db
        .meta()
        .id()
        .find(META_ID)
        .map(|m| m.started_on)
        .unwrap_or_default();

    if current.is_empty() || day < current.as_str() {
        let row = Meta { id: META_ID, started_on: day.to_string() };
        if ctx.db.meta().id().find(META_ID).is_some() {
            ctx.db.meta().id().update(row);
        } else {
            ctx.db.meta().insert(row);
        }
    }
}

/// Mark a night, or edit one already marked. Upsert on `day`.
#[spacetimedb::reducer]
pub fn mark_night(ctx: &ReducerContext, day: String, kind: String, note: String, by: String) {
    if day.is_empty() {
        log::warn!("mark_night called with an empty day");
        return;
    }
    let kind = if kind == "clouded" { "clouded" } else { "called" }.to_string();

    let row = Night { day: day.clone(), kind, note, by, at: ctx.timestamp };
    if ctx.db.night().day().find(day.clone()).is_some() {
        ctx.db.night().day().update(row);
    } else {
        ctx.db.night().insert(row);
    }
    touch_started_on(ctx, &day);
}

/// Erase a night entirely.
#[spacetimedb::reducer]
pub fn clear_night(ctx: &ReducerContext, day: String) {
    if ctx.db.night().day().find(day.clone()).is_some() {
        ctx.db.night().day().delete(day);
    }
}

// ---------------------------------------------------------------------------
// Inside jokes
// ---------------------------------------------------------------------------

/// A word or phrase either of them adds. The celebration popup draws from these,
/// so the thing it says back is always in their own language.
#[spacetimedb::table(accessor = joke, public)]
pub struct Joke {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub text: String,
    pub by: String,
    pub at: Timestamp,
}

const MAX_JOKE_LEN: usize = 60;

#[spacetimedb::reducer]
pub fn add_joke(ctx: &ReducerContext, text: String, by: String) {
    let text = text.trim().to_string();
    if text.is_empty() {
        return;
    }
    // Guard the boundary: this string is rendered large on both phones.
    let text = if text.chars().count() > MAX_JOKE_LEN {
        text.chars().take(MAX_JOKE_LEN).collect()
    } else {
        text
    };

    // Ignore a duplicate rather than stacking it up twice.
    if ctx.db.joke().iter().any(|j| j.text.eq_ignore_ascii_case(&text)) {
        return;
    }

    ctx.db.joke().insert(Joke { id: 0, text, by, at: ctx.timestamp });
}

#[spacetimedb::reducer]
pub fn remove_joke(ctx: &ReducerContext, id: u64) {
    if ctx.db.joke().id().find(id).is_some() {
        ctx.db.joke().id().delete(id);
    }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
//
// These rows are plaintext. The thread used to be sealed client side under a
// phrase the two of them shared, and it worked, but it cost a lock screen on
// every new device, a slow key derivation on every open, and a thread that
// flashed empty while it decrypted. For a two person room this was guarding
// against someone who already knows the module name, and it made the thing
// unpleasant to use every single day. Plain rows, honestly labelled.
//
// What that means in practice: every table in this module is `public`, so
// anyone who learns the module name can read the messages. The name is the
// secret now. Keep `.stdb-name` out of anything public.

/// One message.
#[spacetimedb::table(accessor = message, public)]
pub struct Message {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub body: String,
    /// Dead weight, and deliberately so. Messages used to be encrypted and this
    /// held the AES nonce; the encryption is gone and nothing reads this now.
    /// It stays because dropping a column is the one schema change SpacetimeDB
    /// will not auto-migrate, and the alternative is republishing with
    /// `--delete-data`, which would take the night grid with it. Always "".
    pub iv: String,
    /// "Moon" or "Star", whoever was signed in when it was sent.
    pub by: String,
    pub at: Timestamp,
    /// True once edited, so the thread can say so.
    pub edited: bool,
}

/// Matches the client's own cap, with room for multi byte characters.
const MAX_BODY_LEN: usize = 4096;

/// Also dead weight, and kept for exactly the same reason as `Message::iv`:
/// this is where the encryption canary lived. No reducer writes it and no
/// client reads it, but deleting a table is a breaking change, so it stays
/// empty rather than costing us the history.
#[spacetimedb::table(accessor = keycheck, public)]
pub struct Keycheck {
    #[primary_key]
    pub id: u32,
    pub canary: String,
    pub iv: String,
    pub salt: String,
}

/// How far each of them has read. Lets an unread badge survive a device change.
#[spacetimedb::table(accessor = read_marker, public)]
pub struct ReadMarker {
    #[primary_key]
    pub who: String,
    pub last_seen: u64,
}

/// Liveness for the thread. `typing` is a raw flag rather than a deadline: the
/// receiver expires it on its own clock, so the two phones never have to agree
/// on what time it is.
#[spacetimedb::table(accessor = presence, public)]
pub struct Presence {
    #[primary_key]
    pub who: String,
    pub typing: bool,
    pub at: Timestamp,
}

#[spacetimedb::reducer]
pub fn send_message(ctx: &ReducerContext, body: String, by: String) {
    let body = body.trim().to_string();
    if body.is_empty() || body.len() > MAX_BODY_LEN {
        log::warn!("send_message rejected: empty or oversized body");
        return;
    }
    ctx.db.message().insert(Message {
        id: 0,
        body,
        iv: String::new(),
        by: by.clone(),
        at: ctx.timestamp,
        edited: false,
    });

    // Sending is the end of typing. Clearing it here rather than trusting the
    // client to send a follow-up means a phone that drops right after hitting
    // send cannot leave the other side staring at a stuck indicator.
    if let Some(mut p) = ctx.db.presence().who().find(by) {
        if p.typing {
            p.typing = false;
            p.at = ctx.timestamp;
            ctx.db.presence().who().update(p);
        }
    }
}

#[spacetimedb::reducer]
pub fn edit_message(ctx: &ReducerContext, id: u64, body: String) {
    let body = body.trim().to_string();
    if body.is_empty() || body.len() > MAX_BODY_LEN {
        return;
    }
    if let Some(mut m) = ctx.db.message().id().find(id) {
        m.body = body;
        m.edited = true;
        ctx.db.message().id().update(m);
    }
}

#[spacetimedb::reducer]
pub fn delete_message(ctx: &ReducerContext, id: u64) {
    if ctx.db.message().id().find(id).is_some() {
        ctx.db.message().id().delete(id);
    }
}

/// Wipe the thread. The read markers go with it, otherwise a stale marker would
/// sit above every id in a freshly empty thread and suppress the unread badge.
#[spacetimedb::reducer]
pub fn clear_thread(ctx: &ReducerContext) {
    let ids: Vec<u64> = ctx.db.message().iter().map(|m| m.id).collect();
    for id in ids {
        ctx.db.message().id().delete(id);
    }
    let whos: Vec<String> = ctx.db.read_marker().iter().map(|r| r.who).collect();
    for who in whos {
        ctx.db.read_marker().who().delete(who);
    }
    log::info!("same moon: thread cleared");
}

/// Monotonic: a stale client replaying an old marker cannot un-read the thread.
#[spacetimedb::reducer]
pub fn mark_read(ctx: &ReducerContext, who: String, last_seen: u64) {
    if who.is_empty() {
        return;
    }
    match ctx.db.read_marker().who().find(who.clone()) {
        Some(existing) => {
            if last_seen > existing.last_seen {
                ctx.db.read_marker().who().update(ReadMarker { who, last_seen });
            }
        }
        None => {
            ctx.db.read_marker().insert(ReadMarker { who, last_seen });
        }
    }
}

#[spacetimedb::reducer]
pub fn set_typing(ctx: &ReducerContext, who: String, typing: bool) {
    if who.is_empty() {
        return;
    }
    // A repeated "stopped" is nothing to say, so swallow it. A repeated
    // "still typing" is written anyway, because the receiver expires the flag
    // on its own clock and needs the fresh row to know the finger is still
    // moving. That write is cheap now: typing rides in its own slice, so it
    // moves the indicator without touching the message list.
    if !typing {
        if let Some(existing) = ctx.db.presence().who().find(who.clone()) {
            if !existing.typing {
                return;
            }
        }
    }
    let row = Presence { who: who.clone(), typing, at: ctx.timestamp };
    if ctx.db.presence().who().find(who).is_some() {
        ctx.db.presence().who().update(row);
    } else {
        ctx.db.presence().insert(row);
    }
}
