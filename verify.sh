#!/bin/bash
# Full verification script — start server, login via demo, screenshot dashboard
cd /home/z/my-project

pkill -9 -f "next" 2>/dev/null
sleep 2
> dev.log
NODE_OPTIONS="--max-old-space-size=1400" nohup bun run dev >> dev.log 2>&1 &
SRV=$!
echo "Server PID $SRV"

# Wait for server ready
echo "Waiting for compile..."
for i in $(seq 1 40); do
  sleep 2
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "Server ready at ${i}x2s"
    break
  fi
done

if [ "$CODE" != "200" ]; then
  echo "FAILED: server not ready"
  exit 1
fi

# Open landing page
echo "=== Opening landing page ==="
agent-browser open http://localhost:3000 2>&1 | tail -1
sleep 4

# Dismiss pointer-events-none overlays and click Get Started via JS
echo "=== Clicking Get Started via JS ==="
agent-browser eval "
  document.querySelectorAll('div.fixed.inset-0').forEach(d => {
    if(getComputedStyle(d).pointerEvents === 'none') d.style.display='none';
  });
  var btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Get Started'));
  if(btn) { btn.click(); 'clicked'; } else { 'not found: ' + document.querySelectorAll('button').length; }
" 2>&1 | tail -2

sleep 5

# Check if we're on login page
echo "=== Current URL ==="
agent-browser get url 2>&1 | tail -1

# Snapshot login page to find demo button
echo "=== Login page buttons ==="
agent-browser snapshot -i 2>&1 | rg -i "button|explore|demo|sign|continue" | head -15

# Click "Explore the platform" (demo login)
echo "=== Clicking Explore the platform ==="
agent-browser eval "
  var btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Explore'));
  if(btn) { btn.click(); 'clicked explore'; } else { 'explore not found'; }
" 2>&1 | tail -2

# Wait for dashboard to load
echo "=== Waiting for dashboard ==="
sleep 12

# Screenshot
echo "=== Screenshot ==="
agent-browser screenshot /home/z/my-project/preview-dashboard.png --full 2>&1 | tail -1

# Check server alive
echo "=== Server alive? ==="
kill -0 $SRV 2>/dev/null && echo "ALIVE" || echo "DEAD"

# Keep server alive for a few more seconds for any follow-up
sleep 3
