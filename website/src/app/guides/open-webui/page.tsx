export default function OpenWebuiGuide() {
    return (
        <>
            <h1>Create a Secure Chatbot on Separate Hardware</h1>

            <p>
                In this guide, we&apos;ll walk you through how to create your own secure chatbot
                using an AI model hosted on a separate machine—like a friend&apos;s computer or your
                own desktop—while keeping the chat interface securely accessible from
                your laptop or phone.
            </p>

            <div className="my-10 p-8 hidden md:block overflow-hidden">
                <svg viewBox="0 0 800 270" className="w-full max-w-3xl h-auto" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }} stroke="currentColor" fill="none">
                    <defs>
                        <marker id="arrow1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-blue)" stroke="none" />
                        </marker>
                    </defs>

                    {/* Client Machine */}
                    <g transform="translate(80, 30)">
                        {/* Sleek Monitor Stand */}
                        <path d="M 75 100 L 85 100 L 90 130 L 70 130 Z" fill="currentColor" fillOpacity="0.1" stroke="none" />
                        <rect x="50" y="130" width="60" height="3" rx="1.5" fill="currentColor" fillOpacity="0.5" stroke="none" />

                        {/* Sleek Monitor Screen */}
                        <rect x="0" y="0" width="160" height="100" rx="8" strokeWidth="1.5" stroke="currentColor" fill="var(--background)" />
                        <rect x="5" y="5" width="150" height="90" rx="5" fill="currentColor" fillOpacity="0.03" stroke="none" />

                        {/* "Open WebUI" label on screen */}
                        <text x="80" y="22" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" fillOpacity="0.7" stroke="none">Open WebUI</text>

                        {/* App UI on Screen - Chat bubbles */}
                        <g transform="translate(40, 28)">
                            {/* Chat Bubble 1 */}
                            <rect x="0" y="0" width="50" height="18" rx="6" fill="var(--accent-orange)" fillOpacity="0.8" stroke="none" />
                            <circle cx="14" cy="9" r="2" fill="white" stroke="none" />
                            <circle cx="24" cy="9" r="2" fill="white" stroke="none" />
                            <circle cx="34" cy="9" r="2" fill="white" stroke="none" />

                            {/* Chat Bubble 2 (Response) */}
                            <rect x="20" y="24" width="60" height="28" rx="6" fill="#0090a8" stroke="none" />
                            <path d="M 30 33 L 60 33 M 30 41 L 50 41" stroke="white" strokeWidth="1.5" strokeLinecap="round" />

                            {/* Bot face icon */}
                            <rect x="-8" y="30" width="16" height="16" rx="4" fill="currentColor" stroke="none" />
                            <circle cx="-3" cy="36" r="1.5" fill="var(--background)" stroke="none" />
                            <circle cx="3" cy="36" r="1.5" fill="var(--background)" stroke="none" />
                            <path d="M -2 41 L 2 41" stroke="var(--background)" strokeWidth="1" strokeLinecap="round" />
                        </g>

                        {/* Labels */}
                        <text x="80" y="155" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor" stroke="none">You (Client)</text>
                        <text x="80" y="172" textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.5" stroke="none">Chat with Open WebUI</text>
                    </g>

                    {/* Connection */}
                    <g transform="translate(255, 80)">
                        <path d="M 0 0 L 255 0" strokeWidth="1.5" stroke="var(--accent-blue)" strokeDasharray="4 4" markerEnd="url(#arrow1)" markerStart="url(#arrow1)" />
                        <rect x="82.5" y="-12" width="90" height="24" rx="12" fill="var(--background)" strokeWidth="1" stroke="var(--accent-blue)" strokeOpacity="0.2" />
                        <text x="127.5" y="4" textAnchor="middle" fontSize="12" fontWeight="500" fill="var(--accent-blue)" stroke="none">Secure Tunnel</text>
                        <text x="127.5" y="24" textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.4" stroke="none">over Internet</text>
                    </g>

                    {/* Host Machine */}
                    <g transform="translate(540, 30)">
                        {/* Sleek Monitor Stand */}
                        <path d="M 75 100 L 85 100 L 90 130 L 70 130 Z" fill="currentColor" fillOpacity="0.1" stroke="none" />
                        <rect x="50" y="130" width="60" height="3" rx="1.5" fill="currentColor" fillOpacity="0.5" stroke="none" />

                        {/* Sleek Monitor Screen */}
                        <rect x="0" y="0" width="160" height="100" rx="8" strokeWidth="1.5" stroke="currentColor" fill="var(--background)" />
                        <rect x="5" y="5" width="150" height="90" rx="5" fill="currentColor" fillOpacity="0.03" stroke="none" />

                        {/* Fireside logo + AI chip, side by side */}
                        <defs>
                            <linearGradient id="flame-grad-diag" x1="12" y1="2" x2="12" y2="18" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#ff6b00" />
                                <stop offset="1" stopColor="#ffb000" />
                            </linearGradient>
                        </defs>

                        {/* Fireside flame logo (real) — left side */}
                        <g transform="translate(30, 18) scale(2.2)">
                            {/* Outer flame */}
                            <path
                                d="M12 2C12 2 6 7.5 6 12C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12C18 7.5 12 2 12 2Z"
                                stroke="url(#flame-grad-diag)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                            {/* Inner flame core */}
                            <path
                                d="M12 9C12 9 9.5 11 9.5 13.5C9.5 14.8807 10.6193 16 12 16C13.3807 16 14.5 14.8807 14.5 13.5C14.5 11 12 9 12 9Z"
                                fill="#ff6b00"
                                stroke="none"
                            />
                        </g>
                        <text x="56" y="72" textAnchor="middle" fontSize="9" fontWeight="600" fill="#ff6b00" stroke="none">Fireside</text>

                        {/* AI chip icon — right side */}
                        <g transform="translate(90, 25)">
                            <rect x="0" y="0" width="40" height="40" rx="6" fill="var(--accent-blue)" fillOpacity="0.1" stroke="var(--accent-blue)" strokeWidth="1.5" />
                            <rect x="7" y="7" width="26" height="26" rx="5" fill="var(--accent-blue)" stroke="none" />
                            {/* Chip pins */}
                            <path d="M 8 0 L 8 -2 M 14 0 L 14 -2 M 20 0 L 20 -2 M 26 0 L 26 -2 M 32 0 L 32 -2" stroke="var(--accent-blue)" strokeWidth="1.5" />
                            <path d="M 8 40 L 8 42 M 14 40 L 14 42 M 20 40 L 20 42 M 26 40 L 26 42 M 32 40 L 32 42" stroke="var(--accent-blue)" strokeWidth="1.5" />
                            <text x="20" y="24" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white" stroke="none">AI</text>
                        </g>

                        {/* Labels */}
                        <text x="80" y="155" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor" stroke="none">Host (Stronger Hardware)</text>
                        <text x="80" y="172" textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.5" stroke="none">Hosting the core AI model</text>
                    </g>
                </svg>
            </div>

            <h2>How It Works</h2>

            <p>
                To make this possible, we need two tools running on two different machines (while they can be the same machine, the true value shines when they are separate):
            </p>

            <ol className="list-decimal space-y-4 mb-8">
                <li>
                    <strong>The Host Machine (Fireside Server):</strong> Runs the secure network connection and hosts the AI model.
                    It exposes an OpenAI-compatible API so external applications can talk to it seamlessly.
                </li>
                <li>
                    <strong>The Guest Machine (Open WebUI):</strong> Runs the modern chat interface (which looks and feels like ChatGPT)
                    on your device, and connects directly to the Host.
                </li>
            </ol>

            <h2>Part 1: The Host&apos;s Setup</h2>

            <p className="text-foreground/80">
                If someone else is hosting the model for you, send them this section! The person with the hardware needs to set up the server first. The host machine must be running macOS or Linux for now.
            </p>

            <h3>1. Install Fireside</h3>

            <p>
                The Host runs the quick install command to start the secure server on their machine:
            </p>

            <pre><code>curl -fsSL https://fireside.run/install | sh</code></pre>

            <p>
                Once it&apos;s running, they log into the server&apos;s dashboard using the secure tunnel URL provided in their terminal.
                During setup, they&apos;ll give their server a name and pick the AI models they want to host—these
                will be the brains behind your chatbot. Fireside recommends models based on the machine&apos;s capabilities,
                so they can start small and add more later.
            </p>

            <h3>2. Create an API Key</h3>

            <p>
                Next, the Host goes to the <strong>API</strong> tab in the Fireside dashboard and generates a new API key.
                This key is what allows your Open WebUI instance to securely connect to their server.
            </p>
            <p>
                They now need to securely message you two things:
            </p>
            <ul>
                <li>The <strong>API URL</strong> (e.g. <code>https://your-tunnel-url.trycloudflare.com/v1</code>)</li>
                <li>The new <strong>API Key</strong></li>
            </ul>

            <hr className="my-10 border-foreground/10" />

            <h2>Part 2: You (The User)</h2>

            <p>
                Now it&apos;s your turn. By pointing an Open WebUI instance at the Host&apos;s API URL (from Step 2), you&apos;ll be
                chatting with AI running directly on their hardware.
            </p>

            <h3>3. Install Open WebUI</h3>

            <p>
                Open WebUI runs as a Docker container, so you&apos;ll need <a href="https://docs.docker.com/get-started/get-docker/" target="_blank" rel="noreferrer">Docker installed</a> on
                your machine first. For full setup details and other installation methods, see the{' '}
                <a href="https://docs.openwebui.com/getting-started/" target="_blank" rel="noreferrer">Open WebUI documentation</a>.
            </p>

            <p>If you already have Open WebUI running:</p>

            <ol>
                <li>Go to <strong>Settings</strong> → <strong>Connections</strong>.</li>
                <li>Under <strong>OpenAI API</strong>, paste the <strong>API URL</strong> and <strong>API Key</strong> the Host gave you (from Step 2).</li>
                <li>Test the connection and save.</li>
            </ol>

            <p>If you&apos;re starting fresh, run this command to spin up Open WebUI with the Host&apos;s credentials pre-configured. This works on <strong>macOS</strong>, <strong>Linux</strong>, and <strong>Windows</strong> (via Docker Desktop):</p>

            <pre><code>{`docker run -d -p 3000:8080 \\
  -e OPENAI_API_BASE_URL=<API_URL_FROM_STEP_2> \\
  -e OPENAI_API_KEY=<API_KEY_FROM_STEP_2> \\
  --name open-webui \\
  ghcr.io/open-webui/open-webui:main`}</code></pre>

            <p>
                Open <code>http://localhost:3000</code> in your browser. It will be preconfigured to connect to the Host&apos;s Fireside server.
            </p>

            <h3>4. Start Chatting</h3>

            <p>
                In your Open WebUI model dropdown, you&apos;ll now see the AI models running on the Host&apos;s machine.
                Pick one and start a conversation. Inference runs entirely on their hardware — no cloud, no costs.
            </p>

            <h2>What&apos;s Next?</h2>

            <ul>
                <li><strong>Connect more devices:</strong> You can install Open WebUI on any other device you own—your tablet, another laptop, a home server—and point them all at the same Fireside Host. Everyone shares the same AI models without any extra setup on the Host&apos;s side.</li>
                <li><strong>Go beyond chat:</strong> Want to build AI agents or custom applications powered by the same model? Check out our <a href="/guides/langchain">LangChain guide</a> to connect your own code to the Host&apos;s Fireside server.</li>
            </ul>
        </>
    );
}
