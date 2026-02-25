export default function GettingStarted() {
    return (
        <>
            <h1>Getting Started</h1>

            <p>
                This page covers everything from installing Fireside to inviting your first user and using the API.
                The whole process takes about 5 minutes.
            </p>

            {/* ---- Install ---- */}
            <h2>Install</h2>

            <p>Fireside runs on macOS and Linux. Open a terminal and run:</p>

            <pre><code>curl -fsSL https://fireside.run/install | sh</code></pre>

            <p>
                This downloads the Fireside binary along with Ollama (the AI engine) and cloudflared (the secure tunnel).
                Everything is automatic — no manual configuration.
            </p>

            <p>
                When it finishes, start your server with <code>fireside</code> and open <code>http://localhost:7654</code> in your browser to begin setup.
            </p>

            {/* ---- Setup ---- */}
            <h2>Setup</h2>

            <p>The setup wizard has two quick steps:</p>

            <ol>
                <li><strong>Name your server</strong> — pick a name like &quot;Kazem&apos;s AI&quot;. This is what
                    your Clients will see when they log in.</li>
                <li><strong>Create your admin account</strong> — choose a username and password. This is your Host
                    account.</li>
            </ol>

            <p>
                A secure public URL is created automatically when Fireside starts — you&apos;ll see it in the terminal
                and in the dashboard. You can claim a permanent <code>name.fireside.run</code> address in
                the Settings tab so your URL never changes between restarts.
            </p>

            <p>
                After setup, you land on the admin dashboard. Head to the <strong>Models</strong> tab to
                download an AI model — we recommend starting with a smaller model
                like <code>llama3.2:1b</code> to verify everything works. You can always add larger ones later.
            </p>

            {/* ---- Sharing Access ---- */}
            <h2>Invite People</h2>

            <p>
                To give someone access, go to the <strong>Users</strong> tab and create an invite link.
                You can configure how many times each invite can be used. This prevents unauthorized signups.
            </p>

            <p>Here&apos;s what happens on the Client&apos;s side:</p>

            <ol>
                <li>You send them the invite link (text, email, in person — whatever works).</li>
                <li>They click it. A page opens asking them to pick a username and password.</li>
                <li>They create their account and land directly in the chat interface.</li>
                <li>The invite link stops working — it can&apos;t be reused by anyone else.</li>
            </ol>

            <p>
                From that point on, the Client just goes to your server URL and logs in. Their conversations sync
                across devices because chat history is stored on your server, not in their browser.
            </p>

            <p>
                The invite link also contains an encryption key in the URL fragment (the part after <code>#</code>).
                Browsers never send URL fragments to the server or network, so the key stays between you and the
                Client. This is how end-to-end encryption is established without any manual key exchange.
            </p>

            {/* ---- API ---- */}
            <h2>API</h2>

            <p>
                Fireside exposes an OpenAI-compatible API. If you or someone in your group is a developer, you can
                use the same tools and libraries you&apos;d use with OpenAI — just point them at your Fireside server instead.
            </p>

            <h3>Create an API key</h3>

            <p>
                Go to the <strong>API</strong> tab in the admin dashboard and create a new key. Copy it —
                you&apos;ll need it for authentication.
            </p>

            <h3>Make a request</h3>

            <p>Replace the URL and key with your own:</p>

            <pre><code>{`curl https://your-server-url/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "qwen3:8b",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`}</code></pre>

            <h3>Use with Python</h3>

            <p>The standard OpenAI Python library works out of the box:</p>

            <pre><code>{`from openai import OpenAI

client = OpenAI(
    base_url="https://your-server-url/v1",
    api_key="YOUR_API_KEY"
)

response = client.chat.completions.create(
    model="qwen3:8b",
    messages=[{"role": "user", "content": "Hello"}]
)

print(response.choices[0].message.content)`}</code></pre>

            <h3>Endpoints</h3>

            <table>
                <thead>
                    <tr>
                        <th>Endpoint</th>
                        <th>Method</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code>/v1/chat/completions</code></td>
                        <td>POST</td>
                        <td>Send messages, get a response. Supports streaming.</td>
                    </tr>
                    <tr>
                        <td><code>/v1/models</code></td>
                        <td>GET</td>
                        <td>List available models on the server.</td>
                    </tr>
                </tbody>
            </table>

            <p>
                Because the API follows the OpenAI format, it works with tools like
                Cursor, LangChain, Open WebUI, and any other OpenAI-compatible client.
                See the <a href="/guides/open-webui">Open WebUI guide</a> and <a href="/guides/langchain">LangChain guide</a> for
                step-by-step tutorials.
            </p>
        </>
    );
}
