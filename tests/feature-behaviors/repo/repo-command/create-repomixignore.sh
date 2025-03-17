#!/bin/bash
# This script creates a .repomixignore file with the specified content
# Usage: ./create-repomixignore.sh "pattern"

PATTERN="${1:-src/**}"

sqlite3 :memory: <<EOF
.output .repomixignore
SELECT '$PATTERN';
EOF

echo "Created .repomixignore with content: $PATTERN"
