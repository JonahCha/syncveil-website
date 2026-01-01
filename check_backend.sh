#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Checking backend status...${NC}\n"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python3 is not installed${NC}"
    exit 1
fi

# Install required packages if not present
if ! python3 -c "import requests" 2>/dev/null; then
    echo -e "${YELLOW}Installing required Python packages...${NC}"
    pip install requests
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}Created .env file. Please review and update settings if needed.${NC}\n"
fi

# Run the Python test script
python3 test_backend.py
exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo -e "\n${GREEN}Backend is healthy!${NC}"
else
    echo -e "\n${RED}Backend has issues. Please review the output above.${NC}"
fi

exit $exit_code
