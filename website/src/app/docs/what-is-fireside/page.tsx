import { HowItWorksDiagram } from "../../../components/HowItWorksDiagram";

export default function WhatIsFireside() {
    return (
        <>
            <h1>What is Fireside</h1>

            <p>
                Fireside is a self-hosted AI platform. You install it on a computer you own, and it turns that machine
                into a private AI server — complete with a chat interface, user accounts, and a secure public URL.
            </p>

            <p>
                The people you share it with don&apos;t need to install anything. They open a link in their browser and
                start chatting. Their conversations are private, encrypted, and never leave your hardware.
            </p>

            <HowItWorksDiagram />

            <h2>Two Roles</h2>

            <p>
                Fireside connects two types of devices:
            </p>

            <ul>
                <li><strong>The Host</strong> — Your main computer. It runs the Fireside server, holds the AI models, and does all the heavy processing.</li>
                <li><strong>The Client</strong> — Any phone, tablet, or laptop. You or your friends use this to chat with the AI through a normal web browser. No technical setup is required.</li>
            </ul>

            <p className="mt-4 text-foreground/80 italic">
                Note: You can easily be both! Many people run the Host on their home desktop and use their phone as a Client to chat with their models while on the go.
            </p>

            {/* Two Roles Diagram */}
            <div className="my-10 hidden md:block overflow-hidden">
                <svg viewBox="0 0 800 270" className="w-full max-w-3xl h-auto" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }} stroke="currentColor" fill="none">
                    <defs>
                        <marker id="arrow-roles" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#00e5ff" stroke="none" />
                        </marker>
                        <linearGradient id="flame-grad-roles" x1="12" y1="2" x2="12" y2="18" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#ff6b00" />
                            <stop offset="1" stopColor="#ffb000" />
                        </linearGradient>
                    </defs>

                    {/* Client Device */}
                    <g transform="translate(80, 30)">
                        {/* Sleek Monitor Stand */}
                        <path d="M 75 100 L 85 100 L 90 130 L 70 130 Z" fill="currentColor" fillOpacity="0.1" stroke="none" />
                        <rect x="50" y="130" width="60" height="3" rx="1.5" fill="currentColor" fillOpacity="0.5" stroke="none" />

                        {/* Sleek Monitor Screen */}
                        <rect x="0" y="0" width="160" height="100" rx="8" strokeWidth="1.5" stroke="currentColor" fill="var(--background)" />
                        <rect x="5" y="5" width="150" height="90" rx="5" fill="currentColor" fillOpacity="0.03" stroke="none" />

                        {/* Chat UI on Screen */}
                        <g transform="translate(40, 18)">
                            <text x="40" y="8" textAnchor="middle" fontSize="9" fontWeight="600" fill="currentColor" fillOpacity="0.5" stroke="none">💬 Chat</text>
                            {/* Chat Bubble 1 */}
                            <rect x="0" y="14" width="50" height="18" rx="6" fill="var(--accent-orange)" fillOpacity="0.8" stroke="none" />
                            <circle cx="14" cy="23" r="2" fill="white" stroke="none" />
                            <circle cx="24" cy="23" r="2" fill="white" stroke="none" />
                            <circle cx="34" cy="23" r="2" fill="white" stroke="none" />
                            {/* Chat Bubble 2 */}
                            <rect x="20" y="38" width="60" height="28" rx="6" fill="#0090a8" stroke="none" />
                            <path d="M 30 47 L 60 47 M 30 55 L 50 55" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        </g>

                        {/* Labels */}
                        <text x="80" y="155" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor" stroke="none">Client (Any Device)</text>
                        <text x="80" y="172" textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.5" stroke="none">Browser — no install needed</text>
                    </g>

                    {/* Connection */}
                    <g transform="translate(255, 80)">
                        <path d="M 0 0 L 255 0" strokeWidth="2" stroke="#00e5ff" strokeOpacity="0.6" strokeDasharray="4 4" markerEnd="url(#arrow-roles)" markerStart="url(#arrow-roles)" />
                        <rect x="82.5" y="-12" width="90" height="24" rx="12" fill="var(--background)" strokeWidth="1" stroke="#00e5ff" strokeOpacity="0.3" />
                        <text x="127.5" y="4" textAnchor="middle" fontSize="12" fontWeight="500" fill="#00e5ff" stroke="none">Secure Tunnel</text>
                        <text x="127.5" y="24" textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.4" stroke="none">Encrypted</text>
                    </g>

                    {/* Host Machine */}
                    <g transform="translate(540, 30)">
                        {/* Sleek Monitor Stand */}
                        <path d="M 75 100 L 85 100 L 90 130 L 70 130 Z" fill="currentColor" fillOpacity="0.1" stroke="none" />
                        <rect x="50" y="130" width="60" height="3" rx="1.5" fill="currentColor" fillOpacity="0.5" stroke="none" />

                        {/* Sleek Monitor Screen */}
                        <rect x="0" y="0" width="160" height="100" rx="8" strokeWidth="1.5" stroke="currentColor" fill="var(--background)" />
                        <rect x="5" y="5" width="150" height="90" rx="5" fill="currentColor" fillOpacity="0.03" stroke="none" />

                        {/* Fireside flame logo — left side */}
                        <g transform="translate(30, 18) scale(2.2)">
                            <path
                                d="M12 2C12 2 6 7.5 6 12C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12C18 7.5 12 2 12 2Z"
                                stroke="url(#flame-grad-roles)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                            <path
                                d="M12 9C12 9 9.5 11 9.5 13.5C9.5 14.8807 10.6193 16 12 16C13.3807 16 14.5 14.8807 14.5 13.5C14.5 11 12 9 12 9Z"
                                fill="#ff6b00"
                                stroke="none"
                            />
                        </g>
                        <text x="56" y="72" textAnchor="middle" fontSize="9" fontWeight="600" fill="#ff6b00" stroke="none">Fireside</text>

                        {/* AI chip icon — right side */}
                        <g transform="translate(90, 25)">
                            <rect x="0" y="0" width="40" height="40" rx="6" fill="#00e5ff" fillOpacity="0.1" stroke="#00e5ff" strokeWidth="1.5" />
                            <rect x="7" y="7" width="26" height="26" rx="5" fill="#00e5ff" stroke="none" />
                            <path d="M 8 0 L 8 -2 M 14 0 L 14 -2 M 20 0 L 20 -2 M 26 0 L 26 -2 M 32 0 L 32 -2" stroke="#00e5ff" strokeWidth="1.5" />
                            <path d="M 8 40 L 8 42 M 14 40 L 14 42 M 20 40 L 20 42 M 26 40 L 26 42 M 32 40 L 32 42" stroke="#00e5ff" strokeWidth="1.5" />
                            <text x="20" y="24" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white" stroke="none">AI</text>
                        </g>

                        {/* Labels */}
                        <text x="80" y="155" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor" stroke="none">Host (Your Computer)</text>
                        <text x="80" y="172" textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.5" stroke="none">Runs Fireside + AI models</text>
                    </g>
                </svg>
            </div>

            <p>
                Think of it like a Plex server, but for AI instead of movies. Set it up once on a powerful machine, and access it from any device, anywhere.
            </p>

            <h2>How It Works</h2>

            <p>
                We turned a traditionally complex process into a single install command. It perfectly handles all the tedious parts for you:
            </p>

            <ol>
                <li><strong>AI Engine</strong> — Sets up the engine needed to efficiently run open-source models (like Llama and DeepSeek) locally on your hardware.</li>
                <li><strong>Chat App</strong> — Provides a beautiful, built-in web interface that feels just like ChatGPT.</li>
                <li><strong>Secure Access</strong> — Automatically creates an encrypted public web link. You can text your AI from a coffee shop without ever touching your router's confusing port-forwarding settings.</li>
            </ol>

            <p>
                Fireside runs entirely as a single application on your machine. No Docker, no messy containers, and no complex configuration files to edit.
            </p>

            <h2>Privacy</h2>

            <p>
                Privacy is core to how Fireside is built, not an add-on feature.
            </p>

            <ul>
                <li><strong>Your data stays on your machine.</strong> The AI models run locally. Your conversations are
                    stored in a local database on the Host&apos;s computer. Nothing is sent to OpenAI, Google, or any
                    third-party AI provider.</li>
                <li><strong>Messages are encrypted end-to-end.</strong> When a Client sends a message, it&apos;s encrypted
                    in their browser before it leaves their device. The encryption key is exchanged through the invite
                    link. Even the networking layer that carries the traffic cannot read the content.</li>
                <li><strong>Each user has their own encryption key.</strong> Every invite link generates a unique 256-bit
                    key. Users are cryptographically isolated from each other.</li>
            </ul>

            <p>
                The encryption uses the Web Crypto API (AES-256-GCM), which is built into every modern browser and
                hardware-accelerated. No extensions or special software needed.
            </p>

            <h2>Open Source</h2>

            <p>
                Fireside is fully open source under the <a href="https://github.com/mksadoughi/fireside/blob/main/LICENSE" target="_blank" rel="noreferrer">AGPL-3.0 license</a>.
                You can read every line of code, verify the encryption implementation, and build it yourself. There are
                no hidden services, no telemetry, and no locked features.
            </p>

            <h2>What Hardware Do I Need?</h2>

            <p>
                Fireside scales with the hardware you have. Because there are so many open-source models available
                in different sizes, you don&apos;t need a dedicated server or an expensive GPU to get started.
            </p>

            <p>
                There is a simple relation: the stronger your hardware, the smarter (and larger) the models you can run.
            </p>

            <ul>
                <li><strong>Everyday Computers (No dedicated GPU):</strong> You can still run smaller, highly-efficient models (like less than 1B parameter models or optimized 3B models). These are great for basic coding questions, summarization, and everyday chatting.</li>
                <li><strong>Mid-Range Computers (Like a gaming PC or standard Apple Silicon Mac):</strong> Can easily handle fast, high-quality 8B parameter models (like Llama 3 or Qwen). This is the sweet spot for a group of 5–10 friends.</li>
                <li><strong>High-End Setups (Heavy GPUs or Mac Studio):</strong> Can comfortably host 32B+ parameter models for noticeably smarter, complex reasoning.</li>
            </ul>

            <p>
                In short, you don&apos;t need to buy anything new to try it. Fireside will gladly run on what you already have.
            </p>
        </>
    );
}
