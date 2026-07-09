#!/bin/bash
# Full end-to-end test: create → execute (real DB write + PDF + email/WhatsApp + audit)
trap 'kill $SRV 2>/dev/null; pkill -9 -f "next-server" 2>/dev/null' EXIT
cd /home/z/my-project
pkill -9 -f "next" 2>/dev/null; sleep 2
echo "" > dev.log
NODE_OPTIONS="--max-old-space-size=2200" node node_modules/.bin/next dev -p 3000 --turbo >> dev.log 2>&1 &
SRV=$!
sleep 12
echo "=== Waiting for root compile ==="
for i in $(seq 1 40); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>/dev/null)
  [ "$CODE" = "200" ] && { echo "root ready after ${i}x5s"; break; }
  sleep 5
done

echo ""
echo "=== [1] Invoice CREATE — with description and payment terms ==="
curl -s --max-time 90 -X POST http://localhost:3000/api/oracle/cfo/invoice/create \
  -H "Content-Type: application/json" \
  -d '{"message":"Create an invoice for TechCorp Solutions worth ₹1,00,000 at 18% GST due in 30 days, description: Annual software license, payment terms: net 30","organizationId":"preview-org","userId":"demo","userEmail":"demo@gstpilot.in"}' \
  -w "\n[HTTP %{http_code} in %{time_total}s]\n" 2>&1 | python3 -c "
import json,sys
lines = sys.stdin.read()
# Split body and status line
parts = lines.rsplit('[HTTP', 1)
body = parts[0].strip()
status = '[HTTP' + parts[1] if len(parts) > 1 else ''
try:
    d = json.loads(body)
    print(f'step: {d.get(\"step\")}')
    print(f'durationMs: {d.get(\"durationMs\")}ms')
    intent = d.get('intent', {})
    print(f'customerName: {intent.get(\"customerName\")}')
    print(f'amount: ₹{intent.get(\"amount\")}')
    print(f'gstRate: {intent.get(\"gstRate\")}%')
    print(f'dueDate: {intent.get(\"dueDate\")}')
    print(f'description: {intent.get(\"description\")}')
    print(f'paymentTerms: {intent.get(\"paymentTerms\")}')
    print(f'currency: {intent.get(\"currency\")}')
    if d.get('gst'):
        gst = d['gst']
        print(f'GST calc: taxable=₹{gst[\"taxableValue\"]}, CGST=₹{gst[\"cgst\"]}, SGST=₹{gst[\"sgst\"]}, IGST=₹{gst[\"igst\"]}, total=₹{gst[\"grandTotal\"]}')
        print(f'isInterState: {gst[\"isInterState\"]}')
    if d.get('invoiceNumber'):
        print(f'invoiceNumber: {d[\"invoiceNumber\"][\"invoiceNumber\"]}')
    if d.get('integrations'):
        print(f'email connected: {d[\"integrations\"][\"email\"][\"connected\"]}')
        print(f'whatsapp connected: {d[\"integrations\"][\"whatsapp\"][\"connected\"]}')
    if d.get('summary'):
        import json as j
        with open('/tmp/invoice_summary.json', 'w') as f:
            j.dump(d['summary'], f)
        with open('/tmp/invoice_meta.json', 'w') as f:
            j.dump({'approvalId': d.get('approvalId',''), 'placeOfSupply': d.get('placeOfSupply',''), 'hsnCode': d.get('hsnCode','')}, f)
except Exception as e:
    print(f'parse error: {e}')
    print(body[:500])
print(status.strip())
" 2>&1

echo ""
echo "=== [2] Invoice EXECUTE — real DB write + PDF + email + WhatsApp + audit ==="
python3 -c "
import json
with open('/tmp/invoice_summary.json') as f:
    summary = json.load(f)
with open('/tmp/invoice_meta.json') as f:
    meta = json.load(f)
payload = {
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
    'clientId': 'demo-client-techcorp',
    'customerGstin': summary.get('customer',{}).get('gstin'),
    'placeOfSupply': meta.get('placeOfSupply', 'Maharashtra'),
    'hsnCode': meta.get('hsnCode', '998314'),
    'organizationId': 'preview-org',
    'userId': 'demo',
    'userEmail': 'demo@gstpilot.in'
}
with open('/tmp/invoice_exec_payload.json', 'w') as f:
    json.dump(payload, f)
" 2>/dev/null

curl -s --max-time 120 -X POST http://localhost:3000/api/oracle/cfo/invoice/execute \
  -H "Content-Type: application/json" \
  -d @/tmp/invoice_exec_payload.json \
  -w "\n[HTTP %{http_code} in %{time_total}s]\n" 2>&1 | python3 -c "
import json,sys
lines = sys.stdin.read()
parts = lines.rsplit('[HTTP', 1)
body = parts[0].strip()
status = '[HTTP' + parts[1] if len(parts) > 1 else ''
try:
    d = json.loads(body)
    print(f'success: {d.get(\"success\")}')
    print(f'status: {d.get(\"status\")}')
    print(f'invoiceId: {d.get(\"invoiceId\")}')
    print(f'invoiceNumber: {d.get(\"invoiceNumber\")}')
    print(f'executionMs: {d.get(\"executionMs\")}ms')
    print(f'pdfGenerated: {d.get(\"pdfGenerated\")}')
    print(f'pdfBase64 length: {len(d.get(\"pdfBase64\",\"\"))} chars')
    print(f'email.status: {d.get(\"email\",{}).get(\"status\")}')
    print(f'email.message: {d.get(\"email\",{}).get(\"message\",\"\")[:120]}...')
    print(f'whatsapp.status: {d.get(\"whatsapp\",{}).get(\"status\")}')
    print(f'whatsapp.message: {d.get(\"whatsapp\",{}).get(\"message\",\"\")[:120]}...')
    print(f'recordsAffected: {len(d.get(\"recordsAffected\",[]))} records')
    for r in d.get('recordsAffected',[]):
        print(f'  → {r[\"action\"]} {r[\"collection\"]}/{r[\"id\"][-12:]}')
    print(f'rollbackStatus: {d.get(\"rollbackStatus\")}')
    print(f'auditId: {d.get(\"auditId\")}')
    msg = d.get('message','')
    print(f'message (first 200 chars): {msg[:200]}...')
except Exception as e:
    print(f'parse error: {e}')
    print(body[:500])
print(status.strip())
" 2>&1

echo ""
echo "=== [3] Server status ==="
kill -0 $SRV 2>/dev/null && echo "Server ALIVE" || echo "Server DEAD"
