#!/bin/bash
# Idempotent setup for the agent's Sailbox. Safe to re-run.
set -e
mkdir -p /opt/agent /data/files /data/profile
if [ ! -x /opt/agent/venv/bin/python ] || ! /opt/agent/venv/bin/python -c "import playwright, pypdf" 2>/dev/null; then
  (apt-get install -y -q python3-venv >/dev/null 2>&1) || (apt-get update -q >/dev/null && apt-get install -y -q python3-venv >/dev/null)
  python3 -m venv /opt/agent/venv
  /opt/agent/venv/bin/pip install -q playwright==1.64.1 pypdf==6.21.4
fi
if ! ls /root/.cache/ms-playwright 2>/dev/null | grep -q chromium_headless_shell; then
  /opt/agent/venv/bin/python -m playwright install --with-deps chromium >/dev/null 2>&1
fi
fonts-ok() { fc-list 2>/dev/null | grep -qi dejavu; }
fonts-ok || apt-get install -y -q fonts-dejavu-core fonts-liberation >/dev/null 2>&1 || true
cat > /opt/agent/restart.sh <<'SH'
#!/bin/bash
pkill -f "[b]rowserd.py" || true
pkill -f "[p]ortals.py" || true
sleep 0.5
rm -f /data/profile/SingletonLock
cd /opt/agent
nohup /opt/agent/venv/bin/python /opt/agent/portals.py > /var/log/portals.log 2>&1 &
nohup /opt/agent/venv/bin/python /opt/agent/browserd.py > /var/log/browserd.log 2>&1 &
for i in $(seq 1 60); do
  if curl -s -m 2 -X POST -d '{"action":"ping"}' http://127.0.0.1:7777/ | grep -q pong; then echo READY; exit 0; fi
  sleep 0.5
done
echo "browserd failed to start"; tail -30 /var/log/browserd.log; exit 1
SH
chmod +x /opt/agent/restart.sh
/opt/agent/restart.sh
