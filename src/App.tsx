import { useState, useEffect } from "react";
import { Bot, MessageSquare, Shield, Activity, Terminal, ExternalLink, Github, Settings, FileCode, Folder, ChevronRight, Circle } from "lucide-react";
import { motion } from "motion/react";

export default function App() {
  const [status, setStatus] = useState("Checking...");
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then(() => setStatus("Online"))
      .catch(() => setStatus("Offline"));

    setLogs([
      "Initializing ELIAKIM MD Bot...",
      "Session restored successfully.",
      "Connecting to WhatsApp...",
      "Bot is now Online and ready.",
      "Listening for events...",
    ]);
  }, []);

  return (
    <div className="flex h-screen bg-gh-bg text-gh-text overflow-hidden font-sans">
      {/* Sidebar - Repository Style */}
      <aside className="w-64 bg-gh-sidebar border-r border-gh-border flex flex-col shrink-0">
        <div className="p-4 border-b border-gh-border flex items-center gap-2 font-semibold text-sm">
          <Circle size={10} fill="currentColor" className="text-gh-success" />
          ELIAKIM MD — REPO
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-6 scrollbar-thin">
          <FileItem name="config.js" active />
          <FileItem name="package.json" />
          <FileItem name=".gitignore" />
          <FolderItem name=".github">
            <FileItem name="bot.yml" indent />
          </FolderItem>
          <FolderItem name="src">
            <FileItem name="index.js" indent />
            <FileItem name="handler.js" indent />
            <FolderItem name="features" indent>
              <FileItem name="antilink.js" indent />
              <FileItem name="viewonce.js" indent />
            </FolderItem>
          </FolderItem>
        </div>

        <nav className="p-4 border-t border-gh-border space-y-1">
          <NavItem icon={<Activity size={16} />} label="Actions" />
          <NavItem icon={<Settings size={16} />} label="Settings" />
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar - Tabs Style */}
        <header className="h-12 border-b border-gh-border flex items-center px-4 bg-gh-bg">
          <div className="flex h-full items-center gap-6 text-[13px]">
            <div className="h-full border-b-2 border-[#f78166] flex items-center px-1 font-medium">config.js</div>
            <div className="text-gh-muted hover:text-gh-text cursor-pointer transition-colors">workflow/bot.yml</div>
            <div className="text-gh-muted hover:text-gh-text cursor-pointer transition-colors">src/handler.js</div>
          </div>
          <div className="ml-auto text-gh-muted text-xs">
            Owner: <span className="font-mono">254739320033</span>
          </div>
        </header>

        {/* Editor/Dashboard Canvas */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
          <header>
            <h1 className="text-xl font-normal text-gh-text mb-1 tracking-tight">Configuration Settings</h1>
            <p className="text-gh-muted text-sm">Review your environment variables and core bot parameters.</p>
          </header>

          {/* Code Block Display */}
          <div className="bg-[#010409] border border-gh-border rounded-lg p-6 font-mono text-[13px] leading-relaxed relative group shadow-inner">
            <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <span className="text-[10px] text-gh-muted">TypeScript</span>
               <Terminal size={14} className="text-gh-muted" />
            </div>
            <div className="text-gh-muted italic font-light">// ELIAKIM MD — CONFIG FILE</div>
            <div className="text-gh-muted italic font-light">// Only edit this file. Nothing else needs to be touched.</div>
            <br />
            <div>
              <span className="text-[#ff7b72]">const</span> config = {"{"}
            </div>
            <div className="pl-6">
              <div><span className="text-gh-accent">OWNER_NUMBER</span>: <span className="text-[#a5d6ff]">"254739320033"</span>,</div>
              <div><span className="text-gh-accent">SESSION_ID</span>: <span className="text-[#a5d6ff]">"KnightBot!H4sIAAA..."</span>,</div>
              <div><span className="text-gh-accent">BOT_NAME</span>: <span className="text-[#a5d6ff]">"ELIAKIM MD"</span>,</div>
              <div><span className="text-gh-accent">PREFIX</span>: <span className="text-[#a5d6ff]">"."</span></div>
            </div>
            <div>{"}"};</div>
            <br />
            <div><span className="text-[#ff7b72]">export default</span> config;</div>
          </div>

          {/* Feature Toggles & Health */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gh-border bg-gh-sidebar p-5 rounded-lg shadow-sm">
              <div className="text-[11px] font-bold text-gh-muted uppercase tracking-wider mb-4">Active Core Features</div>
              <div className="space-y-3">
                <FeatureRow label="Anti-Delete" status="ENABLED" active />
                <FeatureRow label="Anti-Link" status="ENABLED" active />
                <FeatureRow label="Status Mention" status="ENABLED" active />
                <FeatureRow label="View Once Bypass" status="RESTRICTED" />
              </div>
            </div>

            <div className="border border-gh-border bg-gh-sidebar p-5 rounded-lg shadow-sm flex flex-col justify-between">
              <div className="text-[11px] font-bold text-gh-muted uppercase tracking-wider">Bot Statistics</div>
              <div className="py-6 text-center">
                <div className="text-5xl font-light text-gh-text tracking-tighter">99.9%</div>
                <div className="text-[11px] text-gh-muted mt-2 tracking-widest uppercase">Uptime (24/7 Workflow)</div>
              </div>
              <div className="text-[10px] text-gh-muted text-center pt-2 border-t border-gh-border/50">
                Last Heartbeat: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Activity/Logs Terminal */}
          <div className="bg-[#010409] border border-gh-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gh-sidebar border-b border-gh-border flex items-center gap-2">
              <Terminal size={14} className="text-gh-muted" />
              <span className="text-xs font-medium text-gh-muted">Console Output</span>
            </div>
            <div className="p-4 font-mono text-[12px] h-48 overflow-y-auto space-y-1 text-gh-muted scrollbar-thin">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-gh-border shrink-0">{i + 1}</span>
                  <span className={log.includes("successfully") ? "text-gh-success" : ""}>{log}</span>
                </div>
              ))}
              <div className="inline-block w-1.5 h-4 bg-gh-accent align-middle animate-pulse ml-1" />
            </div>
          </div>
        </div>

        {/* Global Footer Stats */}
        <footer className="h-14 border-t border-gh-border bg-gh-sidebar flex items-center px-6 gap-8 overflow-x-auto scrollbar-none">
          <Stat label="Session Status" value="ACTIVE" badge="LIVE" color="success" />
          <div className="w-px h-6 bg-gh-border" />
          <Stat label="Latency" value="42ms" color="accent" />
          <div className="w-px h-6 bg-gh-border" />
          <Stat label="Commands" value="14 Loaded" />
          <div className="w-px h-6 bg-gh-border" />
          <Stat label="Version" value="v2.0.4-stable" muted />
        </footer>
      </main>
    </div>
  );
}

function NavItem({ icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 text-gh-muted hover:text-gh-text cursor-pointer p-2 rounded-md transition-colors text-sm">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function FileItem({ name, active = false, indent = false }: { name: string; active?: boolean; indent?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group transition-colors ${
      active ? "bg-gh-accent/10 text-gh-accent" : "hover:bg-gh-border/30 text-gh-text"
    } ${indent ? "ml-4" : ""}`}>
      <FileCode size={14} className={active ? "text-gh-accent" : "text-gh-muted group-hover:text-gh-text"} />
      <span>{name}</span>
    </div>
  );
}

function FolderItem({ name, children, indent = false }: { name: string; children: React.ReactNode; indent?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={indent ? "ml-4" : ""}>
      <div 
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gh-border/30 text-gh-accent font-bold"
      >
        <ChevronRight size={14} className={`transform transition-transform ${open ? 'rotate-90' : ''}`} />
        <Folder size={14} fill="currentColor" className="opacity-80" />
        <span>{name}/</span>
      </div>
      {open && children}
    </div>
  );
}

function FeatureRow({ label, status, active = false }: { label: string; status: string; active?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gh-text">{label}</span>
      <span className={active ? "text-gh-success" : "text-gh-danger"}>{status}</span>
    </div>
  );
}

function Stat({ label, value, badge, color, muted }: { label: string; value: string; badge?: string; color?: "success" | "accent"; muted?: boolean }) {
  return (
    <div className="flex flex-col min-w-fit">
      <span className="text-[10px] uppercase text-gh-muted tracking-wide mb-0.5">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold tracking-tight ${
          color === "success" ? "text-gh-success" : 
          color === "accent" ? "text-gh-accent" : 
          muted ? "text-gh-muted" : "text-gh-text"
        }`}>{value}</span>
        {badge && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-gh-success bg-gh-success/10 text-gh-success font-bold">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
