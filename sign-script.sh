#!/bin/sh

# Parameters
JS_FILE_PATH="$1"
CONFIG_FILE_PATH="$2"

# Detect OS for base64 compatibility
case "$(uname -s)" in
    Darwin*) BASE64_DEC="base64 -D" ;;
    *)       BASE64_DEC="base64 -d" ;;
esac

# Decode and save the private key to a temporary file
printf '%s' "$SIGNING_PRIVATE_KEY" | $BASE64_DEC > tmp_private_key.pem 2>/dev/null
if [ ! -s tmp_private_key.pem ]; then
    printf '%s' "$SIGNING_PRIVATE_KEY" | base64 -d > tmp_private_key.pem 2>/dev/null
fi

if [ ! -s tmp_private_key.pem ]; then
    echo "Error: Failed to decode private key. Check SIGNING_PRIVATE_KEY."
    rm -f tmp_private_key.pem
    exit 1
fi

# Generate signature (pipe stdin to avoid /dev/stdout issues on Windows)
SIGNATURE=$(cat "$JS_FILE_PATH" | openssl dgst -sha512 -sign tmp_private_key.pem | base64 -w 0)

if [ -z "$SIGNATURE" ]; then
    echo "Error: Failed to generate signature."
    rm -f tmp_private_key.pem
    exit 1
fi

# Extract public key (just the body, no PEM headers)
PUBLIC_KEY=$(openssl rsa -pubout -outform PEM -in tmp_private_key.pem 2>/dev/null | tail -n +2 | head -n -1 | tr -d '\n')

echo "PUBLIC_KEY: $PUBLIC_KEY"

# Remove temporary key file
rm -f tmp_private_key.pem

# Update "scriptSignature" and "scriptPublicKey" fields in Config JSON
if command -v jq >/dev/null 2>&1; then
    cat "$CONFIG_FILE_PATH" | jq --arg signature "$SIGNATURE" --arg publicKey "$PUBLIC_KEY" '. + {scriptSignature: $signature, scriptPublicKey: $publicKey}' > temp_config.json && mv temp_config.json "$CONFIG_FILE_PATH"
    echo "Config updated successfully."
else
    echo "Warning: jq not found. Config not updated."
    echo "scriptSignature: $SIGNATURE"
    echo "scriptPublicKey: $PUBLIC_KEY"
fi
