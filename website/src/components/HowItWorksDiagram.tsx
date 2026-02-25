export function HowItWorksDiagram() {
    return (
        <svg viewBox="0 0 800 420" fill="none" xmlns="http://www.w3.org/2000/svg"
            style={{ width: '100%', maxWidth: 680, margin: '2rem auto', display: 'block' }}>
            <defs>
                <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ff6b00" stopOpacity="0.08" />
                    <stop offset="60%" stopColor="#ff6b00" stopOpacity="0.03" />
                    <stop offset="100%" stopColor="#ff6b00" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="flame-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6b00" />
                    <stop offset="100%" stopColor="#ffb000" />
                </linearGradient>
            </defs>

            {/* Orbital rings */}
            <ellipse cx="400" cy="210" rx="290" ry="170" stroke="var(--foreground)" strokeOpacity="0.08" strokeWidth="1" fill="none" />
            <ellipse cx="400" cy="210" rx="185" ry="110" stroke="var(--foreground)" strokeOpacity="0.12" strokeWidth="1" fill="none" />

            {/* Core glow */}
            <circle cx="400" cy="210" r="140" fill="url(#core-glow)" />

            {/* HOST CENTER: Monitor with flame inside */}
            <g transform="translate(400, 200)">
                <rect x="-32" y="-32" width="64" height="46" rx="4" stroke="var(--foreground)" strokeOpacity="0.35" strokeWidth="1.8" fill="var(--foreground)" fillOpacity="0.04" />
                <line x1="0" y1="14" x2="0" y2="22" stroke="var(--foreground)" strokeOpacity="0.3" strokeWidth="1.8" />
                <line x1="-14" y1="22" x2="14" y2="22" stroke="var(--foreground)" strokeOpacity="0.3" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M0,-22 C0,-22 -12,-9 -12,4 C-12,10.6 -6.6,16 0,16 C6.6,16 12,10.6 12,4 C12,-9 0,-22 0,-22Z"
                    stroke="url(#flame-grad)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M0,-10 C0,-10 -5.5,-3.5 -5.5,3 C-5.5,6.3 -3,8.5 0,8.5 C3,8.5 5.5,6.3 5.5,3 C5.5,-3.5 0,-10 0,-10Z"
                    fill="#ff6b00" opacity="0.55" />
            </g>

            {/* Host labels */}
            <text x="400" y="240" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="11.5" fontWeight="600" fill="var(--foreground)" opacity="0.7">Your Computer</text>
            <text x="400" y="255" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="10" fill="var(--foreground)" opacity="0.4">AI models running locally</text>

            {/* CONNECTION LINES */}
            <line x1="355" y1="180" x2="200" y2="102" stroke="#00e5ff" strokeOpacity="0.6" strokeWidth="3" />
            <line x1="448" y1="183" x2="612" y2="110" stroke="#00e5ff" strokeOpacity="0.6" strokeWidth="3" />
            <line x1="355" y1="232" x2="175" y2="316" stroke="#00e5ff" strokeOpacity="0.6" strokeWidth="3" />
            <line x1="448" y1="232" x2="625" y2="316" stroke="#00e5ff" strokeOpacity="0.6" strokeWidth="3" />
            <line x1="400" y1="260" x2="400" y2="350" stroke="#00e5ff" strokeOpacity="0.6" strokeWidth="3" />

            {/* Lock icons */}
            {[[278, 141], [530, 147], [265, 274], [537, 274], [400, 308]].map(([x, y], i) => (
                <g key={i} transform={`translate(${x}, ${y})`}>
                    <rect x="-5.5" y="0" width="11" height="8.5" rx="2.5" stroke="#00e5ff" strokeOpacity="0.8" strokeWidth="1.3" fill="#00e5ff" fillOpacity="0.08" />
                    <path d="M-2.5,0 L-2.5,-3.5 A2.5,2.5 0 0,1 2.5,-3.5 L2.5,0" stroke="#00e5ff" strokeOpacity="0.8" strokeWidth="1.3" fill="none" />
                </g>
            ))}

            {/* Client 1: Phone — Ask anything */}
            <g transform="translate(175, 82)">
                <circle r="26" stroke="var(--foreground)" strokeOpacity="0.15" strokeWidth="1.5" fill="var(--foreground)" fillOpacity="0.04" />
                <rect x="-6" y="-10" width="12" height="20" rx="3" stroke="var(--foreground)" strokeOpacity="0.45" strokeWidth="1.3" fill="none" />
                <line x1="-2" y1="7" x2="2" y2="7" stroke="var(--foreground)" strokeOpacity="0.25" strokeWidth="0.8" />
            </g>
            <text x="175" y="122" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="12" fontWeight="600" fill="var(--foreground)" opacity="0.85">Ask anything</text>
            <text x="175" y="136" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="10.5" fill="var(--foreground)" opacity="0.5">Chat with AI</text>

            {/* Client 2: Laptop — Write & edit */}
            <g transform="translate(628, 90)">
                <circle r="26" stroke="var(--foreground)" strokeOpacity="0.15" strokeWidth="1.5" fill="var(--foreground)" fillOpacity="0.04" />
                <rect x="-10" y="-7" width="20" height="13" rx="2" stroke="var(--foreground)" strokeOpacity="0.45" strokeWidth="1.3" fill="none" />
                <line x1="-13" y1="8" x2="13" y2="8" stroke="var(--foreground)" strokeOpacity="0.35" strokeWidth="1.3" strokeLinecap="round" />
            </g>
            <text x="628" y="130" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="12" fontWeight="600" fill="var(--foreground)" opacity="0.85">Write &amp; edit</text>
            <text x="628" y="144" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="10.5" fill="var(--foreground)" opacity="0.5">Essays, emails, ideas</text>

            {/* Client 3: Tablet — Learn & explore */}
            <g transform="translate(152, 323)">
                <circle r="26" stroke="var(--foreground)" strokeOpacity="0.15" strokeWidth="1.5" fill="var(--foreground)" fillOpacity="0.04" />
                <rect x="-8" y="-10" width="16" height="22" rx="2.5" stroke="var(--foreground)" strokeOpacity="0.45" strokeWidth="1.3" fill="none" />
                <line x1="-3" y1="9" x2="3" y2="9" stroke="var(--foreground)" strokeOpacity="0.25" strokeWidth="0.8" />
            </g>
            <text x="152" y="362" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="12" fontWeight="600" fill="var(--foreground)" opacity="0.85">Learn &amp; explore</text>
            <text x="152" y="376" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="10.5" fill="var(--foreground)" opacity="0.5">Summarize, research</text>

            {/* Client 4: Desktop — Generate code */}
            <g transform="translate(648, 323)">
                <circle r="26" stroke="var(--foreground)" strokeOpacity="0.15" strokeWidth="1.5" fill="var(--foreground)" fillOpacity="0.04" />
                <rect x="-10" y="-9" width="20" height="14" rx="2" stroke="var(--foreground)" strokeOpacity="0.45" strokeWidth="1.3" fill="none" />
                <line x1="0" y1="5" x2="0" y2="9" stroke="var(--foreground)" strokeOpacity="0.3" strokeWidth="1.2" />
                <line x1="-5" y1="9" x2="5" y2="9" stroke="var(--foreground)" strokeOpacity="0.3" strokeWidth="1.2" strokeLinecap="round" />
            </g>
            <text x="648" y="362" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="12" fontWeight="600" fill="var(--foreground)" opacity="0.85">Generate code</text>
            <text x="648" y="376" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="10.5" fill="var(--foreground)" opacity="0.5">Debug &amp; review</text>

            {/* Client 5: Terminal — Build agents */}
            <g transform="translate(400, 365)">
                <circle r="24" stroke="var(--foreground)" strokeOpacity="0.15" strokeWidth="1.5" fill="var(--foreground)" fillOpacity="0.04" />
                <path d="M-6,-4 L-1,0 L-6,4" stroke="var(--foreground)" strokeOpacity="0.45" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="1" y1="4" x2="7" y2="4" stroke="var(--foreground)" strokeOpacity="0.45" strokeWidth="1.4" strokeLinecap="round" />
            </g>
            <text x="400" y="401" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="12" fontWeight="600" fill="var(--foreground)" opacity="0.85">Build agents</text>
            <text x="400" y="415" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="10.5" fill="var(--foreground)" opacity="0.5">LangChain, Cursor, API</text>
        </svg>
    );
}
