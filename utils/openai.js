export async function generateReplies(message, apiKey) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [{ role: "user", content: `Reply to this WhatsApp message in 3 different ways: "${message}"` }],
            max_tokens: 150
        })
    });

    const data = await response.json();
    return data.choices[0].message.content.split("\\n").filter(r => r.trim());
}
