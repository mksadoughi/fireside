export default function QuickstartGuide() {
    return (
        <>
            <h1>AI Chatbot Ready in 5 Minutes</h1>

            <p className="text-lg text-foreground/70">
                No Docker. No code. No configuration files. Just one install command and
                you&apos;ll have a private AI chatbot you can share with friends, family, or your team.
            </p>

            <div className="my-10 p-8 hidden md:block overflow-hidden">
                <svg viewBox="0 0 800 190" className="w-full max-w-3xl h-auto" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }} stroke="currentColor" fill="none">
                    {/* Step 1: Terminal */}
                    <g transform="translate(40, 20)">
                        <rect x="0" y="0" width="140" height="90" rx="8" strokeWidth="1.5" fill="var(--background)" />
                        <rect x="0" y="0" width="140" height="20" rx="8" fill="currentColor" fillOpacity="0.06" stroke="none" />
                        <circle cx="14" cy="10" r="3" fill="#ff5f57" stroke="none" />
                        <circle cx="26" cy="10" r="3" fill="#febc2e" stroke="none" />
                        <circle cx="38" cy="10" r="3" fill="#28c840" stroke="none" />
                        {/* Terminal text */}
                        <text x="12" y="42" fontSize="9" fontFamily="monospace" fill="currentColor" fillOpacity="0.5" stroke="none">$ curl ... | sh</text>
                        <text x="12" y="56" fontSize="9" fontFamily="monospace" fill="#28c840" stroke="none">✓ Installed</text>
                        <text x="12" y="70" fontSize="9" fontFamily="monospace" fill="currentColor" fillOpacity="0.4" stroke="none">$ fireside</text>
                        <text x="12" y="84" fontSize="9" fontFamily="monospace" fill="#ff6b00" stroke="none">🔥 Running</text>
                        <text x="70" y="120" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" stroke="none">1. Install</text>
                        <text x="70" y="136" textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.4" stroke="none">One command</text>
                    </g>

                    {/* Arrow 1→2 */}
                    <g transform="translate(195, 60)">
                        <path d="M 0 0 L 65 0" strokeWidth="1.5" stroke="var(--accent-blue)" strokeDasharray="4 4" markerEnd="url(#arrow-q)" />
                    </g>

                    {/* Step 2: Dashboard */}
                    <g transform="translate(280, 20)">
                        <rect x="0" y="0" width="140" height="90" rx="8" strokeWidth="1.5" fill="var(--background)" />
                        <rect x="5" y="5" width="130" height="80" rx="5" fill="currentColor" fillOpacity="0.03" stroke="none" />
                        {/* Model card mockup */}
                        <rect x="15" y="15" width="110" height="24" rx="6" fill="var(--accent-blue)" fillOpacity="0.1" stroke="none" />
                        <text x="70" y="31" textAnchor="middle" fontSize="10" fontWeight="500" fill="var(--accent-blue)" stroke="none">llama3.2 ↓</text>
                        {/* Toggle */}
                        <rect x="15" y="48" width="30" height="14" rx="7" fill="#28c840" stroke="none" />
                        <circle cx="37" cy="55" r="5" fill="white" stroke="none" />
                        <text x="52" y="59" fontSize="9" fill="currentColor" fillOpacity="0.5" stroke="none">Ready</text>
                        {/* Invite button */}
                        <rect x="15" y="68" width="110" height="12" rx="3" fill="#ff6b00" fillOpacity="0.15" stroke="none" />
                        <text x="70" y="77" textAnchor="middle" fontSize="8" fontWeight="500" fill="#ff6b00" stroke="none">+ Create Invite</text>
                        <text x="70" y="120" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" stroke="none">2. Set Up</text>
                        <text x="70" y="136" textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.4" stroke="none">Pick model, invite friends</text>
                    </g>

                    {/* Arrow 2→3 */}
                    <g transform="translate(435, 60)">
                        <path d="M 0 0 L 65 0" strokeWidth="1.5" stroke="var(--accent-blue)" strokeDasharray="4 4" markerEnd="url(#arrow-q)" />
                    </g>

                    {/* Step 3: Chat */}
                    <g transform="translate(520, 20)">
                        <rect x="0" y="0" width="140" height="90" rx="8" strokeWidth="1.5" fill="var(--background)" />
                        <rect x="5" y="5" width="130" height="80" rx="5" fill="currentColor" fillOpacity="0.03" stroke="none" />
                        {/* Chat bubbles */}
                        <rect x="12" y="14" width="60" height="18" rx="6" fill="var(--accent-orange)" fillOpacity="0.8" stroke="none" />
                        <text x="42" y="26" textAnchor="middle" fontSize="8" fill="white" stroke="none">Hey there!</text>
                        <rect x="40" y="38" width="90" height="28" rx="6" fill="#0090a8" stroke="none" />
                        <path d="M 50 47 L 110 47 M 50 55 L 90 55" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        {/* Input bar */}
                        <rect x="12" y="72" width="116" height="10" rx="5" fill="currentColor" fillOpacity="0.06" stroke="none" />
                        <text x="70" y="120" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" stroke="none">3. Chat!</text>
                        <text x="70" y="136" textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.4" stroke="none">Private &amp; encrypted</text>
                    </g>

                    {/* Multiple users icon next to step 3 */}
                    <g transform="translate(680, 35)">
                        <circle cx="15" cy="15" r="12" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="1" />
                        <circle cx="15" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1" />
                        <path d="M 7 22 Q 15 17 23 22" fill="none" stroke="currentColor" strokeWidth="1" />

                        <circle cx="35" cy="25" r="12" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="1" />
                        <circle cx="35" cy="22" r="4" fill="none" stroke="currentColor" strokeWidth="1" />
                        <path d="M 27 32 Q 35 27 43 32" fill="none" stroke="currentColor" strokeWidth="1" />

                        <circle cx="55" cy="15" r="12" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="1" />
                        <circle cx="55" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1" />
                        <path d="M 47 22 Q 55 17 63 22" fill="none" stroke="currentColor" strokeWidth="1" />
                        <text x="35" y="55" textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.4" stroke="none">Everyone</text>
                        <text x="35" y="67" textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.4" stroke="none">joins in</text>
                    </g>

                    <defs>
                        <marker id="arrow-q" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-blue)" stroke="none" />
                        </marker>
                    </defs>
                </svg>
            </div>

            <h2>What You&apos;ll Get</h2>

            <p>
                After 5 minutes, you&apos;ll have a fully working AI chatbot with:
            </p>
            <ul>
                <li><strong>Your own ChatGPT-like interface</strong> — clean, fast, and mobile-friendly</li>
                <li><strong>End-to-end encryption</strong> — every message is encrypted with a unique key per user</li>
                <li><strong>Share with anyone</strong> — invite friends via a single link; they sign up and start chatting instantly</li>
                <li><strong>100% private</strong> — everything runs on your hardware. No data leaves your machine</li>
                <li><strong>No subscriptions</strong> — no API fees, no monthly costs, no token limits</li>
            </ul>

            <hr className="my-10 border-foreground/10" />

            <h2>Step 1: Install Fireside</h2>

            <p>
                Open a terminal on the machine with the hardware (the one with a good GPU or enough RAM to run AI models).
                This works on <strong>macOS</strong> and <strong>Linux</strong>.
            </p>

            <pre><code>curl -fsSL https://fireside.run/install | sh</code></pre>

            <p>
                This installs everything you need — Fireside, Ollama (the AI engine), and a secure
                tunnel so people can connect from anywhere. When it finishes, you&apos;ll see:
            </p>

            <pre><code>{`  ╭──────────────────────────────╮
  │ █▀▀ █ █▀█ █▀▀ █▀▀ █ █▀▄ █▀▀ │
  │ █▀  █ █▀▄ ██▄ ▄▀█ █ █▄▀ ██▄ │
  ╰──────────────────────────────╯

  Setup       http://localhost:7654

  ✓ AI engine
  ✓ Tunnel

  Press Ctrl+C to stop`}</code></pre>

            <h2>Step 2: Set Up Your Server</h2>

            <p>
                Open the link in your browser. You&apos;ll land on a quick setup page where you:
            </p>

            <ol>
                <li><strong>Create your admin account</strong> — pick a username and password</li>
                <li><strong>Name your server</strong> — this appears in the chat interface (e.g. &quot;Home AI&quot;, &quot;Lab Server&quot;)</li>
            </ol>

            <p>
                Once that&apos;s done, you&apos;re in the dashboard. Head to the <strong>Models</strong> tab
                and download an AI model. For most machines, we recommend starting with a smaller model
                like <code>llama3.2:1b</code> — it&apos;s fast and capable. You can always add larger ones later.
            </p>

            <h2>Step 3: Invite Friends</h2>

            <p>
                Go to the <strong>Users</strong> tab and click <strong>Create Invite</strong>.
                Fireside generates a one-time invite link — send it to anyone you want to share AI with.
            </p>

            <p>
                When they open the link, they create their own account and land straight in the chat.
                Each user gets their own <strong>unique encryption key</strong> — even you as the server
                admin can&apos;t read their messages.
            </p>

            <h2>Step 4: Start Chatting</h2>

            <p>
                That&apos;s it. Open the <strong>Chat</strong> from the dashboard or go directly to
                your server URL. Pick a model from the dropdown, type a message, and you&apos;re talking to AI
                running entirely on your own hardware.
            </p>

            <p>
                Everyone you invited can do the same — from their phone, laptop, or tablet. All conversations
                are private, encrypted, and stored locally on your machine.
            </p>

            <hr className="my-10 border-foreground/10" />

            <h2>What&apos;s Next?</h2>

            <ul>
                <li><strong>Want a different chat interface?</strong> Connect <a href="/guides/open-webui">Open WebUI</a> to your Fireside server for additional features like image generation, RAG, and more.</li>
                <li><strong>Want to build apps?</strong> Use <a href="/guides/langchain">LangChain</a> or any OpenAI-compatible SDK to build AI agents and applications powered by your Fireside server.</li>
            </ul>
        </>
    );
}

