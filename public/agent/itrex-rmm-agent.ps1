#Requires -RunAsAdministrator
<#
.SYNOPSIS
    IT REX RMM Agent - Windows PowerShell Installation Script

.DESCRIPTION
    Installs and configures the IT REX RMM Agent on Windows systems.
    Connects to the IT REX ServiceDesk for monitoring and management.

.PARAMETER EnrollmentToken
    The enrollment token from the IT REX ServiceDesk

.PARAMETER ApiUrl
    The base URL of the IT REX ServiceDesk API

.EXAMPLE
    .\itrex-rmm-agent.ps1 -EnrollmentToken "ITREX-ABC123-XYZ" -ApiUrl "https://yourservicedesk.com/api"

.NOTES
    Version: 1.0
    Author: IT REX Solutions
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$EnrollmentToken,
    
    [Parameter(Mandatory=$true)]
    [string]$ApiUrl,
    
    [int]$HeartbeatInterval = 60,
    
    [switch]$InstallRustDesk
)

$ErrorActionPreference = "Stop"
$AgentPath = "$env:ProgramData\ITREXAgent"
$LogFile = "$AgentPath\agent.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    Add-Content -Path $LogFile -Value $logEntry -ErrorAction SilentlyContinue
    switch ($Level) {
        "ERROR" { Write-Host $logEntry -ForegroundColor Red }
        "WARNING" { Write-Host $logEntry -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $logEntry -ForegroundColor Green }
        default { Write-Host $logEntry }
    }
}

function Get-SystemInfo {
    $computerInfo = Get-ComputerInfo
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object -First 1
    $network = Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1
    $ip = Get-NetIPAddress -InterfaceIndex $network.ifIndex -AddressFamily IPv4 | Select-Object -First 1
    
    return @{
        hostname = $env:COMPUTERNAME
        os_type = "Windows"
        os_version = $os.Caption
        os_build = $os.BuildNumber
        cpu_model = $cpu.Name
        cpu_cores = $cpu.NumberOfCores
        ram_total_gb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
        disk_total_gb = [math]::Round($disk.Size / 1GB, 2)
        mac_address = $network.MacAddress
        ip_address = $ip.IPAddress
    }
}

function Get-Metrics {
    $cpu = (Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples.CookedValue
    $os = Get-CimInstance Win32_OperatingSystem
    $ramUsed = ($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize * 100
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object -First 1
    $diskUsed = ($disk.Size - $disk.FreeSpace) / $disk.Size * 100
    $uptime = (Get-Date) - $os.LastBootUpTime
    $processes = (Get-Process).Count
    $loggedUsers = (Get-CimInstance Win32_ComputerSystem).UserName
    
    return @{
        cpu_usage = [math]::Round($cpu, 2)
        ram_usage = [math]::Round($ramUsed, 2)
        ram_used_gb = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1MB, 2)
        disk_usage = [math]::Round($diskUsed, 2)
        disk_used_gb = [math]::Round(($disk.Size - $disk.FreeSpace) / 1GB, 2)
        disk_free_gb = [math]::Round($disk.FreeSpace / 1GB, 2)
        uptime_seconds = [math]::Round($uptime.TotalSeconds)
        process_count = $processes
        logged_in_users = @($loggedUsers)
        ip_address = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1).IPAddress
        public_ip = (Invoke-RestMethod -Uri "https://api.ipify.org?format=json" -TimeoutSec 5).ip
    }
}

function Get-SoftwareInventory {
    $software = @()
    
    # 64-bit software
    $software += Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName } |
        Select-Object @{N="name";E={$_.DisplayName}}, @{N="version";E={$_.DisplayVersion}}, @{N="vendor";E={$_.Publisher}}, @{N="install_date";E={$_.InstallDate}}, @{N="install_location";E={$_.InstallLocation}}
    
    # 32-bit software on 64-bit Windows
    $software += Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName } |
        Select-Object @{N="name";E={$_.DisplayName}}, @{N="version";E={$_.DisplayVersion}}, @{N="vendor";E={$_.Publisher}}, @{N="install_date";E={$_.InstallDate}}, @{N="install_location";E={$_.InstallLocation}}
    
    return $software | Select-Object -Unique name, version, vendor, install_date, install_location
}

function Get-HardwareInventory {
    $hardware = @()
    
    # CPU
    Get-CimInstance Win32_Processor | ForEach-Object {
        $hardware += @{
            component_type = "cpu"
            manufacturer = $_.Manufacturer
            model = $_.Name
            serial_number = $_.ProcessorId
            capacity = "$($_.MaxClockSpeed) MHz"
            speed = "$($_.CurrentClockSpeed) MHz"
        }
    }
    
    # RAM
    Get-CimInstance Win32_PhysicalMemory | ForEach-Object {
        $hardware += @{
            component_type = "memory"
            manufacturer = $_.Manufacturer
            model = $_.PartNumber.Trim()
            serial_number = $_.SerialNumber.Trim()
            capacity = "$([math]::Round($_.Capacity / 1GB)) GB"
            speed = "$($_.Speed) MHz"
        }
    }
    
    # Disks
    Get-CimInstance Win32_DiskDrive | ForEach-Object {
        $hardware += @{
            component_type = "disk"
            manufacturer = $_.Manufacturer
            model = $_.Model
            serial_number = $_.SerialNumber.Trim()
            capacity = "$([math]::Round($_.Size / 1GB)) GB"
            interface_type = $_.InterfaceType
        }
    }
    
    # Network Adapters
    Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | ForEach-Object {
        $hardware += @{
            component_type = "network"
            manufacturer = $_.DriverProvider
            model = $_.InterfaceDescription
            serial_number = $_.MacAddress
            speed = "$($_.LinkSpeed)"
        }
    }
    
    return $hardware
}

function Invoke-APIRequest {
    param(
        [string]$Endpoint,
        [string]$Method = "POST",
        [hashtable]$Body
    )
    
    $uri = "$ApiUrl$Endpoint"
    $headers = @{
        "Content-Type" = "application/json"
        "X-Agent-Token" = $script:AgentId
    }
    
    try {
        $jsonBody = $Body | ConvertTo-Json -Depth 10 -Compress
        $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $jsonBody -TimeoutSec 30
        return $response
    }
    catch {
        Write-Log "API request failed: $($_.Exception.Message)" "ERROR"
        return $null
    }
}

function Register-Agent {
    Write-Log "Registering agent with token: $EnrollmentToken"
    
    $systemInfo = Get-SystemInfo
    $body = @{
        token = $EnrollmentToken
    } + $systemInfo
    
    try {
        $uri = "$ApiUrl/rmm/enroll"
        $jsonBody = $body | ConvertTo-Json -Depth 10
        $response = Invoke-RestMethod -Uri $uri -Method POST -ContentType "application/json" -Body $jsonBody -TimeoutSec 30
        
        if ($response.success) {
            Write-Log "Agent registered successfully. Device ID: $($response.device_id), Agent ID: $($response.agent_id)" "SUCCESS"
            return $response
        }
        else {
            Write-Log "Registration failed: $($response.error)" "ERROR"
            return $null
        }
    }
    catch {
        Write-Log "Registration failed: $($_.Exception.Message)" "ERROR"
        return $null
    }
}

function Send-Heartbeat {
    $metrics = Get-Metrics
    $body = @{
        agent_id = $script:AgentId
    } + $metrics
    
    $response = Invoke-APIRequest -Endpoint "/rmm/heartbeat" -Body $body
    
    if ($response) {
        Write-Log "Heartbeat sent successfully"
        
        # Process pending jobs
        if ($response.pending_jobs -and $response.pending_jobs.Count -gt 0) {
            foreach ($job in $response.pending_jobs) {
                Execute-Job -Job $job
            }
        }
    }
}

function Send-Inventory {
    Write-Log "Collecting and sending inventory..."
    
    $software = Get-SoftwareInventory
    $hardware = Get-HardwareInventory
    
    $body = @{
        agent_id = $script:AgentId
        software = $software
        hardware = $hardware
    }
    
    $response = Invoke-APIRequest -Endpoint "/rmm/inventory/report" -Body $body
    
    if ($response -and $response.success) {
        Write-Log "Inventory sent: $($response.software_count) software, $($response.hardware_count) hardware items" "SUCCESS"
    }
}

function Execute-Job {
    param([object]$Job)
    
    Write-Log "Executing job: $($Job.id)"
    
    try {
        $jobInfo = $Job.deployment_jobs
        $startTime = Get-Date
        $output = ""
        $exitCode = 0
        
        if ($jobInfo.script_content) {
            # Execute PowerShell script
            $result = Invoke-Expression $jobInfo.script_content 2>&1
            $output = $result | Out-String
        }
        elseif ($jobInfo.command) {
            # Execute command
            $result = Invoke-Expression $jobInfo.command 2>&1
            $output = $result | Out-String
        }
        
        # Report result
        $body = @{
            execution_id = $Job.id
            status = "success"
            exit_code = $exitCode
            output = $output.Substring(0, [Math]::Min(10000, $output.Length))
        }
        
        Invoke-APIRequest -Endpoint "/rmm/deployment-jobs/report" -Body $body
        Write-Log "Job completed: $($Job.id)" "SUCCESS"
    }
    catch {
        $body = @{
            execution_id = $Job.id
            status = "failed"
            exit_code = 1
            error_output = $_.Exception.Message
        }
        
        Invoke-APIRequest -Endpoint "/rmm/deployment-jobs/report" -Body $body
        Write-Log "Job failed: $($Job.id) - $($_.Exception.Message)" "ERROR"
    }
}

function Install-AgentService {
    Write-Log "Installing IT REX RMM Agent service..."
    
    # Create agent directory
    New-Item -ItemType Directory -Path $AgentPath -Force | Out-Null
    
    # Create config file
    $config = @{
        api_url = $ApiUrl
        agent_id = $script:AgentId
        device_id = $script:DeviceId
        heartbeat_interval = $HeartbeatInterval
        inventory_interval = 3600  # 1 hour
    }
    
    $config | ConvertTo-Json | Set-Content "$AgentPath\config.json"
    
    # Copy script to agent directory
    Copy-Item $PSCommandPath "$AgentPath\agent.ps1" -Force
    
    # Create scheduled task for heartbeat
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$AgentPath\agent.ps1`" -RunService"
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    
    Register-ScheduledTask -TaskName "ITREXRMMAgent" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
    
    Write-Log "Agent service installed successfully" "SUCCESS"
}

function Start-ServiceMode {
    # Load config
    $configPath = "$AgentPath\config.json"
    if (Test-Path $configPath) {
        $config = Get-Content $configPath | ConvertFrom-Json
        $script:ApiUrl = $config.api_url
        $script:AgentId = $config.agent_id
        $script:DeviceId = $config.device_id
        $script:HeartbeatInterval = $config.heartbeat_interval
    }
    else {
        Write-Log "Config file not found" "ERROR"
        exit 1
    }
    
    Write-Log "Starting IT REX RMM Agent in service mode..."
    
    $lastInventory = Get-Date
    $inventoryInterval = 3600  # 1 hour
    
    while ($true) {
        try {
            Send-Heartbeat
            
            # Send inventory every hour
            if ((Get-Date) -gt $lastInventory.AddSeconds($inventoryInterval)) {
                Send-Inventory
                $lastInventory = Get-Date
            }
        }
        catch {
            Write-Log "Error in service loop: $($_.Exception.Message)" "ERROR"
        }
        
        Start-Sleep -Seconds $HeartbeatInterval
    }
}

# Main execution
Write-Host @"

  ██╗████████╗    ██████╗ ███████╗██╗  ██╗
  ██║╚══██╔══╝    ██╔══██╗██╔════╝╚██╗██╔╝
  ██║   ██║       ██████╔╝█████╗   ╚███╔╝ 
  ██║   ██║       ██╔══██╗██╔══╝   ██╔██╗ 
  ██║   ██║       ██║  ██║███████╗██╔╝ ██╗
  ╚═╝   ╚═╝       ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
                                          
  RMM Agent Installer v1.0

"@ -ForegroundColor Cyan

# Create agent directory and log file
New-Item -ItemType Directory -Path $AgentPath -Force | Out-Null
New-Item -ItemType File -Path $LogFile -Force | Out-Null

if ($PSBoundParameters.ContainsKey('RunService')) {
    Start-ServiceMode
    exit 0
}

Write-Log "Starting IT REX RMM Agent installation..."
Write-Log "API URL: $ApiUrl"
Write-Log "Enrollment Token: $($EnrollmentToken.Substring(0, [Math]::Min(10, $EnrollmentToken.Length)))***"

# Register with ServiceDesk
$registration = Register-Agent

if ($registration -and $registration.success) {
    $script:AgentId = $registration.agent_id
    $script:DeviceId = $registration.device_id
    
    # Install service
    Install-AgentService
    
    # Send initial inventory
    Send-Inventory
    
    # Start service
    Start-ScheduledTask -TaskName "ITREXRMMAgent"
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  IT REX RMM Agent installed successfully!" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Device ID: $script:DeviceId"
    Write-Host "  Agent ID:  $script:AgentId"
    Write-Host "  Log file:  $LogFile"
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "Installation failed. Please check the enrollment token and try again." -ForegroundColor Red
    Write-Host ""
    exit 1
}
