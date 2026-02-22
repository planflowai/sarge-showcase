#!/usr/bin/env python3
"""
extract_and_verify.py - Archive Extraction and Checksum Verification Helper
==============================================================================

PURPOSE:
    Helper script called by download_dumps.sh to:
    1. Verify file checksum (SHA256 or MD5) if provided
    2. Intelligently detect archive type and extract
    3. Log every step for debugging

USAGE:
    python3 extract_and_verify.py <file_path> <dest_dir> [OPTIONS]

OPTIONS:
    --checksum HASH    Expected SHA256 or MD5 hash (auto-detects by length)
    --log FILE         Path to log file (default: extraction.log in dest_dir)
    --skip-verify      Skip checksum verification even if provided

EXIT CODES:
    0 - Success
    1 - Checksum verification failed
    2 - Extraction failed
    3 - File not found
    4 - Unknown archive type
    5 - Missing required tool

Author: SARGE Knowledge Vault
Version: 1.0.0
==============================================================================
"""

import argparse
import hashlib
import logging
import os
import shutil
import subprocess
import sys
import tarfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

# ==============================================================================
# CONFIGURATION
# ==============================================================================

# Supported archive extensions and their handlers
ARCHIVE_HANDLERS = {
    '.tar.gz': 'tar_gz',
    '.tgz': 'tar_gz',
    '.tar.bz2': 'tar_bz2',
    '.tbz2': 'tar_bz2',
    '.tar.xz': 'tar_xz',
    '.txz': 'tar_xz',
    '.tar': 'tar',
    '.gz': 'gzip',
    '.bz2': 'bzip2',
    '.xz': 'xz',
    '.zip': 'zip',
}

# External tools for extraction (preferred over Python for speed)
EXTERNAL_TOOLS = {
    'tar_gz': ['tar', '-xzf'],
    'tar_bz2': ['tar', '-xjf'],
    'tar_xz': ['tar', '-xJf'],
    'tar': ['tar', '-xf'],
    'gzip': ['pigz', '-dk'],  # pigz is parallel gzip, falls back to gunzip
    'bzip2': ['pbzip2', '-dk'],  # pbzip2 is parallel bzip2, falls back to bunzip2
    'xz': ['xz', '-dk'],
    'zip': ['unzip', '-o'],
}

# Fallback tools if preferred ones not available
FALLBACK_TOOLS = {
    'gzip': ['gunzip', '-k'],
    'bzip2': ['bunzip2', '-k'],
}

# ==============================================================================
# LOGGING SETUP
# ==============================================================================

def setup_logging(log_file: Optional[str] = None) -> logging.Logger:
    """Configure logging to both console and file."""
    logger = logging.getLogger('extract_verify')
    logger.setLevel(logging.DEBUG)

    # Console handler (INFO and above)
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console_fmt = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s', '%H:%M:%S')
    console.setFormatter(console_fmt)
    logger.addHandler(console)

    # File handler (DEBUG and above)
    if log_file:
        file_handler = logging.FileHandler(log_file, mode='a')
        file_handler.setLevel(logging.DEBUG)
        file_fmt = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s', '%Y-%m-%d %H:%M:%S')
        file_handler.setFormatter(file_fmt)
        logger.addHandler(file_handler)

    return logger

# ==============================================================================
# CHECKSUM VERIFICATION
# ==============================================================================

def detect_hash_type(checksum: str) -> str:
    """
    Detect hash type based on length.
    - 32 chars = MD5
    - 64 chars = SHA256
    """
    length = len(checksum.strip())
    if length == 32:
        return 'md5'
    elif length == 64:
        return 'sha256'
    else:
        raise ValueError(f"Unknown hash length: {length} (expected 32 for MD5 or 64 for SHA256)")


def calculate_checksum(file_path: Path, hash_type: str, logger: logging.Logger) -> str:
    """
    Calculate checksum of a file.
    Uses chunked reading to handle very large files.
    """
    logger.info(f"Calculating {hash_type.upper()} checksum for {file_path.name}...")

    if hash_type == 'md5':
        hasher = hashlib.md5()
    elif hash_type == 'sha256':
        hasher = hashlib.sha256()
    else:
        raise ValueError(f"Unsupported hash type: {hash_type}")

    # Read in 64KB chunks (efficient for large files)
    chunk_size = 65536
    bytes_read = 0
    file_size = file_path.stat().st_size

    with open(file_path, 'rb') as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            hasher.update(chunk)
            bytes_read += len(chunk)

            # Progress logging every 1GB
            if bytes_read % (1024 * 1024 * 1024) == 0:
                progress = (bytes_read / file_size) * 100
                logger.debug(f"  Checksum progress: {progress:.1f}%")

    return hasher.hexdigest()


def verify_checksum(file_path: Path, expected: str, logger: logging.Logger) -> bool:
    """
    Verify file checksum matches expected value.
    Auto-detects hash type from checksum length.
    """
    try:
        hash_type = detect_hash_type(expected)
        logger.info(f"Verifying {hash_type.upper()} checksum...")

        actual = calculate_checksum(file_path, hash_type, logger)
        expected_clean = expected.strip().lower()
        actual_clean = actual.strip().lower()

        if actual_clean == expected_clean:
            logger.info(f"✓ Checksum verified: {actual_clean[:16]}...")
            return True
        else:
            logger.error(f"✗ Checksum MISMATCH!")
            logger.error(f"  Expected: {expected_clean}")
            logger.error(f"  Actual:   {actual_clean}")
            return False

    except Exception as e:
        logger.error(f"Checksum verification error: {e}")
        return False

# ==============================================================================
# ARCHIVE TYPE DETECTION
# ==============================================================================

def detect_archive_type(file_path: Path) -> Optional[str]:
    """
    Detect archive type from file extension.
    Handles compound extensions like .tar.gz
    """
    name = file_path.name.lower()

    # Check compound extensions first (longest match)
    for ext in sorted(ARCHIVE_HANDLERS.keys(), key=len, reverse=True):
        if name.endswith(ext):
            return ARCHIVE_HANDLERS[ext]

    return None


def check_tool_available(tool: str) -> bool:
    """Check if an external tool is available."""
    return shutil.which(tool) is not None

# ==============================================================================
# EXTRACTION HANDLERS
# ==============================================================================

def extract_with_external_tool(
    file_path: Path,
    dest_dir: Path,
    handler_type: str,
    logger: logging.Logger
) -> bool:
    """
    Extract archive using external command-line tool.
    Preferred for large files (faster than Python).
    """
    # Get command template
    if handler_type in EXTERNAL_TOOLS:
        cmd_template = EXTERNAL_TOOLS[handler_type]
    else:
        logger.error(f"No external tool configured for: {handler_type}")
        return False

    tool = cmd_template[0]

    # Check if preferred tool exists, try fallback
    if not check_tool_available(tool):
        if handler_type in FALLBACK_TOOLS:
            cmd_template = FALLBACK_TOOLS[handler_type]
            tool = cmd_template[0]
            logger.debug(f"Using fallback tool: {tool}")

    if not check_tool_available(tool):
        logger.warning(f"Tool not found: {tool}")
        return False

    # Build command
    cmd = list(cmd_template)
    cmd.append(str(file_path))

    # Add output directory for certain tools
    if handler_type.startswith('tar'):
        cmd.extend(['-C', str(dest_dir)])
    elif handler_type == 'zip':
        cmd.extend(['-d', str(dest_dir)])

    logger.info(f"Extracting with: {tool}")
    logger.debug(f"  Command: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=43200  # 12 hour timeout
        )

        if result.returncode == 0:
            logger.info(f"✓ External extraction successful")
            return True
        else:
            logger.error(f"External extraction failed (exit {result.returncode})")
            if result.stderr:
                logger.error(f"  stderr: {result.stderr[:500]}")
            return False

    except subprocess.TimeoutExpired:
        logger.error("Extraction timed out (12 hour limit)")
        return False
    except Exception as e:
        logger.error(f"External extraction error: {e}")
        return False


def extract_with_python(
    file_path: Path,
    dest_dir: Path,
    handler_type: str,
    logger: logging.Logger
) -> bool:
    """
    Extract archive using Python's built-in libraries.
    Fallback when external tools aren't available.
    """
    logger.info(f"Extracting with Python (fallback)")

    try:
        if handler_type in ('tar', 'tar_gz', 'tar_bz2', 'tar_xz'):
            # Determine mode
            mode_map = {
                'tar': 'r',
                'tar_gz': 'r:gz',
                'tar_bz2': 'r:bz2',
                'tar_xz': 'r:xz',
            }
            mode = mode_map.get(handler_type, 'r')

            with tarfile.open(file_path, mode) as tar:
                # Security: check for path traversal
                for member in tar.getmembers():
                    if member.name.startswith('/') or '..' in member.name:
                        logger.warning(f"Skipping suspicious path: {member.name}")
                        continue

                logger.debug(f"  Extracting {len(tar.getmembers())} members...")
                tar.extractall(path=dest_dir)

            logger.info("✓ Python tar extraction successful")
            return True

        elif handler_type == 'zip':
            with zipfile.ZipFile(file_path, 'r') as zf:
                # Security: check for path traversal
                for name in zf.namelist():
                    if name.startswith('/') or '..' in name:
                        logger.warning(f"Skipping suspicious path: {name}")
                        continue

                logger.debug(f"  Extracting {len(zf.namelist())} files...")
                zf.extractall(path=dest_dir)

            logger.info("✓ Python zip extraction successful")
            return True

        elif handler_type == 'gzip':
            import gzip
            out_path = dest_dir / file_path.stem  # Remove .gz
            with gzip.open(file_path, 'rb') as f_in:
                with open(out_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            logger.info("✓ Python gzip extraction successful")
            return True

        elif handler_type == 'bzip2':
            import bz2
            out_path = dest_dir / file_path.stem  # Remove .bz2
            with bz2.open(file_path, 'rb') as f_in:
                with open(out_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            logger.info("✓ Python bzip2 extraction successful")
            return True

        elif handler_type == 'xz':
            import lzma
            out_path = dest_dir / file_path.stem  # Remove .xz
            with lzma.open(file_path, 'rb') as f_in:
                with open(out_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            logger.info("✓ Python xz extraction successful")
            return True

        else:
            logger.error(f"No Python handler for: {handler_type}")
            return False

    except Exception as e:
        logger.error(f"Python extraction error: {e}")
        return False


def extract_archive(
    file_path: Path,
    dest_dir: Path,
    logger: logging.Logger
) -> bool:
    """
    Main extraction function.
    Tries external tools first, falls back to Python.
    """
    handler_type = detect_archive_type(file_path)

    if not handler_type:
        logger.error(f"Unknown archive type: {file_path.name}")
        logger.error(f"Supported extensions: {', '.join(ARCHIVE_HANDLERS.keys())}")
        return False

    logger.info(f"Archive type: {handler_type}")
    logger.info(f"Destination: {dest_dir}")

    # Ensure destination exists
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Try external tool first (faster)
    if extract_with_external_tool(file_path, dest_dir, handler_type, logger):
        return True

    # Fall back to Python
    logger.info("Falling back to Python extraction...")
    return extract_with_python(file_path, dest_dir, handler_type, logger)

# ==============================================================================
# MAIN
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Extract archives and verify checksums',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('file_path', help='Path to archive file')
    parser.add_argument('dest_dir', help='Destination directory for extraction')
    parser.add_argument('--checksum', help='Expected SHA256 or MD5 checksum')
    parser.add_argument('--log', help='Log file path')
    parser.add_argument('--skip-verify', action='store_true', help='Skip checksum verification')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    # Setup paths
    file_path = Path(args.file_path).resolve()
    dest_dir = Path(args.dest_dir).resolve()

    # Setup logging
    log_file = args.log or (dest_dir / 'extraction.log')
    logger = setup_logging(str(log_file))

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    # Header
    logger.info("=" * 60)
    logger.info("EXTRACT AND VERIFY")
    logger.info(f"  File: {file_path.name}")
    logger.info(f"  Size: {file_path.stat().st_size / (1024**3):.2f} GB")
    logger.info(f"  Dest: {dest_dir}")
    logger.info("=" * 60)

    # Check file exists
    if not file_path.exists():
        logger.error(f"File not found: {file_path}")
        return 3

    # Verify checksum if provided
    if args.checksum and not args.skip_verify:
        if not verify_checksum(file_path, args.checksum, logger):
            logger.error("CHECKSUM VERIFICATION FAILED")
            return 1
    elif args.checksum and args.skip_verify:
        logger.warning("Checksum provided but verification skipped")
    else:
        logger.info("No checksum provided, skipping verification")

    # Extract archive
    start_time = datetime.now()

    if not extract_archive(file_path, dest_dir, logger):
        logger.error("EXTRACTION FAILED")
        return 2

    # Summary
    duration = (datetime.now() - start_time).total_seconds()
    logger.info("=" * 60)
    logger.info(f"✓ EXTRACTION COMPLETE")
    logger.info(f"  Duration: {duration:.1f}s")
    logger.info(f"  Output: {dest_dir}")
    logger.info("=" * 60)

    return 0


if __name__ == '__main__':
    sys.exit(main())
