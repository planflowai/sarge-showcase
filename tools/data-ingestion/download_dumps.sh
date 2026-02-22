#!/usr/bin/env bash
# ==============================================================================
# download_dumps.sh - Bulk Data Downloader for Knowledge Vault / RAG System
# ==============================================================================
#
# PURPOSE:
#   Safely download large public data dumps (Wikipedia, arXiv, NASA, etc.),
#   verify integrity, extract archives, organize into dated folders, and
#   archive originals to a spinning disk. Keeps only last 3 versions.
#
# USAGE:
#   ./download_dumps.sh [OPTIONS]
#
# OPTIONS:
#   --dry-run     Print what would happen, don't actually download
#   --force       Overwrite existing dated folders
#   --only-download  Skip extraction step
#   --source NAME Only process sources matching NAME
#   --help        Show this help
#
# INPUT FILE: sources.txt (same folder as this script)
#   Format: URL  expected_size_GB  short_name  [optional_checksum]
#
# Author: SARGE Knowledge Vault
# Version: 1.0.0
# ==============================================================================

set -euo pipefail

# ==============================================================================
# CONFIGURATION - Edit these as needed
# ==============================================================================

# Where to store extracted data (fast NVMe recommended)
DATA_DIR="./data"

# Where to archive compressed originals (spinning disk)
ARCHIVE_PATH="/mnt/archive/data"

# Maximum parallel downloads (aria2c only)
MAX_PARALLEL=6

# Bandwidth limit in MB/s (0 = unlimited)
BANDWIDTH_LIMIT_MB=25

# Retry settings
MAX_RETRIES=3
RETRY_DELAYS=(10 30 90)  # seconds between retries

# Timeouts
CONNECTION_TIMEOUT=60      # seconds per connection
MAX_DOWNLOAD_TIME=43200    # 12 hours max per file

# Disk space safety margin (download if free >= expected * SPACE_MULTIPLIER)
SPACE_MULTIPLIER=3

# How many old versions to keep per source
VERSIONS_TO_KEEP=3

# Sources file
SOURCES_FILE="$(dirname "$0")/sources.txt"

# State file for resume capability
STATE_FILE="$(dirname "$0")/.download_state.json"

# ==============================================================================
# COLORS FOR OUTPUT
# ==============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ==============================================================================
# GLOBAL VARIABLES
# ==============================================================================

DRY_RUN=false
FORCE=false
ONLY_DOWNLOAD=false
SOURCE_FILTER=""
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TODAY=$(date +%Y-%m-%d)
LOG_FILE="${SCRIPT_DIR}/download_${TODAY}.log"

# Summary arrays
declare -a DONE_LIST=()
declare -a FAILED_LIST=()
declare -a SKIPPED_LIST=()

# Trap for clean exit
CURRENT_FILE=""
trap cleanup EXIT INT TERM

# ==============================================================================
# FUNCTIONS
# ==============================================================================

# --- Logging ---
log() {
    local level="$1"
    shift
    local msg="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case "$level" in
        INFO)  echo -e "${CYAN}[${timestamp}]${NC} ${GREEN}INFO${NC}  $msg" ;;
        WARN)  echo -e "${CYAN}[${timestamp}]${NC} ${YELLOW}WARN${NC}  $msg" ;;
        ERROR) echo -e "${CYAN}[${timestamp}]${NC} ${RED}ERROR${NC} $msg" ;;
        DEBUG) echo -e "${CYAN}[${timestamp}]${NC} ${BLUE}DEBUG${NC} $msg" ;;
        *)     echo -e "${CYAN}[${timestamp}]${NC} $msg" ;;
    esac

    # Also write to log file (without colors)
    echo "[${timestamp}] ${level} $msg" >> "$LOG_FILE"
}

# --- Cleanup on exit ---
cleanup() {
    local exit_code=$?

    if [[ -n "$CURRENT_FILE" && -f "$CURRENT_FILE.aria2" ]]; then
        log WARN "Download interrupted. Partial file kept for resume: $CURRENT_FILE"
    fi

    # Write summary files
    write_summaries

    log INFO "Script finished with exit code: $exit_code"
    exit $exit_code
}

# --- Show help ---
show_help() {
    cat << 'EOF'
================================================================================
download_dumps.sh - Bulk Data Downloader for Knowledge Vault
================================================================================

USAGE:
  ./download_dumps.sh [OPTIONS]

OPTIONS:
  --dry-run         Print what would happen, don't download or extract
  --force           Overwrite existing dated folders
  --only-download   Download only, skip extraction
  --source NAME     Only process sources matching NAME (partial match)
  --help            Show this help message

INPUT FILE:
  sources.txt in the same folder as this script
  Format: URL  expected_size_GB  short_name  [optional_sha256_or_md5]

EXAMPLES:
  ./download_dumps.sh                    # Normal run
  ./download_dumps.sh --dry-run          # Preview what would happen
  ./download_dumps.sh --source enwiki    # Only process Wikipedia
  ./download_dumps.sh --force            # Overwrite existing folders

CONFIGURATION:
  Edit the top of this script to change:
  - DATA_DIR: Where extracted data goes (default: ./data)
  - ARCHIVE_PATH: Where compressed archives go (default: /mnt/archive/data)
  - MAX_PARALLEL: Parallel downloads (default: 6)
  - BANDWIDTH_LIMIT_MB: Rate limit in MB/s (default: 25)
  - VERSIONS_TO_KEEP: How many old versions to keep (default: 3)

================================================================================
EOF
}

# --- Check if command exists ---
command_exists() {
    command -v "$1" &> /dev/null
}

# --- Get free disk space in GB ---
get_free_space_gb() {
    local path="$1"
    # Ensure path exists, create if needed
    mkdir -p "$path" 2>/dev/null || true

    if [[ -d "$path" ]]; then
        df -BG "$path" 2>/dev/null | tail -1 | awk '{gsub(/G/,"",$4); print $4}'
    else
        echo "0"
    fi
}

# --- Check if we have enough disk space ---
check_disk_space() {
    local path="$1"
    local required_gb="$2"
    local min_required=$((required_gb * SPACE_MULTIPLIER))
    local available=$(get_free_space_gb "$path")

    if [[ "$available" -lt "$min_required" ]]; then
        log WARN "Insufficient disk space: need ${min_required}GB, have ${available}GB at $path"
        return 1
    fi

    log DEBUG "Disk space OK: ${available}GB available, need ${min_required}GB"
    return 0
}

# --- HEAD request to check URL and get size ---
check_url() {
    local url="$1"
    local expected_size_gb="$2"

    log DEBUG "Checking URL: $url"

    # Get HTTP status and content-length
    local response
    if command_exists curl; then
        response=$(curl -sI -o /dev/null -w "%{http_code} %{size_download}" \
            --connect-timeout "$CONNECTION_TIMEOUT" \
            -L "$url" 2>/dev/null || echo "000 0")
    elif command_exists wget; then
        local status=$(wget --spider -S "$url" 2>&1 | grep "HTTP/" | tail -1 | awk '{print $2}')
        response="${status:-000} 0"
    else
        log ERROR "Neither curl nor wget found!"
        return 1
    fi

    local http_status=$(echo "$response" | cut -d' ' -f1)

    case "$http_status" in
        200|206|301|302)
            log DEBUG "URL check passed: HTTP $http_status"
            return 0
            ;;
        404)
            log ERROR "URL not found (404): $url"
            return 1
            ;;
        403)
            log ERROR "URL forbidden (403): $url"
            return 1
            ;;
        429)
            log ERROR "Rate limited (429): $url"
            return 1
            ;;
        *)
            log WARN "Unexpected HTTP status $http_status for $url"
            return 1
            ;;
    esac
}

# --- Download a file ---
download_file() {
    local url="$1"
    local dest_dir="$2"
    local filename="$3"
    local expected_size_gb="$4"
    local attempt="$5"

    local dest_file="${dest_dir}/${filename}"
    CURRENT_FILE="$dest_file"

    mkdir -p "$dest_dir"

    log INFO "Downloading: $filename (attempt $attempt/$MAX_RETRIES)"
    log DEBUG "  URL: $url"
    log DEBUG "  Destination: $dest_file"

    if $DRY_RUN; then
        log INFO "[DRY-RUN] Would download $url to $dest_file"
        return 0
    fi

    local download_log="${dest_dir}/download.log"
    local start_time=$(date +%s)

    # Prefer aria2c, fallback to wget
    if command_exists aria2c; then
        log DEBUG "Using aria2c for download"

        local aria_opts=(
            --continue=true
            --max-connection-per-server=4
            --split=4
            --min-split-size=10M
            --connect-timeout="$CONNECTION_TIMEOUT"
            --timeout="$CONNECTION_TIMEOUT"
            --max-tries=1
            --retry-wait=5
            --dir="$dest_dir"
            --out="$filename"
            --log="$download_log"
            --log-level=notice
        )

        # Add bandwidth limit if set
        if [[ "$BANDWIDTH_LIMIT_MB" -gt 0 ]]; then
            aria_opts+=(--max-overall-download-limit="${BANDWIDTH_LIMIT_MB}M")
        fi

        if timeout "$MAX_DOWNLOAD_TIME" aria2c "${aria_opts[@]}" "$url" >> "$download_log" 2>&1; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            log INFO "Download complete: $filename (${duration}s)"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Download completed in ${duration}s" >> "$download_log"
            CURRENT_FILE=""
            return 0
        else
            log ERROR "aria2c download failed for $filename"
            return 1
        fi

    elif command_exists wget; then
        log DEBUG "Using wget for download (aria2c not found)"

        local wget_opts=(
            --continue
            --timeout="$CONNECTION_TIMEOUT"
            --tries=1
            --output-document="$dest_file"
            --progress=dot:giga
        )

        # Add bandwidth limit if set
        if [[ "$BANDWIDTH_LIMIT_MB" -gt 0 ]]; then
            wget_opts+=(--limit-rate="${BANDWIDTH_LIMIT_MB}m")
        fi

        if timeout "$MAX_DOWNLOAD_TIME" wget "${wget_opts[@]}" "$url" >> "$download_log" 2>&1; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            log INFO "Download complete: $filename (${duration}s)"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Download completed in ${duration}s" >> "$download_log"
            CURRENT_FILE=""
            return 0
        else
            log ERROR "wget download failed for $filename"
            return 1
        fi

    else
        log ERROR "No download tool available! Install aria2c or wget."
        return 1
    fi
}

# --- Verify file size ---
verify_size() {
    local file="$1"
    local expected_gb="$2"

    if [[ ! -f "$file" ]]; then
        log ERROR "File not found for size verification: $file"
        return 1
    fi

    local actual_bytes=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
    local expected_bytes=$((expected_gb * 1073741824))  # GB to bytes

    # Allow 10% variance
    local min_bytes=$((expected_bytes * 90 / 100))
    local max_bytes=$((expected_bytes * 110 / 100))

    if [[ "$actual_bytes" -lt "$min_bytes" || "$actual_bytes" -gt "$max_bytes" ]]; then
        local actual_gb=$(echo "scale=2; $actual_bytes / 1073741824" | bc)
        log ERROR "Size mismatch: expected ~${expected_gb}GB, got ${actual_gb}GB"
        return 1
    fi

    log DEBUG "Size verification passed: $(echo "scale=2; $actual_bytes / 1073741824" | bc)GB"
    return 0
}

# --- Call Python helper for extraction and checksum ---
extract_and_verify() {
    local file="$1"
    local dest_dir="$2"
    local checksum="${3:-}"

    local python_helper="${SCRIPT_DIR}/extract_and_verify.py"

    if [[ ! -f "$python_helper" ]]; then
        log ERROR "Python helper not found: $python_helper"
        return 1
    fi

    if $DRY_RUN; then
        log INFO "[DRY-RUN] Would extract $file to $dest_dir"
        return 0
    fi

    log INFO "Extracting: $(basename "$file")"

    local extract_log="${dest_dir}/extraction.log"
    local extracted_dir="${dest_dir}/extracted"
    mkdir -p "$extracted_dir"

    local args=("$file" "$extracted_dir")
    if [[ -n "$checksum" ]]; then
        args+=(--checksum "$checksum")
    fi
    args+=(--log "$extract_log")

    if python3 "$python_helper" "${args[@]}"; then
        log INFO "Extraction complete: $(basename "$file")"
        return 0
    else
        log ERROR "Extraction failed: $(basename "$file")"
        return 1
    fi
}

# --- Archive compressed file to spinning disk ---
archive_original() {
    local file="$1"
    local short_name="$2"

    if $DRY_RUN; then
        log INFO "[DRY-RUN] Would archive $file to $ARCHIVE_PATH"
        return 0
    fi

    local archive_dest="${ARCHIVE_PATH}/${TODAY}__${short_name}"
    mkdir -p "$archive_dest"

    log INFO "Archiving original to: $archive_dest"

    if mv "$file" "$archive_dest/"; then
        log INFO "Archive complete: $(basename "$file")"
        return 0
    else
        log WARN "Failed to archive $file (continuing anyway)"
        return 0  # Don't fail the whole process
    fi
}

# --- Delete old versions, keep only N most recent ---
cleanup_old_versions() {
    local short_name="$1"
    local base_dir="$2"

    if $DRY_RUN; then
        log INFO "[DRY-RUN] Would cleanup old versions for $short_name"
        return 0
    fi

    # Find all dated folders for this source
    local folders=($(find "$base_dir" -maxdepth 1 -type d -name "*__${short_name}" 2>/dev/null | sort -r))
    local count=${#folders[@]}

    if [[ "$count" -le "$VERSIONS_TO_KEEP" ]]; then
        log DEBUG "No cleanup needed for $short_name ($count versions, keeping $VERSIONS_TO_KEEP)"
        return 0
    fi

    # Delete oldest folders beyond the keep limit
    local to_delete=$((count - VERSIONS_TO_KEEP))
    log INFO "Cleaning up $to_delete old version(s) of $short_name"

    for ((i=VERSIONS_TO_KEEP; i<count; i++)); do
        local folder="${folders[$i]}"
        log DEBUG "Deleting old version: $folder"
        rm -rf "$folder"
    done

    return 0
}

# --- Process a single source ---
process_source() {
    local url="$1"
    local expected_size_gb="$2"
    local short_name="$3"
    local checksum="${4:-}"

    local start_time=$(date +%s)
    local filename=$(basename "$url")
    local dest_dir="${DATA_DIR}/${TODAY}__${short_name}"

    log INFO "=========================================="
    log INFO "Processing: ${BOLD}$short_name${NC}"
    log INFO "  URL: $url"
    log INFO "  Expected size: ${expected_size_gb}GB"
    [[ -n "$checksum" ]] && log INFO "  Checksum: ${checksum:0:16}..."
    log INFO "=========================================="

    # Check if folder already exists
    if [[ -d "$dest_dir" && "$FORCE" != true ]]; then
        log WARN "Folder already exists: $dest_dir (use --force to overwrite)"
        SKIPPED_LIST+=("$short_name|$TODAY|Folder already exists")
        return 0
    fi

    # Remove existing if --force
    if [[ -d "$dest_dir" && "$FORCE" == true ]]; then
        log WARN "Removing existing folder (--force): $dest_dir"
        rm -rf "$dest_dir"
    fi

    # Check disk space
    if ! check_disk_space "$DATA_DIR" "$expected_size_gb"; then
        SKIPPED_LIST+=("$short_name|$TODAY|Insufficient disk space")
        return 0
    fi

    # Check URL accessibility
    if ! check_url "$url" "$expected_size_gb"; then
        FAILED_LIST+=("$short_name|$TODAY|URL check failed")
        return 1
    fi

    # Download with retries
    local attempt=1
    local download_success=false

    while [[ $attempt -le $MAX_RETRIES ]]; do
        if download_file "$url" "$dest_dir" "$filename" "$expected_size_gb" "$attempt"; then
            download_success=true
            break
        fi

        if [[ $attempt -lt $MAX_RETRIES ]]; then
            local delay=${RETRY_DELAYS[$((attempt-1))]}
            log WARN "Retry in ${delay}s..."
            sleep "$delay"
        fi

        ((attempt++))
    done

    if ! $download_success; then
        FAILED_LIST+=("$short_name|$TODAY|Download failed after $MAX_RETRIES attempts")
        # Move to failed folder
        if [[ -d "$dest_dir" ]]; then
            mkdir -p "./failed"
            mv "$dest_dir" "./failed/${TODAY}__${short_name}_failed"
        fi
        return 1
    fi

    local downloaded_file="${dest_dir}/${filename}"

    # Verify size
    if ! verify_size "$downloaded_file" "$expected_size_gb"; then
        FAILED_LIST+=("$short_name|$TODAY|Size verification failed")
        mkdir -p "./failed"
        mv "$dest_dir" "./failed/${TODAY}__${short_name}_failed"
        return 1
    fi

    # Extract (unless --only-download)
    if ! $ONLY_DOWNLOAD; then
        if ! extract_and_verify "$downloaded_file" "$dest_dir" "$checksum"; then
            FAILED_LIST+=("$short_name|$TODAY|Extraction/verification failed")
            mkdir -p "./failed"
            mv "$dest_dir" "./failed/${TODAY}__${short_name}_failed"
            return 1
        fi

        # Archive original to spinning disk
        archive_original "$downloaded_file" "$short_name"
    fi

    # Cleanup old versions
    cleanup_old_versions "$short_name" "$DATA_DIR"
    cleanup_old_versions "$short_name" "$ARCHIVE_PATH"

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local actual_size=$(du -sh "$dest_dir" 2>/dev/null | cut -f1)

    DONE_LIST+=("$short_name|$TODAY|${actual_size:-unknown}|${duration}s")

    log INFO "${GREEN}SUCCESS:${NC} $short_name completed in ${duration}s"
    return 0
}

# --- Write summary files ---
write_summaries() {
    if $DRY_RUN; then
        log INFO "[DRY-RUN] Would write summary files"
        return 0
    fi

    # done.txt
    {
        echo "# Download Summary - Completed"
        echo "# Generated: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "# Format: source_name | date | size | time"
        echo ""
        for item in "${DONE_LIST[@]}"; do
            echo "$item"
        done
    } > "${SCRIPT_DIR}/done.txt"

    # failed.txt
    {
        echo "# Download Summary - Failed"
        echo "# Generated: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "# Format: source_name | date | reason"
        echo ""
        for item in "${FAILED_LIST[@]}"; do
            echo "$item"
        done
    } > "${SCRIPT_DIR}/failed.txt"

    # skipped.txt
    {
        echo "# Download Summary - Skipped"
        echo "# Generated: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "# Format: source_name | date | reason"
        echo ""
        for item in "${SKIPPED_LIST[@]}"; do
            echo "$item"
        done
    } > "${SCRIPT_DIR}/skipped.txt"

    log INFO "Summary files written: done.txt, failed.txt, skipped.txt"
}

# --- Parse sources.txt ---
parse_sources() {
    if [[ ! -f "$SOURCES_FILE" ]]; then
        log ERROR "Sources file not found: $SOURCES_FILE"
        log INFO "Create sources.txt with format: URL  expected_size_GB  short_name  [checksum]"
        exit 1
    fi

    local count=0
    while IFS=$' \t' read -r url size name checksum || [[ -n "$url" ]]; do
        # Skip empty lines and comments
        [[ -z "$url" || "$url" =~ ^# ]] && continue

        # Apply source filter if specified
        if [[ -n "$SOURCE_FILTER" && ! "$name" =~ $SOURCE_FILTER ]]; then
            log DEBUG "Skipping $name (doesn't match filter: $SOURCE_FILTER)"
            continue
        fi

        process_source "$url" "$size" "$name" "$checksum"
        ((count++))

    done < "$SOURCES_FILE"

    if [[ $count -eq 0 ]]; then
        log WARN "No sources processed. Check sources.txt and filters."
    fi
}

# ==============================================================================
# MAIN
# ==============================================================================

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --only-download)
                ONLY_DOWNLOAD=true
                shift
                ;;
            --source)
                SOURCE_FILTER="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log ERROR "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Header
    echo ""
    echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║     BULK DATA DOWNLOADER - Knowledge Vault / RAG System      ║${NC}"
    echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    log INFO "Starting download session: $TODAY"
    log INFO "Data directory: $DATA_DIR"
    log INFO "Archive directory: $ARCHIVE_PATH"
    $DRY_RUN && log WARN "DRY-RUN MODE - No actual downloads"
    $FORCE && log WARN "FORCE MODE - Will overwrite existing folders"
    $ONLY_DOWNLOAD && log INFO "ONLY-DOWNLOAD MODE - Skipping extraction"
    [[ -n "$SOURCE_FILTER" ]] && log INFO "Source filter: $SOURCE_FILTER"

    # Create directories
    mkdir -p "$DATA_DIR" "$ARCHIVE_PATH" "./failed" 2>/dev/null || true

    # Check for download tools
    if command_exists aria2c; then
        log INFO "Download tool: aria2c (preferred)"
    elif command_exists wget; then
        log INFO "Download tool: wget (fallback)"
    else
        log ERROR "No download tool found! Install aria2c or wget."
        exit 1
    fi

    # Check for Python
    if ! command_exists python3; then
        log ERROR "Python 3 not found! Required for extraction."
        exit 1
    fi

    # Process sources
    parse_sources

    # Final summary
    echo ""
    log INFO "=========================================="
    log INFO "SESSION COMPLETE"
    log INFO "  Completed: ${#DONE_LIST[@]}"
    log INFO "  Failed: ${#FAILED_LIST[@]}"
    log INFO "  Skipped: ${#SKIPPED_LIST[@]}"
    log INFO "=========================================="

    # Return non-zero if any failures
    [[ ${#FAILED_LIST[@]} -gt 0 ]] && exit 1
    exit 0
}

# Run main
main "$@"
