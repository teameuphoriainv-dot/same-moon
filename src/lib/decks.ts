import type { GameKind } from "./types";

/**
 * The prompt decks.
 *
 * These live in the client rather than the database on purpose: whoever draws
 * a card picks the text and publishes it, so both phones read the same words
 * without the module having to carry a few hundred strings. Adding a prompt is
 * a deploy, not a migration.
 *
 * Written for two people who are mostly on a video call, so nothing here asks
 * anyone to be in the same room.
 */

export interface DeckInfo {
  kind: Exclude<GameKind, "">;
  name: string;
  blurb: string;
  /** True when the two of them take turns instead of answering together. */
  turnBased: boolean;
}

export const DECKS: DeckInfo[] = [
  {
    kind: "ama",
    name: "Ask Me Anything",
    blurb: "A question lands. You both answer it. Nothing reveals until both are in.",
    turnBased: false,
  },
  {
    kind: "wyr",
    name: "Would You Rather",
    blurb: "Pick one each, in secret. Find out if you picked the same.",
    turnBased: false,
  },
  {
    kind: "nhie",
    name: "Never Have I Ever",
    blurb: "Have you, or haven't you. Both answers show at once.",
    turnBased: false,
  },
  {
    kind: "tod",
    name: "Truth or Dare",
    blurb: "One of you is up. The other one gets to watch.",
    turnBased: true,
  },
];

export const ANSWER_YES = "I have";
export const ANSWER_NO = "I never have";
export const DID_IT = "Did it";
export const CHICKENED = "Chickened out";

const AMA = [
  "What is something I do that you would miss most if I stopped?",
  "When did you first know this was serious?",
  "What is a small thing about me you noticed early and never mentioned?",
  "What is the version of us five years from now doing on a Tuesday night?",
  "What is something you are scared to want out loud?",
  "What is the best day we have had so far, and what made it that one?",
  "What do you think I get wrong about myself?",
  "What is a thing you wish I asked you about more often?",
  "What is something you have changed your mind about since we met?",
  "Where do you feel most like yourself?",
  "What is the kindest thing anyone has done for you?",
  "What is a fight we had that you think about differently now?",
  "What is something you want to be better at, that has nothing to do with me?",
  "If you could keep one memory of us forever and lose the rest, which one?",
  "What is something you find hard to say and would rather text?",
  "What do you do when you miss me?",
  "What is a habit of mine you have quietly picked up?",
  "What is something you want more of from me?",
  "What is a compliment you got that you still think about?",
  "What were you like at fourteen, honestly?",
  "What is something about your family you want me to understand?",
  "What does a perfect ordinary day look like to you?",
  "What is a part of your life I have not seen yet?",
  "What is the last thing that made you cry?",
  "What is something you are proud of that you never bring up?",
  "What would you want said about you in ten years?",
  "What is a risk you are glad you took?",
  "What is a risk you did not take and still wonder about?",
  "When do you feel closest to me?",
  "When do you feel furthest from me?",
  "What is something I said once that stuck with you?",
  "What is your favourite thing about your own face?",
  "What do you want our first place together to feel like?",
  "What is a tradition you want us to start?",
  "What is something you need when you are upset that you have never asked for?",
  "What is a song that is about us, even though it is not?",
  "What is something you find genuinely attractive that has nothing to do with looks?",
  "What is the most honest thing you can say right now?",
  "What is something you hope never changes about us?",
  "What is a question you wish I would ask you?",
];

const WYR: [string, string][] = [
  ["One long call a week", "Ten short ones a day"],
  ["Always know when I am lying", "Never wonder about it"],
  ["Live somewhere cold together", "Live somewhere hot apart"],
  ["Meet a year earlier", "Meet a year later but never be apart"],
  ["Be the one who plans everything", "Be the one who gets surprised"],
  ["Same city, busy lives", "Far apart, endless time to talk"],
  ["Read my mind for a day", "Have me read yours"],
  ["A tiny flat with a huge window", "A big place with no view"],
  ["Cook together badly", "Order in and talk more"],
  ["Fall asleep on call every night", "Wake up to a long message every morning"],
  ["Travel constantly", "Build one home properly"],
  ["Win every argument", "Never have one"],
  ["A loud family dinner", "A quiet night for two"],
  ["Know exactly when we next see each other", "Have it be a surprise"],
  ["Be told a hard truth now", "Be protected from it a while"],
  ["Dance badly in public", "Sing badly in private"],
  ["Have every photo of us", "Have every voice note"],
  ["A morning person together", "A night person together"],
  ["Spend a year apart then forever together", "Never apart but always a little unsure"],
  ["Be understood instantly", "Be discovered slowly"],
  ["A dog that loves us equally", "A cat that clearly prefers one of us"],
  ["Share every password", "Keep one drawer each"],
  ["Say it first every time", "Hear it first every time"],
  ["Be someone's favourite person", "Be someone's safest place"],
  ["A wedding with everyone", "A wedding with nobody"],
  ["Remember every detail of us", "Get to experience the best day again, new"],
  ["Talk it out at 3am", "Sleep and talk it out at noon"],
  ["Be praised in public", "Be looked after in private"],
  ["Have the same taste in everything", "Argue about music forever"],
  ["Grow old fast together", "Stay young apart"],
];

const NHIE = [
  "Never have I ever re-read our old messages for an hour.",
  "Never have I ever taken a screenshot of something you sent.",
  "Never have I ever stayed on a call after you fell asleep.",
  "Never have I ever practised what I was going to say to you.",
  "Never have I ever checked if you were online.",
  "Never have I ever pretended to be fine when I was not.",
  "Never have I ever told someone about you before I told you.",
  "Never have I ever changed my plans so I could talk to you.",
  "Never have I ever looked at flights I could not book.",
  "Never have I ever kept something small of yours.",
  "Never have I ever been jealous and said nothing.",
  "Never have I ever gone quiet on purpose to see if you noticed.",
  "Never have I ever cried on a call and blamed the wifi.",
  "Never have I ever imagined our future in detail.",
  "Never have I ever been nervous before calling you.",
  "Never have I ever lied about being busy.",
  "Never have I ever fallen asleep mid sentence talking to you.",
  "Never have I ever reread one message twenty times.",
  "Never have I ever told you a dream I had about you.",
  "Never have I ever left a message drafted and never sent it.",
  "Never have I ever been the first to give in after a fight.",
  "Never have I ever wanted to call and talked myself out of it.",
  "Never have I ever counted days.",
  "Never have I ever shown someone a photo of you unprompted.",
  "Never have I ever stayed up way too late because I did not want to hang up.",
  "Never have I ever been proud of you in front of people who do not know you.",
  "Never have I ever missed you at an inconvenient moment.",
  "Never have I ever kept a voice note to listen to later.",
  "Never have I ever apologised without meaning it yet.",
  "Never have I ever known I loved you before I said it.",
];

const TRUTHS = [
  "What is the last thing you thought about me that you did not say?",
  "What is something you want but feel silly asking for?",
  "What is the most attractive thing I have ever done without noticing?",
  "When did you last feel genuinely proud of me?",
  "What is a thing you worry about with us?",
  "What is something you have never told anyone?",
  "What do you think I would be surprised to learn about you?",
  "What is the pettiest thing that annoys you about me?",
  "What is a moment you wish you could go back to?",
  "What is something you have forgiven me for without telling me?",
  "What do you think about right before you fall asleep?",
  "What is a compliment you want to hear more?",
  "What is the hardest thing about being this far apart?",
  "What is something you pretend not to care about but do?",
  "What is the nicest thing you have ever thought about yourself?",
  "What is a thing you want to do together that you have not said out loud?",
  "Who knows you better than I do, and what do they know?",
  "What is something you would change about how we started?",
  "When were you last completely honest with me about something hard?",
  "What is the thing you are most afraid of right now?",
];

const DARES = [
  "Say the first thing you love about me without thinking.",
  "Show me the last photo you took.",
  "Read out your most recent note to yourself.",
  "Do your best impression of me.",
  "Send a message to me right now that you would never send in public.",
  "Show me what is in your fridge.",
  "Sing eight seconds of the song stuck in your head.",
  "Show me the oldest photo on your phone.",
  "Say something in the most serious voice you have.",
  "Let me pick your next meal.",
  "Show me your screen time without editing it.",
  "Describe me to a stranger in one sentence.",
  "Do a lap of the room with the camera and show me everything.",
  "Tell me a secret that is not a big one.",
  "Give me a compliment you have been saving.",
  "Show me the last thing you searched for.",
  "Do the worst dance you can for ten seconds.",
  "Say my name the way you say it when you are annoyed.",
  "Show me the messiest corner of where you are.",
  "Say one thing you want out loud, right now.",
];

export interface Draw {
  prompt: string;
  options: string[];
}

/** Something other than what is already on the table, when there is a choice. */
function pick<T>(items: T[], avoid: (item: T) => boolean): T {
  const fresh = items.filter((item) => !avoid(item));
  const pool = fresh.length > 0 ? fresh : items;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Draw the next card. `previous` is the prompt currently showing, to skip. */
export function draw(kind: GameKind, previous = ""): Draw {
  switch (kind) {
    case "ama":
      return { prompt: pick(AMA, (q) => q === previous), options: [] };
    case "wyr": {
      const [a, b] = pick(WYR, ([x, y]) => `Would you rather: ${x}, or ${y}?` === previous);
      return { prompt: `Would you rather: ${a}, or ${b}?`, options: [a, b] };
    }
    case "nhie":
      return {
        prompt: pick(NHIE, (q) => q === previous),
        options: [ANSWER_YES, ANSWER_NO],
      };
    case "tod": {
      // Truths outnumber dares deliberately; a dare over video wears thin
      // faster than a question does.
      const wantDare = Math.random() < 0.4;
      const pool = wantDare ? DARES : TRUTHS;
      const label = wantDare ? "Dare" : "Truth";
      return {
        prompt: `${label}: ${pick(pool, (q) => `${label}: ${q}` === previous)}`,
        options: [DID_IT, CHICKENED],
      };
    }
    default:
      return { prompt: "", options: [] };
  }
}
