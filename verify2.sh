#!/bin/bash
# Multi-page verification — login, then screenshot Dashboard, Oracle, Invoices, Settings
cd /home/z/my-project

pkill -9 -f "next" 2>/dev/null
sleep 2
> dev.log
NODE_OPTIONS="--max-old-space-size=1400" nohup bun run dev >> dev.log 2>&1 &
SRV=$!

# Wait for server ready
echo "Waiting for compile..."
for i in $(seq 1 40); do
  sleep 2
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  if [ "$CODE" = "200" ]; then echo "Ready"; break; fi
done

# Open page
agent-browser open http://localhost:3000 2>&1 | tail -1
sleep 4

# If on landing, click Get Started
agent-browser eval "
  document.querySelectorAll('div.fixed.inset-0').forEach(d => {
    if(getComputedStyle(d).pointerEvents === 'none') d.style.display='none';
  });
  var gs = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Get Started'));
  if(gs) gs.click();
  'ok'
" 2>&1 | tail -1
sleep 4

# If on login, click Explore (demo)
agent-browser eval "
  var ex = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Explore'));
  if(ex) ex.click();
  'ok'
" 2>&1 | tail -1
sleep 10

echo "=== Dashboard screenshot ==="
agent-browser screenshot /home/z/my-project/p-dashboard.png --full 2>&1 | tail -1

# Navigate to Oracle (it's a route /oracle)
echo "=== Navigating to Oracle ==="
agent-browser open http://localhost:3000/oracle 2>&1 | tail -1
sleep 8
agent-browser screenshot /home/z/my-project/p-oracle.png --full 2>&1 | tail -1

# Navigate to Invoices (via setCurrentView — click in sidebar)
echo "=== Back to dashboard, click Invoices ==="
agent-browser open http://localhost:3000 2>&1 | tail -1
sleep 6
agent-browser eval "
  var inv = Array.from(document.querySelectorAll('button, a')).find(b => b.textContent.trim() === 'Invoices');
  if(inv) inv.click();
  'ok'
" 2>&1 | tail -1
sleep 6
agent-browser screenshot /home/z/my-project/p-invoices.png --full 2>&1 | tail -1

# Navigate to Settings
echo "=== Click Settings ==="
agent-browser eval "
  var set = Array.from(document.querySelectorAll('button, a')).find(b => b.textContent.trim() === 'Settings');
  if(set) set.click();
  'ok'
" 2>&1 | tail -1
sleep 6
agent-browser screenshot /home/z/my-project/p-settings.png --full 2>&1 | tail -1

# Navigate to Customers
echo "=== Click Customers ==="
agent-browser eval "
  var cus = Array.from(document.querySelectorAll('button, a')).find(b => b.textContent.trim() === 'Customers');
  if(cus) cus.click();
  'ok'
" 2>&1 | tail -1
sleep 6
agent-browser screenshot /home/z/my-project/p-customers.png --full 2>&1 | tail -1

echo "=== Server alive? ==="
kill -0 $SRV 2>/dev/null && echo "ALIVE" || echo "DEAD"
