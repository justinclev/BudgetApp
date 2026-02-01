#!/bin/bash

# MongoDB Collections Reset Script for BudgetApp
# This script allows you to drop collections individually or all at once
# Usage: ./reset-db.sh [collection_name]
# Examples: ./reset-db.sh all
#           ./reset-db.sh 1
#           ./reset-db.sh transactions
#           ./reset-db.sh debts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# MongoDB configuration
MONGO_DB="budget"
COLLECTIONS=("transactions" "debts" "recurringTransactions")

# Print header
print_header() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}  BudgetApp MongoDB Collections Reset${NC}"
  echo -e "${BLUE}  (Docker Container)${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
}

# Print menu
print_menu() {
  echo -e "${YELLOW}Select a collection to drop:${NC}"
  echo "0) Drop ALL collections"
  for i in "${!COLLECTIONS[@]}"; do
    echo "$((i + 1))) Drop ${COLLECTIONS[$i]}"
  done
  echo "5) Exit"
  echo ""
}

# Confirm dangerous operation
confirm() {
  local prompt="$1"
  read -p "$(echo -e ${RED}$prompt${NC})" -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    return 0
  else
    return 1
  fi
}

# Get the MongoDB container ID
get_mongo_container() {
  local container_id=$(docker ps --filter "name=mongo" --format "{{.ID}}" | head -1)
  if [ -z "$container_id" ]; then
    echo -e "${RED}Error: MongoDB Docker container not found${NC}"
    echo -e "${YELLOW}Please make sure MongoDB is running in Docker${NC}"
    echo -e "${YELLOW}Run: docker-compose up -d${NC}"
    exit 1
  fi
  echo "$container_id"
}

# Check if Docker is running and MongoDB container is available
check_docker() {
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    exit 1
  fi
  
  # Try to get container
  if ! get_mongo_container > /dev/null 2>&1; then
    echo -e "${RED}Error: MongoDB Docker container not found${NC}"
    echo -e "${YELLOW}Please make sure MongoDB is running: docker-compose up -d${NC}"
    exit 1
  fi
}

# Drop all collections
drop_all_collections() {
  echo -e "${RED}WARNING: You are about to drop ALL collections!${NC}"
  if confirm "Are you sure? This cannot be undone. (y/n): "; then
    echo ""
    echo -e "${YELLOW}Dropping all collections...${NC}"
    
    for collection in "${COLLECTIONS[@]}"; do
      drop_collection "$collection"
    done
    
    echo -e "${GREEN}✓ All collections dropped!${NC}"
  else
    echo -e "${YELLOW}Operation cancelled.${NC}"
  fi
}

# Drop a single collection
drop_collection() {
  local collection=$1
  
  if [ -z "$collection" ]; then
    echo -e "${RED}Error: No collection specified${NC}"
    return 1
  fi
  
  echo -e "${RED}WARNING: You are about to drop the '$collection' collection!${NC}"
  if confirm "Are you sure? (y/n): "; then
    echo -e "${YELLOW}Dropping collection: $collection${NC}"
    
    local container=$(get_mongo_container)
    docker exec "$container" mongosh "$MONGO_DB" --eval "db.${collection}.deleteMany({})" 2>/dev/null
    
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✓ Collection '$collection' cleared!${NC}"
    else
      echo -e "${RED}✗ Failed to clear collection '$collection'${NC}"
      return 1
    fi
  else
    echo -e "${YELLOW}Operation cancelled.${NC}"
  fi
}

# Handle numeric or string input
handle_input() {
  local input=$1
  
  # Check if input is numeric
  if [[ $input =~ ^[0-9]+$ ]]; then
    case $input in
      0)
        drop_all_collections
        ;;
      1)
        drop_collection "${COLLECTIONS[0]}"
        ;;
      2)
        drop_collection "${COLLECTIONS[1]}"
        ;;
      3)
        drop_collection "${COLLECTIONS[2]}"
        ;;
      5)
        echo -e "${GREEN}Goodbye!${NC}"
        exit 0
        ;;
      *)
        echo -e "${RED}Invalid choice. Please try again.${NC}"
        ;;
    esac
  else
    # Check if input is a collection name
    local found=0
    for collection in "${COLLECTIONS[@]}"; do
      if [[ "$input" == "$collection" ]]; then
        drop_collection "$collection"
        found=1
        break
      fi
    done
    
    if [ $found -eq 0 ]; then
      if [[ "$input" == "all" ]]; then
        drop_all_collections
      else
        echo -e "${RED}Invalid collection name. Available collections:${NC}"
        printf '%s\n' "${COLLECTIONS[@]}"
      fi
    fi
  fi
}

# Main function
main() {
  check_docker
  
  # If argument provided, use it directly
  if [ $# -gt 0 ]; then
    handle_input "$1"
  else
    # Interactive mode
    while true; do
      print_header
      print_menu
      read -p "Enter your choice: " choice
      handle_input "$choice"
      echo ""
      read -p "Press Enter to continue..."
    done
  fi
}

# Run main function with arguments
main "$@"
