#!/bin/bash
set -e

LOG_FILE="/var/log/care-ssl-renew.log"
DATE=$(date "+%Y-%m-%d %H:%M:%S")

echo "[$DATE] Starting SSL check and renewal..." >> "$LOG_FILE"

# Check if www.care1.shop resolves to this server
MY_IP="94.184.43.180"
WWW_IP=$(dig +short www.care1.shop @8.8.8.8 2>/dev/null || true)

DOMAINS="-d care1.shop"
if [ "$WWW_IP" == "$MY_IP" ]; then
    DOMAINS="-d care1.shop -d www.care1.shop"
fi

# 1. Run Certbot renewal
certbot renew --quiet --deploy-hook "systemctl reload nginx" >> "$LOG_FILE" 2>&1

# 2. If certificate doesn't exist yet, obtain it
if [ ! -f /etc/letsencrypt/live/care1.shop/fullchain.pem ]; then
    certbot certonly --nginx $DOMAINS --non-interactive --agree-tos -m admin@care1.shop >> "$LOG_FILE" 2>&1
    systemctl reload nginx
fi

# 3. If www became active and isn't in cert yet, expand
if [ "$WWW_IP" == "$MY_IP" ]; then
    CERT_DOMAINS=$(certbot certificates 2>/dev/null | grep "Domains:" || true)
    if [[ "$CERT_DOMAINS" != *"www.care1.shop"* ]]; then
        echo "[$DATE] Expanding certificate to include www.care1.shop..." >> "$LOG_FILE"
        certbot certonly --nginx --expand $DOMAINS --non-interactive --agree-tos -m admin@care1.shop >> "$LOG_FILE" 2>&1
        systemctl reload nginx
    fi
fi

echo "[$DATE] SSL check completed successfully." >> "$LOG_FILE"
