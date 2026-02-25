export default function FAQ() {
    return (
        <>
            <h1>FAQ</h1>

            {/* ---- General ---- */}

            <details>
                <summary>What is Fireside?</summary>
                <div className="faq-answer">
                    <p>
                        Fireside turns a computer you own into a private AI server. You install it, pick an AI model, and get
                        a link you can share with family, friends, or teammates. They open the link in their browser and start
                        chatting — no installs, no accounts with big tech companies, no monthly fees.
                    </p>
                    <p>
                        Everything runs on your machine. Conversations never leave your hardware.
                    </p>
                </div>
            </details>

            <details>
                <summary>How is this different from ChatGPT, Claude, or Gemini?</summary>
                <div className="faq-answer">
                    <p>
                        Those services run on someone else&apos;s servers. Your conversations go through their infrastructure,
                        and you pay a monthly subscription for each person who uses it.
                    </p>
                    <p>
                        With Fireside, the AI runs on a computer you own. Your conversations stay on that machine. There&apos;s
                        no subscription — once you have the hardware, it&apos;s free for everyone you share it with.
                    </p>
                    <p>
                        The tradeoff is that the AI models you can run at home are generally not as capable as the latest
                        commercial models. But they&apos;re good and getting better fast — for most everyday questions, writing
                        help, and coding tasks, they work well.
                    </p>
                </div>
            </details>

            <details>
                <summary>How is this different from Ollama, Open WebUI, or LM Studio?</summary>
                <div className="faq-answer">
                    <p>
                        Those are great tools, and Fireside actually uses Ollama under the hood to run AI models. The difference
                        is what happens after the model is running.
                    </p>
                    <p>
                        Ollama and LM Studio are designed for one person on one computer. If you want to share access with
                        others, you need to figure out networking, user accounts, and security yourself — usually by stitching
                        together multiple tools.
                    </p>
                    <p>
                        Fireside handles all of that for you. It gives you user accounts, invite links, a chat interface,
                        encrypted connections, and a public URL — out of the box. You install one thing and your group can
                        start using it.
                    </p>
                </div>
            </details>

            {/* ---- Host ---- */}

            <details>
                <summary>What hardware do I need?</summary>
                <div className="faq-answer">
                    <p>
                        Any modern computer can run Fireside. What changes with better hardware is the size (and quality) of AI
                        models you can use.
                    </p>
                    <ul>
                        <li><strong>No dedicated GPU</strong> — You can run small models (1–3 billion parameters). Fine for
                            simple questions, summaries, and basic tasks. A good way to try it out.</li>
                        <li><strong>A gaming GPU (8–12 GB VRAM)</strong> — Runs 8B parameter models comfortably. This is the
                            sweet spot for most groups. Fast responses, good quality.</li>
                        <li><strong>A high-end GPU (24 GB VRAM) or Apple Silicon Mac</strong> — Runs 32B+ parameter models.
                            Noticeably smarter responses, handles complex reasoning well.</li>
                    </ul>
                    <p>
                        If you have a gaming PC or a recent Mac, you likely already have enough to get started.
                    </p>
                </div>
            </details>

            <details>
                <summary>What happens when my machine is off?</summary>
                <div className="faq-answer">
                    <p>
                        Your users won&apos;t be able to chat until it&apos;s back on. They&apos;ll see a clear offline message,
                        and the chat will automatically reconnect when your machine comes back — no manual refresh needed.
                    </p>
                    <p>
                        This is similar to how a Plex server works — when the computer is off, the library is unavailable.
                        For most groups, this is fine. If you want always-on access, a low-power machine like a Mac Mini
                        works well as a dedicated server (it draws about as much power as a light bulb).
                    </p>
                </div>
            </details>

            <details>
                <summary>How many people can use my server at once?</summary>
                <div className="faq-answer">
                    <p>
                        More than you&apos;d expect. AI chat is bursty — someone sends a message, waits for a response, reads
                        it, thinks, then sends another. The GPU is only busy during the response. Most of the time, it&apos;s idle.
                    </p>
                    <p>
                        In a group of 10 people, it&apos;s rare for more than 2–3 to be actively waiting for a response at the
                        same exact moment. A mid-range GPU handles that fine. If two requests do overlap, the second one just
                        takes a little longer — it doesn&apos;t fail.
                    </p>
                </div>
            </details>

            {/* ---- Client ---- */}

            <details>
                <summary>Do I need to install anything to use it?</summary>
                <div className="faq-answer">
                    <p>
                        No. If someone shared a Fireside server with you, all you need is a browser. Click the invite link,
                        pick a username and password, and you&apos;re in. Nothing to download, no app store, no sign-up with
                        any company.
                    </p>
                </div>
            </details>

            <details>
                <summary>Can I use it on my phone?</summary>
                <div className="faq-answer">
                    <p>
                        Yes. The chat interface works in any mobile browser — Safari, Chrome, Firefox, whatever you use. You
                        can also add it to your home screen for a more app-like experience.
                    </p>
                </div>
            </details>

            {/* ---- Privacy ---- */}

            <details>
                <summary>Is my data private? Who can see my conversations?</summary>
                <div className="faq-answer">
                    <p>
                        Your conversations are stored on the Host&apos;s machine and nowhere else. No data is sent to any
                        AI company, cloud provider, or to us.
                    </p>
                    <p>
                        Messages are encrypted in your browser before they travel over the internet. The networking layer
                        that carries the traffic only sees encrypted data — it cannot read your messages.
                    </p>
                </div>
            </details>

            <details>
                <summary>Can the Host read my messages?</summary>
                <div className="faq-answer">
                    <p>
                        Technically, yes. The Host&apos;s server needs to decrypt your messages to process them through the AI
                        model — that&apos;s how it generates a response. So the Host has access to the machine where your
                        conversations are stored.
                    </p>
                    <p>
                        This is an honest tradeoff. Fireside is designed for groups where you know and trust the Host — your
                        family, your friends, your team. It&apos;s the same trust model as staying at someone&apos;s house:
                        you trust them not to go through your things, even though they have the keys.
                    </p>
                </div>
            </details>

            <details>
                <summary>How does the encryption work?</summary>
                <div className="faq-answer">
                    <p>
                        When someone is invited, their invite link contains a unique encryption key (in the URL fragment — the
                        part after <code>#</code>). Browsers never send this part to any server, so the key stays between the
                        Host and the Client.
                    </p>
                    <p>
                        The Client&apos;s browser uses this key to encrypt every message before sending it. The Host&apos;s
                        server decrypts it, runs it through the AI model, encrypts the response, and sends it back. The
                        Client&apos;s browser decrypts the response to display it.
                    </p>
                    <p>
                        This means anyone in between — the internet provider, the tunnel service, anyone watching the
                        network — only sees encrypted data. Each user has their own key, so users are isolated from each other too.
                    </p>
                </div>
            </details>

            {/* ---- Developer ---- */}

            <details>
                <summary>Can I use Fireside with LangChain, Cursor, or other developer tools?</summary>
                <div className="faq-answer">
                    <p>
                        Yes. Fireside exposes an OpenAI-compatible API. Any tool that works with the OpenAI API can point at
                        your Fireside server instead — just change the base URL and use a Fireside API key.
                    </p>
                    <p>
                        This includes LangChain, Cursor, Continue.dev, Open WebUI, and the
                        standard <code>openai</code> Python library. The Host creates API keys from the admin dashboard.
                    </p>
                </div>
            </details>

            {/* ---- Project ---- */}

            <details>
                <summary>Is Fireside open source?</summary>
                <div className="faq-answer">
                    <p>
                        Yes. The full source code is available on <a href="https://github.com/mksadoughi/fireside" target="_blank" rel="noreferrer">GitHub</a> under
                        the AGPL-3.0 license. You can read the code, verify how encryption works, and build it yourself.
                    </p>
                </div>
            </details>

            <details>
                <summary>Is Fireside free?</summary>
                <div className="faq-answer">
                    <p>
                        Yes. The server software is free and will stay free. You just need your own hardware to run it on.
                    </p>
                </div>
            </details>
        </>
    );
}
