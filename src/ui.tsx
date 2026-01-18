import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'

const App = () => {
  const [loading, setLoading] = useState(false);

  const startPrediction = () => {
    setLoading(true);
    parent.postMessage({ pluginMessage: { type: 'fetch-layers' } }, '*');
  };

  window.onmessage = async (event) => {
    const { type, selection } = event.data.pluginMessage;
    console.log('UI received message:', type, selection);
    if (type === 'layers-data') {
      console.log('Sending to Gumloop with selection:', selection);
      try {
        const response = await fetch('https://api.gumloop.com/api/v1/start_pipeline?api_key=bd8469511c404c4bbca3a77c749c1c5f&user_id=KcdhWoDc8ieSvpUkssCbHIinaOj1&saved_item_id=sbTctfNvijqsLZMHmXXqpi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ figma_json: JSON.stringify(selection) })
        });
        console.log('Gumloop response status:', response.status);
        const data = await response.json();
        console.log('Gumloop full response:', data);
        
        // Try to find the output in the response
        let outputText = '';
        if (data.output) {
          outputText = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
        } else if (data.outputs) {
          outputText = data.outputs.output || '';
        }
        
        console.log('Output text:', outputText);
        
        // Parse the JSON array from the output
        let actions = [];
        try {
          // Remove any markdown code blocks if present
          let cleanOutput = outputText.replace(/```json\n?|\n?```/g, '').trim();
          actions = JSON.parse(cleanOutput);
        } catch (parseError) {
          console.error('Failed to parse output as JSON:', parseError);
          console.log('Raw output:', outputText);
        }
        
        console.log('Parsed actions:', actions);
        if (actions.length > 0) {
          parent.postMessage({ pluginMessage: { type: 'render-prediction', actions } }, '*');
        } else {
          console.warn('No actions to render');
        }
        setLoading(false);
      } catch (error) {
        console.error('Error:', error);
        setLoading(false);
      }
    }
  };

  return (
    <div className="container">
      <h2>AI Design Predictor</h2>
      <button onClick={startPrediction} disabled={loading}>
        {loading ? 'Thinking...' : 'Predict Next Element'}
      </button>
    </div>
  );
};

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const root = createRoot(document.getElementById('root')!);
    root.render(<App />);
  });
} else {
  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);
}