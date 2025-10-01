import dotenv from 'dotenv';
dotenv.config();

import { createAuthenticatedClient } from '../../build/src/smartsuite-client.js';

async function test() {
  console.log('Environment check:');
  console.log('- API Key exists:', !!process.env.SMARTSUITE_API_KEY);
  console.log('- Workspace ID:', process.env.SMARTSUITE_WORKSPACE_ID);
  
  try {
    const client = await createAuthenticatedClient({
      apiKey: process.env.SMARTSUITE_API_KEY,
      workspaceId: process.env.SMARTSUITE_WORKSPACE_ID
    });
    console.log('✅ Authentication successful!');
    
    const result = await client.listRecords('6613bedd1889d8deeaef8b0e', { limit: 2 });
    console.log('✅ API call successful! Items:', result.items.length);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
