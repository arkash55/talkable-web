'use client';

import { generateResponse } from '@/app/actions/generateResponseTest';
import { useState } from 'react';


export default function WatsonTestPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    const result = await generateResponse(input);
    setOutput(result);
    setLoading(false);
  };

  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <h1>Watsonx Secure Server Test</h1>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type your message..."
        style={{ width: '100%', height: 100, fontSize: 16 }}
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{ marginTop: 12, padding: '8px 16px', fontSize: 16 }}
      >
        {loading ? 'Generating...' : 'Submit'}
      </button>
      <div style={{ marginTop: 24 }}>
        <h3>Response:</h3>
        <p>{output}</p>
      </div>
    </div>
  );
}
