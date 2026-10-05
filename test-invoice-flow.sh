#!/bin/bash
# Single-process-tree test: launch server, compile, test invoice flow end-to-end.
trap 'kill $SRV 2>/dev/null; pkill -9 -f "next-server" 2>/dev/null' EXIT
cd /home/z/my-project
pkill -9 -f "next" 2>/dev/null; sleep 2
echo "" > dev.log
NODE_OPTIONS="--max-old-space-size=2200" node node_modules/.bin/next dev -p 3000 --turbo >> dev.log 2>&1 &
SRV=$!
echo "server PID $SRV"
sleep 12

echo "=== [1] Waiting for root compile ==="
for i in $(seq 1 40); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null)
  [ "$CODE" = "200" ] && { echo "root ready after ${i}x5s"; break; }
  sleep 5
done

echo ""
echo "=== [2] Invoice CREATE API (the THINK step) ==="
CREATE_RESP=$(curl -s --max-time 90 -X POST http://localhost:3000/api/oracle/cfo/invoice/create \
  -H "Content-Type: application/json" \
  -d '{"message":"Create an invoice for ABC Pvt Ltd worth ₹50,000 at 18% GST","organizationId":"preview-org","userId":"demo","userEmail":"demo@gstpilot.in"}' \
  -w "\n__HTTP__%{http_code}__TIME__%{time_total}" 2>&1)
HTTP_CODE=$(echo "$CREATE_RESP" | grep -o '__HTTP__.*' | sed 's/__HTTP__//; s/__TIME__.*//')
TIME_T=$(echo "$CREATE_RESP" | grep -o '__TIME__.*' | sed 's/__TIME__//')
BODY=$(echo "$CREATE_RESP" | sed 's/__HTTP__.*//')
echo "HTTP $HTTP_CODE in ${TIME_T}s"
echo "$BODY" | python3 -m json.tool 2>/dev/null | head -80 || echo "$BODY" | head -20

echo ""
echo "=== [3] Extract summary + approvalId for execute test ==="
STEP=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('step','?'))" 2>/dev/null)
echo "step: $STEP"

if [ "$STEP" = "review" ]; then
  SUMMARY=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get('summary',{})))" 2>/dev/null)
  APPROVAL_ID=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('approvalId',''))" 2>/dev/null)
  INVOICE_NUM=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('invoiceNumber',{}).get('invoiceNumber',''))" 2>/dev/null)
  echo "approvalId: $APPROVAL_ID"
  echo "invoiceNumber: $INVOICE_NUM"

  echo ""
  echo "=== [4] Invoice EXECUTE API (the ACT step — real DB write + PDF) ==="
  EXEC_BODY=$(python3 -c "
import json
summary = json.loads('''$SUMMARY''')
print(json.dumps({
  'decision': 'approved',
  'summary': summary,
  'sellerDetails': {
    'tradeName': 'GSTPilot Demo',
    'legalName': 'GSTPilot Demo Pvt Ltd',
    'gstin': '27ABCDE1234F1Z5',
    'address': '123 Business Park, Mumbai',
    'state': 'Maharashtra',
    'stateCode': '27',
    'email': 'demo@gstpilot.in',
    'phone': '+919876543210'
  },
  'clientId': 'demo-client-1',
  'customerGstin': summary.get('customer',{}).get('gstin'),
  'placeOfSupply': 'Maharashtra',
  'hsnCode': '998314',
  'organizationId': 'preview-org',
  'userId': 'demo',
  'userEmail': 'demo@gstpilot.in'
}))
" 2>/dev/null)
  
  EXEC_RESP=$(curl -s --max-time 60 -X POST http://localhost:3000/api/oracle/cfo/invoice/execute \
    -H "Content-Type: application/json" \
    -d "$EXEC_BODY" \
    -w "\n__HTTP__%{http_code}__TIME__%{time_total}" 2>&1)
  EXEC_HTTP=$(echo "$EXEC_RESP" | grep -o '__HTTP__.*' | sed 's/__HTTP__//; s/__TIME__.*//')
  EXEC_TIME=$(echo "$EXEC_RESP" | grep -o '__TIME__.*' | sed 's/__TIME__//')
  EXEC_BODY_OUT=$(echo "$EXEC_RESP" | sed 's/__HTTP__.*//')
  echo "HTTP $EXEC_HTTP in ${EXEC_TIME}s"
  echo "$EXEC_BODY_OUT" | python3 -m json.tool 2>/dev/null | head -60 || echo "$EXEC_BODY_OUT" | head -20
fi

echo ""
echo "=== [5] Server status ==="
kill -0 $SRV 2>/dev/null && echo "Server ALIVE" || echo "Server DEAD"
tail -3 dev.log
