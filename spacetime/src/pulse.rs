//! Who is here right now, and when they were last.
//!
//! Each phone checks in every half minute or so while the page is open and in
//! front of them. The reader treats a row that has gone quiet for longer than
//! that as someone who has left, whatever the flag says, so nobody has to trust
//! a phone that died mid-sentence to have said goodbye first.
//!
//! This is its own table rather than more columns on `presence` for two
//! reasons. Adding a column to a table that already holds rows is a migration,
//! and a heartbeat landing every few seconds should not wake up the message
//! thread, which is what watches `presence`.

use spacetimedb::{ReducerContext, Table, Timestamp};

#[spacetimedb::table(accessor = pulse, public)]
pub struct Pulse {
    #[primary_key]
    pub who: String,
    /// True while their page is open and in front of them.
    pub active: bool,
    /// Where on the site they are: "home", "messages", "call", "games", "book".
    pub place: String,
    /// The connection that checked in last, so a socket that drops can be
    /// matched back to the person it belonged to.
    pub conn: String,
    /// The last moment they were known to be here.
    pub at: Timestamp,
}

const MAX_PLACE_LEN: usize = 24;

fn conn_of(ctx: &ReducerContext) -> String {
    ctx.connection_id().map(|c| c.to_string()).unwrap_or_default()
}

fn put(ctx: &ReducerContext, row: Pulse) {
    if ctx.db.pulse().who().find(row.who.clone()).is_some() {
        ctx.db.pulse().who().update(row);
    } else {
        ctx.db.pulse().insert(row);
    }
}

/// Check in. Called on arrival, on coming back to the tab, and on a timer.
#[spacetimedb::reducer]
pub fn beat(ctx: &ReducerContext, who: String, place: String) {
    if !crate::is_one_of_us(&who) {
        return;
    }
    let place: String = place.chars().take(MAX_PLACE_LEN).collect();
    put(
        ctx,
        Pulse {
            who,
            active: true,
            place,
            conn: conn_of(ctx),
            at: ctx.timestamp,
        },
    );
}

/// Step away: the tab was hidden or the page is closing.
#[spacetimedb::reducer]
pub fn rest(ctx: &ReducerContext, who: String) {
    let Some(row) = ctx.db.pulse().who().find(who) else {
        return;
    };
    if !row.active {
        return;
    }
    // If another of their devices has checked in since, they are still here.
    let me = conn_of(ctx);
    if !me.is_empty() && !row.conn.is_empty() && row.conn != me {
        return;
    }
    ctx.db.pulse().who().update(Pulse {
        active: false,
        at: ctx.timestamp,
        ..row
    });
}

/// The socket closed. Whoever was checked in on it has gone.
///
/// `at` is left alone on purpose. A socket can take a while to be noticed as
/// dead, and the last check-in is a truer "last here" than the moment the
/// server finally gave up on it.
pub fn drop_connection(ctx: &ReducerContext) {
    let me = conn_of(ctx);
    if me.is_empty() {
        return;
    }
    let rows: Vec<Pulse> = ctx
        .db
        .pulse()
        .iter()
        .filter(|p| p.active && p.conn == me)
        .collect();
    for row in rows {
        ctx.db.pulse().who().update(Pulse {
            active: false,
            ..row
        });
    }
}
