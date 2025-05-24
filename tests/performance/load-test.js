const autocannon = require('autocannon');
const chalk = require('chalk');

// Performance test configuration
const TEST_CONFIG = {
  url: process.env.TEST_URL || 'http://localhost:3005',
  connections: 100,
  duration: 30, // seconds
  pipelining: 1,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'ThinkRank-LoadTest/1.0'
  }
};

// Test scenarios
const scenarios = [
  {
    name: 'Health Check Load Test',
    path: '/health',
    method: 'GET',
    expectedLatency: 50, // ms
    expectedThroughput: 1000 // req/sec
  },
  {
    name: 'Analytics Event Tracking',
    path: '/api/analytics/events',
    method: 'POST',
    body: JSON.stringify({
      userId: 'test-user-id',
      eventType: 'load_test_event',
      eventData: { test: true },
      timestamp: new Date().toISOString()
    }),
    expectedLatency: 200,
    expectedThroughput: 500
  },
  {
    name: 'Dashboard Overview',
    path: '/api/dashboard/overview',
    method: 'GET',
    expectedLatency: 300,
    expectedThroughput: 100
  },
  {
    name: 'Metrics Collection',
    path: '/api/metrics/system',
    method: 'GET',
    expectedLatency: 100,
    expectedThroughput: 200
  }
];

async function runLoadTest(scenario) {
  console.log(chalk.blue(`\n🚀 Running load test: ${scenario.name}`));
  console.log(chalk.gray(`URL: ${TEST_CONFIG.url}${scenario.path}`));
  console.log(chalk.gray(`Duration: ${TEST_CONFIG.duration}s, Connections: ${TEST_CONFIG.connections}`));

  const config = {
    ...TEST_CONFIG,
    url: `${TEST_CONFIG.url}${scenario.path}`,
    method: scenario.method
  };

  if (scenario.body) {
    config.body = scenario.body;
  }

  try {
    const result = await autocannon(config);

    // Analyze results
    const avgLatency = result.latency.average;
    const throughput = result.requests.average;
    const errorRate = (result.errors / result.requests.total) * 100;

    console.log(chalk.green(`\n✅ Test completed: ${scenario.name}`));
    console.log(`📊 Results:`);
    console.log(`   Average Latency: ${avgLatency}ms (target: <${scenario.expectedLatency}ms)`);
    console.log(`   Throughput: ${throughput} req/sec (target: >${scenario.expectedThroughput} req/sec)`);
    console.log(`   Error Rate: ${errorRate.toFixed(2)}%`);
    console.log(`   Total Requests: ${result.requests.total}`);
    console.log(`   Total Errors: ${result.errors}`);

    // Check if performance targets are met
    const latencyPassed = avgLatency <= scenario.expectedLatency;
    const throughputPassed = throughput >= scenario.expectedThroughput;
    const errorRatePassed = errorRate < 1; // Less than 1% error rate

    if (latencyPassed && throughputPassed && errorRatePassed) {
      console.log(chalk.green(`✅ Performance targets met for ${scenario.name}`));
      return true;
    } else {
      console.log(chalk.red(`❌ Performance targets not met for ${scenario.name}`));
      if (!latencyPassed) console.log(chalk.red(`   - Latency too high: ${avgLatency}ms > ${scenario.expectedLatency}ms`));
      if (!throughputPassed) console.log(chalk.red(`   - Throughput too low: ${throughput} < ${scenario.expectedThroughput} req/sec`));
      if (!errorRatePassed) console.log(chalk.red(`   - Error rate too high: ${errorRate.toFixed(2)}%`));
      return false;
    }
  } catch (error) {
    console.log(chalk.red(`❌ Load test failed for ${scenario.name}: ${error.message}`));
    return false;
  }
}

async function runAllTests() {
  console.log(chalk.cyan('🎯 ThinkRank Performance Load Tests'));
  console.log(chalk.cyan('====================================='));

  const results = [];

  for (const scenario of scenarios) {
    const passed = await runLoadTest(scenario);
    results.push({ scenario: scenario.name, passed });

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log(chalk.cyan('\n📋 Test Summary'));
  console.log(chalk.cyan('================'));

  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;

  results.forEach(result => {
    const status = result.passed ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
    console.log(`${status} ${result.scenario}`);
  });

  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log(chalk.green('🎉 All performance tests passed!'));
    process.exit(0);
  } else {
    console.log(chalk.red('💥 Some performance tests failed!'));
    process.exit(1);
  }
}

// Add stress test function
async function runStressTest() {
  console.log(chalk.red('\n🔥 Running stress test...'));

  const stressConfig = {
    ...TEST_CONFIG,
    url: `${TEST_CONFIG.url}/api/analytics/events`,
    method: 'POST',
    body: JSON.stringify({
      userId: 'stress-test-user',
      eventType: 'stress_test',
      eventData: { stress: true }
    }),
    connections: 500, // Much higher load
    duration: 60, // Longer duration
    overallRate: 1000 // 1000 req/sec
  };

  try {
    const result = await autocannon(stressConfig);
    console.log(chalk.yellow('🔥 Stress test completed'));
    console.log(`   Max Latency: ${result.latency.max}ms`);
    console.log(`   Average Latency: ${result.latency.average}ms`);
    console.log(`   Throughput: ${result.requests.average} req/sec`);
    console.log(`   Error Rate: ${((result.errors / result.requests.total) * 100).toFixed(2)}%`);
  } catch (error) {
    console.log(chalk.red(`❌ Stress test failed: ${error.message}`));
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'stress':
    runStressTest();
    break;
  case 'load':
  default:
    runAllTests();
}
