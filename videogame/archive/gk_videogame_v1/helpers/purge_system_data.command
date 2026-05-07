#!/bin/bash

# Ask for admin password upfront
sudo -v

echo "=== Purging APFS Local Snapshots ==="
sudo tmutil thinlocalsnapshots / 99999999999 1

echo "=== Deleting Spotlight Index ==="
sudo mdutil -a -i off
sudo rm -rf /.Spotlight-V100
sudo mdutil -a -i on

echo "=== Purging Virtual Memory Swap ==="
sudo rm -f /private/var/vm/sleepimage
sudo rm -f /private/var/vm/swapfile*

echo "=== Clearing System Caches ==="
sudo rm -rf /Library/Caches/*

echo "=== Clearing User Caches ==="
rm -rf ~/Library/Caches/*

echo "=== Clearing Container Caches ==="
rm -rf ~/Library/Containers/*/Data/Library/Caches/*
rm -rf ~/Library/Containers/*/Data/tmp/*

echo "=== Clearing Log Files ==="
sudo rm -rf /private/var/log/*
rm -rf ~/Library/Logs/*

echo "=== Clearing Temporary Files ==="
sudo rm -rf /private/var/tmp/*
sudo rm -rf /private/tmp/*

echo "=== Clearing CloudKit / iCloud Cache ==="
rm -rf ~/Library/Application\ Support/CloudDocs/*
rm -rf ~/Library/Application\ Support/CloudKit/*
rm -rf ~/Library/CloudStorage/*
rm -rf ~/Library/Containers/com.apple.CloudDocs/Data/*

echo "=== Removing iOS Backups ==="
rm -rf ~/Library/Application\ Support/MobileSync/Backup/*

echo "=== Clearing Purgeable Space via APFS Trim ==="
sudo diskutil apfs trimVolume /

echo "=== Resetting User Permissions ==="
sudo diskutil resetUserPermissions / "$(id -u)"

echo "=== DONE ==="
echo "Reboot your Mac now for maximum effect."
