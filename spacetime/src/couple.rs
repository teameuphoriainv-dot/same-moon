//! Who the two of them are, and whether they have Plus.
//!
//! Inside the module the two people are always "Moon" and "Star". Those are the
//! keys every other table stores in its `who` and `by` columns. The names they
//! actually go by live here, in one row, so renaming somebody never has to touch
//! a single night, message or page.
//!
//! Plus is one row too. Either of them buying it unlocks it for both, which is
//! the whole point of a subscription for two.

use spacetimedb::{ReducerContext, Table, Timestamp};

#[spacetimedb::table(accessor = couple, public)]
pub struct Couple {
    #[primary_key]
    pub id: u32,
    pub moon_name: String,
    pub star_name: String,
    pub named_at: Timestamp,
}

#[spacetimedb::table(accessor = plus, public)]
pub struct Plus {
    #[primary_key]
    pub id: u32,
    pub active: bool,
    /// "Moon" or "Star", whoever bought it.
    pub by: String,
    pub at: Timestamp,
}

const ROW: u32 = 0;
const MAX_NAME_LEN: usize = 24;

fn clean(name: &str) -> String {
    name.trim().chars().take(MAX_NAME_LEN).collect()
}

/// Name the two of them. Either of them can rename either name later.
#[spacetimedb::reducer]
pub fn name_us(ctx: &ReducerContext, moon_name: String, star_name: String) {
    let moon_name = clean(&moon_name);
    let star_name = clean(&star_name);
    if moon_name.is_empty() || star_name.is_empty() {
        return;
    }
    let row = Couple { id: ROW, moon_name, star_name, named_at: ctx.timestamp };
    if ctx.db.couple().id().find(ROW).is_some() {
        ctx.db.couple().id().update(row);
    } else {
        ctx.db.couple().insert(row);
    }
}

/// Called by the app after RevenueCat confirms the purchase on the buyer's
/// phone. A production build would have a RevenueCat webhook set this from the
/// server instead, so a client could not grant itself Plus.
#[spacetimedb::reducer]
pub fn unlock_plus(ctx: &ReducerContext, by: String) {
    if !crate::is_one_of_us(&by) {
        return;
    }
    let row = Plus { id: ROW, active: true, by, at: ctx.timestamp };
    if ctx.db.plus().id().find(ROW).is_some() {
        ctx.db.plus().id().update(row);
    } else {
        ctx.db.plus().insert(row);
    }
}
