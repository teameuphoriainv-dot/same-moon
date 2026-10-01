export type NightKind = "called" | "clouded";

/** One logged night. `day` is a local calendar key, "YYYY-MM-DD". */
export interface Night {
  day: string;
  kind: NightKind;
  note?: string;
  photo?: string;
  by?: string;
  at?: string;
}

/** One entry in their inside-joke library. */
export interface Joke {
  id: number;
  text: string;
  by?: string;
}

export interface Book {
  /** The night they started counting, "YYYY-MM-DD". */
  startedOn: string;
  nights: Record<string, Night>;
  jokes: Joke[];
}

export interface Stats {
  current: number;
  longest: number;
  totalCalled: number;
  cloudedUsed: number;
  daysSinceStart: number;
  loggedTonight: boolean;
  /** True when yesterday carries the streak but tonight is still open. */
  pendingTonight: boolean;
}

export const EMPTY_BOOK: Book = { startedOn: "", nights: {}, jokes: [] };

// --- messages ---------------------------------------------------------------

/** A message exactly as it sits in the database. */
export interface Message {
  id: number;
  body: string;
  by: string;
  /** Milliseconds since the epoch. */
  at: number;
  edited: boolean;
}

/**
 * A message as the thread draws it.
 *
 * `pending` is one this device has sent but the server has not echoed back
 * yet. It is shown straight away, greyed, so typing never feels like it went
 * into a hole while a round trip finishes.
 */
export interface ThreadMessage extends Message {
  mine: boolean;
  pending: boolean;
}

/**
 * The three slices of the thread, kept apart on purpose.
 *
 * They used to live in one object that was rebuilt whenever any of them
 * changed, so a typing ping every couple of seconds re-created every message
 * and re-rendered the whole thread. Splitting them means a typing flag only
 * moves the typing flag.
 */
export interface ThreadSlices {
  messages: Message[];
  /** Name to the id of the last message they have read. */
  readBy: Record<string, number>;
  /** Name to whether they are typing right now. */
  typing: Record<string, boolean>;
}

export const EMPTY_THREAD: ThreadSlices = { messages: [], readBy: {}, typing: {} };

// --- calls ------------------------------------------------------------------

export type CallStatus = "idle" | "ringing" | "live";

export interface CallState {
  status: CallStatus;
  /** Who started it. The caller is the side that makes the WebRTC offer. */
  caller: string;
  /** Server time the status last changed, in milliseconds. */
  at: number;
}

export const IDLE_CALL: CallState = { status: "idle", caller: "", at: 0 };

/** One step of the WebRTC handshake, in transit. */
export interface SignalRow {
  id: number;
  from: string;
  kind: "offer" | "answer" | "ice";
  payload: string;
}

/** How far the peer connection has got, for what the call panel says. */
export type CallPhase =
  | "idle"
  | "ringing"
  | "incoming"
  | "connecting"
  | "live"
  | "failed"
  /** Rang out. Only the one who was calling ever sees this. */
  | "unanswered";

// --- games ------------------------------------------------------------------

/** "" means nobody is playing. */
export type GameKind = "" | "ama" | "wyr" | "nhie" | "tod";

export type GamePhase = "answering" | "revealed";

export interface GameState {
  kind: GameKind;
  round: number;
  prompt: string;
  /** Choices for the pick-one games, empty for the open ones. */
  options: string[];
  phase: GamePhase;
  /** Whose turn, for the games that take turns. "" means both at once. */
  turn: string;
}

export const IDLE_GAME: GameState = {
  kind: "",
  round: 0,
  prompt: "",
  options: [],
  phase: "answering",
  turn: "",
};

export interface GameAnswer {
  who: string;
  round: number;
  answer: string;
}

export interface Score {
  who: string;
  matches: number;
  rounds: number;
}

// --- who is here ------------------------------------------------------------

/** Where on the site somebody is. Sent along with every check-in. */
export type Place = "home" | "messages" | "call" | "games" | "book";

export interface PulseRow {
  who: string;
  active: boolean;
  place: string;
  /** Server time of their last check-in, in milliseconds. */
  at: number;
}

// --- the storybook ----------------------------------------------------------

export type ScrapKind = "photo" | "doodle" | "note";

/** One page of the storybook. */
export interface Scrap {
  id: number;
  kind: ScrapKind;
  /** Address of the full photo. Empty unless `kind` is "photo". */
  url: string;
  /** A tiny preview, as a data URL, drawn while the real photo loads. */
  thumb: string;
  /** For a doodle: one ink character per pixel, row by row. */
  art: string;
  caption: string;
  /** The day the memory is from, "YYYY-MM-DD". */
  day: string;
  /** Which stickers decorate the page. */
  charm: string;
  w: number;
  h: number;
  by: string;
  at: number;
  /** The arrangement, as JSON (see layout.ts). "" until someone moves something. */
  layout: string;
  /** Who sealed the page with a kiss. "" while it is still open. */
  sealedBy: string;
  /** When it was sealed, ms. 0 while open. */
  sealedAt: number;
}

/** What it takes to add a page. */
export interface NewScrap {
  kind: ScrapKind;
  url?: string;
  thumb?: string;
  art?: string;
  caption: string;
  day: string;
  charm: string;
  w?: number;
  h?: number;
}

// --- board games ------------------------------------------------------------

/** "" means no board is out. */
export type BoardKind = "" | "ttt" | "four" | "pairs" | "doodle";

export interface BoardState {
  kind: BoardKind;
  round: number;
  /** One character per square. "." empty, "a" first player, "b" second. */
  cells: string;
  /** Pairs only: the face showing on each card, "." when it is face down. */
  faces: string;
  turn: string;
  first: string;
  second: string;
  /** "" while playing, then a name, or "draw". */
  winner: string;
  /** The winning squares. */
  line: number[];
  moves: number;
  /** Pairs only: cards turned over and not yet matched. */
  open: number[];
  scoreFirst: number;
  scoreSecond: number;
}

export const IDLE_BOARD: BoardState = {
  kind: "",
  round: 0,
  cells: "",
  faces: "",
  turn: "",
  first: "",
  second: "",
  winner: "",
  line: [],
  moves: 0,
  open: [],
  scoreFirst: 0,
  scoreSecond: 0,
};

/** Wins that outlast a match. `who` is a name, or "draw". */
export interface Tally {
  kind: string;
  who: string;
  wins: number;
}

// --- the shared canvas ------------------------------------------------------

export const DOODLE_SIZE = 32;

export interface DoodleState {
  size: number;
  /** `size * size` ink characters, row by row. "." is bare canvas. */
  cells: string;
  /** Goes up every time the sheet is wiped. */
  sheet: number;
  prompt: string;
  by: string;
}

export const BLANK_DOODLE: DoodleState = {
  size: DOODLE_SIZE,
  cells: ".".repeat(DOODLE_SIZE * DOODLE_SIZE),
  sheet: 0,
  prompt: "",
  by: "",
};
