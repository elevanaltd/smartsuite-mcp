import { KnowledgeLibrary } from '../../build/src/intelligent/knowledge-library.js';
import { SafetyEngine } from '../../build/src/intelligent/safety-engine.js';
import { SmartSuiteAPIProxy } from '../../build/src/intelligent/api-proxy.js';
import { createAuthenticatedClient } from '../../build/src/smartsuite-client.js';

async function test() {
  // Initialize components
  const knowledgeLibrary = new KnowledgeLibrary();
  await knowledgeLibrary.loadFromResearch('./src/knowledge');
  
  const safetyEngine = new SafetyEngine();
  
  // Test 1: Check knowledge loading
  console.log('Knowledge version:', knowledgeLibrary.getVersion());
  
  // Test 2: Test pattern matching
  const matches1 = knowledgeLibrary.findRelevantKnowledge('POST', '/applications/123/add_field/');
  console.log('Matches for add_field:', matches1);
  
  const matches2 = knowledgeLibrary.findRelevantKnowledge('POST', '/applications/123/records/list/');
  console.log('Matches for records/list:', matches2);
  
  // Test 3: Execute with API proxy
  try {
    const client = await createAuthenticatedClient({
      apiKey: process.env.SMARTSUITE_API_KEY,
      workspaceId: process.env.SMARTSUITE_WORKSPACE_ID
    });
    
    const proxy = new SmartSuiteAPIProxy(client, knowledgeLibrary, safetyEngine);
    
    const result = await proxy.executeOperation({
      endpoint: '/applications/6613bedd1889d8deeaef8b0e/records/list/',
      method: 'POST',
      operation_description: 'List records',
      mode: 'execute',
      payload: { limit: 1 }
    });
    
    console.log('API Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('API Error:', error);
  }
}

test().catch(console.error);
