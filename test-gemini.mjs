import fs from 'fs';
import path from 'path';

async function testGemini() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    const keyMatch = envContent.match(/^GEMINI_API_KEY=(.*)$/m);
    if (!keyMatch || !keyMatch[1].trim()) {
      console.log('Error: GEMINI_API_KEY not found or empty in .env');
      process.exit(1);
    }
    const apiKey = keyMatch[1].trim();

    const modelName = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    console.log(`Testing model: ${modelName}`);

    const payload = {
      contents: [{
        parts: [{ text: "Hello, just testing your connectivity!" }]
      }]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      console.log("Success! Received response:");
      console.log(data.candidates[0].content.parts[0].text);
    } else {
      const err = await res.json();
      console.error("API Error Response:", JSON.stringify(err, null, 2));
      process.exit(1);
    }

  } catch (error) {
    console.error("Script Error:", error.message);
    process.exit(1);
  }
}

testGemini();
