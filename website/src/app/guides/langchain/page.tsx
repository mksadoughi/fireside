export default function LangchainGuide() {
    return (
        <>
            <h1>Use LangChain with a Remote AI Model</h1>

            <p>
                If you&apos;re building an AI app with <a href="https://www.langchain.com/" target="_blank" rel="noreferrer">LangChain</a>
                and want to power it using an AI model hosted on a separate machine (like a powerful desktop),
                you&apos;re in the right place.
            </p>

            <p>
                In this guide, we&apos;ll walk you through how to point your LangChain app to a secure, remote AI model
                running on private hardware, bypassing clunky networking setup and cloud API costs.
            </p>

            <div className="my-10 p-8 hidden md:block overflow-hidden">
                <svg viewBox="0 0 800 270" className="w-full max-w-3xl h-auto" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }} stroke="currentColor" fill="none">
                    <defs>
                        <marker id="arrow-lc" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-blue)" stroke="none" />
                        </marker>
                        <linearGradient id="lc-grad" x1="0" y1="0" x2="1" y2="1">
                            <stop stopColor="#1a8870" />
                            <stop offset="1" stopColor="#2dd4a8" />
                        </linearGradient>
                        <linearGradient id="flame-grad-lc" x1="12" y1="2" x2="12" y2="18" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#ff6b00" />
                            <stop offset="1" stopColor="#ffb000" />
                        </linearGradient>
                    </defs>

                    {/* Client Machine */}
                    <g transform="translate(80, 30)">
                        {/* Sleek Monitor Stand */}
                        <path d="M 75 100 L 85 100 L 90 130 L 70 130 Z" fill="currentColor" fillOpacity="0.1" stroke="none" />
                        <rect x="50" y="130" width="60" height="3" rx="1.5" fill="currentColor" fillOpacity="0.5" stroke="none" />

                        {/* Sleek Monitor Screen */}
                        <rect x="0" y="0" width="160" height="100" rx="8" strokeWidth="1.5" stroke="currentColor" fill="var(--background)" />
                        <rect x="5" y="5" width="150" height="90" rx="5" fill="currentColor" fillOpacity="0.03" stroke="none" />

                        {/* LangChain chain-link logo on screen */}
                        <g transform="translate(50, 15)">
                            {/* Two intertwined L shapes forming chain link */}
                            <g transform="scale(1.6)">
                                {/* First L shape */}
                                <path d="M 8 4 L 8 20 L 20 20" stroke="url(#lc-grad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                {/* Second L shape (inverted, intertwined) */}
                                <path d="M 28 28 L 28 12 L 16 12" stroke="url(#lc-grad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            </g>
                        </g>
                        <text x="80" y="80" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" fillOpacity="0.7" stroke="none">LangChain</text>

                        {/* Labels */}
                        <text x="80" y="155" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor" stroke="none">Your Application</text>
                        <text x="80" y="172" textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.5" stroke="none">Running LangChain</text>
                    </g>

                    {/* Connection */}
                    <g transform="translate(255, 80)">
                        <path d="M 0 0 L 255 0" strokeWidth="1.5" stroke="var(--accent-blue)" strokeDasharray="4 4" markerEnd="url(#arrow-lc)" markerStart="url(#arrow-lc)" />
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

                        {/* Fireside flame logo (real) — left side */}
                        <g transform="translate(30, 18) scale(2.2)">
                            {/* Outer flame */}
                            <path
                                d="M12 2C12 2 6 7.5 6 12C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12C18 7.5 12 2 12 2Z"
                                stroke="url(#flame-grad-lc)"
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
                    <strong>Your Machine (LangChain App):</strong> Runs your LangChain application code,
                    connecting to the Host&apos;s Fireside server as if it were any OpenAI-compatible API.
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
                will be the brains behind your application. Fireside recommends models based on the machine&apos;s capabilities,
                so they can start small and add more later.
            </p>

            <h3>2. Create an API Key</h3>

            <p>
                Next, the Host goes to the <strong>API</strong> tab in the Fireside dashboard and generates a new API key.
                This key is what allows your LangChain application to securely connect to their server.
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
                Now it&apos;s your turn. With the Host&apos;s API URL and Key (from Step 2), you can point your LangChain app
                at their hardware and start using AI models running on their machine.
            </p>

            <h3>3. Install LangChain</h3>

            <pre><code>pip install langchain langchain-openai</code></pre>

            <h3>4. Connect to Fireside</h3>

            <p>Replace the placeholders below with the <strong>API URL</strong> and <strong>API Key</strong> from Step 2:</p>

            <pre><code>{`from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="<API_URL_FROM_STEP_2>",
    api_key="<API_KEY_FROM_STEP_2>",
    model="qwen3:8b",
)

response = llm.invoke("Explain quantum computing simply.")
print(response.content)`}</code></pre>

            <p>
                That&apos;s it. Because Fireside uses a secure tunnel, you don&apos;t even need to be on the same WiFi network as the server.
                LangChain treats Fireside exactly like OpenAI, while the models actually run on private hardware.
            </p>

            <h2>Streaming</h2>

            <pre><code>{`for chunk in llm.stream("Write a short poem about the ocean."):
    print(chunk.content, end="", flush=True)`}</code></pre>

            <h2>Chains</h2>

            <pre><code>{`from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages([
    ("system", "You explain things simply."),
    ("human", "{question}"),
])

chain = prompt | llm
response = chain.invoke({"question": "What is a black hole?"})
print(response.content)`}</code></pre>

            <h2>What Works</h2>

            <ul>
                <li>Chat completions (streaming and non-streaming)</li>
                <li>Prompt templates and chains</li>
                <li>Output parsers</li>
                <li>Agents with tool calling (if the model supports it)</li>
            </ul>

            <p>
                Embeddings, fine-tuning, and assistants APIs are not currently supported.
            </p>

            <h2>What&apos;s Next?</h2>

            <ul>
                <li><strong>Add a chat interface:</strong> Want a visual chatbot powered by your Fireside server? Check out our <a href="/guides/open-webui">Open WebUI guide</a> to set up a full chat experience connected to the same Host.</li>
                <li><strong>Build agents:</strong> With LangChain&apos;s agent framework and Fireside as the model backend, you can build autonomous AI agents that use tools, browse the web, and reason through complex tasks—all running on private hardware.</li>
            </ul>
        </>
    );
}
