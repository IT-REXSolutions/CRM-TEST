#!/bin/bash
#
# IT REX RMM Agent for Linux
# Remote Monitoring & Management Agent
# Sends heartbeat, metrics, and inventory to IT REX ServiceDesk
#
# Version: 1.0.0
# Author: IT REX Solutions
#

set -e

# Configuration
AGENT_VERSION="1.0.0"
CONFIG_DIR="/etc/itrex-rmm"
CONFIG_FILE="$CONFIG_DIR/agent.json"
LOG_FILE="/var/log/itrex-rmm-agent.log"
PID_FILE="/var/run/itrex-rmm-agent.pid"

# Parse arguments
ENROLLMENT_TOKEN=""
SERVER_URL="https://your-servicedesk.domain.de"
HEARTBEAT_INTERVAL=60

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--token)
            ENROLLMENT_TOKEN="$2"
            shift 2
            ;;
        -s|--server)
            SERVER_URL="$2"
            shift 2
            ;;
        -i|--interval)
            HEARTBEAT_INTERVAL="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Ensure running as root
if [[ $EUID -ne 0 ]]; then
    echo "This script must be run as root"
    exit 1
fi

# Create config directory
mkdir -p "$CONFIG_DIR"

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Get system information
get_system_info() {
    local hostname=$(hostname)
    local domain=$(hostname -d 2>/dev/null || echo "")
    local os_type="linux"
    local os_version=$(cat /etc/os-release 2>/dev/null | grep "PRETTY_NAME" | cut -d'"' -f2 || uname -r)
    local os_build=$(uname -r)
    local cpu_model=$(grep "model name" /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)
    local cpu_cores=$(nproc)
    local ram_total_gb=$(free -g | awk '/Mem:/ {print $2}')
    local disk_info=$(df -BG / | awk 'NR==2 {print $2, $4}')
    local disk_total_gb=$(echo "$disk_info" | awk '{print $1}' | tr -d 'G')
    local disk_free_gb=$(echo "$disk_info" | awk '{print $2}' | tr -d 'G')
    local mac_address=$(ip link show | grep -A1 "state UP" | grep "ether" | head -1 | awk '{print $2}')
    local ip_address=$(hostname -I | awk '{print $1}')
    
    cat << EOF
{
    "hostname": "$hostname",
    "domain": "$domain",
    "os_type": "$os_type",
    "os_version": "$os_version",
    "os_build": "$os_build",
    "cpu_model": "$cpu_model",
    "cpu_cores": $cpu_cores,
    "ram_total_gb": $ram_total_gb,
    "disk_total_gb": $disk_total_gb,
    "disk_free_gb": $disk_free_gb,
    "mac_address": "$mac_address",
    "ip_address": "$ip_address"
}
EOF
}

# Get current metrics
get_metrics() {
    # CPU usage (average over 1 second)
    local cpu_usage=$(top -bn2 -d0.5 | grep "Cpu(s)" | tail -1 | awk '{print $2}' | cut -d'%' -f1)
    
    # RAM usage
    local mem_info=$(free | awk '/Mem:/ {print $2, $3}')
    local mem_total=$(echo "$mem_info" | awk '{print $1}')
    local mem_used=$(echo "$mem_info" | awk '{print $2}')
    local ram_usage=$(echo "scale=2; $mem_used / $mem_total * 100" | bc)
    local ram_used_gb=$(echo "scale=2; $mem_used / 1024 / 1024" | bc)
    
    # Disk usage
    local disk_info=$(df / | awk 'NR==2 {print $5, $3, $4}')
    local disk_usage=$(echo "$disk_info" | awk '{print $1}' | tr -d '%')
    local disk_used_gb=$(echo "$disk_info" | awk '{printf "%.2f", $2/1024/1024}')
    local disk_free_gb=$(echo "$disk_info" | awk '{printf "%.2f", $3/1024/1024}')
    
    # Uptime
    local uptime_seconds=$(awk '{print int($1)}' /proc/uptime)
    
    # Process count
    local process_count=$(ps aux | wc -l)
    
    # Logged in users
    local logged_in_users=$(who | awk '{print $1}' | sort -u | tr '\n' ',' | sed 's/,$//')
    
    # Public IP
    local public_ip=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || echo "")
    
    cat << EOF
{
    "cpu_usage": $cpu_usage,
    "ram_usage": $ram_usage,
    "ram_used_gb": $ram_used_gb,
    "disk_usage": $disk_usage,
    "disk_used_gb": $disk_used_gb,
    "disk_free_gb": $disk_free_gb,
    "uptime_seconds": $uptime_seconds,
    "process_count": $process_count,
    "logged_in_users": ["$logged_in_users"],
    "public_ip": "$public_ip"
}
EOF
}

# Get installed software (Debian/Ubuntu)
get_software_inventory() {
    echo "["
    local first=true
    
    if command -v dpkg &> /dev/null; then
        dpkg-query -W -f='${Package}\t${Version}\t${Maintainer}\n' 2>/dev/null | while IFS=$'\t' read -r name version vendor; do
            if [ "$first" = true ]; then
                first=false
            else
                echo ","
            fi
            echo "  {\"name\": \"$name\", \"version\": \"$version\", \"vendor\": \"$vendor\"}"
        done
    elif command -v rpm &> /dev/null; then
        rpm -qa --queryformat '%{NAME}\t%{VERSION}\t%{VENDOR}\n' 2>/dev/null | while IFS=$'\t' read -r name version vendor; do
            if [ "$first" = true ]; then
                first=false
            else
                echo ","
            fi
            echo "  {\"name\": \"$name\", \"version\": \"$version\", \"vendor\": \"$vendor\"}"
        done
    fi
    
    echo "]"
}

# Get hardware inventory
get_hardware_inventory() {
    echo "["
    
    # CPU
    local cpu_model=$(grep "model name" /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)
    local cpu_vendor=$(grep "vendor_id" /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)
    local cpu_cores=$(nproc)
    echo "  {\"component_type\": \"cpu\", \"manufacturer\": \"$cpu_vendor\", \"model\": \"$cpu_model\", \"capacity\": \"$cpu_cores Cores\"},"
    
    # Memory
    local mem_total=$(free -h | awk '/Mem:/ {print $2}')
    echo "  {\"component_type\": \"memory\", \"capacity\": \"$mem_total\"},"
    
    # Disk
    lsblk -d -o NAME,SIZE,MODEL,SERIAL 2>/dev/null | tail -n +2 | while read -r name size model serial; do
        echo "  {\"component_type\": \"disk\", \"model\": \"$model\", \"serial_number\": \"$serial\", \"capacity\": \"$size\"},"
    done
    
    # Network
    local net_model=$(lspci 2>/dev/null | grep -i ethernet | head -1 | cut -d':' -f3 | xargs || echo "Unknown")
    local mac=$(ip link show | grep -A1 "state UP" | grep "ether" | head -1 | awk '{print $2}')
    echo "  {\"component_type\": \"network\", \"model\": \"$net_model\", \"serial_number\": \"$mac\"}"
    
    echo "]"
}

# Make API request
api_request() {
    local endpoint="$1"
    local method="$2"
    local data="$3"
    
    local url="${SERVER_URL}/api${endpoint}"
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl -s -X POST "$url" \
            -H "Content-Type: application/json" \
            -H "X-Agent-Version: $AGENT_VERSION" \
            -d "$data" \
            --max-time 30
    else
        curl -s -X GET "$url" \
            -H "X-Agent-Version: $AGENT_VERSION" \
            --max-time 30
    fi
}

# Register agent
register_agent() {
    log "INFO" "Registering agent with token: $ENROLLMENT_TOKEN"
    
    local system_info=$(get_system_info)
    local data=$(echo "$system_info" | jq ". + {\"token\": \"$ENROLLMENT_TOKEN\"}")
    
    local result=$(api_request "/rmm/enroll" "POST" "$data")
    
    if echo "$result" | jq -e '.success' > /dev/null 2>&1; then
        AGENT_ID=$(echo "$result" | jq -r '.agent_id')
        DEVICE_ID=$(echo "$result" | jq -r '.device_id')
        
        # Save config
        cat > "$CONFIG_FILE" << EOF
{
    "agent_id": "$AGENT_ID",
    "device_id": "$DEVICE_ID",
    "server_url": "$SERVER_URL",
    "enrollment_token": "$ENROLLMENT_TOKEN",
    "registered_at": "$(date -Iseconds)"
}
EOF
        log "INFO" "Agent registered successfully. Device ID: $DEVICE_ID"
        return 0
    else
        log "ERROR" "Failed to register agent: $result"
        return 1
    fi
}

# Send heartbeat
send_heartbeat() {
    if [ -z "$AGENT_ID" ]; then
        log "WARN" "Agent not registered, skipping heartbeat"
        return
    fi
    
    local metrics=$(get_metrics)
    local data=$(echo "$metrics" | jq ". + {\"agent_id\": \"$AGENT_ID\"}")
    
    local result=$(api_request "/rmm/heartbeat" "POST" "$data")
    
    if echo "$result" | jq -e '.success' > /dev/null 2>&1; then
        local cpu=$(echo "$metrics" | jq -r '.cpu_usage')
        local ram=$(echo "$metrics" | jq -r '.ram_usage')
        local disk=$(echo "$metrics" | jq -r '.disk_usage')
        log "INFO" "Heartbeat sent. CPU: ${cpu}%, RAM: ${ram}%, Disk: ${disk}%"
        
        # Check for pending jobs
        local pending_jobs=$(echo "$result" | jq -r '.pending_jobs // []')
        local job_count=$(echo "$pending_jobs" | jq 'length')
        
        if [ "$job_count" -gt 0 ]; then
            log "INFO" "Found $job_count pending job(s)"
            # Execute jobs (simplified)
        fi
    fi
}

# Send inventory
send_inventory() {
    if [ -z "$AGENT_ID" ]; then
        return
    fi
    
    log "INFO" "Collecting inventory..."
    
    local software=$(get_software_inventory)
    local hardware=$(get_hardware_inventory)
    
    local data=$(cat << EOF
{
    "agent_id": "$AGENT_ID",
    "software": $software,
    "hardware": $hardware
}
EOF
)
    
    local result=$(api_request "/rmm/inventory/report" "POST" "$data")
    
    if echo "$result" | jq -e '.success' > /dev/null 2>&1; then
        local sw_count=$(echo "$result" | jq -r '.software_count // 0')
        local hw_count=$(echo "$result" | jq -r '.hardware_count // 0')
        log "INFO" "Inventory reported: $sw_count software, $hw_count hardware items"
    fi
}

# Install as systemd service
install_service() {
    cat > /etc/systemd/system/itrex-rmm-agent.service << EOF
[Unit]
Description=IT REX RMM Agent
After=network.target

[Service]
Type=simple
ExecStart=/bin/bash $0 -t "$ENROLLMENT_TOKEN" -s "$SERVER_URL" -i $HEARTBEAT_INTERVAL
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable itrex-rmm-agent
    systemctl start itrex-rmm-agent
    log "INFO" "Service installed and started"
}

# Main execution
log "INFO" "IT REX RMM Agent v$AGENT_VERSION starting..."
log "INFO" "Server: $SERVER_URL"

# Check dependencies
for cmd in curl jq bc; do
    if ! command -v $cmd &> /dev/null; then
        log "ERROR" "Required command not found: $cmd"
        log "INFO" "Install with: apt-get install -y curl jq bc"
        exit 1
    fi
done

# Load existing config or register
if [ -f "$CONFIG_FILE" ]; then
    AGENT_ID=$(jq -r '.agent_id' "$CONFIG_FILE")
    DEVICE_ID=$(jq -r '.device_id' "$CONFIG_FILE")
    log "INFO" "Loaded existing configuration. Agent ID: $AGENT_ID"
else
    if [ -z "$ENROLLMENT_TOKEN" ]; then
        log "ERROR" "No enrollment token provided and no existing config found"
        echo "Usage: $0 -t <enrollment_token> [-s <server_url>] [-i <interval>]"
        exit 1
    fi
    
    if ! register_agent; then
        log "ERROR" "Registration failed. Exiting."
        exit 1
    fi
fi

# Initial inventory
send_inventory

# Heartbeat loop
inventory_counter=0
while true; do
    send_heartbeat
    
    # Send inventory every hour
    ((inventory_counter++))
    if [ $inventory_counter -ge $((3600 / HEARTBEAT_INTERVAL)) ]; then
        send_inventory
        inventory_counter=0
    fi
    
    sleep $HEARTBEAT_INTERVAL
done
