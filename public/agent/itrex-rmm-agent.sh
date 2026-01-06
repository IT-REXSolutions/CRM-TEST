#!/bin/bash
#
# IT REX RMM Agent - Linux Installation Script
# Version: 1.0
# Author: IT REX Solutions
#
# Usage: sudo ./itrex-rmm-agent.sh -t "ENROLLMENT_TOKEN" -u "API_URL"
#

set -e

# Default values
HEARTBEAT_INTERVAL=60
AGENT_PATH="/opt/itrex-rmm"
LOG_FILE="$AGENT_PATH/agent.log"
CONFIG_FILE="$AGENT_PATH/config.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Banner
show_banner() {
    echo -e "${CYAN}"
    echo '  ██╗████████╗    ██████╗ ███████╗██╗  ██╗'
    echo '  ██║╚══██╔══╝    ██╔══██╗██╔════╝╚██╗██╔╝'
    echo '  ██║   ██║       ██████╔╝█████╗   ╚███╔╝ '
    echo '  ██║   ██║       ██╔══██╗██╔══╝   ██╔██╗ '
    echo '  ██║   ██║       ██║  ██║███████╗██╔╝ ██╗'
    echo '  ╚═╝   ╚═╝       ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝'
    echo ''
    echo '  RMM Agent Installer v1.0 (Linux)'
    echo -e "${NC}"
}

# Logging
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE" 2>/dev/null || true
    
    case $level in
        ERROR)   echo -e "${RED}[$timestamp] [$level] $message${NC}" ;;
        WARNING) echo -e "${YELLOW}[$timestamp] [$level] $message${NC}" ;;
        SUCCESS) echo -e "${GREEN}[$timestamp] [$level] $message${NC}" ;;
        *)       echo "[$timestamp] [$level] $message" ;;
    esac
}

# Parse arguments
parse_args() {
    while getopts "t:u:h:s" opt; do
        case $opt in
            t) ENROLLMENT_TOKEN="$OPTARG" ;;
            u) API_URL="$OPTARG" ;;
            h) HEARTBEAT_INTERVAL="$OPTARG" ;;
            s) SERVICE_MODE=true ;;
            \?) echo "Invalid option: -$OPTARG" >&2; exit 1 ;;
        esac
    done
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}Please run as root (sudo)${NC}"
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    log "INFO" "Installing dependencies..."
    
    if command -v apt-get &> /dev/null; then
        apt-get update -qq
        apt-get install -y -qq curl jq bc dmidecode
    elif command -v yum &> /dev/null; then
        yum install -y -q curl jq bc dmidecode
    elif command -v dnf &> /dev/null; then
        dnf install -y -q curl jq bc dmidecode
    else
        log "WARNING" "Could not detect package manager. Ensure curl, jq, and bc are installed."
    fi
}

# Get system information
get_system_info() {
    local hostname=$(hostname)
    local os_type=$(uname -s)
    local os_version=""
    local os_build=$(uname -r)
    
    # Get OS version
    if [ -f /etc/os-release ]; then
        os_version=$(grep PRETTY_NAME /etc/os-release | cut -d= -f2 | tr -d '"')
    elif [ -f /etc/redhat-release ]; then
        os_version=$(cat /etc/redhat-release)
    else
        os_version="$os_type $os_build"
    fi
    
    local cpu_model=$(grep "model name" /proc/cpuinfo | head -1 | cut -d: -f2 | xargs)
    local cpu_cores=$(nproc)
    local ram_total_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local ram_total_gb=$(echo "scale=2; $ram_total_kb / 1024 / 1024" | bc)
    
    # Get disk info
    local disk_total_kb=$(df / | tail -1 | awk '{print $2}')
    local disk_total_gb=$(echo "scale=2; $disk_total_kb / 1024 / 1024" | bc)
    
    # Get network info
    local primary_interface=$(ip route | grep default | awk '{print $5}' | head -1)
    local mac_address=$(ip link show $primary_interface 2>/dev/null | grep ether | awk '{print $2}')
    local ip_address=$(ip addr show $primary_interface 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d/ -f1)
    
    cat << EOF
{
    "hostname": "$hostname",
    "os_type": "$os_type",
    "os_version": "$os_version",
    "os_build": "$os_build",
    "cpu_model": "$cpu_model",
    "cpu_cores": $cpu_cores,
    "ram_total_gb": $ram_total_gb,
    "disk_total_gb": $disk_total_gb,
    "mac_address": "$mac_address",
    "ip_address": "$ip_address"
}
EOF
}

# Get metrics
get_metrics() {
    # CPU usage (average over 1 second)
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    if [ -z "$cpu_usage" ]; then
        cpu_usage=$(vmstat 1 2 | tail -1 | awk '{print 100-$15}')
    fi
    
    # RAM usage
    local mem_info=$(free -m | grep Mem)
    local ram_total=$(echo $mem_info | awk '{print $2}')
    local ram_used=$(echo $mem_info | awk '{print $3}')
    local ram_usage=$(echo "scale=2; $ram_used * 100 / $ram_total" | bc)
    local ram_used_gb=$(echo "scale=2; $ram_used / 1024" | bc)
    
    # Disk usage
    local disk_info=$(df / | tail -1)
    local disk_used=$(echo $disk_info | awk '{print $3}')
    local disk_total=$(echo $disk_info | awk '{print $2}')
    local disk_usage=$(echo $disk_info | awk '{print $5}' | tr -d '%')
    local disk_used_gb=$(echo "scale=2; $disk_used / 1024 / 1024" | bc)
    local disk_free=$(echo $disk_info | awk '{print $4}')
    local disk_free_gb=$(echo "scale=2; $disk_free / 1024 / 1024" | bc)
    
    # Uptime
    local uptime_seconds=$(cat /proc/uptime | awk '{print int($1)}')
    
    # Process count
    local process_count=$(ps aux | wc -l)
    
    # Logged in users
    local logged_users=$(who | awk '{print $1}' | sort | uniq | jq -R . | jq -s .)
    
    # IP addresses
    local primary_interface=$(ip route | grep default | awk '{print $5}' | head -1)
    local ip_address=$(ip addr show $primary_interface 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d/ -f1)
    
    # Public IP
    local public_ip=$(curl -s --connect-timeout 5 https://api.ipify.org 2>/dev/null || echo "")
    
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
    "logged_in_users": $logged_users,
    "ip_address": "$ip_address",
    "public_ip": "$public_ip"
}
EOF
}

# Get software inventory
get_software_inventory() {
    local software="[]"
    
    if command -v dpkg &> /dev/null; then
        software=$(dpkg -l | grep ^ii | awk '{print "{\"name\":\"" $2 "\",\"version\":\"" $3 "\",\"vendor\":\"\"}"}' | jq -s '.')
    elif command -v rpm &> /dev/null; then
        software=$(rpm -qa --queryformat '{"name":"%{NAME}","version":"%{VERSION}","vendor":"%{VENDOR}"}\n' | jq -s '.')
    fi
    
    echo "$software"
}

# Get hardware inventory
get_hardware_inventory() {
    local hardware="[]"
    
    # CPU
    local cpu_info=$(cat /proc/cpuinfo | grep -m1 "model name" | cut -d: -f2 | xargs)
    local cpu_vendor=$(cat /proc/cpuinfo | grep -m1 "vendor_id" | cut -d: -f2 | xargs)
    
    # Memory
    local mem_total=$(free -h | grep Mem | awk '{print $2}')
    
    # Disk
    local disk_model=$(lsblk -d -o MODEL | tail -n +2 | head -1 | xargs)
    local disk_size=$(lsblk -d -o SIZE | tail -n +2 | head -1 | xargs)
    local disk_serial=$(lsblk -d -o SERIAL | tail -n +2 | head -1 | xargs 2>/dev/null || echo "")
    
    # Network
    local net_interface=$(ip route | grep default | awk '{print $5}' | head -1)
    local net_mac=$(ip link show $net_interface 2>/dev/null | grep ether | awk '{print $2}')
    local net_speed=$(ethtool $net_interface 2>/dev/null | grep Speed | awk '{print $2}' || echo "Unknown")
    
    cat << EOF
[
    {"component_type": "cpu", "manufacturer": "$cpu_vendor", "model": "$cpu_info", "capacity": "$(nproc) cores"},
    {"component_type": "memory", "model": "System Memory", "capacity": "$mem_total"},
    {"component_type": "disk", "model": "$disk_model", "capacity": "$disk_size", "serial_number": "$disk_serial"},
    {"component_type": "network", "model": "$net_interface", "serial_number": "$net_mac", "speed": "$net_speed"}
]
EOF
}

# Register agent
register_agent() {
    log "INFO" "Registering agent with token: ${ENROLLMENT_TOKEN:0:10}***"
    
    local system_info=$(get_system_info)
    local payload=$(echo "$system_info" | jq --arg token "$ENROLLMENT_TOKEN" '. + {token: $token}')
    
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        --connect-timeout 30 \
        "$API_URL/rmm/enroll")
    
    local success=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success" = "true" ]; then
        AGENT_ID=$(echo "$response" | jq -r '.agent_id')
        DEVICE_ID=$(echo "$response" | jq -r '.device_id')
        log "SUCCESS" "Agent registered successfully. Device ID: $DEVICE_ID, Agent ID: $AGENT_ID"
        return 0
    else
        local error=$(echo "$response" | jq -r '.error // "Unknown error"')
        log "ERROR" "Registration failed: $error"
        return 1
    fi
}

# Send heartbeat
send_heartbeat() {
    local metrics=$(get_metrics)
    local payload=$(echo "$metrics" | jq --arg agent_id "$AGENT_ID" '. + {agent_id: $agent_id}')
    
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-Agent-Token: $AGENT_ID" \
        -d "$payload" \
        --connect-timeout 30 \
        "$API_URL/rmm/heartbeat")
    
    local success=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success" = "true" ]; then
        log "INFO" "Heartbeat sent successfully"
        
        # Check for pending jobs
        local pending_jobs=$(echo "$response" | jq -r '.pending_jobs // []')
        if [ "$pending_jobs" != "[]" ] && [ "$pending_jobs" != "null" ]; then
            execute_jobs "$pending_jobs"
        fi
    else
        log "ERROR" "Heartbeat failed"
    fi
}

# Send inventory
send_inventory() {
    log "INFO" "Collecting and sending inventory..."
    
    local software=$(get_software_inventory)
    local hardware=$(get_hardware_inventory)
    
    local payload=$(jq -n \
        --arg agent_id "$AGENT_ID" \
        --argjson software "$software" \
        --argjson hardware "$hardware" \
        '{agent_id: $agent_id, software: $software, hardware: $hardware}')
    
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-Agent-Token: $AGENT_ID" \
        -d "$payload" \
        --connect-timeout 60 \
        "$API_URL/rmm/inventory/report")
    
    local success=$(echo "$response" | jq -r '.success // false')
    
    if [ "$success" = "true" ]; then
        local sw_count=$(echo "$response" | jq -r '.software_count // 0')
        local hw_count=$(echo "$response" | jq -r '.hardware_count // 0')
        log "SUCCESS" "Inventory sent: $sw_count software, $hw_count hardware items"
    else
        log "ERROR" "Inventory send failed"
    fi
}

# Execute pending jobs
execute_jobs() {
    local jobs="$1"
    
    echo "$jobs" | jq -c '.[]' | while read job; do
        local job_id=$(echo "$job" | jq -r '.id')
        local script_content=$(echo "$job" | jq -r '.deployment_jobs.script_content // ""')
        local command=$(echo "$job" | jq -r '.deployment_jobs.command // ""')
        
        log "INFO" "Executing job: $job_id"
        
        local output=""
        local exit_code=0
        local status="success"
        
        if [ -n "$script_content" ] && [ "$script_content" != "null" ]; then
            output=$(bash -c "$script_content" 2>&1) || exit_code=$?
        elif [ -n "$command" ] && [ "$command" != "null" ]; then
            output=$(bash -c "$command" 2>&1) || exit_code=$?
        fi
        
        if [ $exit_code -ne 0 ]; then
            status="failed"
        fi
        
        # Report result
        local report_payload=$(jq -n \
            --arg exec_id "$job_id" \
            --arg status "$status" \
            --argjson exit_code "$exit_code" \
            --arg output "${output:0:10000}" \
            '{execution_id: $exec_id, status: $status, exit_code: $exit_code, output: $output}')
        
        curl -s -X POST \
            -H "Content-Type: application/json" \
            -H "X-Agent-Token: $AGENT_ID" \
            -d "$report_payload" \
            "$API_URL/rmm/deployment-jobs/report" > /dev/null
        
        log "INFO" "Job $job_id completed with status: $status"
    done
}

# Install systemd service
install_service() {
    log "INFO" "Installing IT REX RMM Agent service..."
    
    # Create agent directory
    mkdir -p "$AGENT_PATH"
    
    # Save config
    cat > "$CONFIG_FILE" << EOF
{
    "api_url": "$API_URL",
    "agent_id": "$AGENT_ID",
    "device_id": "$DEVICE_ID",
    "heartbeat_interval": $HEARTBEAT_INTERVAL,
    "inventory_interval": 3600
}
EOF
    
    # Copy script
    cp "$0" "$AGENT_PATH/agent.sh"
    chmod +x "$AGENT_PATH/agent.sh"
    
    # Create systemd service
    cat > /etc/systemd/system/itrex-rmm.service << EOF
[Unit]
Description=IT REX RMM Agent
After=network.target

[Service]
Type=simple
ExecStart=$AGENT_PATH/agent.sh -s
Restart=always
RestartSec=30
User=root

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable itrex-rmm
    systemctl start itrex-rmm
    
    log "SUCCESS" "Agent service installed and started"
}

# Service mode
run_service_mode() {
    # Load config
    if [ ! -f "$CONFIG_FILE" ]; then
        log "ERROR" "Config file not found"
        exit 1
    fi
    
    API_URL=$(jq -r '.api_url' "$CONFIG_FILE")
    AGENT_ID=$(jq -r '.agent_id' "$CONFIG_FILE")
    DEVICE_ID=$(jq -r '.device_id' "$CONFIG_FILE")
    HEARTBEAT_INTERVAL=$(jq -r '.heartbeat_interval' "$CONFIG_FILE")
    INVENTORY_INTERVAL=$(jq -r '.inventory_interval // 3600' "$CONFIG_FILE")
    
    log "INFO" "Starting IT REX RMM Agent in service mode..."
    
    local last_inventory=$(date +%s)
    
    while true; do
        send_heartbeat
        
        # Send inventory every hour
        local now=$(date +%s)
        if [ $((now - last_inventory)) -ge $INVENTORY_INTERVAL ]; then
            send_inventory
            last_inventory=$now
        fi
        
        sleep $HEARTBEAT_INTERVAL
    done
}

# Main
main() {
    parse_args "$@"
    
    # Service mode
    if [ "$SERVICE_MODE" = true ]; then
        run_service_mode
        exit 0
    fi
    
    show_banner
    check_root
    
    # Create directories
    mkdir -p "$AGENT_PATH"
    touch "$LOG_FILE"
    
    # Validate arguments
    if [ -z "$ENROLLMENT_TOKEN" ] || [ -z "$API_URL" ]; then
        echo -e "${RED}Usage: sudo $0 -t \"ENROLLMENT_TOKEN\" -u \"API_URL\"${NC}"
        echo ""
        echo "Options:"
        echo "  -t    Enrollment token from IT REX ServiceDesk"
        echo "  -u    API URL (e.g., https://yourservicedesk.com/api)"
        echo "  -h    Heartbeat interval in seconds (default: 60)"
        exit 1
    fi
    
    log "INFO" "Starting IT REX RMM Agent installation..."
    log "INFO" "API URL: $API_URL"
    log "INFO" "Enrollment Token: ${ENROLLMENT_TOKEN:0:10}***"
    
    install_dependencies
    
    if register_agent; then
        install_service
        send_inventory
        
        echo ""
        echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  IT REX RMM Agent installed successfully!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
        echo ""
        echo "  Device ID: $DEVICE_ID"
        echo "  Agent ID:  $AGENT_ID"
        echo "  Log file:  $LOG_FILE"
        echo ""
        echo "  Service status: systemctl status itrex-rmm"
        echo ""
    else
        echo ""
        echo -e "${RED}Installation failed. Please check the enrollment token and try again.${NC}"
        echo ""
        exit 1
    fi
}

main "$@"
