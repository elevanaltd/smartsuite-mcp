import { KnowledgeLibrary } from '../../build/src/intelligent/knowledge-library.js';
import { SafetyEngine } from '../../build/src/intelligent/safety-engine.js';
import { SmartSuiteAPIProxy } from '../../build/src/intelligent/api-proxy.js';
import { createAuthenticatedClient } from '../../build/src/smartsuite-client.js';

async function testAPIExecution() {
  console.log('Testing SmartSuite API Shim Intelligent Tool...\n');
  
  // Initialize components
  const knowledgeLibrary = new KnowledgeLibrary();
  await knowledgeLibrary.loadFromResearch('./src/knowledge');
  
  const safetyEngine = new SafetyEngine();
  
  // Check knowledge loading
  const version = knowledgeLibrary.getVersion();
  console.log('✅ Knowledge loaded:', JSON.stringify(version));
  
  // Test pattern matching
  const matches1 = knowledgeLibrary.findRelevantKnowledge('POST', '/applications/123/add_field/');
  console.log('✅ Matches for add_field:', matches1.length);
  
  const matches2 = knowledgeLibrary.findRelevantKnowledge('POST', '/applications/123/records/list/');
  console.log('✅ Matches for records/list:', matches2.length);
  
  // Test API execution
  try {
    console.log('\nAttempting API execution...');
    const client = await createAuthenticatedClient({
      apiKey: process.env.SMARTSUITE_API_KEY,
      workspaceId: process.env.SMARTSUITE_WORKSPACE_ID
    });
    
    const proxy = new SmartSuiteAPIProxy(client, knowledgeLibrary, safetyEngine);
    
    // Test with a simple list operation
    const result = await proxy.executeOperation({
      endpoint: '/applications/6613bedd1889d8deeaef8b0e/records/list/',
      method: 'POST',
      operation_description: 'List records from Planning table',
      mode: 'execute',
      payload: { limit: 2 }
    });
    
    if (result.success) {
      console.log('✅ API execution successful!');
      console.log('Response type:', typeof result.result);
      console.log('Has items?:', result.result && 'items' in result.result);
      if (result.result && result.result.items) {
        console.log('Record count:', result.result.items.length);
      }
    } else {
      console.log('❌ API execution failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error during API test:', error.message);
  }
}

testAPIExecution().catch(console.error);
