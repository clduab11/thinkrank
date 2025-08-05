// K6 Load Testing Script for Phase 4 - 10,000+ Concurrent Users
// This script validates system performance under extreme load conditions

import http from 'k6/http';
import ws from 'k6/ws';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics for ThinkRank specific monitoring
export const gameSessionDuration = new Trend('thinkrank_game_session_duration');
export const aiResponseTime = new Trend('thinkrank_ai_response_time');
export const websocketConnections = new Gauge('thinkrank_websocket_connections');
export const authenticationRate = new Rate('thinkrank_authentication_success');
export const gameCompletionRate = new Rate('thinkrank_game_completion_rate');
export const socialInteractionCounter = new Counter('thinkrank_social_interactions');
export const mobileClientLatency = new Trend('thinkrank_mobile_client_latency');

// Load test configuration
export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up to 10,000 users
    peak_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },    // Warm up
        { duration: '5m', target: 1000 },   // Initial ramp
        { duration: '10m', target: 5000 },  // Heavy load
        { duration: '15m', target: 10000 }, // Peak load
        { duration: '20m', target: 10000 }, // Sustained peak
        { duration: '10m', target: 5000 },  // Scale down
        { duration: '5m', target: 1000 },   // Cool down
        { duration: '2m', target: 0 },      // Complete
      ],
      gracefulRampDown: '30s',
    },
    
    // Scenario 2: Spike testing - sudden traffic surges
    spike_test: {
      executor: 'ramping-vus',
      startTime: '30m',
      startVUs: 1000,
      stages: [
        { duration: '30s', target: 1000 },
        { duration: '30s', target: 15000 }, // Sudden spike
        { duration: '2m', target: 15000 },  // Sustained spike
        { duration: '30s', target: 1000 },  // Drop back
      ],
    },
    
    // Scenario 3: WebSocket stress testing
    websocket_load: {
      executor: 'constant-vus',
      vus: 2000,
      duration: '45m',
      startTime: '10m',
    },
    
    // Scenario 4: Mobile client simulation
    mobile_clients: {
      executor: 'ramping-vus',
      startTime: '5m',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 500 },
        { duration: '30m', target: 2000 },
        { duration: '10m', target: 500 },
      ],
    },
    
    // Scenario 5: AI service intensive testing
    ai_intensive: {
      executor: 'constant-vus',
      vus: 500,
      duration: '40m',
      startTime: '15m',
    }
  },
  
  thresholds: {
    // Performance thresholds for SLO validation
    http_req_duration: [
      'p(95)<500',     // 95% of requests under 500ms
      'p(99)<1000',    // 99% of requests under 1s
      'avg<200'        // Average response time under 200ms
    ],
    http_req_failed: ['rate<0.01'],  // Less than 1% error rate
    
    // ThinkRank specific thresholds
    thinkrank_game_session_duration: ['p(95)<30000'],     // Game sessions under 30s
    thinkrank_ai_response_time: ['p(95)<2000'],          // AI responses under 2s
    thinkrank_authentication_success: ['rate>0.99'],      // 99%+ auth success
    thinkrank_game_completion_rate: ['rate>0.95'],       // 95%+ game completion
    thinkrank_mobile_client_latency: ['p(95)<800'],      // Mobile latency under 800ms
    
    // System resource thresholds
    checks: ['rate>0.95'],           // 95%+ of checks should pass
    websocket_connect_duration: ['p(95)<1000'], // WebSocket connection under 1s
  },
  
  // Global configuration
  userAgent: 'ThinkRank-K6-LoadTest/1.0',
  insecureSkipTLSVerify: false,
  noConnectionReuse: false,
  batch: 20,
  batchPerHost: 10,
};

// Base URLs - update these for your environment
const BASE_URL = __ENV.BASE_URL || 'https://api.thinkrank.com';
const WS_URL = __ENV.WS_URL || 'wss://api.thinkrank.com';
const APP_URL = __ENV.APP_URL || 'https://app.thinkrank.com';

// Test data generators
function generateUser() {
  return {
    username: `testuser_${randomString(8)}`,
    email: `test_${randomString(8)}@example.com`,
    password: 'TestPassword123!',
    deviceType: Math.random() > 0.5 ? 'mobile' : 'desktop',
    userAgent: Math.random() > 0.3 ? 'mobile-app' : 'web-browser'
  };
}

function generateGameData() {
  return {
    problemId: randomIntBetween(1, 1000),
    difficulty: ['easy', 'medium', 'hard'][randomIntBetween(0, 2)],
    category: ['bias-detection', 'context-evaluation', 'alignment'][randomIntBetween(0, 2)],
    sessionId: randomString(16),
    timeLimit: randomIntBetween(30, 300) // 30 seconds to 5 minutes
  };
}

// Authentication helper
function authenticate() {
  const user = generateUser();
  
  group('Authentication Flow', () => {
    // Register user
    let registerResponse = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      username: user.username,
      email: user.email,
      password: user.password
    }), {
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Type': user.deviceType,
        'User-Agent': user.userAgent
      }
    });
    
    check(registerResponse, {
      'registration successful': (r) => r.status === 201,
      'registration response time OK': (r) => r.timings.duration < 1000,
    });
    
    // Login user
    let loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password
    }), {
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Type': user.deviceType
      }
    });
    
    let loginSuccess = check(loginResponse, {
      'login successful': (r) => r.status === 200,
      'login response time OK': (r) => r.timings.duration < 500,
      'token received': (r) => r.json('token') !== undefined,
    });
    
    authenticationRate.add(loginSuccess);
    
    if (loginSuccess) {
      return {
        token: loginResponse.json('token'),
        userId: loginResponse.json('userId'),
        deviceType: user.deviceType
      };
    }
    return null;
  });
}

// Main test execution
export default function() {
  // Determine scenario behavior
  const scenarioName = __ENV.K6_SCENARIO_NAME || 'peak_load';
  
  if (scenarioName === 'websocket_load') {
    return websocketTest();
  } else if (scenarioName === 'mobile_clients') {
    return mobileClientTest();
  } else if (scenarioName === 'ai_intensive') {
    return aiIntensiveTest();
  } else {
    return standardTest();
  }
}

function standardTest() {
  // Authenticate user
  const auth = authenticate();
  if (!auth) return;
  
  const headers = {
    'Authorization': `Bearer ${auth.token}`,
    'Content-Type': 'application/json',
    'X-User-ID': auth.userId,
    'X-Device-Type': auth.deviceType
  };
  
  group('Game Session Flow', () => {
    const gameData = generateGameData();
    const sessionStart = Date.now();
    
    // Start game session
    let startResponse = http.post(`${BASE_URL}/api/game/start`, JSON.stringify(gameData), { headers });
    
    check(startResponse, {
      'game start successful': (r) => r.status === 200,
      'game start response time OK': (r) => r.timings.duration < 1000,
      'session ID received': (r) => r.json('sessionId') !== undefined,
    });
    
    if (startResponse.status === 200) {
      const sessionId = startResponse.json('sessionId');
      
      // Simulate gameplay
      for (let i = 0; i < randomIntBetween(3, 10); i++) {
        sleep(randomIntBetween(2, 8)); // Think time
        
        // Submit game action
        let actionResponse = http.post(`${BASE_URL}/api/game/${sessionId}/action`, JSON.stringify({
          action: 'answer',
          response: randomIntBetween(1, 4),
          timestamp: Date.now()
        }), { headers });
        
        check(actionResponse, {
          'game action successful': (r) => r.status === 200,
          'action response time OK': (r) => r.timings.duration < 300,
        });
        
        // Random AI assistance request (30% probability)
        if (Math.random() < 0.3) {
          const aiStart = Date.now();
          let aiResponse = http.post(`${BASE_URL}/api/ai/assist`, JSON.stringify({
            sessionId: sessionId,
            context: 'game_help',
            query: 'Can you help me understand this problem?'
          }), { headers });
          
          const aiDuration = Date.now() - aiStart;
          aiResponseTime.add(aiDuration);
          
          check(aiResponse, {
            'AI assistance successful': (r) => r.status === 200,
            'AI response time acceptable': (r) => r.timings.duration < 5000,
          });
        }
      }
      
      // End game session
      let endResponse = http.post(`${BASE_URL}/api/game/${sessionId}/end`, JSON.stringify({
        score: randomIntBetween(0, 100),
        completedAt: Date.now()
      }), { headers });
      
      let gameCompleted = check(endResponse, {
        'game end successful': (r) => r.status === 200,
        'final score received': (r) => r.json('finalScore') !== undefined,
      });
      
      gameCompletionRate.add(gameCompleted);
      
      const sessionDuration = Date.now() - sessionStart;
      gameSessionDuration.add(sessionDuration);
    }
  });
  
  group('Social Interactions', () => {
    // Get leaderboard
    let leaderboardResponse = http.get(`${BASE_URL}/api/social/leaderboard`, { headers });
    
    check(leaderboardResponse, {
      'leaderboard fetch successful': (r) => r.status === 200,
      'leaderboard response time OK': (r) => r.timings.duration < 500,
    });
    
    // Share achievement (20% probability)
    if (Math.random() < 0.2) {
      let shareResponse = http.post(`${BASE_URL}/api/social/share`, JSON.stringify({
        type: 'achievement',
        content: 'Just completed a challenging game!',
        platform: 'internal'
      }), { headers });
      
      check(shareResponse, {
        'share successful': (r) => r.status === 200,
      });
      
      socialInteractionCounter.add(1);
    }
  });
  
  sleep(randomIntBetween(1, 5)); // User think time
}

function websocketTest() {
  const auth = authenticate();
  if (!auth) return;
  
  const wsUrl = `${WS_URL}/ws?token=${auth.token}`;
  
  const response = ws.connect(wsUrl, {}, function (socket) {
    websocketConnections.add(1);
    
    socket.on('open', () => {
      console.log('WebSocket connection established');
      
      // Send periodic messages
      socket.setInterval(() => {
        socket.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now()
        }));
      }, 30000); // Every 30 seconds
      
      // Simulate real-time game updates
      socket.setInterval(() => {
        socket.send(JSON.stringify({
          type: 'game_update',
          sessionId: randomString(16),
          score: randomIntBetween(0, 100),
          timestamp: Date.now()
        }));
      }, 5000); // Every 5 seconds
    });
    
    socket.on('message', (data) => {
      const message = JSON.parse(data);
      check(message, {
        'valid WebSocket message': (msg) => msg.type !== undefined,
        'message has timestamp': (msg) => msg.timestamp !== undefined,
      });
    });
    
    socket.on('close', () => {
      websocketConnections.add(-1);
      console.log('WebSocket connection closed');
    });
    
    socket.on('error', (e) => {
      console.log('WebSocket error:', e.error());
    });
    
    // Keep connection alive for test duration
    socket.setTimeout(() => {
      socket.close();
    }, randomIntBetween(30000, 300000)); // 30 seconds to 5 minutes
  });
  
  check(response, {
    'WebSocket connection successful': (r) => r && r.status === 101,
  });
}

function mobileClientTest() {
  const auth = authenticate();
  if (!auth) return;
  
  const mobileHeaders = {
    'Authorization': `Bearer ${auth.token}`,
    'Content-Type': 'application/json',
    'X-Device-Type': 'mobile',
    'X-App-Version': '1.0.0',
    'X-Platform': Math.random() > 0.5 ? 'iOS' : 'Android',
    'User-Agent': 'ThinkRank-Mobile/1.0'
  };
  
  group('Mobile Client Simulation', () => {
    const start = Date.now();
    
    // Mobile-specific requests with higher latency tolerance
    let profileResponse = http.get(`${BASE_URL}/api/user/profile`, { headers: mobileHeaders });
    
    check(profileResponse, {
      'mobile profile fetch successful': (r) => r.status === 200,
      'mobile profile response time acceptable': (r) => r.timings.duration < 2000, // Higher threshold for mobile
    });
    
    // Sync offline data (simulate mobile app sync)
    let syncResponse = http.post(`${BASE_URL}/api/sync`, JSON.stringify({
      lastSync: Date.now() - 3600000, // 1 hour ago
      offlineActions: [
        { type: 'game_progress', data: { score: 85 } },
        { type: 'settings_change', data: { theme: 'dark' } }
      ]
    }), { headers: mobileHeaders });
    
    check(syncResponse, {
      'mobile sync successful': (r) => r.status === 200,
      'sync conflicts resolved': (r) => r.json('conflicts') === undefined || r.json('conflicts').length === 0,
    });
    
    const mobileDuration = Date.now() - start;
    mobileClientLatency.add(mobileDuration);
  });
  
  sleep(randomIntBetween(10, 30)); // Mobile users typically have longer think times
}

function aiIntensiveTest() {
  const auth = authenticate();
  if (!auth) return;
  
  const headers = {
    'Authorization': `Bearer ${auth.token}`,
    'Content-Type': 'application/json',
    'X-AI-Priority': Math.random() > 0.7 ? 'high' : 'medium'
  };
  
  group('AI Intensive Operations', () => {
    // Complex AI analysis request
    const aiStart = Date.now();
    let aiResponse = http.post(`${BASE_URL}/api/ai/analyze`, JSON.stringify({
      type: 'complex_analysis',
      data: {
        text: 'This is a complex research problem that requires deep AI analysis...',
        context: 'research_evaluation',
        requireExplanation: true,
        analysisDepth: 'detailed'
      }
    }), { 
      headers,
      timeout: '60s' // Longer timeout for AI operations
    });
    
    const aiDuration = Date.now() - aiStart;
    aiResponseTime.add(aiDuration);
    
    check(aiResponse, {
      'AI analysis successful': (r) => r.status === 200,
      'AI analysis complete': (r) => r.json('analysis') !== undefined,
      'AI explanation provided': (r) => r.json('explanation') !== undefined,
      'AI confidence score present': (r) => r.json('confidence') !== undefined,
    });
    
    // Follow-up AI refinement (30% probability)
    if (Math.random() < 0.3 && aiResponse.status === 200) {
      let refinementResponse = http.post(`${BASE_URL}/api/ai/refine`, JSON.stringify({
        originalAnalysisId: aiResponse.json('analysisId'),
        refinementRequest: 'Please provide more details on the bias detection aspect'
      }), { headers });
      
      check(refinementResponse, {
        'AI refinement successful': (r) => r.status === 200,
        'refinement builds on original': (r) => r.json('originalAnalysisId') !== undefined,
      });
    }
  });
  
  sleep(randomIntBetween(5, 15)); // Think time between AI requests
}

// Cleanup function
export function teardown(data) {
  console.log('Load test completed');
  console.log('Peak VUs reached:', options.scenarios.peak_load.stages[3].target);
  console.log('Total test duration:', '69 minutes');
}

// Test data validation
export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    'load-test-summary.html': generateHTMLReport(data),
    stdout: generateConsoleReport(data),
  };
}

function generateConsoleReport(data) {
  return `
  ==========================================
  ThinkRank Phase 4 Load Test Results
  ==========================================
  
  Test Duration: ${data.state.testRunDurationMs / 1000}s
  Peak VUs: ${Math.max(...Object.values(data.metrics.vus.values).map(v => v.value))}
  
  Performance Metrics:
  - Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
  - P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
  - P99 Response Time: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms
  - Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
  
  ThinkRank Specific Metrics:
  - Game Session Duration (P95): ${data.metrics.thinkrank_game_session_duration?.values['p(95)'] || 'N/A'}ms
  - AI Response Time (P95): ${data.metrics.thinkrank_ai_response_time?.values['p(95)'] || 'N/A'}ms
  - Authentication Success Rate: ${((data.metrics.thinkrank_authentication_success?.values.rate || 0) * 100).toFixed(2)}%
  - Game Completion Rate: ${((data.metrics.thinkrank_game_completion_rate?.values.rate || 0) * 100).toFixed(2)}%
  
  WebSocket Metrics:
  - Peak Concurrent Connections: ${Math.max(...Object.values(data.metrics.thinkrank_websocket_connections?.values || {}).map(v => v.value) || [0])}
  
  SLO Compliance:
  - Response Time SLO (P95 < 500ms): ${data.metrics.http_req_duration.values['p(95)'] < 500 ? '✅ PASS' : '❌ FAIL'}
  - Error Rate SLO (< 1%): ${data.metrics.http_req_failed.values.rate < 0.01 ? '✅ PASS' : '❌ FAIL'}
  - Authentication SLO (> 99%): ${(data.metrics.thinkrank_authentication_success?.values.rate || 0) > 0.99 ? '✅ PASS' : '❌ FAIL'}
  
  ==========================================
  `;
}

function generateHTMLReport(data) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>ThinkRank Phase 4 Load Test Results</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      .metric { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
      .pass { color: green; font-weight: bold; }
      .fail { color: red; font-weight: bold; }
      .warning { color: orange; font-weight: bold; }
    </style>
  </head>
  <body>
    <h1>ThinkRank Phase 4 Load Test Results</h1>
    <h2>Test Summary</h2>
    <div class="metric">
      <strong>Test Duration:</strong> ${data.state.testRunDurationMs / 1000}s<br>
      <strong>Peak VUs:</strong> ${Math.max(...Object.values(data.metrics.vus.values).map(v => v.value))}<br>
      <strong>Total Requests:</strong> ${data.metrics.http_reqs.values.count}<br>
      <strong>Request Rate:</strong> ${data.metrics.http_reqs.values.rate.toFixed(2)}/s
    </div>
    
    <h2>Performance Metrics</h2>
    <div class="metric">
      <strong>Average Response Time:</strong> ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms<br>
      <strong>P95 Response Time:</strong> ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms<br>
      <strong>P99 Response Time:</strong> ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms<br>
      <strong>Error Rate:</strong> ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
    </div>
    
    <h2>SLO Compliance</h2>
    <div class="metric">
      <div class="${data.metrics.http_req_duration.values['p(95)'] < 500 ? 'pass' : 'fail'}">
        Response Time SLO (P95 < 500ms): ${data.metrics.http_req_duration.values['p(95)'] < 500 ? 'PASS' : 'FAIL'}
      </div>
      <div class="${data.metrics.http_req_failed.values.rate < 0.01 ? 'pass' : 'fail'}">
        Error Rate SLO (< 1%): ${data.metrics.http_req_failed.values.rate < 0.01 ? 'PASS' : 'FAIL'}
      </div>
    </div>
    
    <h2>Detailed Metrics</h2>
    <pre>${JSON.stringify(data, null, 2)}</pre>
  </body>
  </html>
  `;
}