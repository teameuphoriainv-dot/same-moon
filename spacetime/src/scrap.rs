//! The storybook.
//!
//! One row is one page. A page is a photo, a drawing the two of them made on
//! the shared canvas, or a note with nothing but words on it.
//!
//! Photos themselves do not live here. A row carries the address of the full
//! picture and a thumbnail small enough to draw straight from the row, so the
//! book can lay itself out before a single image has been fetched. Keeping the
//! pictures out of the database is what lets the book grow without every visit
//! having to download all of it.

use spacetimedb::{ReducerContext, Table, Timestamp};

#[spacetimedb::table(accessor = scrap, public)]
pub struct Scrap {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// "photo", "doodle" or "note".
    pub kind: String,
    /// Where the full photo lives. Empty for the other kinds.
    pub url: String,
    /// A tiny preview as a data URL, drawn while the real one loads.
    pub thumb: String,
    /// For a doodle: the canvas, one ink character per pixel, row by row.
    pub art: String,
    pub caption: String,
    /// The day the memory is from, "YYYY-MM-DD". Pages are read in this order.
    pub day: String,
    /// Which set of stickers decorates the page.
    pub charm: String,
    /// Pixel size of the photo, so the page can hold its shape before it loads.
    pub w: u32,
    pub h: u32,
    pub by: String,
    pub at: Timestamp,
}

/// How a page is arranged, and whether it has been sealed.
///
/// This lives beside `scrap` rather than in it on purpose: adding a column to
/// a table that already exists is a breaking migration here, and a second
/// table is not. Keeping it separate means the module can always be published
/// additively, whichever build went out first.
#[spacetimedb::table(accessor = scrap_layout, public)]
pub struct ScrapLayout {
    #[primary_key]
    pub scrap_id: u64,
    /// Where everything sits on the page: stickers, tape, scraps of text and
    /// the picture itself. Written by the client as JSON, and bounded here so
    /// one runaway phone cannot bloat a row. Empty means the page has never
    /// been arranged, and the client lays it out on its own.
    pub layout: String,
    /// Who sealed the page with a kiss. Empty while it is still open. A sealed
    /// page can never be changed, rearranged or removed again, and every
    /// reducer in this file holds to that.
    pub sealed_by: String,
    pub sealed_at: Option<Timestamp>,
}

const MAX_CAPTION_LEN: usize = 600;
const MAX_URL_LEN: usize = 600;
const MAX_THUMB_LEN: usize = 16 * 1024;
const MAX_ART_LEN: usize = 64 * 64;
const MAX_CHARM_LEN: usize = 24;
const MAX_LAYOUT_LEN: usize = 6 * 1024;
/// Far more than they will ever add. It only exists so a runaway loop on one
/// phone cannot fill the table.
const MAX_PAGES: usize = 5000;

fn is_day_key(s: &str) -> bool {
    let b = s.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return false;
    }
    let digits = |r: std::ops::Range<usize>| b[r].iter().all(|c| c.is_ascii_digit());
    if !digits(0..4) || !digits(5..7) || !digits(8..10) {
        return false;
    }
    let month = (b[5] - b'0') * 10 + (b[6] - b'0');
    let day = (b[8] - b'0') * 10 + (b[9] - b'0');
    (1..=12).contains(&month) && (1..=31).contains(&day)
}

fn clamp(value: &str, max: usize) -> String {
    value.trim().chars().take(max).collect()
}

fn is_square(n: usize) -> bool {
    let root = (n as f64).sqrt().round() as usize;
    root * root == n
}

/// Add a page.
#[spacetimedb::reducer]
pub fn add_scrap(
    ctx: &ReducerContext,
    kind: String,
    url: String,
    thumb: String,
    art: String,
    caption: String,
    day: String,
    charm: String,
    w: u32,
    h: u32,
    by: String,
) {
    if !crate::is_one_of_us(&by) {
        log::warn!("add_scrap rejected: unknown author");
        return;
    }
    if !is_day_key(&day) {
        log::warn!("add_scrap rejected: bad day {day}");
        return;
    }
    if ctx.db.scrap().iter().count() >= MAX_PAGES {
        log::warn!("add_scrap rejected: the book is full");
        return;
    }
    let caption = clamp(&caption, MAX_CAPTION_LEN);

    let (url, thumb, art) = match kind.as_str() {
        "photo" => {
            if !url.starts_with("https://") || url.len() > MAX_URL_LEN {
                log::warn!("add_scrap rejected: bad photo address");
                return;
            }
            let thumb = if thumb.starts_with("data:image/") && thumb.len() <= MAX_THUMB_LEN {
                thumb
            } else {
                String::new()
            };
            (url, thumb, String::new())
        }
        "doodle" => {
            let drawn = art.chars().any(|c| c != '.');
            if art.is_empty()
                || art.len() > MAX_ART_LEN
                || !is_square(art.len())
                || !art.chars().all(crate::doodle::is_ink)
                || !drawn
            {
                log::warn!("add_scrap rejected: bad drawing");
                return;
            }
            (String::new(), String::new(), art)
        }
        "note" => {
            if caption.is_empty() {
                return;
            }
            (String::new(), String::new(), String::new())
        }
        _ => {
            log::warn!("add_scrap rejected: unknown kind {kind}");
            return;
        }
    };

    ctx.db.scrap().insert(Scrap {
        id: 0,
        kind,
        url,
        thumb,
        art,
        caption,
        day,
        charm: clamp(&charm, MAX_CHARM_LEN),
        w,
        h,
        by,
        at: ctx.timestamp,
    });
}

fn is_sealed(ctx: &ReducerContext, id: u64) -> bool {
    ctx.db
        .scrap_layout()
        .scrap_id()
        .find(id)
        .map(|s| !s.sealed_by.is_empty())
        .unwrap_or(false)
}

/// Change the words, the day or the stickers on a page. The picture stays.
#[spacetimedb::reducer]
pub fn edit_scrap(ctx: &ReducerContext, id: u64, caption: String, day: String, charm: String) {
    let Some(row) = ctx.db.scrap().id().find(id) else {
        return;
    };
    if is_sealed(ctx, id) {
        log::warn!("edit_scrap rejected: page {id} is sealed");
        return;
    }
    if !is_day_key(&day) {
        return;
    }
    let caption = clamp(&caption, MAX_CAPTION_LEN);
    // A note is nothing but its words, so it cannot be edited down to nothing.
    if row.kind == "note" && caption.is_empty() {
        return;
    }
    ctx.db.scrap().id().update(Scrap {
        caption,
        day,
        charm: clamp(&charm, MAX_CHARM_LEN),
        ..row
    });
}

/// Take a page out. A sealed page stays.
#[spacetimedb::reducer]
pub fn remove_scrap(ctx: &ReducerContext, id: u64) {
    if ctx.db.scrap().id().find(id).is_some() {
        if is_sealed(ctx, id) {
            log::warn!("remove_scrap rejected: page {id} is sealed");
            return;
        }
        ctx.db.scrap().id().delete(id);
        ctx.db.scrap_layout().scrap_id().delete(id);
    }
}

/// The side row for a page, made on first use.
fn layout_row(ctx: &ReducerContext, id: u64) -> ScrapLayout {
    ctx.db.scrap_layout().scrap_id().find(id).unwrap_or(ScrapLayout {
        scrap_id: id,
        layout: String::new(),
        sealed_by: String::new(),
        sealed_at: None,
    })
}

fn save_layout_row(ctx: &ReducerContext, row: ScrapLayout) {
    if ctx.db.scrap_layout().scrap_id().find(row.scrap_id).is_some() {
        ctx.db.scrap_layout().scrap_id().update(row);
    } else {
        ctx.db.scrap_layout().insert(row);
    }
}

/// Move things around on a page. The layout is the client's JSON; all that is
/// checked here is that it is a JSON object of a sane size, and that nobody is
/// rearranging a page that has been sealed.
#[spacetimedb::reducer]
pub fn set_layout(ctx: &ReducerContext, id: u64, layout: String) {
    if ctx.db.scrap().id().find(id).is_none() {
        return;
    }
    if is_sealed(ctx, id) {
        log::warn!("set_layout rejected: page {id} is sealed");
        return;
    }
    let layout = layout.trim().to_string();
    if !layout.is_empty() && (!layout.starts_with('{') || !layout.ends_with('}')) {
        log::warn!("set_layout rejected: not an object");
        return;
    }
    if layout.len() > MAX_LAYOUT_LEN {
        log::warn!("set_layout rejected: too big");
        return;
    }
    let row = layout_row(ctx, id);
    save_layout_row(ctx, ScrapLayout { layout, ..row });
}

/// Seal a page with a kiss. From here on nothing about it can change, and there
/// is deliberately no reducer that undoes it.
#[spacetimedb::reducer]
pub fn seal_scrap(ctx: &ReducerContext, id: u64, by: String) {
    if !crate::is_one_of_us(&by) {
        log::warn!("seal_scrap rejected: unknown kisser");
        return;
    }
    if ctx.db.scrap().id().find(id).is_none() {
        return;
    }
    if is_sealed(ctx, id) {
        return;
    }
    let row = layout_row(ctx, id);
    save_layout_row(ctx, ScrapLayout {
        sealed_by: by,
        sealed_at: Some(ctx.timestamp),
        ..row
    });
}
