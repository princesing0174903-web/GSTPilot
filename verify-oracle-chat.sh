#!/bin/bash
# Oracle Chat E2E verification script
# Runs dev server in background + issues all agent-browser commands in same cgroup
set +e
cd /home/z/my-project

LOG=/tmp/oracle-e2e.log
: > "$LOG"
exec > >(tee -a "$LOG") 2>&1

echo "=== [$(date +%T)] Starting dev server (turbopack, 1024MB heap) ==="
nohup env NODE_OPTIONS='--max-old-space-size=1024' ./node_modules/.bin/next dev -p 3000 > dev.log 2>&1 < /dev/null &
DEV_PID=$!
echo "Dev server PID: $DEV_PID"

# Wait for ready
READY=0
for i in $(seq 1 60); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ --max-time 3 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "SERVER_READY after ${i}s (HTTP $CODE)"
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" != "1" ]; then
  echo "SERVER_FAILED_TO_START (last code: $CODE)"
  cat dev.log | tail -30
  exit 1
fi

# Pre-warm chat API route so first question doesn't take 30s
curl -s -o /dev/null -w "PREWARM_CHAT_API: %{http_code}\n" -X POST http://localhost:3000/api/oracle-chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}],"conversationId":"prewarm"}' --max-time 5 2>/dev/null
curl -s -o /dev/null -w "PREWARM_CONV_API: %{http_code}\n" http://localhost:3000/api/oracle-chat/conversations --max-time 5 2>/dev/null

# Clear browser console/errors
agent-browser console --clear 2>&1 | tail -1
agent-browser errors --clear 2>&1 | tail -1

# Set desktop viewport
agent-browser set viewport 1440 900 2>&1 | tail -1

echo ""
echo "=== [$(date +%T)] STEP 3: Open Oracle Chat ==="
agent-browser open http://localhost:3000/ 2>&1 | tail -3
agent-browser wait --load networkidle --timeout 30000 2>&1 | tail -2
sleep 2
echo "--- Page title + URL ---"
agent-browser get title 2>&1
agent-browser get url 2>&1
echo ""
echo "--- Snapshot (interactive, compact) ---"
agent-browser snapshot -i -c 2>&1 | head -120

echo ""
echo "=== [$(date +%T)] Verify layout: header text ==="
agent-browser get text "h1" 2>&1 | head -5
echo ""
echo "=== Verify body text contains 'Oracle CFO' ==="
agent-browser eval "document.body.innerText.includes('Oracle') ? 'YES_Oracle_VISIBLE' : 'NOT_FOUND'" 2>&1 | tail -3

# Helper: ask a question, wait for streaming to complete, snapshot, capture sections
ask_question() {
  local Q="$1"
  local LABEL="$2"
  echo ""
  echo "=== [$(date +%T)] QUESTION: $LABEL ==="
  echo "Q: $Q"

  # Find the input box (sticky footer textarea)
  INPUT_REF=$(agent-browser snapshot -i -c 2>&1 | grep -iE "textbox|input.*prompt|chat.*input" | head -1 | grep -oE "@e[0-9]+" | head -1)
  if [ -z "$INPUT_REF" ]; then
    echo "NO_INPUT_REF_FOUND — trying fallback search"
    INPUT_REF=$(agent-browser find first "textarea" 2>&1 | grep -oE "@e[0-9]+" | head -1)
  fi
  echo "Using input ref: $INPUT_REF"

  # Type question
  agent-browser fill "$INPUT_REF" "$Q" 2>&1 | tail -1
  sleep 1
  # Press Enter
  agent-browser press Enter 2>&1 | tail -1

  # Wait for streaming to complete — poll for the "Sources" section (always appears last)
  echo "Waiting for streaming to complete..."
  for i in $(seq 1 90); do  # up to 90s
    sleep 1
    # Look for "Sources" header in the latest oracle message bubble
    RESULT=$(agent-browser eval "
      (function(){
        var msgs = document.querySelectorAll('[data-oracle-message], .oracle-message, article');
        if (!msgs.length) {
          // fallback: check body text
          var t = document.body.innerText;
          if (t.includes('Sources') && t.includes('Confidence')) return 'DONE_BODY';
          return 'WAITING';
        }
        var last = msgs[msgs.length-1];
        var t = last.innerText || '';
        if (t.includes('Sources') && t.includes('Confidence')) return 'DONE_LAST';
        return 'WAITING';
      })()
    " 2>&1 | tail -1)
    if [[ "$RESULT" == "DONE_BODY" || "$RESULT" == "DONE_LAST" ]]; then
      echo "STREAM_COMPLETE after ${i}s ($RESULT)"
      break
    fi
  done

  # Wait an extra 2s for any follow-up chips to render
  sleep 2

  # Capture key info
  echo "--- Last oracle bubble text (truncated 2500 chars) ---"
  agent-browser eval "
    (function(){
      var msgs = document.querySelectorAll('article, [class*=\"oracle\"], [class*=\"message\"]');
      if (!msgs.length) return 'NO_MSGS_FOUND';
      return (msgs[msgs.length-1].innerText || '').slice(0, 2500);
    })()
  " 2>&1 | tail -50

  echo ""
  echo "--- Section presence check ---"
  agent-browser eval "
    (function(){
      var t = document.body.innerText;
      var sections = ['Executive Summary','Analysis','Evidence','Recommended Actions','Confidence','Sources'];
      var out = [];
      sections.forEach(function(s){
        out.push(s + ': ' + (t.includes(s) ? 'YES' : 'NO'));
      });
      return out.join(' | ');
    })()
  " 2>&1 | tail -3

  echo ""
  echo "--- Tools called (from ThinkingTrail) ---"
  agent-browser eval "
    (function(){
      var trail = document.querySelector('[class*=\"thinking\"], [class*=\"tool\"], [data-thinking-trail]');
      if (!trail) return 'NO_THINKING_TRAIL_VISIBLE';
      return (trail.innerText || '').slice(0, 600);
    })()
  " 2>&1 | tail -15

  echo ""
  echo "--- Confidence meter value ---"
  agent-browser eval "
    (function(){
      var t = document.body.innerText;
      var m = t.match(/(\\d{1,3})\\s*%/);
      return m ? 'PERCENT_FOUND: ' + m[1] + '%' : 'NO_PERCENT_FOUND';
    })()
  " 2>&1 | tail -3

  echo ""
  echo "--- Follow-up chips visible? ---"
  agent-browser eval "
    (function(){
      var chips = document.querySelectorAll('[class*=\"chip\"], [class*=\"suggestion\"], [class*=\"follow-up\"], button[class*=\"prompt\"]');
      return 'CHIPS_COUNT: ' + chips.length;
    })()
  " 2>&1 | tail -3
}

# ============ STEP 4: 8 golden-path questions ============
ask_question "How much money am I expecting?" "Q1_receivables"
ask_question "Which customers need follow-up?" "Q2_followups"
ask_question "How much GST will I pay?" "Q3_gst"
ask_question "What is my cash position?" "Q4_cash"
ask_question "Compare June vs July" "Q5_compare"
ask_question "Predict next month GST" "Q6_predict_gst"
ask_question "Which customers may churn?" "Q7_churn"
ask_question "Generate board meeting summary" "Q8_board"

# ============ STEP 5: DB persistence (reload) ============
echo ""
echo "=== [$(date +%T)] STEP 5: DB persistence — capture conversation title BEFORE reload ==="
agent-browser eval "
  (function(){
    // Find conversation list items in sidebar
    var items = document.querySelectorAll('[class*=\"conversation\"] [class*=\"title\"], aside [class*=\"item\"], nav [class*=\"conversation\"]');
    if (!items.length) {
      // fallback: get sidebar text
      var aside = document.querySelector('aside, [class*=\"sidebar\"]');
      return aside ? aside.innerText.slice(0, 800) : 'NO_SIDEBAR_FOUND';
    }
    return Array.from(items).slice(0,5).map(function(e){return e.innerText;}).join(' || ');
  })()
" 2>&1 | tail -10

echo ""
echo "--- Reloading page... ---"
agent-browser open http://localhost:3000/ 2>&1 | tail -2
agent-browser wait --load networkidle --timeout 30000 2>&1 | tail -2
sleep 3

echo "--- After reload: conversation still in sidebar? ---"
agent-browser eval "
  (function(){
    var aside = document.querySelector('aside, [class*=\"sidebar\"]');
    if (!aside) return 'NO_SIDEBAR_FOUND';
    var t = aside.innerText;
    // Look for any of the question keywords that should be in conversation titles
    var found = [];
    ['money','expecting','customers','follow-up','GST','cash','June','July','Predict','churn','board','meeting'].forEach(function(k){
      if (t.toLowerCase().includes(k.toLowerCase())) found.push(k);
    });
    return 'SIDEBAR_AFTER_RELOAD: ' + (found.length ? 'CONTAINS: ' + found.join(',') : 'EMPTY_OR_DIFFERENT') + ' ||| FULL: ' + t.slice(0, 600);
  })()
" 2>&1 | tail -15

# ============ STEP 6: Conversation management ============
echo ""
echo "=== [$(date +%T)] STEP 6: Conversation management ==="
echo "--- Snapshot interactive elements ---"
agent-browser snapshot -i -c 2>&1 | head -80

echo ""
echo "--- Click 'New Conversation' button ---"
agent-browser find role button click --name "New" 2>&1 | tail -3 || \
  agent-browser find text "New Conversation" click 2>&1 | tail -3 || \
  agent-browser find text "New" click 2>&1 | tail -3
sleep 2
echo "--- After 'New Conversation': welcome screen visible? ---"
agent-browser eval "document.body.innerText.includes('prompt') || document.body.innerText.includes('Ask') || document.body.innerText.includes('Welcome') ? 'WELCOME_VISIBLE' : 'NOT_WELCOME'" 2>&1 | tail -3

# ============ STEP 7: Responsiveness ============
echo ""
echo "=== [$(date +%T)] STEP 7: Responsiveness — resize to 375px ==="
agent-browser set viewport 375 812 2>&1 | tail -1
sleep 2
echo "--- Mobile layout snapshot (compact) ---"
agent-browser snapshot -c -d 4 2>&1 | head -60
echo ""
echo "--- Sticky footer present? ---"
agent-browser eval "
  (function(){
    var input = document.querySelector('textarea, input[type=\"text\"]');
    if (!input) return 'NO_INPUT_BOX_FOUND';
    var r = input.getBoundingClientRect();
    var vh = window.innerHeight;
    return 'INPUT_BOTTOM: ' + Math.round(r.bottom) + 'px / VIEWPORT_HEIGHT: ' + vh + 'px / GAP_FROM_BOTTOM: ' + (vh - Math.round(r.bottom)) + 'px';
  })()
" 2>&1 | tail -3

# Restore desktop viewport
agent-browser set viewport 1440 900 2>&1 | tail -1
sleep 1

# ============ STEP 8: Console errors ============
echo ""
echo "=== [$(date +%T)] STEP 8: Console errors ==="
echo "--- Console messages ---"
agent-browser console 2>&1 | tail -60
echo ""
echo "--- Page errors ---"
agent-browser errors 2>&1 | tail -40

# ============ Final cleanup ============
echo ""
echo "=== [$(date +%T)] Server dev.log tail ==="
tail -40 /home/z/my-project/dev.log

echo ""
echo "=== [$(date +%T)] Verification complete. Stopping dev server. ==="
kill -TERM $DEV_PID 2>/dev/null
sleep 2
kill -KILL $DEV_PID 2>/dev/null
echo "DONE"
