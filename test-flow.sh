#!/bin/bash
set -euo pipefail

UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
PUBLIC_KEY="dGVzdC1rZXk="

echo "Registering with UUID: $UUID"
RESULT=$(icp canister call backend register "(\"$UUID\", \"$PUBLIC_KEY\")")

# Extract short code from: (variant { ok = "ABC123" })
CODE=$(echo "$RESULT" | sed -n 's/.*ok = "\([^"]*\)".*/\1/p')

if [ -z "$CODE" ]; then
  echo "Registration failed: $RESULT"
  exit 1
fi

echo "Short code: $CODE"
echo ""
echo "Open http://frontend.local.localhost:8000/cli-login and enter the code above."
echo "Polling for delegation..."

open "http://frontend.local.localhost:8000/cli-login"

while true; do
  DELEGATION=$(icp canister call backend get_delegation "(\"$UUID\")")
  if [ "$DELEGATION" != "(null)" ]; then
    echo ""
    echo "Delegation received:"
    echo "$DELEGATION"
    exit 0
  fi
  sleep 2
done
