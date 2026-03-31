#!/bin/bash

BASE64_KEY="MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAE9PaTBO1tihpFqEokGLB+nPPXjLKtoIdlGZMpLpF+hrGXN0zpGWYximjgTzMCHEG0u0KiwajHvXXM3WAK0xS8bg=="
URL_ENCODED=$(printf $BASE64_KEY | jq -sRr @uri)

open "http://frontend.local.localhost:8000?k=$URL_ENCODED"

