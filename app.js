/**
 * Anti-India Campaign Detection System
 * Advanced AI-powered platform for detecting propaganda campaigns
 * 
 * @version 2.0.0
 * @author Security Intelligence Team
 */

class AntiIndiaCampaignDetector {
    constructor() {
        this.apiUrl = '/api';
        this.isRealTimeEnabled = false;
        this.pollingInterval = null;
        this.chartInstances = {};
        this.analysisHistory = [];
        this.websocket = null;
        
        this.init();
    }
    
    /**
     * Initialize the application
     */
    async init() {
        try {
            this.showLoadingScreen();
            await this.initializeComponents();
            await this.loadDashboardData();
            this.setupEventListeners();
            this.setupRealTimeMonitoring();
            await this.delay(2000); // Simulate initialization time
            this.hideLoadingScreen();
            this.showToast('System initialized successfully', 'success');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showToast('System initialization failed', 'error');
            this.hideLoadingScreen();
        }
    }
    
    /**
     * Initialize UI components
     */
    async initializeComponents() {
        // Character counter for textarea
        const contentInput = document.getElementById('content-input');
        const charCount = document.getElementById('char-count');
        
        if (contentInput && charCount) {
            contentInput.addEventListener('input', (e) => {
                const length = e.target.value.length;
                charCount.textContent = length;
                
                if (length > 4500) {
                    charCount.style.color = 'var(--error-color)';
                } else if (length > 4000) {
                    charCount.style.color = 'var(--warning-color)';
                } else {
                    charCount.style.color = 'var(--text-light)';
                }
            });
        }
        
        // Initialize file upload
        this.initializeFileUpload();
        
        // Initialize tooltips and help text
        this.initializeTooltips();
        
        // Set system status
        this.updateSystemStatus('online');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Analysis button
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyzeContent());
        }
        
        // Batch analysis button
        const batchAnalyzeBtn = document.getElementById('batch-analyze-btn');
        if (batchAnalyzeBtn) {
            batchAnalyzeBtn.addEventListener('click', () => this.openBatchModal());
        }
        
        // Clear button
        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearForm());
        }
        
        // Real-time toggle
        const realTimeToggle = document.getElementById('real-time-toggle');
        if (realTimeToggle) {
            realTimeToggle.addEventListener('click', () => this.toggleRealTimeMonitoring());
        }
        
        // Dashboard controls
        const timeframeSelect = document.getElementById('timeframe-select');
        if (timeframeSelect) {
            timeframeSelect.addEventListener('change', () => this.loadDashboardData());
        }
        
        const platformFilter = document.getElementById('platform-filter');
        if (platformFilter) {
            platformFilter.addEventListener('change', () => this.loadDashboardData());
        }
        
        // Refresh buttons
        const refreshDetections = document.getElementById('refresh-detections');
        if (refreshDetections) {
            refreshDetections.addEventListener('click', () => this.refreshRecentDetections());
        }
        
        // Export and share buttons
        const exportResults = document.getElementById('export-results');
        if (exportResults) {
            exportResults.addEventListener('click', () => this.exportResults());
        }
        
        const shareResults = document.getElementById('share-results');
        if (shareResults) {
            shareResults.addEventListener('click', () => this.shareResults());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+Enter to analyze
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.analyzeContent();
            }
            
            // Escape to close modals
            if (e.key === 'Escape') {
                this.closeBatchModal();
                this.hideAlert();
            }
        });
        
        // Handle window resize for responsive charts
        window.addEventListener('resize', this.debounce(() => {
            this.resizeCharts();
        }, 250));
        
        // Handle visibility change for performance optimization
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseRealTimeMonitoring();
            } else {
                this.resumeRealTimeMonitoring();
            }
        });
    }
    
    /**
     * Analyze content using the API
     */
    async analyzeContent() {
        const analyzeBtn = document.getElementById('analyze-btn');
        const contentInput = document.getElementById('content-input');
        const platformSelect = document.getElementById('platform-select');
        const userIdInput = document.getElementById('user-id-input');
        const hashtagsInput = document.getElementById('hashtags-input');
        
        if (!contentInput || !contentInput.value.trim()) {
            this.showToast('Please enter content to analyze', 'warning');
            contentInput?.focus();
            return;
        }
        
        try {
            // Show loading state
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<span class="spinner"></span> Analyzing...';
            
            // Prepare request data
            const requestData = {
                content: contentInput.value.trim(),
                metadata: {
                    platform: platformSelect?.value || 'unknown',
                    userId: userIdInput?.value || null,
                    hashtags: hashtagsInput?.value 
                        ? hashtagsInput.value.split(' ').filter(tag => tag.startsWith('#'))
                        : [],
                    timestamp: new Date().toISOString(),
                    networkData: await this.gatherNetworkData(userIdInput?.value)
                }
            };
            
            // Make API request with timeout
            const response = await this.makeRequest('/analyze', {
                method: 'POST',
                body: JSON.stringify(requestData),
                timeout: 30000
            });
            
            if (response.success) {
                this.displayAnalysisResults(response.analysis);
                this.analysisHistory.push(response.analysis);
                this.showToast('Content analyzed successfully', 'success');
                
                // Show alert for high-risk content
                if (response.analysis.riskLevel === 'HIGH') {
                    this.showAlert('High-risk anti-India campaign detected!', 'error');
                }
                
                // Update dashboard
                this.loadDashboardData();
            } else {
                throw new Error(response.error || 'Analysis failed');
            }
            
        } catch (error) {
            console.error('Analysis error:', error);
            this.showToast(`Analysis failed: ${error.message}`, 'error');
        } finally {
            // Reset button state
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<span class="button-icon">🔍</span> Analyze Content';
        }
    }
    
    /**
     * Display analysis results in the UI
     */
    displayAnalysisResults(analysis) {
        const resultsSection = document.getElementById('results-section');
        const analysisResults = document.getElementById('analysis-results');
        
        if (!resultsSection || !analysisResults) return;
        
        // Create results HTML
        const resultsHTML = this.generateResultsHTML(analysis);
        analysisResults.innerHTML = resultsHTML;
        
        // Show results section with animation
        resultsSection.classList.remove('hidden');
        setTimeout(() => {
            resultsSection.classList.add('show');
        }, 100);
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    /**
     * Generate HTML for analysis results
     */
    generateResultsHTML(analysis) {
        const riskColor = this.getRiskColor(analysis.riskLevel);
        const riskIcon = this.getRiskIcon(analysis.riskLevel);
        
        return `
            <div class="result-card">
                <div class="result-header">
                    <div class="risk-assessment">
                        <div class="risk-badge ${analysis.riskLevel.toLowerCase()}">
                            ${riskIcon} ${analysis.riskLevel} RISK
                        </div>
                        <div class="risk-score">${analysis.riskScore}/100</div>
                    </div>
                    <div class="analysis-timestamp">
                        ${this.formatTimestamp(analysis.timestamp)}
                    </div>
                </div>
                
                <div class="content-preview">
                    "${this.truncateText(analysis.content, 200)}"
                </div>
                
                ${analysis.flags.length > 0 ? `
                    <div class="flags-section">
                        <h5>Security Flags Detected:</h5>
                        <div class="flags-list">
                            ${analysis.flags.map(flag => `
                                <span class="flag-item">${this.formatFlagName(flag)}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="sentiment-analysis">
                    <h5>Sentiment Analysis:</h5>
                    <div class="sentiment-metrics">
                        <div class="sentiment-score">
                            Score: <strong>${analysis.sentiment.score}</strong>
                        </div>
                        <div class="sentiment-comparative">
                            Comparative: <strong>${analysis.sentiment.comparative.toFixed(3)}</strong>
                        </div>
                    </div>
                    <div class="sentiment-words">
                        ${analysis.sentiment.positive.length > 0 ? `
                            <div class="positive-words">
                                Positive: ${analysis.sentiment.positive.join(', ')}
                            </div>
                        ` : ''}
                        ${analysis.sentiment.negative.length > 0 ? `
                            <div class="negative-words">
                                Negative: ${analysis.sentiment.negative.join(', ')}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                ${Object.keys(analysis.networkAnalysis).length > 0 ? `
                    <div class="network-analysis-section">
                        <h5>Network Analysis:</h5>
                        <div class="network-indicators">
                            ${analysis.networkAnalysis.indicators ? 
                                analysis.networkAnalysis.indicators.map(indicator => `
                                    <span class="network-indicator">${this.formatIndicatorName(indicator)}</span>
                                `).join('') : ''
                            }
                        </div>
                        <div class="network-score">
                            Network Risk: <strong>${analysis.networkAnalysis.score || 0}/100</strong>
                        </div>
                    </div>
                ` : ''}
                
                <div class="explanation-section">
                    <h5>Detection Explanation:</h5>
                    <ul class="explanation-list">
                        ${analysis.explanation.map(explanation => `
                            <li>${explanation}</li>
                        `).join('')}
                    </ul>
                </div>
                
                <div class="platform-info">
                    <strong>Platform:</strong> ${analysis.platform.toUpperCase()}
                </div>
            </div>
        `;
    }
    
    /**
     * Load dashboard data from API
     */
    async loadDashboardData() {
        try {
            const timeframe = document.getElementById('timeframe-select')?.value || '24h';
            const platform = document.getElementById('platform-filter')?.value || 'all';
            
            const response = await this.makeRequest(`/dashboard?timeframe=${timeframe}&platform=${platform}`);
            
            if (response.success) {
                this.updateDashboardMetrics(response.dashboard);
                this.updateRecentDetections(response.dashboard.recentAnalyses);
                this.updatePlatformStats(response.dashboard.platformStats);
            }
            
            // Load network analysis
            const networkResponse = await this.makeRequest('/network-analysis');
            if (networkResponse.success) {
                this.updateNetworkAnalysis(networkResponse.suspiciousNetworks);
            }
            
        } catch (error) {
            console.error('Dashboard loading error:', error);
            this.showToast('Failed to load dashboard data', 'error');
        }
    }
    
    /**
     * Update dashboard metrics
     */
    updateDashboardMetrics(dashboard) {
        const { summary } = dashboard;
        
        // Update metric values
        this.updateElement('total-analyses', summary.totalAnalyses.toLocaleString());
        this.updateElement('high-risk-count', summary.highRiskCount.toLocaleString());
        this.updateElement('medium-risk-count', summary.mediumRiskCount.toLocaleString());
        this.updateElement('low-risk-count', summary.lowRiskCount.toLocaleString());
        
        // Update percentage changes (simulated for demo)
        this.updateElement('high-risk-change', `${summary.riskDistribution.high}% of total`);
        this.updateElement('medium-risk-change', `${summary.riskDistribution.medium}% of total`);
        this.updateElement('low-risk-change', `${summary.riskDistribution.low}% of total`);
    }
    
    /**
     * Update recent detections list
     */
    updateRecentDetections(detections) {
        const container = document.getElementById('recent-detections');
        if (!container) return;
        
        if (detections.length === 0) {
            container.innerHTML = '<div class="loading-placeholder">No recent detections</div>';
            return;
        }
        
        const detectionsHTML = detections.map(detection => `
            <div class="detection-item">
                <div class="detection-content">
                    <div class="detection-text">
                        ${this.truncateText(detection.content, 100)}
                    </div>
                    <div class="detection-meta">
                        ${detection.platform.toUpperCase()} • 
                        ${this.formatTimestamp(detection.timestamp)} • 
                        Risk: ${detection.riskLevel}
                    </div>
                </div>
                <div class="risk-badge ${detection.riskLevel.toLowerCase()}">
                    ${detection.riskScore}
                </div>
            </div>
        `).join('');
        
        container.innerHTML = detectionsHTML;
    }
    
    /**
     * Update platform statistics
     */
    updatePlatformStats(platformStats) {
        const container = document.getElementById('platform-stats');
        if (!container) return;
        
        if (platformStats.length === 0) {
            container.innerHTML = '<div class="loading-placeholder">No platform data available</div>';
            return;
        }
        
        const statsHTML = platformStats.map(stat => `
            <div class="platform-stat">
                <div class="platform-name">
                    ${this.formatPlatformName(stat._id)}
                </div>
                <div class="platform-metrics">
                    <span class="platform-count">${stat.count}</span>
                    <span class="platform-risk">
                        Avg Risk: ${stat.avgRisk ? stat.avgRisk.toFixed(1) : '0'}
                    </span>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = statsHTML;
    }
    
    /**
     * Update network analysis section
     */
    updateNetworkAnalysis(suspiciousNetworks) {
        const container = document.getElementById('suspicious-networks');
        if (!container) return;
        
        if (suspiciousNetworks.length === 0) {
            container.innerHTML = '<div class="loading-placeholder">No suspicious networks detected</div>';
            return;
        }
        
        const networksHTML = suspiciousNetworks.slice(0, 5).map((network, index) => `
            <div class="network-item">
                <div class="network-header">
                    <strong>User: ${network._id || 'Unknown'}</strong>
                    <span class="network-risk">Risk: ${network.totalRisk}</span>
                </div>
                <div class="network-details">
                    Posts: ${network.posts.length} | 
                    Indicators: ${network.indicators.flat().join(', ') || 'None'}
                </div>
            </div>
        `).join('');
        
        container.innerHTML = networksHTML;
    }
    
    /**
     * Setup real-time monitoring
     */
    setupRealTimeMonitoring() {
        // WebSocket connection for real-time updates
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected');
                this.updateSystemStatus('online');
            };
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleRealTimeUpdate(data);
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateSystemStatus('error');
            };
            
            this.websocket.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateSystemStatus('offline');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.setupRealTimeMonitoring(), 5000);
            };
            
        } catch (error) {
            console.error('WebSocket setup error:', error);
            // Fallback to polling
            this.setupPolling();
        }
    }
    
    /**
     * Setup polling for real-time updates (fallback)
     */
    setupPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        
        this.pollingInterval = setInterval(async () => {
            if (this.isRealTimeEnabled) {
                try {
                    await this.loadDashboardData();
                } catch (error) {
                    console.error('Polling error:', error);
                }
            }
        }, 30000); // Poll every 30 seconds
    }
    
    /**
     * Toggle real-time monitoring
     */
    toggleRealTimeMonitoring() {
        const button = document.getElementById('real-time-toggle');
        this.isRealTimeEnabled = !this.isRealTimeEnabled;
        
        if (this.isRealTimeEnabled) {
            button.innerHTML = '<span class="icon">📡</span> Real-time ON';
            button.style.background = 'var(--success-color)';
            this.showToast('Real-time monitoring enabled', 'info');
        } else {
            button.innerHTML = '<span class="icon">📡</span> Real-time OFF';
            button.style.background = 'rgba(255, 255, 255, 0.1)';
            this.showToast('Real-time monitoring disabled', 'info');
        }
    }
    
    /**
     * Handle real-time updates from WebSocket
     */
    handleRealTimeUpdate(data) {
        switch (data.type) {
            case 'new_detection':
                this.addNewDetection(data.detection);
                if (data.detection.riskLevel === 'HIGH') {
                    this.showAlert(`New high-risk detection: ${data.detection.platform}`, 'error');
                }
                break;
            
            case 'metrics_update':
                this.updateDashboardMetrics(data.metrics);
                break;
            
            case 'system_status':
                this.updateSystemStatus(data.status);
                break;
            
            default:
                console.log('Unknown real-time update type:', data.type);
        }
    }
    
    /**
     * File upload initialization
     */
    initializeFileUpload() {
        const uploadArea = document.getElementById('file-upload-area');
        const fileInput = document.getElementById('batch-file-input');
        
        if (!uploadArea || !fileInput) return;
        
        // Drag and drop functionality
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files);
            this.handleFileUpload(files);
        });
        
        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFileUpload(files);
        });
    }
    
    /**
     * Handle file upload for batch analysis
     */
    async handleFileUpload(files) {
        if (files.length === 0) return;
        
        try {
            const progressSection = document.getElementById('batch-progress');
            const progressFill = progressSection.querySelector('.progress-fill');
            const progressText = document.getElementById('progress-percentage');
            
            progressSection.classList.remove('hidden');
            
            let totalFiles = files.length;
            let processedFiles = 0;
            
            const results = [];
            
            for (const file of files) {
                if (file.size > 10 * 1024 * 1024) { // 10MB limit
                    this.showToast(`File ${file.name} is too large (max 10MB)`, 'warning');
                    continue;
                }
                
                try {
                    const fileContent = await this.readFile(file);
                    const parsedContent = this.parseFileContent(fileContent, file.type);
                    
                    for (const item of parsedContent) {
                        const response = await this.makeRequest('/analyze', {
                            method: 'POST',
                            body: JSON.stringify({
                                content: item.content,
                                metadata: {
                                    ...item.metadata,
                                    source: 'batch_upload',
                                    fileName: file.name
                                }
                            })
                        });
                        
                        if (response.success) {
                            results.push(response.analysis);
                        }
                    }
                    
                } catch (error) {
                    console.error(`Error processing file ${file.name}:`, error);
                    this.showToast(`Error processing ${file.name}`, 'error');
                }
                
                processedFiles++;
                const progress = (processedFiles / totalFiles) * 100;
                progressFill.style.width = `${progress}%`;
                progressText.textContent = `${Math.round(progress)}%`;
            }
            
            // Display batch results
            this.displayBatchResults(results);
            this.closeBatchModal();
            this.showToast(`Batch analysis complete: ${results.length} items processed`, 'success');
            
        } catch (error) {
            console.error('Batch upload error:', error);
            this.showToast('Batch analysis failed', 'error');
        }
    }
    
    /**
     * Parse file content based on type
     */
    parseFileContent(content, fileType) {
        try {
            if (fileType === 'application/json') {
                const data = JSON.parse(content);
                return Array.isArray(data) ? data : [data];
            } else if (fileType === 'text/csv') {
                return this.parseCSV(content);
            } else {
                // Treat as plain text, split by lines
                return content.split('\n')
                    .filter(line => line.trim().length > 0)
                    .map(line => ({ content: line.trim(), metadata: {} }));
            }
        } catch (error) {
            throw new Error(`Failed to parse file content: ${error.message}`);
        }
    }
    
    /**
     * Parse CSV content
     */
    parseCSV(csvContent) {
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const contentIndex = headers.findIndex(h => 
            h.toLowerCase().includes('content') || 
            h.toLowerCase().includes('text') || 
            h.toLowerCase().includes('message')
        );
        
        if (contentIndex === -1) {
            throw new Error('CSV file must have a content/text/message column');
        }
        
        return lines.slice(1)
            .filter(line => line.trim().length > 0)
            .map(line => {
                const values = line.split(',');
                const metadata = {};
                
                headers.forEach((header, index) => {
                    if (index !== contentIndex && values[index]) {
                        metadata[header.toLowerCase()] = values[index].trim();
                    }
                });
                
                return {
                    content: values[contentIndex] ? values[contentIndex].trim() : '',
                    metadata
                };
            })
            .filter(item => item.content.length > 0);
    }
    
    /**
     * Utility functions
     */
    
    async makeRequest(endpoint, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 10000
        };
        
        const config = { ...defaultOptions, ...options };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);
        
        try {
            const response = await fetch(`${this.apiUrl}${endpoint}`, {
                ...config,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            
            throw error;
        }
    }
    
        showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = this.getToastIcon(type);
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        container.appendChild(toast);
        
        // Show toast with animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }
    
    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
    
    showAlert(message, type = 'error') {
        const alertBanner = document.getElementById('alert-banner');
        const alertMessage = document.querySelector('.alert-message');
        
        if (!alertBanner || !alertMessage) return;
        
        alertMessage.textContent = message;
        alertBanner.classList.remove('hidden');
        
        // Auto-hide after 10 seconds for warnings, keep errors visible
        if (type !== 'error') {
            setTimeout(() => this.hideAlert(), 10000);
        }
    }
    
    hideAlert() {
        const alertBanner = document.getElementById('alert-banner');
        if (alertBanner) {
            alertBanner.classList.add('hidden');
        }
    }
    
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.remove('fade-out');
        }
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        }
    }
    
    updateSystemStatus(status) {
        const statusIndicator = document.getElementById('system-status');
        const statusDot = statusIndicator?.querySelector('.status-dot');
        const statusText = statusIndicator?.querySelector('span:last-child');
        
        if (!statusDot || !statusText) return;
        
        statusDot.className = `status-dot ${status}`;
        
        switch (status) {
            case 'online':
                statusText.textContent = 'System Online';
                break;
            case 'offline':
                statusText.textContent = 'System Offline';
                break;
            case 'error':
                statusText.textContent = 'System Error';
                break;
            default:
                statusText.textContent = 'System Status Unknown';
        }
    }
    
    clearForm() {
        const contentInput = document.getElementById('content-input');
        const platformSelect = document.getElementById('platform-select');
        const userIdInput = document.getElementById('user-id-input');
        const hashtagsInput = document.getElementById('hashtags-input');
        const charCount = document.getElementById('char-count');
        
        if (contentInput) contentInput.value = '';
        if (platformSelect) platformSelect.selectedIndex = 0;
        if (userIdInput) userIdInput.value = '';
        if (hashtagsInput) hashtagsInput.value = '';
        if (charCount) charCount.textContent = '0';
        
        // Hide results section
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
            resultsSection.classList.remove('show');
            setTimeout(() => resultsSection.classList.add('hidden'), 300);
        }
        
        this.showToast('Form cleared', 'info');
    }
    
    openBatchModal() {
        const modal = document.getElementById('batch-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
    }
    
    closeBatchModal() {
        const modal = document.getElementById('batch-modal');
        const progressSection = document.getElementById('batch-progress');
        const fileInput = document.getElementById('batch-file-input');
        
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = ''; // Restore scrolling
        }
        
        if (progressSection) {
            progressSection.classList.add('hidden');
        }
        
        if (fileInput) {
            fileInput.value = ''; // Clear file input
        }
    }
    
    async gatherNetworkData(userId) {
        if (!userId) return null;
        
        try {
            // Simulate network data gathering
            // In a real implementation, this would analyze posting patterns, connections, etc.
            return {
                simultaneousPosts: Math.floor(Math.random() * 20),
                sharedContent: {
                    suspiciousPercentage: Math.random()
                },
                accountAge: Math.floor(Math.random() * 365), // days
                followersCount: Math.floor(Math.random() * 10000),
                followingCount: Math.floor(Math.random() * 5000)
            };
        } catch (error) {
            console.error('Network data gathering error:', error);
            return null;
        }
    }
    
    async refreshRecentDetections() {
        const refreshBtn = document.getElementById('refresh-detections');
        if (refreshBtn) {
            refreshBtn.style.animation = 'spin 1s linear infinite';
        }
        
        try {
            await this.loadDashboardData();
            this.showToast('Recent detections refreshed', 'success');
        } catch (error) {
            this.showToast('Failed to refresh detections', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.style.animation = '';
            }
        }
    }
    
    exportResults() {
        if (this.analysisHistory.length === 0) {
            this.showToast('No results to export', 'warning');
            return;
        }
        
        try {
            const data = {
                exportDate: new Date().toISOString(),
                totalAnalyses: this.analysisHistory.length,
                results: this.analysisHistory
            };
            
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `anti-india-detection-results-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showToast('Results exported successfully', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Export failed', 'error');
        }
    }
    
    shareResults() {
        if (this.analysisHistory.length === 0) {
            this.showToast('No results to share', 'warning');
            return;
        }
        
        const latestResult = this.analysisHistory[this.analysisHistory.length - 1];
        const shareText = `Anti-India Campaign Detection Results:
Risk Level: ${latestResult.riskLevel}
Risk Score: ${latestResult.riskScore}/100
Platform: ${latestResult.platform}
Detected at: ${new Date(latestResult.timestamp).toLocaleString()}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Anti-India Campaign Detection Results',
                text: shareText,
                url: window.location.href
            }).then(() => {
                this.showToast('Results shared successfully', 'success');
            }).catch((error) => {
                console.error('Share error:', error);
                this.copyToClipboard(shareText);
            });
        } else {
            this.copyToClipboard(shareText);
        }
    }
    
    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('Results copied to clipboard', 'success');
            }).catch(() => {
                this.fallbackCopyToClipboard(text);
            });
        } else {
            this.fallbackCopyToClipboard(text);
        }
    }
    
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showToast('Results copied to clipboard', 'success');
        } catch (error) {
            console.error('Clipboard copy failed:', error);
            this.showToast('Failed to copy to clipboard', 'error');
        }
        
        document.body.removeChild(textArea);
    }
    
    displayBatchResults(results) {
        if (results.length === 0) return;
        
        const resultsSection = document.getElementById('results-section');
        const analysisResults = document.getElementById('analysis-results');
        
        if (!resultsSection || !analysisResults) return;
        
        // Generate batch results summary
        const highRisk = results.filter(r => r.riskLevel === 'HIGH').length;
        const mediumRisk = results.filter(r => r.riskLevel === 'MEDIUM').length;
        const lowRisk = results.filter(r => r.riskLevel === 'LOW').length;
        const minimal = results.filter(r => r.riskLevel === 'MINIMAL').length;
        
        const summaryHTML = `
            <div class="batch-results-summary">
                <h4>Batch Analysis Summary</h4>
                <div class="batch-metrics">
                    <div class="batch-metric high-risk">
                        <span class="metric-value">${highRisk}</span>
                        <span class="metric-label">High Risk</span>
                    </div>
                    <div class="batch-metric medium-risk">
                        <span class="metric-value">${mediumRisk}</span>
                        <span class="metric-label">Medium Risk</span>
                    </div>
                    <div class="batch-metric low-risk">
                        <span class="metric-value">${lowRisk}</span>
                        <span class="metric-label">Low Risk</span>
                    </div>
                    <div class="batch-metric minimal-risk">
                        <span class="metric-value">${minimal}</span>
                        <span class="metric-label">Minimal Risk</span>
                    </div>
                </div>
            </div>
        `;
        
        // Show top 5 highest risk results
        const topResults = results
            .sort((a, b) => b.riskScore - a.riskScore)
            .slice(0, 5);
        
        const resultsHTML = topResults.map(result => this.generateResultsHTML(result)).join('');
        
        analysisResults.innerHTML = summaryHTML + resultsHTML + `
            <div class="batch-footer">
                <p>Showing top 5 highest risk detections from ${results.length} analyzed items.</p>
            </div>
        `;
        
        // Show results section
        resultsSection.classList.remove('hidden');
        setTimeout(() => resultsSection.classList.add('show'), 100);
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    addNewDetection(detection) {
        // Add to recent detections at the top
        const container = document.getElementById('recent-detections');
        if (!container) return;
        
        const detectionHTML = `
            <div class="detection-item new-detection">
                <div class="detection-content">
                    <div class="detection-text">
                        ${this.truncateText(detection.content, 100)}
                    </div>
                    <div class="detection-meta">
                        ${detection.platform.toUpperCase()} • 
                        ${this.formatTimestamp(detection.timestamp)} • 
                        Risk: ${detection.riskLevel}
                    </div>
                </div>
                <div class="risk-badge ${detection.riskLevel.toLowerCase()}">
                    ${detection.riskScore}
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('afterbegin', detectionHTML);
        
        // Remove oldest if more than 10
        const items = container.querySelectorAll('.detection-item');
        if (items.length > 10) {
            items[items.length - 1].remove();
        }
        
        // Animate new detection
        const newItem = container.querySelector('.new-detection');
        if (newItem) {
            setTimeout(() => newItem.classList.remove('new-detection'), 3000);
        }
    }
    
    pauseRealTimeMonitoring() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({ action: 'pause_monitoring' }));
        }
    }
    
    resumeRealTimeMonitoring() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({ action: 'resume_monitoring' }));
        }
    }
    
    resizeCharts() {
        // Placeholder for chart resizing logic
        // Would be implemented if charts were added
        console.log('Resizing charts...');
    }
    
    initializeTooltips() {
        // Add tooltips to various elements
        const elementsWithTooltips = [
            { selector: '.risk-badge', text: 'Risk assessment based on AI analysis' },
            { selector: '.sentiment-score', text: 'Sentiment analysis score' },
            { selector: '.network-indicator', text: 'Network behavior pattern detected' },
            { selector: '.flag-item', text: 'Security flag triggered by content analysis' }
        ];
        
        elementsWithTooltips.forEach(item => {
            const elements = document.querySelectorAll(item.selector);
            elements.forEach(el => {
                el.title = item.text;
            });
        });
    }
    
    async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('File reading failed'));
            reader.readAsText(file);
        });
    }
    
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        return date.toLocaleDateString();
    }
    
    formatFlagName(flag) {
        return flag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    formatIndicatorName(indicator) {
        return indicator.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    formatPlatformName(platform) {
        const platformNames = {
            twitter: 'Twitter/X',
            facebook: 'Facebook',
            youtube: 'YouTube',
            telegram: 'Telegram',
            instagram: 'Instagram',
            reddit: 'Reddit',
            unknown: 'Unknown Platform'
        };
        return platformNames[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
    }
    
    getRiskColor(riskLevel) {
        const colors = {
            HIGH: '#e53e3e',
            MEDIUM: '#d69e2e',
            LOW: '#38a169',
            MINIMAL: '#718096'
        };
        return colors[riskLevel] || colors.MINIMAL;
    }
    
    getRiskIcon(riskLevel) {
        const icons = {
            HIGH: '🚨',
            MEDIUM: '⚠️',
            LOW: '⚡',
            MINIMAL: 'ℹ️'
        };
        return icons[riskLevel] || icons.MINIMAL;
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Cleanup method for proper resource management
    destroy() {
        // Clear intervals
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        
        // Close WebSocket connection
        if (this.websocket) {
            this.websocket.close();
        }
        
        // Clear any pending timeouts
        // (In a real implementation, you'd track these)
        
        console.log('Anti-India Campaign Detector destroyed');
    }
}

// Global functions for HTML event handlers
function hideAlert() {
    if (window.detector) {
        window.detector.hideAlert();
    }
}

function closeBatchModal() {
    if (window.detector) {
        window.detector.closeBatchModal();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.detector = new AntiIndiaCampaignDetector();
});

// Handle page unload for cleanup
window.addEventListener('beforeunload', () => {
    if (window.detector) {
        window.detector.destroy();
    }
});

// Service Worker registration for PWA capabilities
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.detector) {
        window.detector.showToast('An unexpected error occurred', 'error');
    }
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.detector) {
        window.detector.showToast('Application error detected', 'error');
    }
});

