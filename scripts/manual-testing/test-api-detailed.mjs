import { createAuthenticatedClient } from '../../build/src/smartsuite-client.js';

async function testDirectAPI() {
  console.log('Testing direct SmartSuite API call...\n');
  
  try {
    const client = await createAuthenticatedClient({
      apiKey: process.env.SMARTSUITE_API_KEY,
      workspaceId: process.env.SMARTSUITE_WORKSPACE_ID
    });
    
    // Test 1: Direct client method
    console.log('Test 1: Using listRecords method...');
    const result1 = await client.listRecords('6613bedd1889d8deeaef8b0e', { limit: 2 });
    console.log('✅ listRecords succeeded! Items:', result1.items.length);
    
    // Test 2: Using request method (what API proxy uses)
    console.log('\nTest 2: Using request method...');
    const result2 = await client.request({
      method: 'POST',
      endpoint: '/applications/6613bedd1889d8deeaef8b0e/records/list/',
      data: { limit: 2 }
    });
    console.log('✅ request method succeeded! Items:', result2.items.length);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDirectAPI().catch(console.error);
