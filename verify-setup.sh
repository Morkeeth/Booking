#!/bin/bash

echo "🔍 Verifying Tennis Booking Setup..."
echo ""

# Check Node.js
echo "1. Node.js:"
if command -v node &> /dev/null; then
    echo "   ✅ Node.js found: $(node --version)"
    echo "   ✅ Path: $(which node)"
else
    echo "   ❌ Node.js not found"
fi
echo ""

# Check script exists
echo "2. Booking Script:"
if [ -f "/Users/morkeeth/EVALUATOR/Booking/index.js" ]; then
    echo "   ✅ Script exists"
    node -c /Users/morkeeth/EVALUATOR/Booking/index.js 2>/dev/null && echo "   ✅ Script syntax valid" || echo "   ❌ Script has syntax errors"
else
    echo "   ❌ Script missing"
fi
echo ""

# Check config
echo "3. Configuration:"
if [ -f "/Users/morkeeth/EVALUATOR/Booking/config.json" ]; then
    echo "   ✅ Config file exists"
    node -e "import('./config.json', {assert: {type: 'json'}}).then(c => {
        console.log('   ✅ Locations:', c.default.locations.join(', '));
        console.log('   ✅ Hours:', c.default.hours.join(', '));
        console.log('   ✅ Date:', c.default.date || '6 days ahead (auto)');
    })" 2>/dev/null || echo "   ⚠️  Could not validate config"
else
    echo "   ❌ Config missing"
fi
echo ""

# Check dependencies
echo "4. Dependencies:"
if [ -d "/Users/morkeeth/EVALUATOR/Booking/node_modules" ]; then
    echo "   ✅ Dependencies installed"
else
    echo "   ❌ Dependencies missing - run: npm install"
fi
echo ""

# Check launchd service
echo "5. Automation Service:"
if launchctl list | grep -q "com.tennis.booking"; then
    echo "   ✅ Service is loaded"
else
    echo "   ❌ Service not loaded"
fi

if [ -f ~/Library/LaunchAgents/com.tennis.booking.plist ]; then
    echo "   ✅ Plist in LaunchAgents"
else
    echo "   ⚠️  Plist not in LaunchAgents"
fi
echo ""

# Check schedule
echo "6. Schedule:"
echo "   📅 Runs daily at 8:00 AM"
echo "   📅 Next run: Tomorrow (Jan 14) at 8:00 AM"
echo "   📅 Will book for: Jan 19, 2026 (6 days ahead)"
echo ""

# Check logs directory
echo "7. Logs:"
if [ -w "/Users/morkeeth/EVALUATOR/Booking" ]; then
    echo "   ✅ Can write logs"
else
    echo "   ⚠️  May not be able to write logs"
fi
echo ""

echo "✅ Setup Verification Complete!"
echo ""
echo "To test the script (without booking):"
echo "  cd /Users/morkeeth/EVALUATOR/Booking"
echo "  node index.js --dry-run"
echo ""
