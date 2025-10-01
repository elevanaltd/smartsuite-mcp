#!/bin/bash

# SmartSuite API Shim MCP Server - Setup Script
# Automatically configures the MCP server for Claude Desktop and Claude Code
# Usage: ./setup-mcp.sh [--reconfigure]

set -euo pipefail

# Colors for output
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly RED='\033[0;31m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Configuration
readonly MCP_SERVER_NAME="smartsuite-shim"
readonly SERVER_DISPLAY_NAME="SmartSuite API Shim"
readonly DESKTOP_CONFIG_FLAG="$SCRIPT_DIR/.claude-desktop-configured"
readonly CLAUDE_CODE_CONFIG_FLAG="$SCRIPT_DIR/.claude-code-configured"
RECONFIGURE=false

# Print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_info() {
    echo -e "${YELLOW}$1${NC}"
}

print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

# Show usage
show_usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Configure SmartSuite API Shim MCP Server for Claude Desktop and Claude Code.

OPTIONS:
    --reconfigure, -r        Force reconfiguration
    --help, -h              Show this help message

WHAT THIS SCRIPT DOES:
    1. Checks Node.js version (requires 20.6+)
    2. Installs npm dependencies
    3. Builds the TypeScript project
    4. Configures Claude Desktop (via ~/Library/Application Support/Claude/claude_desktop_config.json)
    5. Configures Claude Code (via ~/.claude.json)
    6. Creates or validates .env file

EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --reconfigure|-r)
            RECONFIGURE=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Show header
show_header() {
    echo ""
    print_header "      🚀 SmartSuite API Shim MCP Server Setup      "
    if [[ "$RECONFIGURE" == "true" ]]; then
        echo -e "${BLUE}Mode: Reconfigure${NC}"
    fi
    echo ""
}

# Check Node.js version
check_nodejs() {
    echo "📋 Checking Node.js version..."
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 20.6+ first."
        echo "Visit: https://nodejs.org/"
        exit 1
    fi
    
    local node_version=$(node -v | cut -d'v' -f2)
    local required_version="20.6.0"
    
    if [[ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]]; then
        print_error "Node.js version $node_version is too old. Version 20.6+ is required (for --env-file support)."
        exit 1
    fi
    
    print_success "Node.js version $node_version ✓"
    echo ""
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    if [[ -f "package-lock.json" ]]; then
        npm ci --silent
    else
        npm install --silent
    fi
    print_success "Dependencies installed"
    echo ""
}

# Build the project
build_project() {
    echo "🔨 Building TypeScript project..."
    npm run build 2>&1 | grep -v "^>" || true
    if [[ -f "build/src/index.js" ]]; then
        print_success "Project built successfully"
    else
        print_error "Build failed - build/src/index.js not found"
        exit 1
    fi
    echo ""
}

# Setup environment file
setup_env_file() {
    echo "🔑 Setting up environment file..."
    
    if [[ -f ".env" ]]; then
        # Check if required variables exist
        if grep -q "SMARTSUITE_API_TOKEN" .env && grep -q "SMARTSUITE_WORKSPACE_ID" .env; then
            print_success ".env file already configured"
        else
            print_warning ".env file exists but missing required variables"
            echo ""
            echo "Please ensure your .env file contains:"
            echo "  SMARTSUITE_API_TOKEN=your_api_token"
            echo "  SMARTSUITE_WORKSPACE_ID=your_workspace_id"
        fi
    else
        # Create .env from example
        if [[ -f ".env.example" ]]; then
            cp .env.example .env
            print_success "Created .env file from .env.example"
            echo ""
            print_warning "Please edit .env and add your SmartSuite credentials:"
            echo "  1. Open .env in your editor"
            echo "  2. Add your SMARTSUITE_API_TOKEN"
            echo "  3. Add your SMARTSUITE_WORKSPACE_ID"
        else
            print_error "No .env or .env.example file found"
            echo ""
            echo "Please create a .env file with:"
            echo "  SMARTSUITE_API_TOKEN=your_api_token"
            echo "  SMARTSUITE_WORKSPACE_ID=your_workspace_id"
        fi
    fi
    echo ""
}

# Get Claude Desktop config path
get_claude_desktop_config_path() {
    local os_type="$(uname -s)"
    case "$os_type" in
        Darwin)
            echo "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
            ;;
        Linux)
            echo "$HOME/.config/Claude/claude_desktop_config.json"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            echo "$APPDATA/Claude/claude_desktop_config.json"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Configure Claude Desktop
configure_claude_desktop() {
    local node_path="$(which node)"
    local server_path="$SCRIPT_DIR/build/src/index.js"
    local env_path="$SCRIPT_DIR/.env"
    local config_path="$(get_claude_desktop_config_path)"
    
    # Skip if already configured (unless reconfiguring)
    if [[ -f "$DESKTOP_CONFIG_FLAG" ]] && [[ "$RECONFIGURE" != "true" ]]; then
        print_success "Claude Desktop already configured"
        return 0
    fi
    
    if [[ -z "$config_path" ]]; then
        print_warning "Unable to determine Claude Desktop config path for this platform"
        return 0
    fi
    
    echo ""
    print_header "         CLAUDE DESKTOP CONFIGURATION         "
    
    read -p "Configure $SERVER_DISPLAY_NAME for Claude Desktop? (Y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        # Check if config file exists
        if [[ ! -f "$config_path" ]]; then
            # Create directory if needed
            mkdir -p "$(dirname "$config_path")"
            echo '{"mcpServers": {}}' > "$config_path"
            print_success "Created Claude Desktop config file"
        fi
        
        # Create the MCP server configuration
        local mcp_config=$(cat <<EOF
{
  "type": "stdio",
  "command": "$node_path",
  "args": [
    "--env-file=$env_path",
    "$server_path"
  ]
}
EOF
)
        
        # Update the config file using jq if available, otherwise show manual instructions
        if command -v jq &> /dev/null; then
            # Use jq to update the config
            local temp_file=$(mktemp)
            jq --arg name "$MCP_SERVER_NAME" --argjson config "$mcp_config" \
                '.mcpServers[$name] = $config' "$config_path" > "$temp_file"
            mv "$temp_file" "$config_path"
            print_success "Claude Desktop configuration updated"
            touch "$DESKTOP_CONFIG_FLAG"
        else
            # Show manual instructions
            echo ""
            print_warning "jq not installed - showing manual configuration"
            echo ""
            echo "Add this to your Claude Desktop config at:"
            echo "$config_path"
            echo ""
            echo "Under \"mcpServers\", add:"
            echo ""
            echo "  \"$MCP_SERVER_NAME\": {"
            echo "    \"type\": \"stdio\","
            echo "    \"command\": \"$node_path\","
            echo "    \"args\": ["
            echo "      \"--env-file=$env_path\","
            echo "      \"$server_path\""
            echo "    ]"
            echo "  }"
            echo ""
        fi
    else
        print_info "Skipping Claude Desktop configuration"
    fi
}

# Configure Claude Code
configure_claude_code() {
    local node_path="$(which node)"
    local server_path="$SCRIPT_DIR/build/src/index.js"
    local env_path="$SCRIPT_DIR/.env"
    local config_path="$HOME/.claude.json"
    
    # Skip if already configured (unless reconfiguring)
    if [[ -f "$CLAUDE_CODE_CONFIG_FLAG" ]] && [[ "$RECONFIGURE" != "true" ]]; then
        print_success "Claude Code already configured"
        return 0
    fi
    
    echo ""
    print_header "          CLAUDE CODE CONFIGURATION          "
    
    read -p "Configure $SERVER_DISPLAY_NAME for Claude Code? (Y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        if [[ ! -f "$config_path" ]]; then
            print_error "Claude Code config not found at $config_path"
            echo "Please ensure Claude Code is installed and has been run at least once"
            return 1
        fi
        
        # Check if already configured
        if grep -q "\"$MCP_SERVER_NAME\"" "$config_path"; then
            print_success "Claude Code already has $MCP_SERVER_NAME configured"
            if [[ "$RECONFIGURE" == "true" ]]; then
                print_info "Updating configuration..."
                # Use jq to update existing config if available
                if command -v jq &> /dev/null; then
                    local temp_file=$(mktemp)
                    local mcp_config=$(cat <<EOF
{
  "type": "stdio",
  "command": "$node_path",
  "args": [
    "--env-file=$env_path",
    "$server_path"
  ]
}
EOF
)
                    jq --arg name "$MCP_SERVER_NAME" --argjson config "$mcp_config" \
                        '.mcpServers[$name] = $config' "$config_path" > "$temp_file"
                    mv "$temp_file" "$config_path"
                    print_success "Claude Code configuration updated"
                fi
            fi
        else
            # Try to add it automatically with jq
            if command -v jq &> /dev/null; then
                echo ""
                print_info "Adding $MCP_SERVER_NAME to Claude Code configuration..."
                local temp_file=$(mktemp)
                local mcp_config=$(cat <<EOF
{
  "type": "stdio",
  "command": "$node_path",
  "args": [
    "--env-file=$env_path",
    "$server_path"
  ]
}
EOF
)
                # Make backup
                cp "$config_path" "${config_path}.backup"
                
                # Add to mcpServers
                jq --arg name "$MCP_SERVER_NAME" --argjson config "$mcp_config" \
                    '.mcpServers[$name] = $config' "$config_path" > "$temp_file"
                mv "$temp_file" "$config_path"
                print_success "Claude Code configuration updated"
            else
                # Show manual instructions
                echo ""
                echo "To add to Claude Code:"
                echo ""
                echo "1. Open Claude Code"
                echo "2. Use the command: /config mcp"
                echo "3. Add this server configuration:"
                echo ""
                echo "Server name: $MCP_SERVER_NAME"
                echo "Type: stdio"
                echo "Command: $node_path"
                echo "Arguments:"
                echo "  --env-file=$env_path"
                echo "  $server_path"
                echo ""
            fi
        fi
        touch "$CLAUDE_CODE_CONFIG_FLAG"
    else
        print_info "Skipping Claude Code configuration"
    fi
}

# Test the server
test_server() {
    echo ""
    print_header "           TESTING MCP SERVER           "
    
    echo "Testing server startup..."
    
    # Try to start the server briefly and capture output
    local test_output
    test_output=$(node --env-file=.env build/src/index.js 2>&1 &
        local pid=$!
        sleep 2
        kill $pid 2>/dev/null
        wait $pid 2>/dev/null)
    
    # Check if the output contains success indicators
    if echo "$test_output" | grep -q "MCP Server connected with tool handlers ready"; then
        print_success "Server starts successfully!"
        echo ""
        echo "Tools registered:"
        echo "$test_output" | grep -E "smartsuite_" | head -4
    elif echo "$test_output" | grep -q "Server initialized with 4 tools"; then
        print_success "Server initializes but check MCP connection"
    else
        print_warning "Server may have issues - check your .env configuration"
        echo "Output: $test_output" | head -5
    fi
    echo ""
}

# Show final instructions
show_final_instructions() {
    echo ""
    print_header "          ✨ SETUP COMPLETE ✨          "
    echo ""
    print_success "SmartSuite API Shim MCP Server is configured!"
    echo ""
    echo "📝 Next steps:"
    echo ""
    echo "1. Ensure your .env file has valid credentials:"
    echo "   - SMARTSUITE_API_TOKEN"
    echo "   - SMARTSUITE_WORKSPACE_ID"
    echo ""
    echo "2. Restart Claude Desktop or Claude Code to load the new MCP server"
    echo ""
    echo "3. Test the connection:"
    echo "   - In Claude Desktop: The server will auto-connect"
    echo "   - In Claude Code: Use /mcp command"
    echo ""
    echo "📚 Available tools:"
    echo "   • smartsuite_query - Query SmartSuite records"
    echo "   • smartsuite_record - Create/update/delete records"
    echo "   • smartsuite_schema - Get table schema"
    echo "   • smartsuite_undo - Undo last operation"
    echo ""
    print_info "Remember: All mutations require DRY-RUN confirmation for safety!"
    echo ""
}

# Main function
main() {
    show_header
    
    # Handle reconfiguration
    if [[ "$RECONFIGURE" == "true" ]]; then
        print_info "Clearing configuration flags for reconfiguration..."
        rm -f "$DESKTOP_CONFIG_FLAG" 2>/dev/null || true
        rm -f "$CLAUDE_CODE_CONFIG_FLAG" 2>/dev/null || true
        print_success "Configuration flags cleared"
        echo ""
    fi
    
    # Run setup steps
    check_nodejs
    install_dependencies
    build_project
    setup_env_file
    configure_claude_desktop
    configure_claude_code
    test_server
    show_final_instructions
}

# Run main function
main