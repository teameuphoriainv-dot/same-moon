# Same Moon

A nightly call streak for two people who live apart. Every night you call, one more moon.

Same Moon started as something I built for one couple: us. We have marked more than sixty
nights in a row with it. This repository is the version anyone can run for themselves.

## What it does

- **A sky you share.** A pixel-art night sky with the real phase of tonight's moon. Two houses
  sit on the horizon, one for each of you. A window lights up while that person has the app
  open, and a string of lights hangs between the houses when you are both there at once.
- **The streak.** Mark a night after you call. A missed night can be bridged with a "clouded"
  night now and then, so one bad evening does not erase two months.
- **Calls that never touch a server.** Video calls are peer to peer over WebRTC. The database
  only carries the handshake, so audio and video go straight from one phone to the other.
- **A storybook.** Add a page with a note, a photo, or a drawing you made together. Arrange it
  like a scrapbook, then seal it with a kiss. A sealed page can never be changed again, by
  anyone, on purpose.
- **Games for the call.** Tic-tac-toe, four in a row and pairs are refereed by the server, so
  nobody can cheat by editing their phone. Four card decks give you something to talk about.
- **Same Moon Plus.** One subscription covers both of you and adds photos to the storybook.
  Photos are the one feature that costs real money to store, so they are what Plus pays for.

## How it is built

| Piece | What it is |
| --- | --- |
| App | Next.js 15 and React 19, TypeScript, no UI framework. Every sprite is ASCII art rendered on an integer grid. |
| Backend | [SpacetimeDB](https://spacetimedb.com). The Rust module in `spacetime/` holds every rule: who can answer a ring, when a game round is scored, that a sealed page stays sealed. Both phones keep a live subscription, so a change on one shows up on the other in about half a second. |
| Calls | WebRTC, peer to peer. SpacetimeDB carries only the offer, answer and ICE candidates. Whoever rang is always the offerer, which is what stops two phones from both offering. |
| Photos | Shrunk on the phone, then stored in Vercel Blob through `/api/photos`. |
| iPhone app | A Capacitor shell in `ios/` that loads the app and adds the native RevenueCat SDK. |
| Purchases | RevenueCat. The entitlement is `plus`. See [Purchases](#purchases). |

Inside the database the two people are always `Moon` and `Star`. Their real names live in one
`couple` row, so renaming somebody never touches a night, a message or a page.

## Run it

You need Node 20+, the [SpacetimeDB CLI](https://spacetimedb.com/install) 2.4.x and Rust.

```bash
npm install

# 1. A database. Locally:
spacetime start --listen-addr 127.0.0.1:3055 --in-memory &
spacetime server add local-sm --url http://127.0.0.1:3055 --no-fingerprint
cd spacetime && spacetime publish -y --server local-sm same-moon-dev && cd ..

# 2. Settings
cp .env.example .env.local    # then fill it in

# 3. The app
npm run dev                    # http://localhost:8931
```

The first person to get through the door names the two of you. After that, each phone picks
which one it is.

To deploy, publish the module to SpacetimeDB Maincloud under a name nobody can guess, deploy
the app to Vercel with the same settings as `.env.example`, and add a Vercel Blob store for
photos.

If you change the module, regenerate the client bindings:

```bash
spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetime
```

## The iPhone app

The iOS app is a Capacitor shell around the same app, plus the native RevenueCat SDK. It
loads the hosted app from `CAP_SERVER_URL`, because the Next API routes rule out a fully
static bundle for now.

```bash
CAP_SERVER_URL=https://your-deployment.vercel.app npx cap sync ios
npx cap open ios   # choose your signing team in Xcode, then run on a phone
```

Video calls need a real phone. The simulator has no camera.

## Purchases

RevenueCat powers one subscription, **Same Moon Plus**, with the entitlement `plus`.

1. The buyer taps Subscribe in the storybook. The native RevenueCat SDK runs the purchase
   (`src/lib/purchases.ts`, `src/components/PlusSheet.tsx`).
2. When RevenueCat reports the `plus` entitlement as active, the app calls the `unlock_plus`
   reducer, which turns Plus on in the shared `plus` row.
3. Both phones are subscribed to that row, so the partner gets photos at the same moment,
   without buying anything or signing in to anything.

For the demo build the key is a RevenueCat Test Store key, so no money moves. In production,
step 2 belongs on the server: a RevenueCat webhook would set the row, so a modified client
could not grant itself Plus.

## Privacy, honestly

- **The door word is one shared word, not an account system.** It is checked on the server
  (`SAME_MOON_DOOR`) and never ships in the app's code, but anyone who learns it can get in.
- **The tables are public.** SpacetimeDB tables marked `public` can be read by anyone who
  knows the database name, so that name is effectively a password. Pick one nobody can guess
  and keep it out of git.
- **Photos are as private as the messages, no more.** Each address is impossible to guess, but
  it is stored in a table.
- Real accounts, with each couple scoped to their own rows, are the next thing to build.

## Tests

```bash
npm run typecheck
npm test                  # unit tests: dates, streaks, decks, sprites, layouts
bash tests/module.sh      # every reducer against a real local SpacetimeDB
```

`tests/module.sh` and `tests/browser/` explain their own setup at the top of each file. The
browser runs drive two real browsers at once, including a real WebRTC call and a real photo
upload. Never point either at a database you care about.

## License

MIT. See [LICENSE](LICENSE).
