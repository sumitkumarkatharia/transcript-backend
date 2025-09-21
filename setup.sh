#!/bin/bash

# setup.sh - Fireflies Backend Setup Script

echo "🚀 Setting up Fireflies Backend..."

# Check if required tools are installed
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL not found. Make sure PostgreSQL is installed and running."
    echo "   You can install it with: brew install postgresql"
fi

# Check Redis
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis not found. Make sure Redis is installed and running."
    echo "   You can install it with: brew install redis"
fi

echo "✅ Prerequisites check completed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Set up environment file
echo "🔧 Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
    echo "⚠️  Please update .env with your actual configuration values"
else
    echo "✅ .env file already exists"
fi

# Generate Prisma client
echo "🗄️  Setting up database..."
npx prisma generate

# Check if database exists and is accessible
echo "🔍 Checking database connection..."
if npx prisma db push --accept-data-loss &> /dev/null; then
    echo "✅ Database connection successful"
    
    # Run migrations
    echo "📝 Running database migrations..."
    npx prisma migrate dev --name init
    
    # Seed database
    echo "🌱 Seeding database..."
    npx prisma db seed
    
    echo "✅ Database setup completed"
else
    echo "❌ Database connection failed"
    echo "   Please make sure PostgreSQL is running and DATABASE_URL is correct in .env"
    echo "   Default connection: postgresql://postgres:password@localhost:5432/fireflies_db"
fi

# Build the application
echo "🔨 Building application..."
npm run build

echo ""
echo "🎉 Setup completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Update .env with your configuration (OpenAI API key, etc.)"
echo "   2. Start Redis: brew services start redis"
echo "   3. Start PostgreSQL: brew services start postgresql"
echo "   4. Start development server: npm run start:dev"
echo ""
echo "🔗 Useful commands:"
echo "   npm run start:dev     - Start development server"
echo "   npm run db:studio     - Open Prisma Studio"
echo "   npm run build         - Build for production"
echo ""