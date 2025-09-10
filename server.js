const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const winston = require('winston');
const natural = require('natural');
const sentiment = require('sentiment');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

// Enhanced logging system
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'anti-india-detection' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Clustering for scalability
if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        cluster.fork();
    });
} else {
    const app = express();
    
    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"]
            }
        }
    }));
    
    // Rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        message: 'Too many requests from this IP'
    });
    app.use('/api/', limiter);
    
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.static('public'));
    
    // Database connection with retry logic
    const connectDB = async () => {
        try {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/anti_india_detection', {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            logger.info('MongoDB connected successfully');
        } catch (error) {
            logger.error('Database connection failed:', error);
            setTimeout(connectDB, 5000);
        }
    };
    connectDB();
    
    // Advanced AI Detection Engine
    class AntiIndiaDetectionEngine {
        constructor() {
            this.suspiciousKeywords = [
                'anti-india', 'destroy india', 'fake india', 'propaganda india',
                'indian fake news', 'corrupt india', 'terrorist india',
                // Hindi/Urdu keywords
                'भारत विरोधी', 'हिंदुस्तान दुश्मन', 'पाकिस्तान जिंदाबाद'
            ];
            
            this.sentimentAnalyzer = new sentiment();
            this.classifier = new natural.LogisticRegressionClassifier();
            this.initializeClassifier();
        }
        
        initializeClassifier() {
            // Training data for anti-India content detection
            const trainingData = [
                { text: "India is a great nation with rich culture", label: "neutral" },
                { text: "Destroy India and its economy", label: "anti-india" },
                { text: "Love Pakistan hate India", label: "anti-india" },
                { text: "Indian festivals are beautiful", label: "neutral" },
                { text: "Spread fake news about India", label: "anti-india" }
            ];
            
            trainingData.forEach(item => {
                this.classifier.addDocument(item.text.toLowerCase(), item.label);
            });
            
            this.classifier.train();
        }
        
        async analyzeContent(content, metadata = {}) {
            try {
                const analysis = {
                    content: content,
                    timestamp: new Date(),
                    platform: metadata.platform || 'unknown',
                    riskScore: 0,
                    flags: [],
                    sentiment: {},
                    networkAnalysis: {},
                    explanation: []
                };
                
                // Sentiment Analysis
                const sentimentResult = this.sentimentAnalyzer.analyze(content);
                analysis.sentiment = {
                    score: sentimentResult.score,
                    comparative: sentimentResult.comparative,
                    positive: sentimentResult.positive,
                    negative: sentimentResult.negative
                };
                
                // Keyword Detection
                const suspiciousMatches = this.detectSuspiciousKeywords(content);
                if (suspiciousMatches.length > 0) {
                    analysis.riskScore += 40;
                    analysis.flags.push('suspicious_keywords');
                    analysis.explanation.push(`Suspicious keywords detected: ${suspiciousMatches.join(', ')}`);
                }
                
                // ML Classification
                const classification = this.classifier.classify(content.toLowerCase());
                if (classification === 'anti-india') {
                    analysis.riskScore += 35;
                    analysis.flags.push('ml_classification_positive');
                    analysis.explanation.push('Machine learning model flagged as anti-India content');
                }
                
                // Sentiment-based risk assessment
                if (sentimentResult.comparative < -0.5) {
                    analysis.riskScore += 20;
                    analysis.flags.push('negative_sentiment');
                    analysis.explanation.push('Extremely negative sentiment detected');
                }
                
                // Bot behavior detection
                if (metadata.userId && await this.detectBotBehavior(metadata.userId)) {
                    analysis.riskScore += 30;
                    analysis.flags.push('bot_behavior');
                    analysis.explanation.push('Bot-like behavior patterns detected');
                }
                
                // Hashtag analysis
                if (metadata.hashtags) {
                    const suspiciousHashtags = this.analyzeSuspiciousHashtags(metadata.hashtags);
                    if (suspiciousHashtags.length > 0) {
                        analysis.riskScore += 25;
                        analysis.flags.push('suspicious_hashtags');
                        analysis.explanation.push(`Suspicious hashtags: ${suspiciousHashtags.join(', ')}`);
                    }
                }
                
                // Network analysis for coordinated campaigns
                if (metadata.networkData) {
                    const networkRisk = await this.analyzeNetworkPatterns(metadata.networkData);
                    analysis.networkAnalysis = networkRisk;
                    analysis.riskScore += networkRisk.score;
                }
                
                // Final risk categorization
                analysis.riskLevel = this.categorizeRisk(analysis.riskScore);
                
                return analysis;
                
            } catch (error) {
                logger.error('Error in content analysis:', error);
                throw new Error('Analysis failed');
            }
        }
        
        detectSuspiciousKeywords(content) {
            const matches = [];
            const lowerContent = content.toLowerCase();
            
            this.suspiciousKeywords.forEach(keyword => {
                if (lowerContent.includes(keyword.toLowerCase())) {
                    matches.push(keyword);
                }
            });
            
            return matches;
        }
        
        analyzeSuspiciousHashtags(hashtags) {
            const suspiciousHashtags = [
                '#antiindia', '#destroyindia', '#fakeindia',
                '#pakistanzindabad', '#indiaexposed'
            ];
            
            return hashtags.filter(tag => 
                suspiciousHashtags.some(suspicious => 
                    tag.toLowerCase().includes(suspicious.replace('#', ''))
                )
            );
        }
        
        async detectBotBehavior(userId) {
            // Simulate bot detection logic
            // In real implementation, this would check posting patterns, account age, etc.
            try {
                const user = await UserActivity.findOne({ userId });
                if (!user) return false;
                
                const recentPosts = user.posts.filter(post => 
                    Date.now() - post.timestamp < 24 * 60 * 60 * 1000
                );
                
                // Bot indicators: too many posts in short time, repetitive content
                return recentPosts.length > 50 || 
                       this.hasRepetitiveContent(recentPosts);
                       
            } catch (error) {
                logger.error('Bot detection error:', error);
                return false;
            }
        }
        
        hasRepetitiveContent(posts) {
            const contents = posts.map(post => post.content);
            const uniqueContents = [...new Set(contents)];
            return (contents.length - uniqueContents.length) / contents.length > 0.7;
        }
        
        async analyzeNetworkPatterns(networkData) {
            // Advanced network analysis for coordinated campaigns
            const analysis = {
                score: 0,
                indicators: [],
                suspiciousConnections: []
            };
            
            // Check for synchronized posting patterns
            if (networkData.simultaneousPosts && networkData.simultaneousPosts > 10) {
                analysis.score += 20;
                analysis.indicators.push('synchronized_posting');
            }
            
            // Check for shared suspicious content
            if (networkData.sharedContent && networkData.sharedContent.suspiciousPercentage > 0.6) {
                analysis.score += 25;
                analysis.indicators.push('coordinated_messaging');
            }
            
            return analysis;
        }
        
        categorizeRisk(score) {
            if (score >= 80) return 'HIGH';
            if (score >= 50) return 'MEDIUM';
            if (score >= 25) return 'LOW';
            return 'MINIMAL';
        }
    }
    
    // Database Models
    const analysisSchema = new mongoose.Schema({
        content: String,
        platform: String,
        riskScore: Number,
        riskLevel: String,
        flags: [String],
        sentiment: Object,
        networkAnalysis: Object,
        explanation: [String],
        timestamp: { type: Date, default: Date.now },
        userId: String,
        resolved: { type: Boolean, default: false }
    });
    
    const userActivitySchema = new mongoose.Schema({
        userId: String,
        posts: [{
            content: String,
            timestamp: { type: Date, default: Date.now },
            platform: String
        }],
        riskProfile: {
            totalRiskScore: { type: Number, default: 0 },
            flaggedPosts: { type: Number, default: 0 }
        }
    });
    
    const Analysis = mongoose.model('Analysis', analysisSchema);
    const UserActivity = mongoose.model('UserActivity', userActivitySchema);
    
    // Initialize detection engine
    const detectionEngine = new AntiIndiaDetectionEngine();
    
    // API Routes
    app.post('/api/analyze', async (req, res) => {
        try {
            const { content, metadata = {} } = req.body;
            
            if (!content || content.trim().length === 0) {
                return res.status(400).json({
                    error: 'Content is required for analysis'
                });
            }
            
            const analysis = await detectionEngine.analyzeContent(content, metadata);
            
            // Save to database
            const savedAnalysis = new Analysis(analysis);
            await savedAnalysis.save();
            
            // Update user activity if userId provided
            if (metadata.userId) {
                await UserActivity.findOneAndUpdate(
                    { userId: metadata.userId },
                    {
                        $push: {
                            posts: {
                                content: content,
                                platform: metadata.platform || 'unknown'
                            }
                        },
                        $inc: {
                            'riskProfile.totalRiskScore': analysis.riskScore,
                            'riskProfile.flaggedPosts': analysis.riskScore > 25 ? 1 : 0
                        }
                    },
                    { upsert: true }
                );
            }
            
            logger.info(`Content analyzed - Risk Level: ${analysis.riskLevel}`, {
                riskScore: analysis.riskScore,
                platform: metadata.platform
            });
            
            res.json({
                success: true,
                analysis: analysis
            });
            
        } catch (error) {
            logger.error('Analysis API error:', error);
            res.status(500).json({
                error: 'Analysis failed',
                details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    });
    
    app.get('/api/dashboard', async (req, res) => {
        try {
            const { timeframe = '24h', platform = 'all' } = req.query;
            
            let timeFilter = {};
            const now = new Date();
            
            switch (timeframe) {
                case '1h':
                    timeFilter = { timestamp: { $gte: new Date(now - 60 * 60 * 1000) } };
                    break;
                case '24h':
                    timeFilter = { timestamp: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
                    break;
                case '7d':
                    timeFilter = { timestamp: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
                    break;
            }
            
            let platformFilter = platform === 'all' ? {} : { platform: platform };
            
            const filter = { ...timeFilter, ...platformFilter };
            
            const [totalAnalyses, highRiskCount, mediumRiskCount, lowRiskCount, recentAnalyses] = await Promise.all([
                Analysis.countDocuments(filter),
                Analysis.countDocuments({ ...filter, riskLevel: 'HIGH' }),
                Analysis.countDocuments({ ...filter, riskLevel: 'MEDIUM' }),
                Analysis.countDocuments({ ...filter, riskLevel: 'LOW' }),
                Analysis.find(filter)
                    .sort({ timestamp: -1 })
                    .limit(10)
                    .select('content riskLevel riskScore flags timestamp platform explanation')
            ]);
            
            const platformStats = await Analysis.aggregate([
                { $match: timeFilter },
                { $group: { _id: '$platform', count: { $sum: 1 }, avgRisk: { $avg: '$riskScore' } } }
            ]);
            
            res.json({
                success: true,
                dashboard: {
                    summary: {
                        totalAnalyses,
                        highRiskCount,
                        mediumRiskCount,
                        lowRiskCount,
                        riskDistribution: {
                            high: ((highRiskCount / totalAnalyses) * 100).toFixed(2),
                            medium: ((mediumRiskCount / totalAnalyses) * 100).toFixed(2),
                            low: ((lowRiskCount / totalAnalyses) * 100).toFixed(2)
                        }
                    },
                    platformStats,
                    recentAnalyses,
                    timeframe,
                    platform
                }
            });
            
        } catch (error) {
            logger.error('Dashboard API error:', error);
            res.status(500).json({
                error: 'Dashboard data retrieval failed'
            });
        }
    });
    
    app.get('/api/network-analysis', async (req, res) => {
        try {
            const suspiciousNetworks = await Analysis.aggregate([
                {
                    $match: {
                        'networkAnalysis.indicators': { $exists: true, $ne: [] },
                        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                    }
                },
                {
                    $group: {
                        _id: '$userId',
                        posts: { $push: '$content' },
                        totalRisk: { $sum: '$riskScore' },
                        indicators: { $push: '$networkAnalysis.indicators' }
                    }
                },
                { $sort: { totalRisk: -1 } },
                { $limit: 20 }
            ]);
            
            res.json({
                success: true,
                suspiciousNetworks
            });
            
        } catch (error) {
            logger.error('Network analysis API error:', error);
            res.status(500).json({
                error: 'Network analysis failed'
            });
        }
    });
    
    // Error handling middleware
    app.use((error, req, res, next) => {
        logger.error('Unhandled error:', error);
        res.status(500).json({
            error: 'Internal server error',
            requestId: req.headers['x-request-id'] || 'unknown'
        });
    });
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
        console.log(`Worker ${process.pid} started`);
    });
}
