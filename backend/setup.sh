#!/bin/bash

echo "Setting up Figma Gumloop Proxy Backend..."

# Navigate to backend directory
cd "$(dirname "$0")"

# Create virtual environment
echo "Creating Python virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo ""
    echo "⚠️  Please edit .env with your Gumloop credentials:"
    echo "   GUMLOOP_API_KEY=your_api_key_here"
    echo "   GUMLOOP_USER_ID=your_user_id_here"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the server, run:"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python3 main.py"
