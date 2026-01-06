#!/bin/bash
# IT REX ServiceDesk - Scheduled Tasks
# Add to crontab: */15 * * * * /app/scripts/scheduled-tasks.sh

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "$(date): Running scheduled tasks..."

# 1. SLA Breach Check (every 15 min)
echo "Checking SLA breaches..."
curl -s -X POST "$BASE_URL/api/sla/check-breaches" > /dev/null

# 2. Send SLA Notifications (if any breaches)
echo "Sending SLA notifications..."
curl -s -X POST "$BASE_URL/api/sla/send-notifications" > /dev/null

# 3. Check expiring assets (daily at 8am - check in script)
HOUR=$(date +%H)
if [ "$HOUR" == "08" ]; then
    echo "Checking expiring assets..."
    curl -s -X POST "$BASE_URL/api/assets/send-reminders" > /dev/null
fi

echo "$(date): Scheduled tasks completed."
