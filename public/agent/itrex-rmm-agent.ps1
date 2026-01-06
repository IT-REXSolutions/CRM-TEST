<#
.SYNOPSIS
    IT REX RMM Agent for Windows
.DESCRIPTION
    Remote Monitoring & Management Agent
    Sends heartbeat, metrics, and inventory to IT REX ServiceDesk
.NOTES
    Version: 1.0.0
    Author: IT REX Solutions
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$EnrollmentToken,
    
    [Parameter(Mandatory=$false)]
    [string]$ServerUrl = "https://your-servicedesk.domain.de",
    
    [Parameter(Mandatory=$false)]
    [int]$HeartbeatInterval = 60
)

# Configuration
$AgentVersion = "1.0.0"
$AgentId = $null
$DeviceId = $null
$ConfigPath = "$env:ProgramData\ITREX-RMM"
$ConfigFile = "$ConfigPath\agent.json"
$LogFile = "$ConfigPath\agent.log"

# Create config directory
if (!(Test-Path $ConfigPath)) {
    New-Item -ItemType Directory -Path $ConfigPath -Force | Out-Null
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    Add-Content -Path $LogFile -Value $logEntry
    if ($Level -eq "ERROR") {
        Write-Host $logEntry -ForegroundColor Red
    } else {
        Write-Host $logEntry
    }
}

function Get-SystemInfo {
    $os = Get-CimInstance Win32_OperatingSystem
    $cs = Get-CimInstance Win32_ComputerSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    $network = Get-NetAdapter | Where-Object Status -eq "Up" | Select-Object -First 1
    
    return @{
        hostname = $env:COMPUTERNAME
        domain = $env:USERDOMAIN
        os_type = "windows"
        os_version = $os.Caption
        os_build = $os.BuildNumber
        cpu_model = $cpu.Name
        cpu_cores = $cs.NumberOfLogicalProcessors
        ram_total_gb = [math]::Round($cs.TotalPhysicalMemory / 1GB, 2)
        disk_total_gb = [math]::Round($disk.Size / 1GB, 2)
        disk_free_gb = [math]::Round($disk.FreeSpace / 1GB, 2)
        mac_address = $network.MacAddress
        ip_address = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" } | Select-Object -First 1).IPAddress
    }
}

function Get-Metrics {
    $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
    $os = Get-CimInstance Win32_OperatingSystem
    $ram_used = $os.TotalVisibleMemorySize - $os.FreePhysicalMemory
    $ram_total = $os.TotalVisibleMemorySize
    $ram_usage = [math]::Round(($ram_used / $ram_total) * 100, 2)
    
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    $disk_used = $disk.Size - $disk.FreeSpace
    $disk_usage = [math]::Round(($disk_used / $disk.Size) * 100, 2)
    
    $uptime = (Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
    $processes = (Get-Process).Count
    $users = (Get-CimInstance Win32_ComputerSystem).UserName
    
    # Get public IP
    try {
        $publicIp = (Invoke-RestMethod -Uri "https://api.ipify.org?format=json" -TimeoutSec 5).ip
    } catch {
        $publicIp = $null
    }
    
    return @{
        cpu_usage = [math]::Round($cpu, 2)
        ram_usage = $ram_usage
        ram_used_gb = [math]::Round($ram_used / 1MB / 1024, 2)
        disk_usage = $disk_usage
        disk_used_gb = [math]::Round($disk_used / 1GB, 2)
        disk_free_gb = [math]::Round($disk.FreeSpace / 1GB, 2)
        uptime_seconds = [math]::Round($uptime.TotalSeconds)
        process_count = $processes
        logged_in_users = @($users)
        public_ip = $publicIp
    }
}

function Get-InstalledSoftware {
    $software = @()
    
    # 64-bit software
    $regPath64 = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
    $software += Get-ItemProperty $regPath64 -ErrorAction SilentlyContinue | 
        Where-Object { $_.DisplayName } |
        Select-Object @{N='name';E={$_.DisplayName}}, 
                      @{N='version';E={$_.DisplayVersion}}, 
                      @{N='vendor';E={$_.Publisher}},
                      @{N='install_date';E={$_.InstallDate}},
                      @{N='install_location';E={$_.InstallLocation}}
    
    # 32-bit software on 64-bit Windows
    $regPath32 = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    $software += Get-ItemProperty $regPath32 -ErrorAction SilentlyContinue | 
        Where-Object { $_.DisplayName } |
        Select-Object @{N='name';E={$_.DisplayName}}, 
                      @{N='version';E={$_.DisplayVersion}}, 
                      @{N='vendor';E={$_.Publisher}},
                      @{N='install_date';E={$_.InstallDate}},
                      @{N='install_location';E={$_.InstallLocation}}
    
    return $software | Sort-Object name -Unique
}

function Get-HardwareInventory {
    $hardware = @()
    
    # CPU
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $hardware += @{
        component_type = "cpu"
        manufacturer = $cpu.Manufacturer
        model = $cpu.Name
        serial_number = $cpu.ProcessorId
        speed = "$($cpu.MaxClockSpeed) MHz"
        capacity = "$($cpu.NumberOfCores) Cores"
    }
    
    # Memory
    Get-CimInstance Win32_PhysicalMemory | ForEach-Object {
        $hardware += @{
            component_type = "memory"
            manufacturer = $_.Manufacturer
            model = $_.PartNumber
            serial_number = $_.SerialNumber
            capacity = "$([math]::Round($_.Capacity / 1GB)) GB"
            speed = "$($_.Speed) MHz"
            interface_type = "DDR$($_.SMBIOSMemoryType)"
        }
    }
    
    # Disks
    Get-CimInstance Win32_DiskDrive | ForEach-Object {
        $hardware += @{
            component_type = "disk"
            manufacturer = $_.Manufacturer
            model = $_.Model
            serial_number = $_.SerialNumber
            capacity = "$([math]::Round($_.Size / 1GB)) GB"
            interface_type = $_.InterfaceType
        }
    }
    
    # Network Adapters
    Get-NetAdapter | Where-Object Status -eq "Up" | ForEach-Object {
        $hardware += @{
            component_type = "network"
            manufacturer = $_.DriverProvider
            model = $_.InterfaceDescription
            serial_number = $_.MacAddress
            speed = "$([math]::Round($_.LinkSpeed / 1000000)) Mbps"
        }
    }
    
    return $hardware
}

function Invoke-ApiRequest {
    param(
        [string]$Endpoint,
        [string]$Method = "GET",
        [hashtable]$Body = $null
    )
    
    $uri = "$ServerUrl/api$Endpoint"
    $headers = @{
        "Content-Type" = "application/json"
        "X-Agent-Version" = $AgentVersion
    }
    
    try {
        if ($Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $jsonBody -TimeoutSec 30
        } else {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -TimeoutSec 30
        }
        return $response
    } catch {
        Write-Log "API Error: $($_.Exception.Message)" "ERROR"
        return $null
    }
}

function Register-Agent {
    Write-Log "Registering agent with token: $EnrollmentToken"
    
    $systemInfo = Get-SystemInfo
    $body = @{
        token = $EnrollmentToken
    } + $systemInfo
    
    $result = Invoke-ApiRequest -Endpoint "/rmm/enroll" -Method "POST" -Body $body
    
    if ($result -and $result.success) {
        $script:AgentId = $result.agent_id
        $script:DeviceId = $result.device_id
        
        # Save config
        @{
            agent_id = $AgentId
            device_id = $DeviceId
            server_url = $ServerUrl
            enrollment_token = $EnrollmentToken
            registered_at = (Get-Date).ToString("o")
        } | ConvertTo-Json | Set-Content -Path $ConfigFile
        
        Write-Log "Agent registered successfully. Device ID: $DeviceId"
        return $true
    } else {
        Write-Log "Failed to register agent" "ERROR"
        return $false
    }
}

function Send-Heartbeat {
    if (!$AgentId) {
        Write-Log "Agent not registered, skipping heartbeat" "WARN"
        return
    }
    
    $metrics = Get-Metrics
    $body = @{
        agent_id = $AgentId
    } + $metrics
    
    $result = Invoke-ApiRequest -Endpoint "/rmm/heartbeat" -Method "POST" -Body $body
    
    if ($result -and $result.success) {
        Write-Log "Heartbeat sent. CPU: $($metrics.cpu_usage)%, RAM: $($metrics.ram_usage)%, Disk: $($metrics.disk_usage)%"
        
        # Check for pending jobs
        if ($result.pending_jobs -and $result.pending_jobs.Count -gt 0) {
            Write-Log "Found $($result.pending_jobs.Count) pending job(s)"
            foreach ($job in $result.pending_jobs) {
                Execute-Job -Job $job
            }
        }
    }
}

function Send-Inventory {
    if (!$AgentId) { return }
    
    Write-Log "Collecting inventory..."
    
    $software = Get-InstalledSoftware
    $hardware = Get-HardwareInventory
    
    $body = @{
        agent_id = $AgentId
        software = $software
        hardware = $hardware
    }
    
    $result = Invoke-ApiRequest -Endpoint "/rmm/inventory/report" -Method "POST" -Body $body
    
    if ($result -and $result.success) {
        Write-Log "Inventory reported: $($result.software_count) software, $($result.hardware_count) hardware items"
    }
}

function Execute-Job {
    param([object]$Job)
    
    Write-Log "Executing job: $($Job.id)"
    
    # Report job started
    Invoke-ApiRequest -Endpoint "/rmm/deployment-jobs/report" -Method "POST" -Body @{
        execution_id = $Job.id
        status = "running"
    }
    
    try {
        $jobData = $Job.deployment_jobs
        if ($jobData.script_content) {
            $output = Invoke-Expression $jobData.script_content 2>&1 | Out-String
            $exitCode = $LASTEXITCODE
        } elseif ($jobData.command) {
            $output = & cmd /c $jobData.command 2>&1 | Out-String
            $exitCode = $LASTEXITCODE
        }
        
        # Report job completed
        Invoke-ApiRequest -Endpoint "/rmm/deployment-jobs/report" -Method "POST" -Body @{
            execution_id = $Job.id
            status = if ($exitCode -eq 0) { "success" } else { "failed" }
            exit_code = $exitCode
            output = $output
        }
        
        Write-Log "Job completed with exit code: $exitCode"
    } catch {
        Invoke-ApiRequest -Endpoint "/rmm/deployment-jobs/report" -Method "POST" -Body @{
            execution_id = $Job.id
            status = "failed"
            error_output = $_.Exception.Message
        }
        Write-Log "Job failed: $($_.Exception.Message)" "ERROR"
    }
}

# Main execution
Write-Log "IT REX RMM Agent v$AgentVersion starting..."
Write-Log "Server: $ServerUrl"

# Load existing config or register
if (Test-Path $ConfigFile) {
    $config = Get-Content $ConfigFile | ConvertFrom-Json
    $AgentId = $config.agent_id
    $DeviceId = $config.device_id
    Write-Log "Loaded existing configuration. Agent ID: $AgentId"
} else {
    if (!(Register-Agent)) {
        Write-Log "Registration failed. Exiting." "ERROR"
        exit 1
    }
}

# Initial inventory
Send-Inventory

# Heartbeat loop
$inventoryCounter = 0
while ($true) {
    Send-Heartbeat
    
    # Send inventory every hour
    $inventoryCounter++
    if ($inventoryCounter -ge (3600 / $HeartbeatInterval)) {
        Send-Inventory
        $inventoryCounter = 0
    }
    
    Start-Sleep -Seconds $HeartbeatInterval
}
