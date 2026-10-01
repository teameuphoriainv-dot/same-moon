#!/bin/bash
#
# Exercises every reducer against a real SpacetimeDB instance.
#
# The reducers hold the rules that matter (what a late tap does, who is allowed
# to answer a ring, when a round is scored) and none of that is reachable from
# a typecheck. This drives the actual module, so it catches the logic.
#
#   spacetime start --listen-addr 127.0.0.1:3055 --in-memory &
#   spacetime server add smtest --url http://127.0.0.1:3055
#   cd spacetime && spacetime publish -y --server smtest samemoon-verify
#   bash tests/module.sh
#
# Never point this at maincloud: it calls clear_thread and hang_up.
#
# Note: aggregates need a column alias here, so it is COUNT(*) as n throughout.
M=${M:-samemoon-verify}
PASS=0; FAIL=0
q(){ spacetime sql --server smtest "$M" "$1" 2>/dev/null | grep -vE "WARNING|new version|Run .spac|^$"; }
c(){ out=$(spacetime call --server smtest "$M" "$@" 2>&1); if echo "$out" | grep -q "^Error:"; then echo "  CALL FAILED: $*"; echo "$out" | grep "^Error:" | head -1; fi; }
want(){ # want <description> <expected> <actual>
  if [ "$2" == "$3" ]; then PASS=$((PASS+1)); echo "  ok   $1"; else FAIL=$((FAIL+1)); echo "  FAIL $1 (expected '$2', got '$3')"; fi; }
val(){ q "$1" | sed -n '3p' | tr -d ' '; }

echo "########## MESSAGES ##########"
c clear_thread
c send_message '"hey you"' '"Star"'
c send_message '"hi back"' '"Moon"'
c send_message '"   "' '"Star"'
want "blank message rejected" "2" "$(val 'SELECT COUNT(*) as n FROM message')"

ID=$(q "SELECT id FROM message" | sed -n '3p' | tr -d ' ')
c edit_message "$ID" '"edited now"'
want "edit sets the edited flag" "true" "$(val "SELECT edited FROM message WHERE id = $ID")"
c delete_message "$ID"
want "delete removes the row" "1" "$(val 'SELECT COUNT(*) as n FROM message')"

echo "-- read markers are monotonic --"
c mark_read '"Moon"' 5
c mark_read '"Moon"' 2
want "older marker ignored" "5" "$(val 'SELECT last_seen FROM read_marker')"

echo "-- typing --"
c set_typing '"Star"' true
T1=$(val 'SELECT at FROM presence')
sleep 1
c set_typing '"Star"' true
T2=$(val 'SELECT at FROM presence')
[ "$T1" != "$T2" ] && { PASS=$((PASS+1)); echo "  ok   repeat start refreshes the timestamp"; } || { FAIL=$((FAIL+1)); echo "  FAIL repeat start did not refresh"; }
c send_message '"done"' '"Star"'
want "sending clears the typing flag" "false" "$(val "SELECT typing FROM presence WHERE who = 'Star'")"

echo "-- clear_thread wipes markers too --"
c clear_thread
want "messages gone" "0" "$(val 'SELECT COUNT(*) as n FROM message')"
want "read markers gone" "0" "$(val 'SELECT COUNT(*) as n FROM read_marker')"

echo ""
echo "########## CALLS ##########"
c hang_up
c ring '"Star"'
want "ringing" "\"ringing\"" "$(val 'SELECT status FROM call')"
want "caller recorded" "\"Star\"" "$(val 'SELECT caller FROM call')"
c accept_call '"Star"'
want "caller cannot answer their own ring" "\"ringing\"" "$(val 'SELECT status FROM call')"
c accept_call '"Moon"'
want "the other one can" "\"live\"" "$(val 'SELECT status FROM call')"

c send_signal '"Star"' '"offer"' '"{\"sdp\":\"x\"}"'
c send_signal '"Moon"' '"answer"' '"{\"sdp\":\"y\"}"'
c send_signal '"Star"' '"nonsense"' '"{}"'
want "unknown signal kind rejected" "2" "$(val 'SELECT COUNT(*) as n FROM signal')"
c hang_up
want "hang up clears signals" "0" "$(val 'SELECT COUNT(*) as n FROM signal')"
want "hang up goes idle" "\"idle\"" "$(val 'SELECT status FROM call')"

echo "-- both reach for the phone at once --"
c ring '"Moon"'
c ring '"Star"'
want "simultaneous ring connects" "\"live\"" "$(val 'SELECT status FROM call')"
want "first caller keeps the offer role" "\"Moon\"" "$(val 'SELECT caller FROM call')"
c hang_up

echo ""
echo "########## GAMES ##########"
c start_game '"wyr"' '"Would you rather: A, or B?"' '"[\"A\",\"B\"]"' '""'
want "round starts at 1" "1" "$(val 'SELECT round FROM game')"
want "phase is answering" "\"answering\"" "$(val 'SELECT phase FROM game')"

c submit_answer 1 '"Star"' '"A"'
want "one answer does not reveal" "\"answering\"" "$(val 'SELECT phase FROM game')"
c submit_answer 1 '"Moon"' '"A"'
want "second answer reveals" "\"revealed\"" "$(val 'SELECT phase FROM game')"
want "a match is scored" "1" "$(val "SELECT matches FROM game_score WHERE who = 'Star'")"

c submit_answer 1 '"Star"' '"B"'
want "no answering after reveal" "1" "$(val "SELECT matches FROM game_score WHERE who = 'Star'")"

c next_round '"Would you rather: C, or D?"' '"[\"C\",\"D\"]"' '""'
want "next round bumps the counter" "2" "$(val 'SELECT round FROM game')"
want "old answers cleared" "0" "$(val 'SELECT COUNT(*) as n FROM game_answer')"
c submit_answer 1 '"Star"' '"C"'
want "a late tap on the old round is ignored" "0" "$(val 'SELECT COUNT(*) as n FROM game_answer')"

c submit_answer 2 '"Star"' '"C"'
c submit_answer 2 '"Moon"' '"D"'
want "a mismatch still counts a round" "2" "$(val "SELECT rounds FROM game_score WHERE who = 'Star'")"
want "but not a match" "1" "$(val "SELECT matches FROM game_score WHERE who = 'Star'")"

echo "-- open ended decks are not scored --"
c start_game '"ama"' '"What is something you never said?"' '""' '""'
want "starting a game resets the tally" "0" "$(val 'SELECT COUNT(*) as n FROM game_score')"
c submit_answer 1 '"Star"' '"a thing"'
c submit_answer 1 '"Moon"' '"a thing"'
want "revealed" "\"revealed\"" "$(val 'SELECT phase FROM game')"
want "no score for an open deck" "0" "$(val 'SELECT COUNT(*) as n FROM game_score')"

echo "-- reveal without waiting --"
c next_round '"Another question?"' '""' '""'
c submit_answer 2 '"Star"' '"only me"'
c reveal_round
want "reveal works with one answer in" "\"revealed\"" "$(val 'SELECT phase FROM game')"

c end_game
want "ending clears the game" "\"\"" "$(val 'SELECT kind FROM game')"
want "ending clears answers" "0" "$(val 'SELECT COUNT(*) as n FROM game_answer')"

echo ""
echo "########## WHO IS HERE ##########"
# The CLI hangs up the moment a call returns, so every check-in made from here
# is followed at once by its own socket closing. That makes the closing half
# testable from a script. The "still here" half needs a socket that stays open,
# which is covered by the browser run in tests/browser/scene.mjs.
c beat '"Moon"' '"home"'
want "a check-in is recorded" "\"home\"" "$(val "SELECT place FROM pulse WHERE who = 'Moon'")"
want "the socket closing marks them gone" "false" "$(val "SELECT active FROM pulse WHERE who = 'Moon'")"
T1=$(val "SELECT at FROM pulse WHERE who = 'Moon'")
sleep 1
c beat '"Moon"' '"book"'
T2=$(val "SELECT at FROM pulse WHERE who = 'Moon'")
[ "$T1" != "$T2" ] && { PASS=$((PASS+1)); echo "  ok   a later check-in moves the time"; } || { FAIL=$((FAIL+1)); echo "  FAIL a later check-in did not move the time"; }
want "and says where they are" "\"book\"" "$(val "SELECT place FROM pulse WHERE who = 'Moon'")"
c beat '"Somebody"' '"home"'
want "a stranger is not recorded" "0" "$(val "SELECT COUNT(*) as n FROM pulse WHERE who = 'Somebody'")"
c rest '"Moon"'
want "stepping away twice changes nothing" "$T2" "$(val "SELECT at FROM pulse WHERE who = 'Moon'")"

echo ""
echo "########## STORYBOOK ##########"
pages(){ val 'SELECT COUNT(*) as n FROM scrap'; }
for id in $(q "SELECT id FROM scrap" | sed -n '3,$p' | tr -d ' '); do c remove_scrap "$id"; done
want "the book starts empty" "0" "$(pages)"

URL='"https://abc.public.blob.vercel-storage.com/book/lake.jpg"'
c add_scrap '"photo"' "$URL" '"data:image/jpeg;base64,AAAA"' '""' '"  the lake  "' '"2026-08-01"' '"stars"' 1600 1200 '"Moon"'
want "a photo page is added" "1" "$(pages)"
want "the caption is trimmed" "\"thelake\"" "$(val 'SELECT caption FROM scrap')"
want "the size is kept" "1600" "$(val 'SELECT w FROM scrap')"
PHOTO=$(val 'SELECT id FROM scrap')

c add_scrap '"photo"' '"http://plain.example/a.jpg"' '""' '""' '"x"' '"2026-08-01"' '"stars"' 1 1 '"Moon"'
want "a photo that is not https is refused" "1" "$(pages)"
c add_scrap '"photo"' '""' '""' '""' '"x"' '"2026-08-01"' '"stars"' 1 1 '"Moon"'
want "a photo with no address is refused" "1" "$(pages)"
c add_scrap '"photo"' "$URL" '""' '""' '"x"' '"2026-13-40"' '"stars"' 1 1 '"Moon"'
want "a day that is not a day is refused" "1" "$(pages)"
c add_scrap '"photo"' "$URL" '""' '""' '"x"' '"yesterday"' '"stars"' 1 1 '"Moon"'
want "a day in words is refused" "1" "$(pages)"
c add_scrap '"photo"' "$URL" '""' '""' '"x"' '"2026-08-01"' '"stars"' 1 1 '"Somebody"'
want "a stranger cannot add a page" "1" "$(pages)"
c add_scrap '"zine"' "$URL" '""' '""' '"x"' '"2026-08-01"' '"stars"' 1 1 '"Moon"'
want "an unknown kind of page is refused" "1" "$(pages)"

c add_scrap '"photo"' "$URL" '"javascript:alert(1)"' '""' '"x"' '"2026-08-02"' '"stars"' 1 1 '"Star"'
want "a thumbnail that is not an image is dropped" "\"\"" "$(val "SELECT thumb FROM scrap WHERE day = '2026-08-02'")"
want "but the page is still added" "2" "$(pages)"

c add_scrap '"note"' '""' '""' '""' '"   "' '"2026-08-03"' '"hearts"' 0 0 '"Star"'
want "an empty note is refused" "2" "$(pages)"
c add_scrap '"note"' '"https://ignored.example/x.jpg"' '""' '""' '"a note"' '"2026-08-03"' '"hearts"' 0 0 '"Star"'
want "a note is added" "3" "$(pages)"
want "and carries no picture" "\"\"" "$(val "SELECT url FROM scrap WHERE kind = 'note'")"

BLANK=$(printf '.%.0s' $(seq 1 1024))
DRAWN="k${BLANK:1}"
c add_scrap '"doodle"' '""' '""' "\"$BLANK\"" '"x"' '"2026-08-04"' '"moons"' 0 0 '"Moon"'
want "an empty drawing is refused" "3" "$(pages)"
c add_scrap '"doodle"' '""' '""' "\"${DRAWN:0:1000}\"" '"x"' '"2026-08-04"' '"moons"' 0 0 '"Moon"'
want "a drawing that is not square is refused" "3" "$(pages)"
c add_scrap '"doodle"' '""' '""' "\"K${BLANK:1}\"" '"x"' '"2026-08-04"' '"moons"' 0 0 '"Moon"'
want "a drawing with a colour that does not exist is refused" "3" "$(pages)"
c add_scrap '"doodle"' '""' '""' "\"$DRAWN\"" '""' '"2026-08-04"' '"moons"' 0 0 '"Moon"'
want "a drawing is added" "4" "$(pages)"

c edit_scrap "$PHOTO" '"the lake, at dusk"' '"2026-08-05"' '"hearts"'
want "editing changes the day" "\"2026-08-05\"" "$(val "SELECT day FROM scrap WHERE id = $PHOTO")"
want "and the stickers" "\"hearts\"" "$(val "SELECT charm FROM scrap WHERE id = $PHOTO")"
want "and leaves the picture alone" "$(echo $URL | tr -d ' ')" "$(val "SELECT url FROM scrap WHERE id = $PHOTO")"
c edit_scrap "$PHOTO" '"x"' '"soon"' '"hearts"'
want "an edit with a bad day is refused" "\"2026-08-05\"" "$(val "SELECT day FROM scrap WHERE id = $PHOTO")"
NOTE=$(val "SELECT id FROM scrap WHERE kind = 'note'")
c edit_scrap "$NOTE" '"  "' '"2026-08-03"' '"hearts"'
want "a note cannot be edited down to nothing" "\"anote\"" "$(val "SELECT caption FROM scrap WHERE id = $NOTE")"
c remove_scrap "$PHOTO"
want "removing a page takes it out" "3" "$(pages)"
c remove_scrap 999999
want "removing a page that is not there is harmless" "3" "$(pages)"

echo "-- arranging and sealing --"
layouts(){ val 'SELECT COUNT(*) as n FROM scrap_layout'; }
DOODLE=$(val "SELECT id FROM scrap WHERE kind = 'doodle'")
c set_layout "$DOODLE" '"{\"v\":1,\"items\":[]}"'
want "arranging a page makes its side row" "1" "$(layouts)"
want "and keeps the arrangement" "\"{\"v\":1,\"items\":[]}\"" "$(val "SELECT layout FROM scrap_layout WHERE scrap_id = $DOODLE")"
c set_layout "$DOODLE" '"[1,2,3]"'
want "an arrangement that is not an object is refused" "\"{\"v\":1,\"items\":[]}\"" "$(val "SELECT layout FROM scrap_layout WHERE scrap_id = $DOODLE")"
BIG=$(printf 'x%.0s' $(seq 1 7000))
c set_layout "$DOODLE" "\"{$BIG}\""
want "an oversized arrangement is refused" "\"{\"v\":1,\"items\":[]}\"" "$(val "SELECT layout FROM scrap_layout WHERE scrap_id = $DOODLE")"
c set_layout 999999 '"{}"'
want "arranging a page that is not there does nothing" "1" "$(layouts)"

c seal_scrap "$DOODLE" '"Somebody"'
want "a stranger cannot seal a page" "\"\"" "$(val "SELECT sealed_by FROM scrap_layout WHERE scrap_id = $DOODLE")"
c seal_scrap "$DOODLE" '"Moon"'
want "a kiss seals the page" "\"Moon\"" "$(val "SELECT sealed_by FROM scrap_layout WHERE scrap_id = $DOODLE")"
c seal_scrap "$DOODLE" '"Star"'
want "a second kiss does not change who sealed it" "\"Moon\"" "$(val "SELECT sealed_by FROM scrap_layout WHERE scrap_id = $DOODLE")"
c set_layout "$DOODLE" '"{\"v\":1,\"items\":[{\"id\":\"a\"}]}"'
want "a sealed page cannot be rearranged" "\"{\"v\":1,\"items\":[]}\"" "$(val "SELECT layout FROM scrap_layout WHERE scrap_id = $DOODLE")"
c edit_scrap "$DOODLE" '"changed"' '"2026-08-04"' '"stars"'
want "a sealed page cannot be edited" "\"\"" "$(val "SELECT caption FROM scrap WHERE id = $DOODLE")"
c remove_scrap "$DOODLE"
want "a sealed page cannot be removed" "3" "$(pages)"
want "and its seal stays" "1" "$(layouts)"

c seal_scrap "$NOTE" '"Star"'
want "sealing a page that was never arranged works too" "\"Star\"" "$(val "SELECT sealed_by FROM scrap_layout WHERE scrap_id = $NOTE")"
want "with an empty arrangement" "\"\"" "$(val "SELECT layout FROM scrap_layout WHERE scrap_id = $NOTE")"
c add_scrap '"note"' '""' '""' '""' '"loose"' '"2026-08-06"' '"hearts"' 0 0 '"Star"'
LOOSE=$(val "SELECT id FROM scrap WHERE caption = 'loose'")
c set_layout "$LOOSE" '"{}"'
c remove_scrap "$LOOSE"
want "removing an open page takes its arrangement with it" "2" "$(layouts)"

echo ""
echo "########## BOARDS: TIC-TAC-TOE ##########"
bare(){ val "$1" | tr -d '"'; }
c board_end
c board_start '"chess"' '"Star"'
want "an unknown game does not start" "\"\"" "$(val 'SELECT kind FROM board')"
c board_start '"ttt"' '"Somebody"'
want "a stranger cannot start one" "\"\"" "$(val 'SELECT kind FROM board')"

c board_start '"ttt"' '"Star"'
R=$(val 'SELECT round FROM board')
want "whoever starts goes first" "\"Star\"" "$(val 'SELECT turn FROM board')"
want "the board is empty" "........." "$(bare 'SELECT cells FROM board')"
c board_move "$R" '"Moon"' 0
want "moving out of turn is refused" "........." "$(bare 'SELECT cells FROM board')"
c board_move "$R" '"Star"' 4
want "a move lands" "....a...." "$(bare 'SELECT cells FROM board')"
want "and passes the turn" "\"Moon\"" "$(val 'SELECT turn FROM board')"
c board_move "$R" '"Moon"' 4
want "a taken square is refused" "....a...." "$(bare 'SELECT cells FROM board')"
want "and does not cost the turn" "\"Moon\"" "$(val 'SELECT turn FROM board')"
c board_move "$R" '"Moon"' 9
want "a square off the board is refused" "....a...." "$(bare 'SELECT cells FROM board')"
c board_move "$R" '"Moon"' 0
c board_move "$R" '"Star"' 2
c board_move "$R" '"Moon"' 1
want "nobody has won yet" "\"\"" "$(val 'SELECT winner FROM board')"
WINS_BEFORE=$(val "SELECT wins FROM board_tally WHERE key = 'ttt:Star'"); WINS_BEFORE=${WINS_BEFORE:-0}
c board_move "$R" '"Star"' 6
want "three in a row wins" "\"Star\"" "$(val 'SELECT winner FROM board')"
want "the winning squares are named" "2,4,6" "$(bare 'SELECT line FROM board')"
want "the win is added to the running score" "$((WINS_BEFORE+1))" "$(val "SELECT wins FROM board_tally WHERE key = 'ttt:Star'")"
c board_move "$R" '"Moon"' 8
want "no moves after it is over" "bba.a.a.." "$(bare 'SELECT cells FROM board')"

c board_start '"ttt"' '"Star"'
want "a rematch hands the opening move over" "\"Moon\"" "$(val 'SELECT first FROM board')"
want "and is a new round" "$((R+1))" "$(val 'SELECT round FROM board')"
c board_move "$R" '"Moon"' 0
want "a late tap from the last round is ignored" "........." "$(bare 'SELECT cells FROM board')"
R=$((R+1))
for m in Moon:0 Star:1 Moon:2 Star:4 Moon:3 Star:5 Moon:7 Star:6 Moon:8; do
  c board_move "$R" "\"${m%%:*}\"" "${m##*:}"
done
want "a full board with no line is a draw" "\"draw\"" "$(val 'SELECT winner FROM board')"
want "the board filled up as played" "abaabbbaa" "$(bare 'SELECT cells FROM board')"

echo ""
echo "########## BOARDS: FOUR IN A ROW ##########"
play(){ for m in "$@"; do c board_move "$R" "\"${m%%:*}\"" "${m##*:}"; done; }
c board_start '"four"' '"Star"'
R=$(val 'SELECT round FROM board')
want "a different game lets the starter go first" "\"Star\"" "$(val 'SELECT first FROM board')"
play Star:0
CELLS=$(bare 'SELECT cells FROM board')
want "a piece falls to the bottom" "a" "${CELLS:35:1}"
want "and nowhere else" "41" "$(echo -n "$CELLS" | tr -cd '.' | wc -c | tr -d ' ')"
play Moon:0
CELLS=$(bare 'SELECT cells FROM board')
want "the next one stacks on top" "b" "${CELLS:28:1}"
play Star:7
want "a column off the board is refused" "\"Star\"" "$(val 'SELECT turn FROM board')"
play Star:1 Moon:2 Star:1 Moon:2 Star:1
want "three is not four" "\"\"" "$(val 'SELECT winner FROM board')"
play Moon:3 Star:1
want "four stacked up wins" "\"Star\"" "$(val 'SELECT winner FROM board')"
want "the column is named bottom to top" "15,22,29,36" "$(bare 'SELECT line FROM board')"

c board_start '"four"' '"Star"'
R=$(val 'SELECT round FROM board')
play Moon:0 Star:0 Moon:1 Star:1 Moon:2 Star:2 Moon:3
want "four across wins" "\"Moon\"" "$(val 'SELECT winner FROM board')"
want "the row is named" "35,36,37,38" "$(bare 'SELECT line FROM board')"

c board_start '"four"' '"Moon"'
R=$(val 'SELECT round FROM board')
want "the opening move alternates again" "\"Star\"" "$(val 'SELECT first FROM board')"
play Star:0 Moon:1 Star:1 Moon:2 Star:3 Moon:2 Star:2 Moon:3 Star:6 Moon:3
want "no winner before the last piece" "\"\"" "$(val 'SELECT winner FROM board')"
play Star:3
want "four on a diagonal wins" "\"Star\"" "$(val 'SELECT winner FROM board')"
want "the diagonal is named" "17,23,29,35" "$(bare 'SELECT line FROM board')"

c board_start '"four"' '"Star"'
R=$(val 'SELECT round FROM board')
play Moon:0 Star:0 Moon:0 Star:0 Moon:0 Star:0
want "six alternating pieces fill a column" "6" "$(val 'SELECT moves FROM board')"
play Moon:0
want "a full column takes no more" "6" "$(val 'SELECT moves FROM board')"
want "and does not cost the turn" "\"Moon\"" "$(val 'SELECT turn FROM board')"

echo ""
echo "########## BOARDS: PAIRS ##########"
c board_start '"pairs"' '"Star"'
R=$(val 'SELECT round FROM board')
DECK=$(bare 'SELECT deck FROM board_secret')
want "sixteen cards are dealt" "16" "${#DECK}"
want "as eight pairs" "AABBCCDDEEFFGGHH" "$(echo -n "$DECK" | fold -w1 | sort | tr -d '\n')"
want "all of them face down" "................" "$(bare 'SELECT faces FROM board')"
at(){ # at <face> <which of the two>
  local n=0 i
  for ((i=0;i<${#DECK};i++)); do
    if [ "${DECK:$i:1}" == "$1" ]; then n=$((n+1)); [ "$n" -eq "$2" ] && { echo "$i"; return; }; fi
  done; }

play "Star:$(at A 1)"
FACES=$(bare 'SELECT faces FROM board')
want "turning a card shows its face" "A" "${FACES:$(at A 1):1}"
want "and only that one" "15" "$(echo -n "$FACES" | tr -cd '.' | wc -c | tr -d ' ')"
play "Star:$(at A 1)"
want "turning the same card again does nothing" "1" "$(val 'SELECT moves FROM board')"
play "Moon:$(at B 1)"
want "turning a card out of turn is refused" "1" "$(val 'SELECT moves FROM board')"
play "Star:$(at A 2)"
want "a pair scores" "1" "$(val 'SELECT score_first FROM board')"
want "a pair keeps the turn" "\"Star\"" "$(val 'SELECT turn FROM board')"
CELLS=$(bare 'SELECT cells FROM board')
want "the pair is marked as theirs" "aa" "${CELLS:$(at A 1):1}${CELLS:$(at A 2):1}"

play "Star:$(at B 1)" "Star:$(at C 1)"
MV=$(val 'SELECT moves FROM board')
want "a miss leaves both cards up" "$(at B 1),$(at C 1)" "$(bare 'SELECT open FROM board')"
want "and keeps the turn until they go back" "\"Star\"" "$(val 'SELECT turn FROM board')"
play "Star:$(at D 1)"
want "no third card while two are up" "$MV" "$(val 'SELECT moves FROM board')"
c board_settle "$R" "$((MV-1))"
want "settling an older position is ignored" "\"Star\"" "$(val 'SELECT turn FROM board')"
c board_settle "$R" "$MV"
want "settling turns them back" "\"\"" "$(val 'SELECT open FROM board')"
want "hides their faces" "14" "$(echo -n "$(bare 'SELECT faces FROM board')" | tr -cd '.' | wc -c | tr -d ' ')"
want "and passes the turn" "\"Moon\"" "$(val 'SELECT turn FROM board')"
c board_settle "$R" "$MV"
want "settling twice does not pass it back" "\"Moon\"" "$(val 'SELECT turn FROM board')"

play "Moon:$(at B 1)" "Moon:$(at B 2)"
want "the other one can score too" "1" "$(val 'SELECT score_second FROM board')"
play "Moon:$(at C 1)" "Moon:$(at D 1)"
play "Star:$(at C 1)"
want "the next tap turns a missed pair back by itself" "$(at C 1)" "$(bare 'SELECT open FROM board')"
want "and is their move" "\"Star\"" "$(val 'SELECT turn FROM board')"
play "Star:$(at C 2)"
for f in D E F G H; do play "Star:$(at $f 1)" "Star:$(at $f 2)"; done
want "every card is matched" "0" "$(echo -n "$(bare 'SELECT cells FROM board')" | tr -cd '.' | wc -c | tr -d ' ')"
want "the final count is right" "7" "$(val 'SELECT score_first FROM board')"
want "most pairs wins" "\"Star\"" "$(val 'SELECT winner FROM board')"

echo "-- the canvas is a game too --"
c board_start '"doodle"' '"Moon"'
want "opening the canvas puts it on the table" "\"doodle\"" "$(val 'SELECT kind FROM board')"
R=$(val 'SELECT round FROM board')
c board_move "$R" '"Moon"' 0
want "there are no squares to play on it" "0" "$(val 'SELECT moves FROM board')"
want "and nobody wins it" "\"\"" "$(val 'SELECT winner FROM board')"

echo "-- one game at a time --"
c start_game '"wyr"' '"A or B?"' '"[\"A\",\"B\"]"' '""'
want "opening a deck puts the board away" "\"\"" "$(val 'SELECT kind FROM board')"
want "and hides the layout" "\"\"" "$(val 'SELECT deck FROM board_secret')"
c board_start '"ttt"' '"Moon"'
want "opening a board puts the deck away" "\"\"" "$(val 'SELECT kind FROM game')"
c board_end
want "putting the board away clears it" "\"\"" "$(val 'SELECT kind FROM board')"

echo ""
echo "########## DOODLE ##########"
c doodle_clear '"Star"'
SH=$(val 'SELECT sheet FROM doodle')
want "a fresh sheet is bare" "1024" "$(echo -n "$(bare 'SELECT cells FROM doodle')" | tr -cd '.' | wc -c | tr -d ' ')"
c doodle_paint "$SH" '"Star"' '"00k01r0zb"'
CELLS=$(bare 'SELECT cells FROM doodle')
want "a stroke lands where it was drawn" "kr" "${CELLS:0:2}"
want "positions count in base 36" "b" "${CELLS:35:1}"
c doodle_paint "$SH" '"Moon"' '"05g"'
CELLS=$(bare 'SELECT cells FROM doodle')
want "the second painter adds to it" "g" "${CELLS:5:1}"
want "without wiping the first" "kr" "${CELLS:0:2}"
c doodle_paint "$SH" '"Moon"' '"00."'
CELLS=$(bare 'SELECT cells FROM doodle')
want "rubbing out is just painting bare canvas" "." "${CELLS:0:1}"

c doodle_paint "$((SH+5))" '"Star"' '"09k"'
c doodle_paint "$SH" '"Star"' '"09"'
c doodle_paint "$SH" '"Star"' '"09K"'
c doodle_paint "$SH" '"Star"' '"09kzzk"'
c doodle_paint "$SH" '"Star"' '"0!k"'
c doodle_paint "$SH" '"Somebody"' '"09k"'
CELLS=$(bare 'SELECT cells FROM doodle')
want "a wrong sheet, a short record, a bad ink, a spot off the sheet, a bad position and a stranger all miss" "." "${CELLS:9:1}"

c doodle_prompt '"  draw our first date  "'
want "an idea can be set" "\"drawourfirstdate\"" "$(val 'SELECT prompt FROM doodle')"
c doodle_clear '"Moon"'
want "wiping gives a bare sheet" "1024" "$(echo -n "$(bare 'SELECT cells FROM doodle')" | tr -cd '.' | wc -c | tr -d ' ')"
want "and a new sheet number" "$((SH+1))" "$(val 'SELECT sheet FROM doodle')"
c doodle_paint "$SH" '"Star"' '"00k"'
want "a stroke meant for the old sheet is dropped" "1024" "$(echo -n "$(bare 'SELECT cells FROM doodle')" | tr -cd '.' | wc -c | tr -d ' ')"
c doodle_prompt '""'

echo "########## COUPLE + PLUS ##########"
c name_us '"  Mira  "' '"Theo"'
want "names are trimmed and stored" "\"Mira\"" "$(val 'SELECT moon_name FROM couple')"
want "the star is named too" "\"Theo\"" "$(val 'SELECT star_name FROM couple')"
c name_us '""' '"Theo"'
want "an empty name changes nothing" "\"Mira\"" "$(val 'SELECT moon_name FROM couple')"
c name_us '"Mira"' '"TheodoreNightingaleLongname"'
want "a rename keeps one row" "1" "$(val 'SELECT COUNT(*) as n FROM couple')"
want "and a long name is cut to 24 characters" "24" "$(val 'SELECT star_name FROM couple' | tr -d '"' | awk '{print length}')"
c unlock_plus '"Stranger"'
want "a stranger cannot unlock plus" "0" "$(val 'SELECT COUNT(*) as n FROM plus')"
c unlock_plus '"Star"'
want "either of them unlocks it for both" "true" "$(val 'SELECT active FROM plus')"
c unlock_plus '"Moon"'
want "a second purchase keeps one row" "1" "$(val 'SELECT COUNT(*) as n FROM plus')"

echo ""
echo "=================================="
echo "passed: $PASS   failed: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1
