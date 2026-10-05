#!/bin/bash
# Oracle Chat E2E — Part 2: continue Q3-Q8 + persistence + conversation + responsiveness + console
set +e
cd /home/z/my-project
LOG=/tmp/oracle-e2e2.log
: > "$LOG"
exec > >(tee -a "$LOG") 2>&1

# Verify dev server still up
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ --max-time 3 2>/dev/null)
echo "=== [$(date +%T)] Dev server status: HTTP $CODE ==="
if [ "$CODE" != "200" ]; then
  echo "Dev server down — restarting"
  nohup env NODE_OPTIONS='--max-old-space-size=1024' ./node_modules/.bin/next dev -p 3000 > dev.log 2>&1 < /dev/null &
  for i in $(seq 1 60); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ --max-time 3 2>/dev/null)
    [ "$CODE" = "200" ] && { echo "READY after ${i}s"; break; }
    sleep 1
  done
fi

# Restore desktop viewport
agent-browser set viewport 1440 900 2>&1 | tail -1

# Helper: ask a question, capture ThinkingTrail mid-stream, then wait for completion
ask_q() {
  local Q="$1"; local LABEL="$2"
  echo ""
  echo "=== [$(date +%T)] QUESTION: $LABEL ==="
  echo "Q: $Q"

  # Find textarea by placeholder
  INPUT=$(agent-browser find label "Ask Oracle anything about your business…" 2>&1 | grep -oE "@e[0-9]+" | head -1)
  if [ -z "$INPUT" ]; then
    INPUT=$(agent-browser eval "document.querySelector('textarea')?.getAttribute('data-ref') || 'fallback'" 2>&1 | tail -1)
    # fallback: snapshot lookup
    INPUT=$(agent-browser snapshot -i -c 2>&1 | grep -i "Ask Oracle" | grep -oE "@e[0-9]+" | head -1)
  fi
  echo "Input ref: $INPUT"

  agent-browser fill "$INPUT" "$Q" 2>&1 | tail -1
  sleep 1
  agent-browser press Enter 2>&1 | tail -1

  # Wait 4s then capture ThinkingTrail (mid-stream)
  sleep 4
  echo "--- ThinkingTrail mid-stream ---"
  agent-browser eval "
    (function(){
      var t = document.body.innerText;
      // Look for tool-call indicators
      var tools = [];
      ['memory_snapshot','search_invoices','search_payments','search_customers','receivables_summary','payables_summary','cash_flow_summary','gst_liability','overdue_invoices','customer_followups','revenue_trend','expense_breakdown','executive_kpis','search_expenses','search_purchases','search_gst_returns','search_tds','search_emails','search_bank_transactions','search_vendors'].forEach(function(tool){
        if (t.toLowerCase().includes(tool.toLowerCase())) tools.push(tool);
      });
      return 'TOOLS_VISIBLE_IN_BODY: ' + (tools.length ? tools.join(', ') : 'NONE_BY_NAME') + ' || thinking-trail-elem: ' + document.querySelectorAll('[class*=\"hink\"], [class*=\"ool\"]').length;
    })()
  " 2>&1 | tail -3
  # Snapshot interactive to look for any "thinking" UI
  agent-browser snapshot -c -d 5 2>&1 | grep -iE "thinking|tool|analyzing" | head -10

  # Wait for streaming to complete (Sources + Confidence in latest message)
  for i in $(seq 1 90); do
    sleep 1
    RESULT=$(agent-browser eval "
      (function(){
        var arts = document.querySelectorAll('article, [class*=\"oracle-message\"], [class*=\"OracleMessage\"], [class*=\"message-bubble\"]');
        if (!arts.length) {
          var t = document.body.innerText;
          return (t.includes('Sources') && t.includes('Confidence')) ? 'DONE_BODY' : 'WAITING';
        }
        var last = arts[arts.length-1];
        var t = last.innerText || '';
        return (t.includes('Sources') && t.includes('Confidence')) ? 'DONE_LAST' : 'WAITING';
      })()
    " 2>&1 | tail -1)
    if [[ "$RESULT" == "DONE_BODY" || "$RESULT" == "DONE_LAST" ]]; then
      echo "STREAM_COMPLETE after ${i}s ($RESULT)"
      break
    fi
  done
  sleep 1

  # Capture the LAST oracle message text
  echo "--- Last oracle message (3000 chars) ---"
  agent-browser eval "
    (function(){
      var arts = document.querySelectorAll('article, [class*=\"oracle-message\"], [class*=\"OracleMessage\"], [class*=\"message-bubble\"]');
      if (!arts.length) return document.body.innerText.slice(-3000);
      return (arts[arts.length-1].innerText || '').slice(0, 3000);
    })()
  " 2>&1 | tail -60

  echo ""
  echo "--- Section presence ---"
  agent-browser eval "
    (function(){
      var arts = document.querySelectorAll('article, [class*=\"oracle-message\"], [class*=\"OracleMessage\"], [class*=\"message-bubble\"]');
      var t = arts.length ? (arts[arts.length-1].innerText||'') : document.body.innerText;
      var s = ['Executive Summary','Analysis','Evidence','Recommended Actions','Confidence','Sources'];
      return s.map(function(x){return x+':'+(t.includes(x)?'Y':'N');}).join(' ');
    })()
  " 2>&1 | tail -3

  echo ""
  echo "--- Confidence % + key numbers ---"
  agent-browser eval "
    (function(){
      var arts = document.querySelectorAll('article, [class*=\"oracle-message\"], [class*=\"OracleMessage\"], [class*=\"message-bubble\"]');
      var t = arts.length ? (arts[arts.length-1].innerText||'') : document.body.innerText;
      var conf = t.match(/Confidence[^0-9]*(\\d{1,3})\\s*%/i);
      var nums = (t.match(/₹\\s*[0-9,]+(\\.[0-9]+)?/g) || []).slice(0,8);
      return 'CONF: ' + (conf ? conf[1]+'%' : 'NOT_FOUND') + ' || RUPEE_NUMS: ' + nums.join(', ');
    })()
  " 2>&1 | tail -3
}

# Continue Q3-Q8
ask_q "How much GST will I pay?" "Q3_gst"
ask_q "What is my cash position?" "Q4_cash"
ask_q "Compare June vs July" "Q5_compare"
ask_q "Predict next month GST" "Q6_predict_gst"
ask_q "Which customers may churn?" "Q7_churn"
ask_q "Generate board meeting summary" "Q8_board"

# ============ STEP 5: DB persistence ============
echo ""
echo "=== [$(date +%T)] STEP 5: DB PERSISTENCE ==="
echo "--- Sidebar BEFORE reload ---"
agent-browser eval "(document.querySelector('aside')||{}).innerText ? document.querySelector('aside').innerText.slice(0,800) : 'NO_ASIDE'" 2>&1 | tail -15
echo ""
echo "--- Reloading page... ---"
agent-browser open http://localhost:3000/ 2>&1 | tail -2
agent-browser wait --load networkidle --timeout 30000 2>&1 | tail -2
sleep 4
echo "--- Sidebar AFTER reload ---"
agent-browser eval "(document.querySelector('aside')||{}).innerText ? document.querySelector('aside').innerText.slice(0,800) : 'NO_ASIDE'" 2>&1 | tail -15
echo ""
echo "--- Conversation history restored? (check first oracle message contains ₹1,18,000) ---"
agent-browser eval "
  (function(){
    var t = document.body.innerText;
    return {
      has_Verma: t.includes('Verma'),
      has_118000: t.includes('1,18,000') || t.includes('118000'),
      has_8_questions: ['How much money','follow-up','GST','cash position','June','Predict','churn','board'].filter(function(k){return t.toLowerCase().includes(k.toLowerCase());}).length,
      total_chars: t.length
    };
  })()
" 2>&1 | tail -5
echo ""
echo "--- Click first conversation in sidebar to verify history loads ---"
# Find conversation items in sidebar
FIRST_CONV=$(agent-browser snapshot -i -c 2>&1 | grep -iE "How much money|customers need|GST|cash position" | grep -v "Ask Oracle" | head -1 | grep -oE "@e[0-9]+" | head -1)
echo "First conv ref: $FIRST_CONV"
if [ -n "$FIRST_CONV" ]; then
  agent-browser click "$FIRST_CONV" 2>&1 | tail -2
  sleep 3
  echo "--- After clicking conversation: message history visible? ---"
  agent-browser eval "
    (function(){
      var arts = document.querySelectorAll('article, [class*=\"oracle-message\"], [class*=\"OracleMessage\"], [class*=\"message-bubble\"]');
      return 'MESSAGE_BUBBLES_COUNT: ' + arts.length + ' || body_chars: ' + document.body.innerText.length;
    })()
  " 2>&1 | tail -3
fi

# ============ STEP 6: Conversation management ============
echo ""
echo "=== [$(date +%T)] STEP 6: CONVERSATION MANAGEMENT ==="
echo "--- Click 'New Conversation' ---"
agent-browser find role button click --name "New Conversation" 2>&1 | tail -3 || agent-browser find text "New Conversation" click 2>&1 | tail -3
sleep 2
agent-browser eval "document.body.innerText.includes('How much money am I expecting?') && document.body.innerText.includes('Outstanding') ? 'WELCOME_SCREEN_VISIBLE' : 'NOT_WELCOME: ' + document.body.innerText.slice(0,200)" 2>&1 | tail -3

echo ""
echo "--- Go back to previous conversation ---"
PREV_CONV=$(agent-browser snapshot -i -c 2>&1 | grep -iE "How much money|customers need|GST|cash position|board meeting" | grep -v "Ask Oracle" | head -1 | grep -oE "@e[0-9]+" | head -1)
echo "Prev conv ref: $PREV_CONV"
if [ -n "$PREV_CONV" ]; then
  agent-browser click "$PREV_CONV" 2>&1 | tail -2
  sleep 3
  agent-browser eval "document.querySelectorAll('article, [class*=\"oracle-message\"], [class*=\"message-bubble\"]').length + ' message bubbles visible after switching back'" 2>&1 | tail -3
fi

echo ""
echo "--- Hover over a conversation to reveal pin/rename/delete ---"
# Hover then snapshot
agent-browser hover "$PREV_CONV" 2>&1 | tail -2
sleep 1
agent-browser snapshot -i -c 2>&1 | grep -iE "Pin|Rename|Delete" | head -6

echo ""
echo "--- Click Rename (pencil) ---"
RENAME_REF=$(agent-browser snapshot -i -c 2>&1 | grep -i "Rename" | head -1 | grep -oE "@e[0-9]+" | head -1)
echo "Rename ref: $RENAME_REF"
if [ -n "$RENAME_REF" ]; then
  agent-browser click "$RENAME_REF" 2>&1 | tail -2
  sleep 1
  # Find the rename input
  RENAME_INPUT=$(agent-browser snapshot -i -c 2>&1 | grep -iE "textbox|input" | head -1 | grep -oE "@e[0-9]+" | head -1)
  echo "Rename input ref: $RENAME_INPUT"
  if [ -n "$RENAME_INPUT" ]; then
    agent-browser fill "$RENAME_INPUT" "TEST_RENAMED_CONV" 2>&1 | tail -1
    sleep 1
    agent-browser press Enter 2>&1 | tail -1
    sleep 2
    agent-browser eval "document.querySelector('aside') ? document.querySelector('aside').innerText.slice(0,400) : 'no aside'" 2>&1 | tail -10
  fi
fi

echo ""
echo "--- Click Pin icon ---"
PIN_REF=$(agent-browser snapshot -i -c 2>&1 | grep -i "Pin" | head -1 | grep -oE "@e[0-9]+" | head -1)
echo "Pin ref: $PIN_REF"
if [ -n "$PIN_REF" ]; then
  agent-browser click "$PIN_REF" 2>&1 | tail -2
  sleep 2
  agent-browser eval "document.querySelector('aside') ? document.querySelector('aside').innerText.slice(0,400) : 'no aside'" 2>&1 | tail -10
fi

# ============ STEP 7: Responsiveness ============
echo ""
echo "=== [$(date +%T)] STEP 7: RESPONSIVENESS (375x812) ==="
agent-browser set viewport 375 812 2>&1 | tail -1
sleep 2
echo "--- Mobile snapshot (top 50 lines) ---"
agent-browser snapshot -c -d 5 2>&1 | head -50
echo ""
echo "--- Sticky footer check ---"
agent-browser eval "
  (function(){
    var input = document.querySelector('textarea');
    if (!input) return 'NO_TEXTAREA';
    var r = input.getBoundingClientRect();
    return 'INPUT_BOTTOM: ' + Math.round(r.bottom) + 'px / VIEWPORT_H: ' + window.innerHeight + 'px / GAP: ' + (window.innerHeight - Math.round(r.bottom)) + 'px / INPUT_VISIBLE: ' + (r.bottom > 0 && r.top < window.innerHeight);
  })()
" 2>&1 | tail -3
echo ""
echo "--- Mobile menu button visible? ---"
agent-browser eval "
  (function(){
    var btns = document.querySelectorAll('button, [role=button]');
    var menuBtns = [];
    btns.forEach(function(b){
      var t = (b.innerText||'').toLowerCase();
      var aria = (b.getAttribute('aria-label')||'').toLowerCase();
      if (t.includes('menu') || aria.includes('menu') || t.includes('sidebar') || aria.includes('sidebar') || t.includes('show') || aria.includes('show')) {
        menuBtns.push((b.innerText||b.getAttribute('aria-label')).slice(0,40));
      }
    });
    return 'MENU_BTNS: ' + (menuBtns.length ? menuBtns.join(' | ') : 'NONE_FOUND');
  })()
" 2>&1 | tail -3

agent-browser set viewport 1440 900 2>&1 | tail -1

# ============ STEP 8: Console errors ============
echo ""
echo "=== [$(date +%T)] STEP 8: CONSOLE + ERRORS ==="
echo "--- Console messages ---"
agent-browser console 2>&1 | tail -80
echo ""
echo "--- Page errors ---"
agent-browser errors 2>&1 | tail -40

echo ""
echo "=== [$(date +%T)] DONE ==="
echo "--- dev.log tail ---"
tail -30 /home/z/my-project/dev.log
