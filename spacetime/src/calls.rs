//! Video calls.
//!
//! SpacetimeDB is not the media path, it is only the introduction. Two tables
//! do the whole job: `call` is the ringer that both phones watch, and `signal`
//! is the mailbox the WebRTC handshake passes through. Once the peer connection
//! is up, audio and video go directly phone to phone and never touch a server.
//!
//! There are exactly two people, so `call` is a single row. No room ids.

use spacetimedb::{ReducerContext, Table, Timestamp};

/// The ringer. Both phones subscribe to this one row, so a call started on one
/// makes the other ring without any polling.
#[spacetimedb::table(accessor = call, public)]
pub struct Call {
    #[primary_key]
    pub id: u32,
    /// "idle", "ringing", or "live".
    pub status: String,
    /// Whoever started it. The caller is the side that makes the WebRTC offer,
    /// which is how the two phones avoid both offering at once.
    pub caller: String,
    pub at: Timestamp,
}

/// One step of the WebRTC handshake in transit: an offer, an answer, or an ICE
/// candidate. Rows are torn down when the call ends, so this table is a
/// mailbox rather than a log.
#[spacetimedb::table(accessor = signal, public)]
pub struct Signal {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// Sender name, so the other side knows to ignore its own echo.
    pub from: String,
    /// "offer", "answer", or "ice".
    pub kind: String,
    /// The SDP or candidate, JSON encoded by the browser.
    pub payload: String,
    pub at: Timestamp,
}

const CALL_ID: u32 = 0;

/// An SDP offer with a few candidates folded in runs a couple of kilobytes.
/// This leaves generous headroom while still bounding a row.
const MAX_PAYLOAD_LEN: usize = 64 * 1024;

pub fn init_call(ctx: &ReducerContext) {
    ctx.db.call().insert(Call {
        id: CALL_ID,
        status: "idle".to_string(),
        caller: String::new(),
        at: ctx.timestamp,
    });
}

fn set_call(ctx: &ReducerContext, status: &str, caller: &str) {
    let row = Call {
        id: CALL_ID,
        status: status.to_string(),
        caller: caller.to_string(),
        at: ctx.timestamp,
    };
    if ctx.db.call().id().find(CALL_ID).is_some() {
        ctx.db.call().id().update(row);
    } else {
        ctx.db.call().insert(row);
    }
}

/// Drop every pending handshake row. Called at both ends of a call so a new one
/// never picks up a stale offer from the last one.
fn clear_signals(ctx: &ReducerContext) {
    let ids: Vec<u64> = ctx.db.signal().iter().map(|s| s.id).collect();
    for id in ids {
        ctx.db.signal().id().delete(id);
    }
}

/// Start ringing.
///
/// If the other one is already ringing us, this is both of them reaching for
/// the phone at the same moment, so it connects instead of clobbering their
/// call. The original caller keeps the caller role and therefore keeps making
/// the offer, which is what stops a double offer.
#[spacetimedb::reducer]
pub fn ring(ctx: &ReducerContext, who: String) {
    if who.is_empty() {
        return;
    }
    let current = ctx.db.call().id().find(CALL_ID);
    match current {
        Some(c) if c.status == "ringing" && c.caller != who => {
            set_call(ctx, "live", &c.caller);
            log::info!("same moon: simultaneous ring, connecting");
        }
        Some(c) if c.status == "live" => {
            log::info!("ring ignored: already live");
        }
        _ => {
            clear_signals(ctx);
            set_call(ctx, "ringing", &who);
        }
    }
}

/// Pick up. Only the side that did not ring can answer.
#[spacetimedb::reducer]
pub fn accept_call(ctx: &ReducerContext, who: String) {
    if let Some(c) = ctx.db.call().id().find(CALL_ID) {
        if c.status == "ringing" && c.caller != who {
            set_call(ctx, "live", &c.caller);
        }
    }
}

/// Hang up, or decline. Either side may do this at any point.
#[spacetimedb::reducer]
pub fn hang_up(ctx: &ReducerContext) {
    clear_signals(ctx);
    set_call(ctx, "idle", "");
}

/// Post one step of the handshake for the other side to pick up.
#[spacetimedb::reducer]
pub fn send_signal(ctx: &ReducerContext, from: String, kind: String, payload: String) {
    if from.is_empty() || payload.is_empty() || payload.len() > MAX_PAYLOAD_LEN {
        log::warn!("send_signal rejected: empty or oversized");
        return;
    }
    if kind != "offer" && kind != "answer" && kind != "ice" {
        log::warn!("send_signal rejected: unknown kind {kind}");
        return;
    }
    ctx.db.signal().insert(Signal {
        id: 0,
        from,
        kind,
        payload,
        at: ctx.timestamp,
    });
}
